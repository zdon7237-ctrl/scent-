import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { projectRoot as defaultProjectRoot, repoRoot as defaultRepoRoot } from "./paths.mjs";

const execFileAsync = promisify(execFile);
const projectRoot = process.env.SCENT_ATOLL_PROJECT_ROOT
  ? path.resolve(process.env.SCENT_ATOLL_PROJECT_ROOT)
  : defaultProjectRoot;
const repoRoot = process.env.SCENT_ATOLL_REPO_ROOT
  ? path.resolve(process.env.SCENT_ATOLL_REPO_ROOT)
  : defaultRepoRoot;

const checks = [
  {
    name: "Deployment config",
    command: process.execPath,
    args: ["scripts/check-deploy-config.mjs"],
    cwd: projectRoot,
    next: "Fix Netlify / Vercel / CI / package release script configuration."
  },
  {
    name: "Launch environment",
    command: process.execPath,
    args: ["scripts/check-launch-env.mjs"],
    cwd: projectRoot,
    next: "Fill SITE_URL, CONTACT_EMAIL, and CONTACT_WECHAT. BUSINESS_NAME and STUDIO_BOOKING have safe defaults."
  },
  {
    name: "Git release handoff",
    command: process.execPath,
    args: ["scripts/check-git-release.mjs"],
    cwd: projectRoot,
    next: "Commit and push release-critical files; keep .env.production, dist/, and dist-public/ out of Git."
  },
  {
    name: "Patch whitespace",
    command: "git",
    args: ["diff", "--check", "--", ":/"],
    cwd: repoRoot,
    next: "Fix whitespace errors reported by git diff --check -- :/."
  }
];

function compact(text) {
  const lines = String(text || "").trim().split("\n").filter(Boolean);
  if (lines.length <= 10) return lines;
  return [...lines.slice(0, 10), `... ${lines.length - 10} more line(s). Run the failing check directly for full output.`];
}

async function runCheck(check) {
  try {
    const result = await execFileAsync(check.command, check.args, {
      cwd: check.cwd,
      env: process.env,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10
    });
    return { check, ok: true, output: compact(`${result.stdout}\n${result.stderr}`) };
  } catch (error) {
    return {
      check,
      ok: false,
      output: compact(`${error.stdout || ""}\n${error.stderr || error.message}`)
    };
  }
}

const results = [];
for (const check of checks) {
  results.push(await runCheck(check));
}

console.log("Scent Atoll launch status");
for (const result of results) {
  console.log(`\n${result.ok ? "PASS" : "FAIL"} ${result.check.name}`);
  for (const line of result.output) console.log(`  ${line}`);
  if (!result.ok) console.log(`  Next: ${result.check.next}`);
}

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`\nLaunch status: ${failed.length} check(s) still need attention.`);
  console.error("After these pass, run npm run launch:ready locally, deploy with npm run launch:strict, then run npm run check:live against the production domain.");
  process.exit(1);
}

console.log("\nLaunch status: local pre-release gates are clear.");
console.log("Next: deploy with npm run launch:strict, then run SITE_URL=https://your-domain npm run check:live.");
