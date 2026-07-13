import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const fetchMock = `
globalThis.fetch = async (input) => {
  const pathname = new URL(String(input)).pathname;
  if (pathname.endsWith('/environments/production')) {
    return Response.json({
      protection_rules: process.env.MOCK_NO_REVIEWER ? [] : [{ type: 'required_reviewers', reviewers: [{ type: 'User', reviewer: { login: 'owner' } }] }],
      can_admins_bypass: false,
      deployment_branch_policy: { protected_branches: false, custom_branch_policies: true }
    });
  }
  if (pathname.endsWith('/deployment-branch-policies')) {
    return Response.json({ branch_policies: [{ name: 'main' }] });
  }
  if (pathname.endsWith('/branches/main/protection')) {
    return Response.json({
      required_pull_request_reviews: { required_approving_review_count: 1 },
      required_status_checks: { contexts: [process.env.MOCK_UNRELATED_CHECK ? 'unrelated/check' : 'Scent Atoll CI / build-and-test'] },
      enforce_admins: { enabled: true }
    });
  }
  if (pathname.includes('/v9/projects/')) {
    return Response.json({ nodeVersion: process.env.MOCK_NODE_VERSION || '22.x' });
  }
  if (pathname.includes('/v2/teams/')) {
    return Response.json({ billing: { plan: process.env.MOCK_VERCEL_PLAN || 'pro' } });
  }
  return new Response('{}', { status: 404 });
};
`;

function runCheck(overrides = {}) {
  return spawnSync(
    process.execPath,
    ["--import", `data:text/javascript,${encodeURIComponent(fetchMock)}`, "scripts/check-platform-release-settings.mjs"],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        GITHUB_RELEASE_AUDIT_TOKEN: "github-audit-token",
        GITHUB_REPOSITORY: "owner/scent",
        GITHUB_API_URL: "https://github.test",
        VERCEL_TOKEN: "vercel-token",
        VERCEL_ORG_ID: "team_test",
        VERCEL_PROJECT_ID: "project_test",
        VERCEL_API_URL: "https://vercel.test",
        ...overrides
      },
      encoding: "utf8"
    }
  );
}

describe("external platform release settings audit", () => {
  it("accepts protected GitHub settings, Node 22, and a commercial Vercel plan", () => {
    const result = runCheck();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /settings audit passed/);
  });

  it("rejects a production Environment without a reviewer", () => {
    const result = runCheck({ MOCK_NO_REVIEWER: "1" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must have at least one required reviewer/);
  });

  it("rejects Vercel Node 24 and Hobby for commercial release", () => {
    const result = runCheck({ MOCK_NODE_VERSION: "24.x", MOCK_VERCEL_PLAN: "hobby" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Node.js version must be 22.x/);
    assert.match(result.stderr, /Vercel Hobby is not approved/);
  });

  it("rejects branch protection that requires only an unrelated status check", () => {
    const result = runCheck({ MOCK_UNRELATED_CHECK: "1" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must require the Scent Atoll CI \/ build-and-test status check/);
  });
});
