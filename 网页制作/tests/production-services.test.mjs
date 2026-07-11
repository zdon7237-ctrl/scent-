import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEmailIdempotencyKey,
  createEmailService,
  EmailDeliveryError
} from "../server/src/services/email-service.mjs";
import {
  buildLoginRateLimitKeys,
  createLoginRateLimiter
} from "../server/src/services/login-rate-limiter.mjs";
import {
  buildProductImagePath,
  createProductImageStorage,
  validateProductImageBlobUrl,
  validateProductImageUpload
} from "../server/src/services/product-image-storage.mjs";
import {
  createErrorReporter,
  createLogger,
  redactSensitive
} from "../server/src/services/observability.mjs";
import { ServiceConfigurationError } from "../server/src/services/runtime-config.mjs";

function captureLogger() {
  const events = [];
  return {
    events,
    debug(message, fields) { events.push({ level: "debug", message, fields }); },
    info(message, fields) { events.push({ level: "info", message, fields }); },
    warn(message, fields) { events.push({ level: "warn", message, fields }); },
    error(message, fields) { events.push({ level: "error", message, fields }); }
  };
}

function pngBytes(size = 32) {
  const bytes = Buffer.alloc(size);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  return bytes;
}

describe("email service", () => {
  it("builds deterministic keys without exposing stable business identifiers", () => {
    const first = buildEmailIdempotencyKey("password-reset", ["user@example.com", "secret-token"]);
    const second = buildEmailIdempotencyKey("password-reset", ["user@example.com", "secret-token"]);
    const different = buildEmailIdempotencyKey("password-reset", ["user@example.com", "new-token"]);

    assert.equal(first, second);
    assert.notEqual(first, different);
    assert.doesNotMatch(first, /user@example|secret-token/);
  });

  it("fails fast when production delivery configuration is missing", () => {
    assert.throws(
      () => createEmailService({ env: { DEPLOYMENT_ENV: "production" } }),
      (error) => error instanceof ServiceConfigurationError
        && error.missing.includes("RESEND_API_KEY")
        && error.missing.includes("EMAIL_FROM")
    );
  });

  it("records a skipped delivery in local development without loading the SDK", async () => {
    const logger = captureLogger();
    let clientLoaded = false;
    const service = createEmailService({
      env: { DEPLOYMENT_ENV: "development" },
      logger,
      clientFactory: async () => {
        clientLoaded = true;
        throw new Error("should not load");
      }
    });

    const result = await service.sendOrderConfirmation({
      to: "buyer@example.com",
      orderId: "order-1",
      orderNumber: "FY-1",
      totalCents: 19900
    });

    assert.equal(result.status, "skipped");
    assert.equal(clientLoaded, false);
    assert.equal(logger.events[0].message, "email.delivery_skipped");
    assert.doesNotMatch(JSON.stringify(logger.events), /buyer@example\.com/);
  });

  it("sends verification, reset, order, and shipment messages through Resend", async () => {
    const calls = [];
    const client = {
      emails: {
        async send(payload, options) {
          calls.push({ payload, options });
          return { data: { id: `email-${calls.length}` }, error: null };
        }
      }
    };
    const service = createEmailService({
      env: { DEPLOYMENT_ENV: "production" },
      apiKey: "re_test",
      from: "馥屿 <orders@example.com>",
      logger: captureLogger(),
      clientFactory: async () => client
    });

    await service.sendVerification({
      to: "buyer@example.com",
      name: "<Buyer>",
      userId: "user-1",
      verificationId: "verification-1",
      verificationUrl: "https://example.com/verify?id=1"
    });
    await service.sendPasswordReset({
      to: "buyer@example.com",
      userId: "user-1",
      resetId: "reset-1",
      resetUrl: "https://example.com/reset?id=1"
    });
    const orderResult = await service.sendOrderConfirmation({
      to: "buyer@example.com",
      orderId: "order-1",
      orderNumber: "FY-1",
      totalCents: 19900
    });
    await service.sendShipmentNotification({
      to: "buyer@example.com",
      orderId: "order-1",
      orderNumber: "FY-1",
      shipmentId: "shipment-1",
      carrier: "顺丰速运",
      trackingNumber: "SF123",
      trackingUrl: "https://example.com/tracking/SF123"
    });

    assert.equal(calls.length, 4);
    assert.equal(orderResult.status, "sent");
    assert.equal(orderResult.providerMessageId, "email-3");
    assert.equal(calls[0].payload.to, "buyer@example.com");
    assert.match(calls[0].payload.html, /&lt;Buyer&gt;/);
    assert.doesNotMatch(calls[0].payload.html, /<Buyer>/);
    const keys = calls.map((call) => call.options.headers["Idempotency-Key"]);
    assert.deepEqual(calls.map((call) => call.options.idempotencyKey), keys);
    assert.equal(new Set(keys).size, 4);
    assert.equal(keys[2], orderResult.idempotencyKey);
  });

  it("wraps provider failures with an actionable delivery error", async () => {
    const service = createEmailService({
      env: { DEPLOYMENT_ENV: "development" },
      apiKey: "re_test",
      from: "orders@example.com",
      logger: captureLogger(),
      clientFactory: async () => ({
        emails: { send: async () => ({ error: { message: "provider rejected" } }) }
      })
    });

    await assert.rejects(
      service.sendOrderConfirmation({
        to: "buyer@example.com",
        orderId: "order-1",
        totalCents: 100
      }),
      (error) => error instanceof EmailDeliveryError && /provider rejected/.test(error.message)
    );
  });
});

