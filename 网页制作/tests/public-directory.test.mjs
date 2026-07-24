import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolvePublicDirectory } from "../server/src/public-directory.mjs";

describe("public directory resolution", () => {
  let rootDir;
  let fallback;
  let configured;

  before(async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), "scent-public-dir-"));
    fallback = path.join(rootDir, "dist");
    configured = path.join(rootDir, "custom-public");
    await mkdir(fallback, { recursive: true });
    await mkdir(configured, { recursive: true });
    await writeFile(path.join(fallback, "product.html"), "fallback");
    await writeFile(path.join(configured, "product.html"), "configured");
  });

  after(() => rm(rootDir, { recursive: true, force: true }));

  it("uses the built dist directory by default", () => {
    assert.equal(resolvePublicDirectory(rootDir, ""), fallback);
  });

  it("resolves a valid relative directory from the project root", () => {
    assert.equal(resolvePublicDirectory(rootDir, "custom-public"), configured);
  });

  it("falls back to dist when a stale configured directory has no product template", () => {
    assert.equal(resolvePublicDirectory(rootDir, "/missing/legacy-public"), fallback);
  });
});
