import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const validLaunchEnv = {
  SITE_URL: "https://www.scent-atoll.test",
  CONTACT_EMAIL: "hello@scent-atoll.test",
  CONTACT_WECHAT: "ScentAtoll",
  BUSINESS_NAME: "Scent Atoll Studio Ltd",
  STUDIO_BOOKING: "Wechat appointment"
};

const minimalLaunchEnv = {
  SITE_URL: "https://www.scent-atoll.test",
  CONTACT_EMAIL: "hello@scent-atoll.test",
  CONTACT_WECHAT: "ScentAtoll"
};

function runNode(args, env) {
  return spawnSync(process.execPath, args, {
    cwd: projectRoot,
    env: { ...process.env, ...env },
    encoding: "utf8"
  });
}

describe("public build launch metadata gate", () => {
  it("requires strict launch contact values to be rendered into the public build", () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), "scent-atoll-public-test-"));
    const env = {
      ...validLaunchEnv,
      PUBLIC_OUTPUT_DIR: outputDir
    };

    try {
      const build = runNode(["scripts/build-public.mjs"], env);
      assert.equal(build.status, 0, build.stderr);

      const validCheck = runNode(["scripts/check-public-build.mjs", "--strict"], env);
      assert.equal(validCheck.status, 0, validCheck.stderr);

      const missingRenderedValue = runNode(["scripts/check-public-build.mjs", "--strict"], {
        ...env,
        STUDIO_BOOKING: "Unrendered booking marker"
      });
      assert.notEqual(missingRenderedValue.status, 0);
      assert.match(missingRenderedValue.stderr, /STUDIO_BOOKING is set but was not rendered into the public build/);

      const missingCustomerHours = runNode(["scripts/check-public-build.mjs", "--strict"], {
        ...env,
        CUSTOMER_HOURS: "09:00 - 10:00"
      });
      assert.notEqual(missingCustomerHours.status, 0);
      assert.match(missingCustomerHours.stderr, /CUSTOMER_HOURS is set but was not rendered into the public build/);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("requires default business and booking values to be rendered in strict mode", () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), "scent-atoll-public-default-test-"));
    const env = {
      ...minimalLaunchEnv,
      PUBLIC_OUTPUT_DIR: outputDir
    };

    try {
      const build = runNode(["scripts/build-public.mjs"], env);
      assert.equal(build.status, 0, build.stderr);

      const check = runNode(["scripts/check-public-build.mjs", "--strict"], env);
      assert.equal(check.status, 0, check.stderr);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("rejects checkout pages in the public build", () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), "scent-atoll-public-checkout-test-"));
    const env = {
      ...validLaunchEnv,
      PUBLIC_OUTPUT_DIR: outputDir
    };

    try {
      const build = runNode(["scripts/build-public.mjs"], env);
      assert.equal(build.status, 0, build.stderr);

      copyFileSync(path.join(outputDir, "index.html"), path.join(outputDir, "checkout.html"));

      const check = runNode(["scripts/check-public-build.mjs"], env);
      assert.notEqual(check.status, 0);
      assert.match(check.stderr, /Forbidden private file in public build: checkout\.html/);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