describe("product image storage", () => {
  it("validates MIME, content signature, size, and generated product paths", async () => {
    const result = await validateProductImageUpload({
      body: pngBytes(),
      contentType: "image/png",
      maxBytes: 100
    });
    assert.deepEqual(result, { contentType: "image/png", extension: "png", size: 32 });
    assert.equal(
      buildProductImagePath({
        productId: "product-1",
        fileName: "Front bottle.PNG",
        contentType: "image/png",
        uniqueId: "upload-1"
      }),
      "products/product-1/upload1-Front-bottle.png"
    );

    await assert.rejects(
      validateProductImageUpload({ body: pngBytes(), contentType: "image/jpeg" }),
      /content is image\/png, not image\/jpeg/
    );
    await assert.rejects(
      validateProductImageUpload({ body: pngBytes(64), contentType: "image/png", maxBytes: 32 }),
      /exceeds/
    );
    assert.throws(
      () => buildProductImagePath({ productId: "../outside", contentType: "image/png" }),
      /invalid path characters/
    );
  });

  it("fails fast without a production Blob token", () => {
    assert.throws(
      () => createProductImageStorage({ env: { DEPLOYMENT_ENV: "production" } }),
      (error) => error instanceof ServiceConfigurationError
        && error.missing.includes("BLOB_READ_WRITE_TOKEN")
    );
  });

  it("uploads and deletes only validated product Blob objects", async () => {
    const calls = [];
    const storage = createProductImageStorage({
      env: { DEPLOYMENT_ENV: "development" },
      token: "blob-token",
      logger: captureLogger(),
      idGenerator: () => "upload-1",
      loadBlob: async () => ({
        async put(pathname, body, options) {
          calls.push({ method: "put", pathname, body, options });
          return {
            url: `https://store.public.blob.vercel-storage.com/${pathname}`,
            pathname
          };
        },
        async del(url, options) {
          calls.push({ method: "del", url, options });
        }
      })
    });

    const uploaded = await storage.upload({
      productId: "product-1",
      fileName: "front.png",
      contentType: "image/png",
      body: pngBytes()
    });
    const removed = await storage.remove({ url: uploaded.url });

    assert.equal(uploaded.pathname, "products/product-1/upload1-front.png");
    assert.equal(uploaded.size, 32);
    assert.equal(calls[0].options.access, "public");
    assert.equal(calls[0].options.token, "blob-token");
    assert.deepEqual(removed, { deleted: true, url: uploaded.url });
    assert.equal(calls[1].method, "del");
  });

  it("rejects deletion outside the product Blob namespace", () => {
    assert.throws(
      () => validateProductImageBlobUrl("https://example.com/products/a/image.jpg"),
      /Vercel Blob/
    );
    assert.throws(
      () => validateProductImageBlobUrl("https://store.public.blob.vercel-storage.com/avatars/a.jpg"),
      /outside the products path/
    );
  });

  it("loads the Blob SDK lazily and reports an actionable missing-SDK error", async () => {
    let loads = 0;
    const storage = createProductImageStorage({
      env: { DEPLOYMENT_ENV: "development" },
      token: "blob-token",
      logger: captureLogger(),
      loadBlob: async () => {
        loads += 1;
        throw new Error("module not found");
      }
    });

    assert.equal(loads, 0);
    await assert.rejects(
      storage.upload({
        productId: "product-1",
        fileName: "front.png",
        contentType: "image/png",
        body: pngBytes()
      }),
      (error) => error.code === "BLOB_SDK_UNAVAILABLE" && /@vercel\/blob/.test(error.message)
    );
    assert.equal(loads, 1);
  });
});

