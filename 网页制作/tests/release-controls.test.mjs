import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const validEnvironment = {
  RELEASE_CONFIRMATION: "RELEASE",
  GITHUB_REF: "refs/heads/main",
  VERCEL_TOKEN: "vercel-token",
  VERCEL_ORG_ID: "team_test",
  VERCEL_PROJECT_ID: "project_test",
  GITHUB_RELEASE_AUDIT_TOKEN: "github-token",
  PRODUCTION_URL: "https://scent-atoll.test",
  PRODUCTION_DATABASE_URL: "postgresql://release:secret@production-db.test/scent"
};

function runCheck(overrides = {}) {
  return spawnSync(process.execPath, ["scripts/check-release-controls.mjs"], {
    cwd: projectRoot,
    env: { ...process.env, ...validEnvironment, ...overrides },
    encoding: "utf8"
  });
}

describe("Production release controls", () => {
  it("accepts an explicitly confirmed main release with all credentials", () => {
    const result = runCheck();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /release control check passed/);
  });

  it("reports every missing protected secret by name without printing values", () => {
    const result = runCheck({
      VERCEL_TOKEN: "",
      VERCEL_PROJECT_ID: "",
      PRODUCTION_DATABASE_URL: ""
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /VERCEL_TOKEN is required/);
    assert.match(result.stderr, /VERCEL_PROJECT_ID is required/);
    assert.match(result.stderr, /PRODUCTION_DATABASE_URL is required/);
    assert.doesNotMatch(result.stderr, /vercel-token|release:secret/);
  });

  it("rejects a dispatch from any branch other than main", () => {
    const result = runCheck({ GITHUB_REF: "refs/heads/feature/unsafe" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must be dispatched from refs\/heads\/main/);
  });
});
