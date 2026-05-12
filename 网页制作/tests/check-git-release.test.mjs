import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(projectRoot, "..");
const checkScriptPath = path.join(projectRoot, "scripts/check-git-release.mjs");
const planIndexPath = path.join(projectRoot, "plan/README.md");

function requiredFilesFromScript() {
  const script = readFileSync(checkScriptPath, "utf8");
  const match = script.match(/const requiredFiles = \[([\s\S]*?)\];/);
  assert.ok(match, "Could not find requiredFiles in check-git-release.mjs");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function planFilesFromIndex() {
  const index = readFileSync(planIndexPath, "utf8");
  return [...index.matchAll(/^\| `([^`]+\.md)` \|/gm)].map((item) => `网页制作/plan/${item[1]}`);
}

function writeFixtureFile(tempRepo, filePath, content = `${filePath}\n`) {
  const target = path.join(tempRepo, filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, filePath.endsWith(".gitignore") ? "# fixture ignore file\n" : content);
}

function runGit(tempRepo, args) {
  const result = spawnSync("git", ["-c", "core.quotepath=false", ...args], {
    cwd: tempRepo,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function commitFixture(tempRepo) {
  runGit(tempRepo, ["init"]);
  runGit(tempRepo, ["add", "."]);
  runGit(tempRepo, [
    "-c",
    "user.name=Scent Atoll Test",
    "-c",
    "user.email=scent-atoll-test@example.com",
    "commit",
    "-m",
    "Fixture"
  ]);
}

function withReleaseRepo(callback) {
  const tempRepo = mkdtempSync(path.join(tmpdir(), "scent-atoll-git-release-"));
  try {
    for (const filePath of requiredFilesFromScript()) {
      writeFixtureFile(tempRepo, filePath);
    }
    commitFixture(tempRepo);
    return callback({
      repoRoot: tempRepo,
      projectRoot: path.join(tempRepo, "网页制作")
    });
  } finally {
    rmSync(tempRepo, { recursive: true, force: true });
  }
}

function runCheck(fixture) {
  return spawnSync(process.execPath, ["scripts/check-git-release.mjs"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      SCENT_ATOLL_PROJECT_ROOT: fixture.projectRoot,
      SCENT_ATOLL_REPO_ROOT: fixture.repoRoot
    },
    encoding: "utf8"
  });
}

describe("git release check", () => {
  it("tracks every plan file kept in the plan index", () => {
    const requiredFiles = new Set(requiredFilesFromScript());
    for (const filePath of planFilesFromIndex()) {
      assert.ok(requiredFiles.has(filePath), `${filePath} should be required by check-git-release.mjs`);
    }
  });

  it("accepts a clean release-critical tree", () => withReleaseRepo((fixture) => {
    const result = runCheck(fixture);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Git release check passed/);
  }));

  it("rejects uncommitted release-critical changes", () => withReleaseRepo((fixture) => {
    writeFixtureFile(fixture.repoRoot, "网页制作/src/pages/terms.njk", "modified\n");

    const result = runCheck(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Release-critical paths have uncommitted or untracked changes/);
    assert.match(result.stderr, /网页制作\/src\/pages\/terms\.njk/);
  }));

  it("rejects tracked generated or local-only files", () => withReleaseRepo((fixture) => {
    writeFixtureFile(fixture.repoRoot, "网页制作/dist/index.html", "generated\n");
    writeFixtureFile(fixture.repoRoot, "网页制作/assets/js/public-app.js", "stale copy\n");
    runGit(fixture.repoRoot, ["add", "网页制作/dist/index.html", "网页制作/assets/js/public-app.js"]);
    runGit(fixture.repoRoot, [
      "-c",
      "user.name=Scent Atoll Test",
      "-c",
      "user.email=scent-atoll-test@example.com",
      "commit",
      "-m",
      "Track generated file"
    ]);

    const result = runCheck(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Generated, local, or secret-like files are tracked/);
    assert.match(result.stderr, /网页制作\/dist\/index\.html/);
    assert.match(result.stderr, /网页制作\/assets\/js\/public-app\.js/);
  }));
});
