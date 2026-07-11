import assert from "node:assert/strict";
import {
  createCipheriv,
  generateKeyPairSync,
  randomBytes,
  sign as rsaSign,
  verify as rsaVerify
} from "node:crypto";
import { describe, it } from "node:test";
import {
  assertWechatPayConfig,
  assertWechatPayTransaction,
  buildJsapiPaymentParameters,
  buildWechatPaySignatureMessage,
  createWechatPayClient,
  decryptWechatPayResource,
  extractWechatPayEventIdentifiers,
  validateWechatPayConfig,
  validateWechatPayTransaction,
  verifyAndDecryptWechatPayCallback,
  verifyWechatPayCallbackSignature,
  WECHAT_PAY_API_BASE_URL,
  WECHAT_PAY_RESOURCE_ALGORITHM,
  WECHAT_PAY_SIGNATURE_SCHEME
} from "../server/src/wechat-pay.mjs";

function rsaKeys() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
    publicKey: publicKey.export({ type: "spki", format: "pem" })
  };
}

const merchantKeys = rsaKeys();
const platformKeys = rsaKeys();
const otherPlatformKeys = rsaKeys();
const fixedNow = Date.UTC(2026, 6, 10, 8, 0, 0);
const fixedTimestamp = Math.floor(fixedNow / 1000);
const apiV3Key = randomBytes(24).toString("base64");
const merchantSerialNumber = randomBytes(10).toString("hex").toUpperCase();
const platformSerialNumber = randomBytes(10).toString("hex").toUpperCase();
const mchid = Array.from(randomBytes(10), (byte) => String(byte % 10)).join("");
const appid = `wx${randomBytes(8).toString("hex")}`;

function config(overrides = {}) {
  return {
    mchid,
    appid,
    merchantSerialNumber,
    merchantPrivateKey: merchantKeys.privateKey,
    apiV3Key,
    notifyUrl: "https://payments.example.test/wechat/callback",
    platformCertificates: [
      {
        serialNumber: platformSerialNumber,
        publicKey: platformKeys.publicKey
      }
    ],
    ...overrides
  };
}

function parseAuthorization(value) {
  const [scheme, fields] = value.split(" ", 2);
  return {
    scheme,
    fields: Object.fromEntries(
      fields.split(",").map((entry) => {
        const match = entry.match(/^([^=]+)="(.*)"$/);
        assert.ok(match, `invalid authorization field: ${entry}`);
        return [match[1], match[2]];
      })
    )
  };
}

function assertRequestSignature(request) {
  const authorization = parseAuthorization(request.init.headers.Authorization);
  assert.equal(authorization.scheme, WECHAT_PAY_SIGNATURE_SCHEME);
  assert.equal(authorization.fields.mchid, mchid);
  assert.equal(authorization.fields.serial_no, merchantSerialNumber);
  assert.equal(authorization.fields.timestamp, String(fixedTimestamp));
  const url = new URL(request.url);
  const message = `${request.init.method}\n${url.pathname}${url.search}\n${authorization.fields.timestamp}\n${authorization.fields.nonce_str}\n${request.init.body || ""}\n`;
  assert.equal(
    rsaVerify(
      "RSA-SHA256",
      Buffer.from(message),
      merchantKeys.publicKey,
      Buffer.from(authorization.fields.signature, "base64")
    ),
    true
  );
}

function recordingClient() {
  const requests = [];
  return {
    requests,
    client: createWechatPayClient(config(), {
      production: true,
      now: () => fixedNow,
      nonce: () => "fixed-request-nonce",
      httpClient: async (url, init) => {
        const request = { url, init };
        requests.push(request);
        return request;
      }
    })
  };
}

function encryptResource(resource, associatedData = "transaction") {
  const nonce = randomBytes(12).toString("base64url").slice(0, 12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(apiV3Key), Buffer.from(nonce));
  cipher.setAAD(Buffer.from(associatedData));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(resource), "utf8"),
    cipher.final(),
    cipher.getAuthTag()
  ]).toString("base64");
  return {
    algorithm: WECHAT_PAY_RESOURCE_ALGORITHM,
    associated_data: associatedData,
    nonce,
    ciphertext,
    original_type: "transaction"
  };
}

