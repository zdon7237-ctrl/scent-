import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runMigration(env = {}) {
  return spawnSync(process.execPath, ["scripts/release-migrate.mjs"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      DATABASE_URL: "",
      DEPLOYMENT_ENV: "",
      ALLOW_RELEASE_MIGRATION: "",
      ...env
    },
    encoding: "utf8"
  });
}

describe("release migration guard", () => {
  it("never silently skips when DATABASE_URL is missing", () => {
    const result = runMigration({
      DEPLOYMENT_ENV: "production",
      ALLOW_RELEASE_MIGRATION: "production"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DATABASE_URL is required; release migrations must never silently skip/);
  });

  it("requires an explicit confirmation matching the target", () => {
    const result = runMigration({
      DEPLOYMENT_ENV: "production",
      ALLOW_RELEASE_MIGRATION: "preview",
      DATABASE_URL: "postgresql://user:password@127.0.0.1:1/release_guard_test"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Set ALLOW_RELEASE_MIGRATION=production to confirm the target environment/);
    assert.doesNotMatch(result.stderr, /ECONNREFUSED/);
  });

  it("rejects development as a release migration target", () => {
    const result = runMigration({
      DEPLOYMENT_ENV: "development",
      ALLOW_RELEASE_MIGRATION: "development",
      DATABASE_URL: "postgresql://user:password@127.0.0.1:1/release_guard_test"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DEPLOYMENT_ENV must be preview or production/);
  });
});
