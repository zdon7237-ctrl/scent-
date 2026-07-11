import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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

  it("removes transaction and credential-recovery pages from the public build", () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), "scent-atoll-public-checkout-test-"));
    const env = {
      ...validLaunchEnv,
      PUBLIC_OUTPUT_DIR: outputDir
    };

    try {
      const build = runNode(["scripts/build-public.mjs"], env);
      assert.equal(build.status, 0, build.stderr);

      for (const file of ["checkout.html", "verify-email.html", "reset-password.html"]) {
        assert.equal(existsSync(path.join(outputDir, file)), false, `${file} should not be published`);
      }
      const redirects = readFileSync(path.join(outputDir, "_redirects"), "utf8");
      assert.match(redirects, /^\/product-\*\.html \/products\/:splat 301!$/m);
      assert.match(redirects, /^\/products\/\* \/product\.html\?id=:splat 200$/m);

      const sitemap = readFileSync(path.join(outputDir, "sitemap.xml"), "utf8");
      assert.match(sitemap, /\/products\/vespree/);
      assert.doesNotMatch(sitemap, /\/product-vespree\.html/);

      copyFileSync(path.join(outputDir, "index.html"), path.join(outputDir, "checkout.html"));
      copyFileSync(path.join(outputDir, "index.html"), path.join(outputDir, "verify-email.html"));
      copyFileSync(path.join(outputDir, "index.html"), path.join(outputDir, "reset-password.html"));

      const check = runNode(["scripts/check-public-build.mjs"], env);
      assert.notEqual(check.status, 0);
      assert.match(check.stderr, /Forbidden private file in public build: checkout\.html/);
      assert.match(check.stderr, /Forbidden private file in public build: verify-email\.html/);
      assert.match(check.stderr, /Forbidden private file in public build: reset-password\.html/);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