function signedCallback(resource, overrides = {}) {
  const event = {
    id: `event-${randomBytes(8).toString("hex")}`,
    create_time: new Date(fixedNow).toISOString(),
    event_type: "TRANSACTION.SUCCESS",
    resource_type: "encrypt-resource",
    summary: "payment succeeded",
    resource: encryptResource(resource),
    ...overrides.event
  };
  const rawBody = JSON.stringify(event);
  const nonce = "callback-nonce";
  const message = `${fixedTimestamp}\n${nonce}\n${rawBody}\n`;
  const signature = rsaSign("RSA-SHA256", Buffer.from(message), platformKeys.privateKey).toString("base64");
  return {
    event,
    rawBody,
    headers: {
      "wechatpay-timestamp": String(fixedTimestamp),
      "Wechatpay-Nonce": nonce,
      "WECHATPAY-SIGNATURE": signature,
      "wechatpay-serial": overrides.serialNumber || platformSerialNumber
    }
  };
}

describe("WeChat Pay configuration", () => {
  it("accepts complete production configuration and normalizes PEM newlines", () => {
    const escapedPrivateKey = String(merchantKeys.privateKey).replaceAll("\n", "\\n");
    const result = validateWechatPayConfig(config({
      merchantPrivateKey: escapedPrivateKey,
      apiBaseUrl: `${WECHAT_PAY_API_BASE_URL}/`
    }), { production: true });
    assert.equal(result.valid, true, result.errors.join("; "));
    assert.match(result.config.merchantPrivateKey, /BEGIN PRIVATE KEY/);
    assert.equal(result.config.apiBaseUrl, WECHAT_PAY_API_BASE_URL);
    assert.equal(assertWechatPayConfig(config(), { production: true }).apiBaseUrl, WECHAT_PAY_API_BASE_URL);
  });

  it("reports missing, malformed, insecure, and duplicate production settings without exposing secrets", () => {
    const result = validateWechatPayConfig({
      mchid: "dummy",
      appid: "wx-invalid",
      merchantSerialNumber: "not-hex",
      merchantPrivateKey: "not-a-private-key",
      apiV3Key: "too-short",
      notifyUrl: "http://localhost/callback",
      apiBaseUrl: "http://localhost:8080",
      platformCertificates: [
        { serialNumber: "ABC123", publicKey: platformKeys.publicKey },
        { serialNumber: "abc123", publicKey: otherPlatformKeys.publicKey }
      ]
    }, { production: true });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes("mchid")));
    assert.ok(result.errors.some((error) => error.includes("appid")));
    assert.ok(result.errors.some((error) => error.includes("merchantPrivateKey")));
    assert.ok(result.errors.some((error) => error.includes("apiV3Key")));
    assert.ok(result.errors.some((error) => error.includes("HTTPS")));
    assert.ok(result.errors.some((error) => error.includes("duplicated")));
    assert.throws(() => assertWechatPayConfig({}, { production: true }), { name: "WechatPayConfigError" });
    assert.doesNotMatch(result.errors.join(" "), /too-short/);
  });
});

