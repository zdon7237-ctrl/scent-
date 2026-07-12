import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredEnv = [
  "SITE_URL",
  "CONTACT_EMAIL",
  "CONTACT_WECHAT"
];

const commercialEnvNames = [
  "BUSINESS_NAME",
  "STUDIO_BOOKING",
  "VERCEL_ENV",
  "DEPLOYMENT_ENV",
  "DATABASE_URL",
  "APP_ORIGIN",
  "PAYMENT_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "BLOB_READ_WRITE_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "CRON_SECRET",
  "DATA_RESIDENCY_DECISION",
  "SEED_ADMIN_EMAIL",
  "SEED_ADMIN_PASSWORD",
  "ERROR_WEBHOOK_URL",
  "ERROR_WEBHOOK_TOKEN",
  "WECHAT_PAY_ENABLED",
  "WECHAT_PAY_MCH_ID",
  "WECHAT_PAY_APP_ID",
  "WECHAT_PAY_MERCHANT_SERIAL_NUMBER",
  "WECHAT_PAY_MERCHANT_PRIVATE_KEY",
  "WECHAT_PAY_API_V3_KEY",
  "WECHAT_PAY_NOTIFY_URL",
  "WECHAT_PAY_PLATFORM_SERIAL_NUMBER",
  "WECHAT_PAY_PLATFORM_PUBLIC_KEY"
];

const validLaunchEnv = {
  SITE_URL: "https://www.scent-atoll.test",
  CONTACT_EMAIL: "hello@scent-atoll.test",
  CONTACT_WECHAT: "ScentAtoll"
};

const validCommercialEnv = {
  ...validLaunchEnv,
  BUSINESS_NAME: "Shanghai Scent Atoll Trading Co., Ltd.",
  VERCEL_ENV: "production",
  DEPLOYMENT_ENV: "production",
  DATA_RESIDENCY_DECISION: "cross_border_approved",
  DATABASE_URL: "postgresql://user:password@db.scent-atoll.test/scent",
  APP_ORIGIN: validLaunchEnv.SITE_URL,
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM: "Scent Atoll <hello@scent-atoll.test>",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_test_token",
  UPSTASH_REDIS_REST_URL: "https://redis.scent-atoll.test",
  UPSTASH_REDIS_REST_TOKEN: "upstash-test-token",
  CRON_SECRET: "production-cron-secret-at-least-32-chars"
};

const validPreviewEnv = {
  ...validCommercialEnv,
  SITE_URL: "https://preview.scent-atoll.test",
  APP_ORIGIN: "https://preview.scent-atoll.test",
  VERCEL_ENV: "preview",
  DEPLOYMENT_ENV: "preview",
  DATABASE_URL: "postgresql://user:password@preview-db.scent-atoll.test/scent_preview",
  RESEND_API_KEY: "re_preview_key",
  EMAIL_FROM: "Scent Atoll Preview <preview@scent-atoll.test>",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_preview_token",
  UPSTASH_REDIS_REST_URL: "https://preview-redis.scent-atoll.test",
  UPSTASH_REDIS_REST_TOKEN: "upstash-preview-token",
  CRON_SECRET: "preview-cron-secret-at-least-32-characters"
};

function runCheck(overrides = {}) {
  const env = { ...process.env };
  for (const name of [...requiredEnv, ...commercialEnvNames, "CUSTOMER_HOURS", "OG_IMAGE"]) {
    env[name] = "";
  }
  Object.assign(env, overrides);
  return spawnSync(process.execPath, ["scripts/check-launch-env.mjs"], {
    cwd: projectRoot,
    env,
    encoding: "utf8"
  });
}

