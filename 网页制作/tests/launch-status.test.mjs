import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(projectRoot, "..");
const gitReleaseScriptPath = path.join(projectRoot, "scripts/check-git-release.mjs");

const configFilesToCopy = [
  ".nvmrc",
  "netlify.toml",
  "vercel.json",
  ".github/workflows/scent-atoll-ci.yml",
  ".github/workflows/scent-atoll-release.yml",
  "网页制作/.nvmrc",
  "网页制作/package.json",
  "网页制作/netlify.toml",
  "网页制作/vercel.json",
  "网页制作/scripts/check-deploy-config.mjs",
  "网页制作/scripts/check-environment-isolation.mjs",
  "网页制作/scripts/check-git-release.mjs",
  "网页制作/scripts/check-launch-env.mjs",
  "网页制作/scripts/load-env.mjs",
  "网页制作/scripts/paths.mjs"
];

const validLaunchEnv = {
  SITE_URL: "https://www.scent-atoll.test",
  CONTACT_EMAIL: "hello@scent-atoll.test",
  CONTACT_WECHAT: "ScentAtoll",
  BUSINESS_NAME: "Scent Atoll Studio Ltd",
  STUDIO_BOOKING: "Wechat appointment"
};

function requiredFilesFromGitReleaseScript() {
  const script = readFileSync(gitReleaseScriptPath, "utf8");
  const match = script.match(/const requiredFiles = \[([\s\S]*?)\];/);
  assert.ok(match, "Could not find requiredFiles in check-git-release.mjs");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function writeFixtureFile(tempRepo, filePath, content = `${filePath}\n`) {
  const target = path.join(tempRepo, filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, filePath.endsWith(".gitignore") ? "# fixture ignore file\n" : content);
}

function copyTextFixture(tempRepo, filePath) {
  const source = path.join(repoRoot, filePath);
  const target = path.join(tempRepo, filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, readFileSync(source, "utf8"));
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

function withReleaseStatusFixture(callback) {
  const tempRepo = mkdtempSync(path.join(tmpdir(), "scent-atoll-launch-status-"));
  try {
    for (const filePath of requiredFilesFromGitReleaseScript()) {
      writeFixtureFile(tempRepo, filePath);
    }
    for (const filePath of configFilesToCopy) {
      copyTextFixture(tempRepo, filePath);
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

function runStatus(fixture, env = {}) {
  return spawnSync(process.execPath, ["scripts/launch-status.mjs"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      SITE_URL: "",
      CONTACT_EMAIL: "",
      CONTACT_WECHAT: "",
      BUSINESS_NAME: "",
      STUDIO_BOOKING: "",
      CUSTOMER_HOURS: "",
      OG_IMAGE: "",
      SCENT_ATOLL_PROJECT_ROOT: fixture.projectRoot,
      SCENT_ATOLL_REPO_ROOT: fixture.repoRoot,
      ...env
    },
    encoding: "utf8"
  });
}

describe("launch status", () => {
  it("passes when local pre-release gates are clear", () => withReleaseStatusFixture((fixture) => {
    const result = runStatus(fixture, validLaunchEnv);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS Deployment config/);
    assert.match(result.stdout, /PASS Launch environment/);
    assert.match(result.stdout, /PASS Git release handoff/);
    assert.match(result.stdout, /PASS Patch whitespace/);
    assert.match(result.stdout, /Launch status: local pre-release gates are clear/);
  }));

  it("summarizes missing launch environment values", () => withReleaseStatusFixture((fixture) => {
    const result = runStatus(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /PASS Deployment config/);
    assert.match(result.stdout, /FAIL Launch environment/);
    assert.match(result.stdout, /PASS Git release handoff/);
    assert.match(result.stdout, /PASS Patch whitespace/);
    assert.match(result.stdout, /SITE_URL is required/);
    assert.match(result.stderr, /Launch status: 1 check\(s\) still need attention/);
  }));
});
