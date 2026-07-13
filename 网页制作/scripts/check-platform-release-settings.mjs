const failures = [];

function value(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

async function fetchJson(label, url, token) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
    if (!response.ok) {
      failures.push(`${label} could not be inspected (HTTP ${response.status}).`);
      return null;
    }
    return await response.json();
  } catch (error) {
    failures.push(`${label} could not be inspected: ${error.message}`);
    return null;
  }
}

const githubToken = value("GITHUB_RELEASE_AUDIT_TOKEN");
const githubRepository = value("GITHUB_REPOSITORY");
const githubApiUrl = value("GITHUB_API_URL", "https://api.github.com").replace(/\/$/, "");
const productionEnvironment = value("GITHUB_PRODUCTION_ENVIRONMENT", "production");
const productionBranch = value("SCENT_ATOLL_PRODUCTION_BRANCH", "main");
const requiredCiCheck = value("GITHUB_REQUIRED_CI_CHECK", "Scent Atoll CI / build-and-test");
const vercelToken = value("VERCEL_TOKEN");
const vercelOrgId = value("VERCEL_ORG_ID");
const vercelProjectId = value("VERCEL_PROJECT_ID");
const vercelApiUrl = value("VERCEL_API_URL", "https://api.vercel.com").replace(/\/$/, "");

for (const [name, current] of [
  ["GITHUB_RELEASE_AUDIT_TOKEN", githubToken],
  ["GITHUB_REPOSITORY", githubRepository],
  ["VERCEL_TOKEN", vercelToken],
  ["VERCEL_ORG_ID", vercelOrgId],
  ["VERCEL_PROJECT_ID", vercelProjectId]
]) {
  if (!current) failures.push(`${name} is required for the platform release settings audit.`);
}

if (!failures.length) {
  const environmentUrl = `${githubApiUrl}/repos/${githubRepository}/environments/${encodeURIComponent(productionEnvironment)}`;
  const branchUrl = `${githubApiUrl}/repos/${githubRepository}/branches/${encodeURIComponent(productionBranch)}/protection`;
  const projectUrl = `${vercelApiUrl}/v9/projects/${encodeURIComponent(vercelProjectId)}?teamId=${encodeURIComponent(vercelOrgId)}`;
  const teamUrl = `${vercelApiUrl}/v2/teams/${encodeURIComponent(vercelOrgId)}`;

  const [environment, protection, project, team] = await Promise.all([
    fetchJson("GitHub production Environment", environmentUrl, githubToken),
    fetchJson(`GitHub ${productionBranch} branch protection`, branchUrl, githubToken),
    fetchJson("Vercel project", projectUrl, vercelToken),
    fetchJson("Vercel team billing plan", teamUrl, vercelToken)
  ]);

  if (environment) {
    const reviewerRule = (environment.protection_rules || []).find((rule) => rule.type === "required_reviewers");
    if (!reviewerRule || !(reviewerRule.reviewers || []).length) {
      failures.push("GitHub production Environment must have at least one required reviewer.");
    }
    if (environment.can_admins_bypass !== false) {
      failures.push("GitHub production Environment must prevent administrators from bypassing protection rules.");
    }

    const branchPolicy = environment.deployment_branch_policy || {};
    if (!branchPolicy.custom_branch_policies || branchPolicy.protected_branches) {
      failures.push("GitHub production Environment must use a custom deployment branch policy limited to main.");
    } else {
      const policies = await fetchJson(
        "GitHub production Environment branch policies",
        `${environmentUrl}/deployment-branch-policies`,
        githubToken
      );
      const names = (policies?.branch_policies || []).map((policy) => policy.name);
      if (names.length !== 1 || names[0] !== productionBranch) {
        failures.push(`GitHub production Environment must allow only the ${productionBranch} branch.`);
      }
    }
  }

  if (protection) {
    const reviews = protection.required_pull_request_reviews;
    if (!reviews || Number(reviews.required_approving_review_count || 0) < 1) {
      failures.push(`${productionBranch} branch protection must require at least one approving PR review.`);
    }
    const statusChecks = protection.required_status_checks;
    const requiredChecks = [
      ...(statusChecks?.contexts || []),
      ...(statusChecks?.checks || []).map((check) => check.context)
    ].filter(Boolean);
    if (!requiredChecks.includes(requiredCiCheck)) {
      failures.push(`${productionBranch} branch protection must require the ${requiredCiCheck} status check before merge.`);
    }
    if (!protection.enforce_admins?.enabled) {
      failures.push(`${productionBranch} branch protection must include administrators.`);
    }
  }

  if (project) {
    const nodeVersion = String(project.nodeVersion || project.settings?.nodeVersion || "");
    if (!/^22(?:\.x)?$/.test(nodeVersion)) {
      failures.push(`Vercel project Node.js version must be 22.x (reported: ${nodeVersion || "not set"}).`);
    }
  }

  if (team) {
    const plan = String(team.billing?.plan || team.plan || "").toLowerCase();
    if (!plan) {
      failures.push("Vercel team billing plan could not be determined.");
    } else if (plan === "hobby") {
      failures.push("Vercel Hobby is not approved for this commercial launch; upgrade the project scope to Pro before release.");
    }
  }
}

if (failures.length) {
  console.error("Platform release settings audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Platform release settings audit passed.");
