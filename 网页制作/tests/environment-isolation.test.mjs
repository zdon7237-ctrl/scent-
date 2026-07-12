import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const production = {
  DEPLOYMENT_ENV: "production",
  SITE_URL: "https://www.scent-atoll.test",
  APP_ORIGIN: "https://www.scent-atoll.test",
  DATABASE_URL: "postgresql://production-secret@prod-db.test/scent",
  RESEND_API_KEY: "re_production_secret",
  EMAIL_FROM: "Scent Atoll <orders@scent-atoll.test>",
  BLOB_READ_WRITE_TOKEN: "blob_production_secret",
  UPSTASH_REDIS_REST_URL: "https://prod-redis.test",
  UPSTASH_REDIS_REST_TOKEN: "redis_production_secret",
  CRON_SECRET: "cron_production_secret"
};

const preview = {
  DEPLOYMENT_ENV: "preview",
  SITE_URL: "https://preview.scent-atoll.test",
  APP_ORIGIN: "https://preview.scent-atoll.test",
  DATABASE_URL: "postgresql://preview-secret@preview-db.test/scent",
  RESEND_API_KEY: "re_preview_secret",
  EMAIL_FROM: "Scent Atoll Preview <preview@scent-atoll.test>",
  BLOB_READ_WRITE_TOKEN: "blob_preview_secret",
  UPSTASH_REDIS_REST_URL: "https://preview-redis.test",
  UPSTASH_REDIS_REST_TOKEN: "redis_preview_secret",
  CRON_SECRET: "cron_preview_secret"
};

function serialize(environment) {
  return Object.entries(environment).map(([name, value]) => `${name}=${value}`).join("\n");
}

function runCheck(productionOverrides = {}, previewOverrides = {}) {
  const tempDir = mkdtempSync(path.join(tmpdir(), "scent-atoll-isolation-"));
  try {
    const productionPath = path.join(tempDir, "production.env");
    const previewPath = path.join(tempDir, "preview.env");
    writeFileSync(productionPath, serialize({ ...production, ...productionOverrides }));
    writeFileSync(previewPath, serialize({ ...preview, ...previewOverrides }));
    return spawnSync(process.execPath, ["scripts/check-environment-isolation.mjs", productionPath, previewPath], {
      cwd: projectRoot,
      encoding: "utf8"
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe("Production and Preview environment isolation", () => {
  it("accepts distinct managed resources without printing secrets", () => {
    const result = runCheck();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /environment isolation check passed/);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /production-secret|preview-secret/);
  });

  it("rejects shared database and Blob resources without echoing their values", () => {
    const result = runCheck(
      {
        DATABASE_URL: "postgresql://production-secret@shared-db.test/scent?sslmode=require",
        BLOB_READ_WRITE_TOKEN: "",
        BLOB_STORE_ID: "store_shared_secret"
      },
      {
        DATABASE_URL: "postgresql://preview-secret@shared-db.test/scent?sslmode=verify-full",
        BLOB_READ_WRITE_TOKEN: "",
        BLOB_STORE_ID: "store_shared_secret"
      }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DATABASE_URL resource must identify different Production and Preview resources/);
    assert.match(result.stderr, /Blob resource must identify different Production and Preview resources/);
    assert.doesNotMatch(result.stderr, /production-secret|preview-secret|store_shared_secret/);
  });

  it("supports Marketplace Blob and Upstash variable names", () => {
    const result = runCheck(
      {
        BLOB_READ_WRITE_TOKEN: "",
        BLOB_STORE_ID: "store_production",
        UPSTASH_REDIS_REST_URL: "",
        UPSTASH_REDIS_REST_TOKEN: "",
        UPSTASH_REDIS_KV_REST_API_URL: "https://production-redis.test",
        UPSTASH_REDIS_KV_REST_API_TOKEN: "production-token"
      },
      {
        BLOB_READ_WRITE_TOKEN: "",
        BLOB_STORE_ID: "store_preview",
        UPSTASH_REDIS_REST_URL: "",
        UPSTASH_REDIS_REST_TOKEN: "",
        UPSTASH_REDIS_KV_REST_API_URL: "https://preview-redis.test",
        UPSTASH_REDIS_KV_REST_API_TOKEN: "preview-token"
      }
    );
    assert.equal(result.status, 0, result.stderr);
  });

  it("rejects a shared Upstash resource even when tokens differ", () => {
    const result = runCheck(
      {
        UPSTASH_REDIS_REST_URL: "",
        UPSTASH_REDIS_KV_REST_API_URL: "https://shared-redis.test/",
        UPSTASH_REDIS_KV_REST_API_TOKEN: "production-token"
      },
      {
        UPSTASH_REDIS_REST_URL: "",
        UPSTASH_REDIS_KV_REST_API_URL: "https://shared-redis.test",
        UPSTASH_REDIS_KV_REST_API_TOKEN: "preview-token"
      }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Upstash Redis resource must identify different Production and Preview resources/);
    assert.doesNotMatch(result.stderr, /production-token|preview-token/);
  });

  it("rejects a legacy payment webhook secret in either deployed environment", () => {
    const result = runCheck({}, { PAYMENT_WEBHOOK_SECRET: "preview-only-secret" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Preview must not define PAYMENT_WEBHOOK_SECRET/);
    assert.doesNotMatch(result.stderr, /preview-only-secret/);
  });
});