describe("launch environment check", () => {
  it("accepts complete production launch values", () => {
    const result = runCheck(validLaunchEnv);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Launch environment check passed/);
  });

  it("rejects missing required launch values", () => {
    const result = runCheck();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SITE_URL is required/);
    assert.match(result.stderr, /CONTACT_EMAIL is required/);
    assert.match(result.stderr, /CONTACT_WECHAT is required/);
  });

  it("rejects blank required launch values", () => {
    const result = runCheck({
      SITE_URL: "   ",
      CONTACT_EMAIL: "   ",
      CONTACT_WECHAT: "   "
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SITE_URL is required/);
    assert.match(result.stderr, /CONTACT_EMAIL is required/);
    assert.match(result.stderr, /CONTACT_WECHAT is required/);
  });

  it("rejects template placeholders", () => {
    const result = runCheck({
      SITE_URL: "https://你的正式域名",
      CONTACT_EMAIL: "你的客服邮箱",
      CONTACT_WECHAT: "你的客服微信",
      BUSINESS_NAME: "你的经营主体名称",
      STUDIO_BOOKING: "你的预约方式"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SITE_URL still contains placeholder text/);
    assert.match(result.stderr, /CONTACT_EMAIL still contains placeholder text/);
    assert.match(result.stderr, /CONTACT_EMAIL must be a valid email address/);
    assert.match(result.stderr, /BUSINESS_NAME still contains placeholder text/);
    assert.match(result.stderr, /STUDIO_BOOKING still contains placeholder text/);
  });

  it("accepts default brand business and booking values when optional env is omitted", () => {
    const result = runCheck(validLaunchEnv);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Launch environment check passed/);
  });

  it("rejects a SITE_URL with a path", () => {
    const result = runCheck({
      ...validLaunchEnv,
      SITE_URL: "https://www.scent-atoll.test/shop.html"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /without a path, query string, or hash/);
  });

  it("rejects a non-HTTPS SITE_URL", () => {
    const result = runCheck({
      ...validLaunchEnv,
      SITE_URL: "http://www.scent-atoll.test"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SITE_URL must use https:\/\//);
  });

  it("rejects a SITE_URL with credentials", () => {
    const result = runCheck({
      ...validLaunchEnv,
      SITE_URL: "https://user:pass@www.scent-atoll.test"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SITE_URL must not include username or password/);
  });

  it("rejects invalid OG_IMAGE values", () => {
    const result = runCheck({
      ...validLaunchEnv,
      OG_IMAGE: "http://www.scent-atoll.test/share.txt"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /OG_IMAGE must be a production https:\/\/ PNG, JPG, or WebP image URL/);
  });

  it("accepts a complete production commercial environment", () => {
    const result = runCheck(validCommercialEnv);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Launch environment check passed/);
  });

  it("requires managed runtime services in Vercel production", () => {
    const result = runCheck({
      ...validLaunchEnv,
      VERCEL_ENV: "production",
      DEPLOYMENT_ENV: "production"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DATABASE_URL is required for production deployments/);
    assert.match(result.stderr, /RESEND_API_KEY is required for production deployments/);
    assert.match(result.stderr, /BLOB_READ_WRITE_TOKEN or VERCEL_OIDC_TOKEN \+ BLOB_STORE_ID is required for production deployments/);
    assert.match(result.stderr, /UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_KV_REST_API_URL is required for production deployments/);
    assert.match(result.stderr, /CRON_SECRET is required for production deployments/);
  });

  it("rejects a weak reservation cleanup secret", () => {
    const result = runCheck({ ...validCommercialEnv, CRON_SECRET: "too-short" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CRON_SECRET must contain at least 32 characters/);
  });

  it("blocks production commerce without a real entity and data residency decision", () => {
    const result = runCheck({
      ...validCommercialEnv,
      BUSINESS_NAME: "",
      DATA_RESIDENCY_DECISION: ""
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /BUSINESS_NAME is required for production commerce/);
    assert.match(result.stderr, /DATA_RESIDENCY_DECISION must be cross_border_approved or domestic_infrastructure/);
  });

  it("rejects an unrecognized data residency decision", () => {
    const result = runCheck({
      ...validCommercialEnv,
      DATA_RESIDENCY_DECISION: "pending_review"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DATA_RESIDENCY_DECISION must be cross_border_approved or domestic_infrastructure/);
  });

  it("rejects a preview environment labeled as production", () => {
    const result = runCheck({
      ...validCommercialEnv,
      VERCEL_ENV: "preview"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DEPLOYMENT_ENV must match VERCEL_ENV \(preview\)/);
  });

  it("rejects production seed-admin credentials", () => {
    const result = runCheck({
      ...validCommercialEnv,
      SEED_ADMIN_EMAIL: "owner@scent-atoll.test",
      SEED_ADMIN_PASSWORD: "do-not-seed-production"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Production must not define SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD/);
  });

  it("accepts a complete isolated Preview service contract", () => {
    const result = runCheck(validPreviewEnv);
    assert.equal(result.status, 0, result.stderr);
  });

  it("rejects a development payment webhook secret in deployed environments", () => {
    const result = runCheck({
      ...validCommercialEnv,
      PAYMENT_WEBHOOK_SECRET: "must-not-reach-production"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Production and Preview must not define PAYMENT_WEBHOOK_SECRET/);

    const previewResult = runCheck({
      ...validPreviewEnv,
      PAYMENT_WEBHOOK_SECRET: "must-not-reach-preview"
    });
    assert.notEqual(previewResult.status, 0);
    assert.match(previewResult.stderr, /Production and Preview must not define PAYMENT_WEBHOOK_SECRET/);
  });

  it("does not require WeChat Pay credentials while the second phase is disabled", () => {
    const result = runCheck({ ...validCommercialEnv, WECHAT_PAY_ENABLED: "false" });
    assert.equal(result.status, 0, result.stderr);
  });

  it("requires the complete WeChat Pay v3 contract when enabled", () => {
    const result = runCheck({ ...validCommercialEnv, WECHAT_PAY_ENABLED: "true" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /WECHAT_PAY_MCH_ID is required when WECHAT_PAY_ENABLED=true/);
    assert.match(result.stderr, /WECHAT_PAY_API_V3_KEY is required when WECHAT_PAY_ENABLED=true/);
    assert.match(result.stderr, /WECHAT_PAY_PLATFORM_PUBLIC_KEY is required when WECHAT_PAY_ENABLED=true/);
  });
});