describe("WeChat Pay signed requests", () => {
  it("uses the exact API v3 request signature message format", () => {
    assert.equal(
      buildWechatPaySignatureMessage("GET", "/v3/pay/transactions/id/1?mchid=2", 1710000000, "nonce_1"),
      "GET\n/v3/pay/transactions/id/1?mchid=2\n1710000000\nnonce_1\n\n"
    );
  });

  it("constructs and signs JSAPI and H5 order requests", async () => {
    const { client, requests } = recordingClient();
    await client.createJsapiOrder({
      description: "馥屿试香订单",
      outTradeNo: "ORDER_JSAPI_1",
      total: 19600,
      openid: "openid-for-current-user",
      attach: "member-order-1"
    });
    await client.createH5Order({
      description: "馥屿香水订单",
      outTradeNo: "ORDER_H5_1",
      total: 52000,
      payerClientIp: "203.0.113.10",
      h5Type: "Wap",
      appName: "馥屿"
    });

    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, `${WECHAT_PAY_API_BASE_URL}/v3/pay/transactions/jsapi`);
    assert.deepEqual(JSON.parse(requests[0].init.body), {
      appid,
      mchid,
      description: "馥屿试香订单",
      out_trade_no: "ORDER_JSAPI_1",
      notify_url: "https://payments.example.test/wechat/callback",
      amount: { total: 19600, currency: "CNY" },
      attach: "member-order-1",
      payer: { openid: "openid-for-current-user" }
    });
    assert.deepEqual(JSON.parse(requests[1].init.body).scene_info, {
      payer_client_ip: "203.0.113.10",
      h5_info: { type: "Wap", app_name: "馥屿" }
    });
    for (const request of requests) assertRequestSignature(request);
  });

  it("builds the signed parameters required to invoke JSAPI payment", () => {
    const parameters = buildJsapiPaymentParameters(config(), {
      prepayId: "wx-prepay-id-from-api",
      timestamp: fixedTimestamp,
      nonce: "fixed-jsapi-nonce"
    });
    assert.deepEqual(Object.keys(parameters), ["appId", "timeStamp", "nonceStr", "package", "signType", "paySign"]);
    assert.equal(parameters.appId, appid);
    assert.equal(parameters.timeStamp, String(fixedTimestamp));
    assert.equal(parameters.package, "prepay_id=wx-prepay-id-from-api");
    assert.equal(parameters.signType, "RSA");
    const message = `${parameters.appId}\n${parameters.timeStamp}\n${parameters.nonceStr}\n${parameters.package}\n`;
    assert.equal(rsaVerify(
      "RSA-SHA256",
      Buffer.from(message),
      merchantKeys.publicKey,
      Buffer.from(parameters.paySign, "base64")
    ), true);

    const { client } = recordingClient();
    assert.equal(client.createJsapiPaymentParameters("wx-prepay-id-from-api").timeStamp, String(fixedTimestamp));
  });

  it("signs query, close, refund, and refund-query requests with the exact path and body", async () => {
    const { client, requests } = recordingClient();
    await client.queryOrder({ outTradeNo: "ORDER_QUERY_1" });
    await client.queryOrder({ transactionId: "4200000000000000000000000001" });
    await client.closeOrder("ORDER_CLOSE_1");
    await client.createRefund({
      outTradeNo: "ORDER_REFUND_1",
      outRefundNo: "REFUND_1",
      total: 52000,
      refund: 10000,
      reason: "部分退款"
    });
    await client.queryRefund("REFUND_1");

    assert.match(requests[0].url, /out-trade-no\/ORDER_QUERY_1\?mchid=/);
    assert.match(requests[1].url, /transactions\/id\/4200000000000000000000000001\?mchid=/);
    assert.deepEqual(JSON.parse(requests[2].init.body), { mchid });
    assert.deepEqual(JSON.parse(requests[3].init.body), {
      out_refund_no: "REFUND_1",
      notify_url: "https://payments.example.test/wechat/callback",
      amount: { refund: 10000, total: 52000, currency: "CNY" },
      out_trade_no: "ORDER_REFUND_1",
      reason: "部分退款"
    });
    assert.match(requests[4].url, /refunds\/REFUND_1$/);
    for (const request of requests) assertRequestSignature(request);
  });

  it("rejects ambiguous or invalid payment amounts before calling HTTP", async () => {
    const { client, requests } = recordingClient();
    assert.throws(() => client.queryOrder({}), /exactly one/);
    assert.throws(() => client.createRefund({
      outTradeNo: "ORDER_1",
      transactionId: "transaction-1",
      outRefundNo: "REFUND_1",
      total: 100,
      refund: 100
    }), /exactly one/);
    assert.throws(() => client.createRefund({
      outTradeNo: "ORDER_1",
      outRefundNo: "REFUND_1",
      total: 100,
      refund: 101
    }), /must not exceed/);
    assert.equal(requests.length, 0);
  });
});

