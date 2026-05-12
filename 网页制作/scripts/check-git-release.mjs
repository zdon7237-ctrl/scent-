import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { projectRoot as defaultProjectRoot, repoRoot as defaultRepoRoot } from "./paths.mjs";

const execFileAsync = promisify(execFile);
const failures = [];
const warnings = [];
const projectRoot = process.env.SCENT_ATOLL_PROJECT_ROOT
  ? path.resolve(process.env.SCENT_ATOLL_PROJECT_ROOT)
  : defaultProjectRoot;
const repoRoot = process.env.SCENT_ATOLL_REPO_ROOT
  ? path.resolve(process.env.SCENT_ATOLL_REPO_ROOT)
  : defaultRepoRoot;

const requiredFiles = [
  ".nvmrc",
  ".gitignore",
  "README.md",
  "netlify.toml",
  "vercel.json",
  ".github/workflows/scent-atoll-ci.yml",
  "网页制作/.eleventy.js",
  "网页制作/.nvmrc",
  "网页制作/.gitignore",
  "网页制作/README.md",
  "网页制作/package.json",
  "网页制作/package-lock.json",
  "网页制作/.env.production.example",
  "网页制作/netlify.toml",
  "网页制作/vercel.json",
  "网页制作/scripts/build-script.mjs",
  "网页制作/scripts/build-public.mjs",
  "网页制作/scripts/build-site.mjs",
  "网页制作/scripts/check-deploy-config.mjs",
  "网页制作/scripts/check-git-release.mjs",
  "网页制作/scripts/check-launch-env.mjs",
  "网页制作/scripts/check-live.mjs",
  "网页制作/scripts/check-public-build.mjs",
  "网页制作/scripts/generate-og-image.mjs",
  "网页制作/scripts/load-env.mjs",
  "网页制作/scripts/launch-status.mjs",
  "网页制作/scripts/migrate.mjs",
  "网页制作/scripts/paths.mjs",
  "网页制作/scripts/seed.mjs",
  "网页制作/tests/server-api.test.mjs",
  "网页制作/tests/launch-env.test.mjs",
  "网页制作/tests/deploy-config.test.mjs",
  "网页制作/tests/check-git-release.test.mjs",
  "网页制作/tests/live-check.test.mjs",
  "网页制作/tests/launch-status.test.mjs",
  "网页制作/tests/public-build.test.mjs",
  "网页制作/tests/site-data.test.mjs",
  "网页制作/src/_data/catalog.js",
  "网页制作/src/_data/site.js",
  "网页制作/src/_includes/footer.njk",
  "网页制作/src/_includes/header.njk",
  "网页制作/src/_includes/layout.njk",
  "网页制作/src/assets/data.js",
  "网页制作/src/assets/styles.css",
  "网页制作/src/assets/js/admin-client.js",
  "网页制作/src/assets/js/api-client.js",
  "网页制作/src/assets/js/app.js",
  "网页制作/src/assets/js/auth-client.js",
  "网页制作/src/assets/js/cart-store.js",
  "网页制作/src/assets/js/cart-ui.js",
  "网页制作/src/assets/js/catalog.js",
  "网页制作/src/assets/js/member-client.js",
  "网页制作/src/assets/js/package.json",
  "网页制作/src/assets/js/points-mall-client.js",
  "网页制作/src/assets/js/public-app.js",
  "网页制作/src/pages/404.njk",
  "网页制作/src/pages/about.njk",
  "网页制作/src/pages/article.njk",
  "网页制作/src/pages/article-detail.njk",
  "网页制作/src/pages/brand.njk",
  "网页制作/src/pages/brand-detail.njk",
  "网页制作/src/pages/brands.njk",
  "网页制作/src/pages/cart.njk",
  "网页制作/src/pages/headers.njk",
  "网页制作/src/pages/index.njk",
  "网页制作/src/pages/journal.njk",
  "网页制作/src/pages/payment.njk",
  "网页制作/src/pages/privacy.njk",
  "网页制作/src/pages/product.njk",
  "网页制作/src/pages/product-detail.njk",
  "网页制作/src/pages/redirects.njk",
  "网页制作/src/pages/robots.njk",
  "网页制作/src/pages/samples.njk",
  "网页制作/src/pages/service.njk",
  "网页制作/src/pages/shop.njk",
  "网页制作/src/pages/sitemap.njk",
  "网页制作/src/pages/terms.njk",
  "网页制作/server/src/app.mjs",
  "网页制作/server/src/db.mjs",
  "网页制作/server/src/migrate.mjs",
  "网页制作/server/src/repository.mjs",
  "网页制作/server/src/seed.mjs",
  "网页制作/plan/README.md",
  "网页制作/plan/launch-completion-audit.md",
  "网页制作/plan/launch-env-intake.md",
  "网页制作/plan/launch-readiness-checklist.md",
  "网页制作/plan/launch-runbook.md",
  "网页制作/plan/membership-system-plan.md",
  "网页制作/plan/points-mall-plan.md",
  "网页制作/plan/postgres-migration-plan.md",
  "网页制作/plan/production-platform-roadmap.md",
  "网页制作/plan/soft-launch-showcase-plan.md"
];

