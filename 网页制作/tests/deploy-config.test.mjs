import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(projectRoot, "..");

const filesToCopy = [
  ".nvmrc",
  "netlify.toml",
  "vercel.json",
  ".github/workflows/scent-atoll-ci.yml",
  ".github/workflows/scent-atoll-release.yml",
  "网页制作/.nvmrc",
  "网页制作/package.json",
  "网页制作/netlify.toml",
  "网页制作/vercel.json",
  "网页制作/scripts/release-migrate.mjs",
  "网页制作/scripts/check-commercial-deployment.mjs",
  "网页制作/scripts/check-environment-isolation.mjs"
];

function copyTextFixture(tempRepo, filePath) {
  const source = path.join(repoRoot, filePath);
  const target = path.join(tempRepo, filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, readFileSync(source, "utf8"));
}

function withFixture(callback) {
  const tempRepo = mkdtempSync(path.join(tmpdir(), "scent-atoll-deploy-config-"));
  try {
    for (const filePath of filesToCopy) copyTextFixture(tempRepo, filePath);
    return callback({
      repoRoot: tempRepo,
      projectRoot: path.join(tempRepo, "网页制作")
    });
  } finally {
    rmSync(tempRepo, { recursive: true, force: true });
  }
}

function runCheck(fixture) {
  return spawnSync(process.execPath, ["scripts/check-deploy-config.mjs"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      SCENT_ATOLL_PROJECT_ROOT: fixture.projectRoot,
      SCENT_ATOLL_REPO_ROOT: fixture.repoRoot
    },
    encoding: "utf8"
  });
}

function mutateJson(filePath, mutator) {
  const json = JSON.parse(readFileSync(filePath, "utf8"));
  mutator(json);
  writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
}

describe("deployment config check", () => {
  it("accepts the release deployment and CI contract", () => withFixture((fixture) => {
    const result = runCheck(fixture);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Deploy config check passed/);
  }));

  it("rejects a strict launch script that skips environment validation", () => withFixture((fixture) => {
    mutateJson(path.join(fixture.projectRoot, "package.json"), (packageJson) => {
      packageJson.scripts["launch:strict"] = "npm run build:public && node scripts/check-public-build.mjs --strict && npm run check:deploy";
    });

    const result = runCheck(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /scripts\.launch:strict should include npm run check:env/);
  }));

  it("rejects CI if it uses the local-only ready gate", () => withFixture((fixture) => {
    const workflowPath = path.join(fixture.repoRoot, ".github/workflows/scent-atoll-ci.yml");
    const workflow = readFileSync(workflowPath, "utf8").replace("npm run launch:strict", "npm run launch:ready");
    writeFileSync(workflowPath, workflow);

    const result = runCheck(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /should include npm run launch:strict/);
    assert.match(result.stderr, /should not run npm run launch:ready/);
  }));

  it("rejects deployment platforms if they use the local-only ready gate", () => withFixture((fixture) => {
    const netlifyPath = path.join(fixture.projectRoot, "netlify.toml");
    const netlify = readFileSync(netlifyPath, "utf8").replace('command = "npm run launch:strict"', 'command = "npm run launch:ready"');
    writeFileSync(netlifyPath, netlify);

    mutateJson(path.join(fixture.projectRoot, "vercel.json"), (vercel) => {
      vercel.buildCommand = "npm run launch:ready";
    });

    const result = runCheck(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /网页制作\/netlify\.toml should not run npm run launch:ready/);
    assert.match(result.stderr, /网页制作\/vercel\.json buildCommand should not run npm run launch:ready/);
  }));

  it("rejects Vercel builds that mutate or seed a database", () => withFixture((fixture) => {
    mutateJson(path.join(fixture.repoRoot, "vercel.json"), (vercel) => {
      vercel.buildCommand = "cd 网页制作 && npm run check:env && npm run db:migrate && npm run db:seed && npm run build";
    });

    const result = runCheck(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /buildCommand must not run db:migrate/);
    assert.match(result.stderr, /buildCommand must not run db:seed/);
  }));

  it("rejects Vercel configs without the stable product slug rewrite", () => withFixture((fixture) => {
    for (const filePath of [
      path.join(fixture.repoRoot, "vercel.json"),
      path.join(fixture.projectRoot, "vercel.json")
    ]) {
      mutateJson(filePath, (vercel) => {
        vercel.rewrites = vercel.rewrites.filter((rewrite) => rewrite.source !== "/products/:slug");
      });
    }

    const result = runCheck(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /should rewrite \/products\/:slug to \/api\/product-page\?slug=:slug/);
  }));

  it("rejects Vercel configs without the database sitemap or reservation cleanup cron", () => withFixture((fixture) => {
    for (const filePath of [
      path.join(fixture.repoRoot, "vercel.json"),
      path.join(fixture.projectRoot, "vercel.json")
    ]) {
      mutateJson(filePath, (vercel) => {
        vercel.rewrites = vercel.rewrites.filter((rewrite) => rewrite.source !== "/sitemap.xml");
        vercel.crons = [];
      });
    }

    const result = runCheck(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /should rewrite \/sitemap\.xml to \/api\/sitemap/);
    assert.match(result.stderr, /should release expired stock reservations every 10 minutes/);
  }));

  it("rejects missing SSR files and the legacy product redirect", () => withFixture((fixture) => {
    mutateJson(path.join(fixture.repoRoot, "vercel.json"), (vercel) => {
      vercel.functions["api/product-page.mjs"].includeFiles = ["网页制作/src/assets/data.js"];
      vercel.redirects = [];
    });

    const result = runCheck(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /includeFiles should include 网页制作\/dist\/product\.html/);
    assert.match(result.stderr, /should permanently redirect \/product-:slug\.html to \/products\/:slug/);
  }));

  it("rejects a release workflow that seeds production", () => withFixture((fixture) => {
    const workflowPath = path.join(fixture.repoRoot, ".github/workflows/scent-atoll-release.yml");
    const workflow = readFileSync(workflowPath, "utf8").replace(
      "scripts/release-migrate.mjs",
      "scripts/release-migrate.mjs && npm run db:seed"
    );
    writeFileSync(workflowPath, workflow);

    const result = runCheck(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must not seed a release database/);
  }));

  it("rejects promotion before candidate verification", () => withFixture((fixture) => {
    const workflowPath = path.join(fixture.repoRoot, ".github/workflows/scent-atoll-release.yml");
    const workflow = readFileSync(workflowPath, "utf8").replace(
      "vercel promote \"${{ steps.candidate.outputs.url }}\"",
      "node scripts/check-commercial-deployment.mjs && vercel promote \"${{ steps.candidate.outputs.url }}\""
    );
    writeFileSync(workflowPath, workflow.replace(
      "run: node scripts/check-commercial-deployment.mjs",
      "run: vercel promote premature"
    ));

    const result = runCheck(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /migration, candidate deploy, verification, then promotion/);
  }));
});
