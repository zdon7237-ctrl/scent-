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

const validLaunchEnv = {
  SITE_URL: "https://www.scent-atoll.test",
  CONTACT_EMAIL: "hello@scent-atoll.test",
  CONTACT_WECHAT: "ScentAtoll"
};

function runCheck(overrides = {}) {
  const env = { ...process.env };
  for (const name of [...requiredEnv, "CUSTOMER_HOURS", "OG_IMAGE"]) {
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
});