const releaseStatusPathspecs = [
  ".github",
  ".nvmrc",
  ".gitignore",
  "README.md",
  "netlify.toml",
  "vercel.json",
  "网页制作/.nvmrc",
  "网页制作/.gitignore",
  "网页制作/README.md",
  "网页制作/package.json",
  "网页制作/package-lock.json",
  "网页制作/.env.production.example",
  "网页制作/netlify.toml",
  "网页制作/vercel.json",
  "网页制作/scripts",
  "网页制作/server/src",
  "网页制作/tests",
  "网页制作/src",
  "网页制作/plan"
];

const forbiddenTrackedPatterns = [
  /^\.env\.production$/,
  /^\.env[^/]*\.local$/,
  /^dist-public\//,
  /^dist\//,
  /^网页制作\/\.env\.production$/,
  /^网页制作\/\.env[^/]*\.local$/,
  /^网页制作\/dist\//,
  /^网页制作\/dist-public\//,
  /^网页制作\/src\/assets\/og-image\.png$/,
  /^网页制作\/server\/data\/db\.json$/,
  /^网页制作\/assets\/js\/(?:admin-client|public-app)\.js$/,
  /^网页制作\/(?:404\.html|_headers|_redirects|robots\.txt|sitemap\.xml|og-image\.png|payment\.html|privacy\.html|terms\.html)$/
];

function normalizeGitPath(filePath) {
  return filePath.split(path.sep).join("/");
}

async function git(args, options = {}) {
  return execFileAsync("git", ["-c", "core.quotepath=false", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
    ...options
  });
}

async function isTracked(filePath) {
  try {
    await git(["ls-files", "--error-unmatch", "--", filePath]);
    return true;
  } catch {
    return false;
  }
}

for (const filePath of requiredFiles) {
  const absolutePath = path.join(repoRoot, filePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing required release file: ${filePath}`);
    continue;
  }
  if (!(await isTracked(filePath))) {
    failures.push(`Required release file is not tracked by Git: ${filePath}`);
  }
}

const status = await git(["status", "--porcelain=v1", "--untracked-files=all", "--", ...releaseStatusPathspecs]);
const dirtyLines = status.stdout.trim().split("\n").filter(Boolean);
if (dirtyLines.length) {
  failures.push("Release-critical paths have uncommitted or untracked changes:");
  failures.push(...dirtyLines.map((line) => `  ${line}`));
}

const tracked = await git(["ls-files"]);
const forbiddenTracked = tracked.stdout
  .split("\n")
  .map((filePath) => filePath.trim())
  .filter(Boolean)
  .map(normalizeGitPath)
  .filter((filePath) => forbiddenTrackedPatterns.some((pattern) => pattern.test(filePath)));

if (forbiddenTracked.length) {
  failures.push("Generated, local, or secret-like files are tracked and should be removed from Git:");
  failures.push(...forbiddenTracked.map((filePath) => `  ${filePath}`));
}

try {
  const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
  if (branch === "HEAD") {
    warnings.push("Detached HEAD: cannot determine whether the release branch has been pushed.");
  } else {
    try {
      await git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
      const counts = (await git(["rev-list", "--left-right", "--count", "HEAD...@{u}"])).stdout.trim();
      const [aheadText, behindText] = counts.split(/\s+/);
      const ahead = Number(aheadText || 0);
      const behind = Number(behindText || 0);
      if (ahead > 0) failures.push(`Current branch has ${ahead} commit(s) not pushed to its upstream.`);
      if (behind > 0) warnings.push(`Current branch is ${behind} commit(s) behind its upstream; fetch/rebase before release if needed.`);
    } catch {
      warnings.push(`Branch ${branch} has no upstream; this script cannot verify whether it has been pushed to GitHub.`);
    }
  }
} catch (error) {
  warnings.push(`Could not inspect branch push status: ${error.message}`);
}

if (warnings.length) {
  console.warn("Git release warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (failures.length) {
  console.error("Git release check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(`Run this from ${projectRoot} after committing and pushing release-critical changes.`);
  process.exit(1);
}

console.log("Git release check passed.");