describe("login rate limiter", () => {
  it("hashes account and IP identifiers in storage keys", () => {
    const keys = buildLoginRateLimitKeys({
      login: "Buyer@Example.com",
      ip: "203.0.113.9",
      scope: "member"
    });
    const serialized = JSON.stringify(keys);
    assert.equal(keys.length, 2);
    assert.doesNotMatch(serialized, /buyer@example\.com|203\.0\.113\.9/i);
  });

  it("requires distributed storage in production and rejects partial Upstash config", () => {
    assert.throws(
      () => createLoginRateLimiter({ env: { DEPLOYMENT_ENV: "production" } }),
      (error) => error instanceof ServiceConfigurationError
        && error.missing.includes("UPSTASH_REDIS_REST_URL")
    );
    assert.throws(
      () => createLoginRateLimiter({
        env: { DEPLOYMENT_ENV: "development", UPSTASH_REDIS_REST_URL: "https://redis.test" }
      }),
      /configured together/
    );
  });

  it("uses a resettable in-memory fixed window only outside production", async () => {
    let timestamp = Date.parse("2026-01-01T00:00:00.000Z");
    const limiter = createLoginRateLimiter({
      env: { DEPLOYMENT_ENV: "development" },
      logger: captureLogger(),
      clock: () => timestamp,
      windowMs: 1000,
      accountLimit: 2,
      ipLimit: 3
    });
    const input = { login: "buyer@example.com", ip: "203.0.113.9" };

    assert.equal((await limiter.consume(input)).allowed, true);
    assert.equal((await limiter.consume(input)).allowed, true);
    const blocked = await limiter.consume(input);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfterMs, 1000);
    assert.deepEqual(blocked.buckets.filter((item) => !item.allowed).map((item) => item.dimension), ["account"]);

    await limiter.clear(input);
    const ipStillBlocked = await limiter.consume(input);
    assert.equal(ipStillBlocked.allowed, false);
    assert.deepEqual(ipStillBlocked.buckets.filter((item) => !item.allowed).map((item) => item.dimension), ["ip"]);

    await limiter.clear(input, { dimensions: ["account", "ip"] });
    assert.equal((await limiter.consume(input)).allowed, true);
    timestamp += 1001;
    assert.equal((await limiter.consume(input)).allowed, true);
  });

  it("uses atomic Upstash REST scripts when configured", async () => {
    const calls = [];
    const limiter = createLoginRateLimiter({
      env: {
        DEPLOYMENT_ENV: "production",
        UPSTASH_REDIS_REST_URL: "https://redis.example.com/",
        UPSTASH_REDIS_REST_TOKEN: "redis-token"
      },
      logger: captureLogger(),
      clock: () => Date.parse("2026-01-01T00:00:00.000Z"),
      fetch: async (url, options) => {
        calls.push({ url, options });
        return new Response(JSON.stringify({ result: [1, 60_000] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
    });

    const result = await limiter.consume({ login: "buyer@example.com", ip: "203.0.113.9" });
    assert.equal(result.backend, "upstash");
    assert.equal(result.allowed, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "https://redis.example.com");
    assert.equal(calls[0].options.headers.authorization, "Bearer redis-token");
    const command = JSON.parse(calls[0].options.body);
    assert.equal(command[0], "EVAL");
    assert.match(command[1], /PEXPIRE/);
    assert.doesNotMatch(calls[0].options.body, /buyer@example\.com|203\.0\.113\.9/);
  });
});

describe("observability foundation", () => {
  it("emits one-line JSON and redacts nested credentials", () => {
    const lines = [];
    const logger = createLogger({
      env: { DEPLOYMENT_ENV: "preview" },
      service: "test-service",
      clock: () => new Date("2026-01-01T00:00:00.000Z"),
      write: (level, line) => lines.push({ level, line })
    });
    logger.error("request.failed", {
      requestId: "request-1",
      password: "secret",
      privateKey: "private-key",
      verificationCode: "123456",
      nested: { authorization: "Bearer token" },
      error: Object.assign(new Error("boom"), { code: "BOOM" })
    });

    assert.equal(lines.length, 1);
    const payload = JSON.parse(lines[0].line);
    assert.equal(payload.level, "error");
    assert.equal(payload.service, "test-service");
    assert.equal(payload.environment, "preview");
    assert.equal(payload.password, "[REDACTED]");
    assert.equal(payload.privateKey, "[REDACTED]");
    assert.equal(payload.verificationCode, "[REDACTED]");
    assert.equal(payload.nested.authorization, "[REDACTED]");
    assert.equal(payload.error.code, "BOOM");
    assert.doesNotMatch(lines[0].line, /Bearer token|"secret"/);
  });

  it("handles circular values while preserving non-sensitive context", () => {
    const value = { orderId: "order-1", sessionToken: "secret" };
    value.self = value;
    assert.deepEqual(redactSensitive(value), {
      orderId: "order-1",
      sessionToken: "[REDACTED]",
      self: "[Circular]"
    });
  });

  it("always logs errors and optionally forwards a sanitized webhook", async () => {
    const logger = captureLogger();
    const requests = [];
    const reporter = createErrorReporter({
      env: { DEPLOYMENT_ENV: "production" },
      webhookUrl: "https://alerts.example.com/errors",
      webhookToken: "alert-token",
      logger,
      idGenerator: () => "incident-1",
      clock: () => new Date("2026-01-01T00:00:00.000Z"),
      fetch: async (url, options) => {
        requests.push({ url, options });
        return new Response(null, { status: 204 });
      }
    });

    const result = await reporter.capture(new Error("checkout failed"), {
      orderId: "order-1",
      paymentToken: "do-not-send"
    });

    assert.deepEqual(result, { incidentId: "incident-1", reported: true, transport: "webhook" });
    assert.equal(logger.events[0].message, "application.error");
    assert.equal(requests[0].options.headers.authorization, "Bearer alert-token");
    const body = JSON.parse(requests[0].options.body);
    assert.equal(body.context.orderId, "order-1");
    assert.equal(body.context.paymentToken, "[REDACTED]");
    assert.doesNotMatch(requests[0].options.body, /do-not-send/);
  });

  it("does not let an alerting outage replace the application error", async () => {
    const logger = captureLogger();
    const reporter = createErrorReporter({
      env: { DEPLOYMENT_ENV: "development" },
      webhookUrl: "https://alerts.example.com/errors",
      logger,
      idGenerator: () => "incident-2",
      fetch: async () => new Response("down", { status: 503 })
    });

    const result = await reporter.capture(new Error("boom"));
    assert.equal(result.reported, false);
    assert.equal(result.transport, "runtime-log");
    assert.equal(logger.events.at(-1).message, "error_report.webhook_failed");
  });
});
