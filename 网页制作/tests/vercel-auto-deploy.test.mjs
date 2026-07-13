import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runCheck(overrides = {}) {
  return spawnSync(process.execPath, ["scripts/check-vercel-auto-deploy.mjs"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      VERCEL_GIT_COMMIT_REF: "feature/release-test",
      ...overrides
    },
    encoding: "utf8"
  });
}

describe("Vercel automatic deployment gate", () => {
  it("skips a Git-integrated deployment from main", () => {
    const result = runCheck({ VERCEL_GIT_COMMIT_REF: "main" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Skipping automatic Vercel Production deployment/);
  });

  it("allows Preview branch builds", () => {
    const result = runCheck();
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Allowing Vercel build/);
  });

  it("allows the protected workflow to build a Production candidate", () => {
    const result = runCheck({
      VERCEL_GIT_COMMIT_REF: "main",
      SCENT_ATOLL_CONTROLLED_RELEASE: "1"
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Allowing Vercel build/);
  });

  it("does not skip local builds without a Vercel Git ref", () => {
    const result = runCheck({ VERCEL_GIT_COMMIT_REF: "" });
    assert.equal(result.status, 1);
  });
});