describe("WeChat Pay callbacks", () => {
  const transaction = {
    appid,
    mchid,
    out_trade_no: "ORDER_CALLBACK_1",
    transaction_id: "4200000000000000000000000002",
    trade_state: "SUCCESS",
    amount: { total: 19600, payer_total: 19600, currency: "CNY", payer_currency: "CNY" }
  };

  it("verifies the raw body signature, decrypts AES-256-GCM, and extracts idempotency identifiers", () => {
    const callback = signedCallback(transaction);
    const result = verifyAndDecryptWechatPayCallback({
      config: config(),
      headers: callback.headers,
      rawBody: Buffer.from(callback.rawBody),
      now: fixedNow
    });

    assert.deepEqual(result.resource, transaction);
    assert.equal(result.verification.serialNumber, platformSerialNumber);
    assert.equal(result.identifiers.eventId, callback.event.id);
    assert.equal(result.identifiers.idempotencyKey, `wechatpay:event:${callback.event.id}`);
    assert.equal(result.identifiers.transactionId, transaction.transaction_id);
    assert.equal(result.identifiers.outTradeNo, transaction.out_trade_no);

    const { client } = recordingClient();
    assert.deepEqual(client.verifyAndDecryptCallback({
      headers: callback.headers,
      rawBody: callback.rawBody
    }).resource, transaction);
  });

  it("rejects modified raw bodies, unknown platform serials, and stale timestamps", () => {
    const callback = signedCallback(transaction);
    assert.throws(() => verifyWechatPayCallbackSignature({
      headers: callback.headers,
      rawBody: `${callback.rawBody} `,
      platformCertificates: config().platformCertificates,
      now: fixedNow
    }), /Invalid .* signature/);

    const unknownSerial = signedCallback(transaction, { serialNumber: randomBytes(10).toString("hex") });
    assert.throws(() => verifyWechatPayCallbackSignature({
      headers: unknownSerial.headers,
      rawBody: unknownSerial.rawBody,
      platformCertificates: config().platformCertificates,
      now: fixedNow
    }), /Unknown .* serial number/);

    assert.throws(() => verifyWechatPayCallbackSignature({
      headers: callback.headers,
      rawBody: callback.rawBody,
      platformCertificates: config().platformCertificates,
      now: fixedNow + 301_000
    }), /outside the allowed tolerance/);
  });

  it("authenticates encrypted resources and rejects the wrong API v3 key", () => {
    const encrypted = encryptResource(transaction);
    assert.deepEqual(decryptWechatPayResource(encrypted, apiV3Key), transaction);
    assert.throws(
      () => decryptWechatPayResource(encrypted, randomBytes(24).toString("base64")),
      /authenticate or decrypt/
    );
  });
});

describe("WeChat Pay transaction validation", () => {
  const transaction = {
    appid,
    mchid,
    out_trade_no: "ORDER_VALIDATE_1",
    transaction_id: "4200000000000000000000000003",
    amount: { total: 52000, currency: "CNY" }
  };

  it("matches merchant, amount, currency, app, and order identifiers", () => {
    const expected = {
      mchid,
      appid,
      total: 52000,
      currency: "CNY",
      outTradeNo: "ORDER_VALIDATE_1",
      transactionId: transaction.transaction_id
    };
    assert.deepEqual(validateWechatPayTransaction(transaction, expected), { valid: true, mismatches: [] });
    assert.equal(assertWechatPayTransaction(transaction, expected), transaction);
  });

  it("reports every security-relevant mismatch and keeps the event ID as the idempotency source", () => {
    const result = validateWechatPayTransaction(transaction, {
      mchid: `${mchid}9`,
      appid: `${appid}9`,
      total: 1,
      currency: "CNY",
      outTradeNo: "OTHER_ORDER"
    });
    assert.equal(result.valid, false);
    assert.deepEqual(result.mismatches, ["mchid", "amount.total", "appid", "out_trade_no"]);
    assert.throws(() => assertWechatPayTransaction(transaction, {
      mchid,
      total: 1,
      currency: "CNY"
    }), { name: "WechatPayTransactionMismatchError" });

    const identifiers = extractWechatPayEventIdentifiers({
      id: "event-idempotency-1",
      event_type: "REFUND.SUCCESS",
      resource_type: "encrypt-resource"
    }, {
      refund_id: "refund-platform-1",
      out_refund_no: "REFUND_1"
    });
    assert.deepEqual(identifiers, {
      eventId: "event-idempotency-1",
      idempotencyKey: "wechatpay:event:event-idempotency-1",
      eventType: "REFUND.SUCCESS",
      resourceType: "encrypt-resource",
      transactionId: null,
      outTradeNo: null,
      refundId: "refund-platform-1",
      outRefundNo: "REFUND_1"
    });
  });
});
