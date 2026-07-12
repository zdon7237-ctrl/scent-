const productionBranch = String(process.env.SCENT_ATOLL_PRODUCTION_BRANCH || "main").trim();
const gitCommitRef = String(process.env.VERCEL_GIT_COMMIT_REF || "").trim();
const controlledRelease = String(process.env.SCENT_ATOLL_CONTROLLED_RELEASE || "") === "1";

// Vercel's ignoreCommand contract is inverted: exit 0 skips the deployment,
// while exit 1 continues it. Production is released only by the protected
// GitHub workflow after its database migration has succeeded.
if (gitCommitRef === productionBranch && !controlledRelease) {
  console.log(`Skipping automatic Vercel Production deployment for ${productionBranch}; use the protected release workflow.`);
  process.exit(0);
}

console.log("Allowing Vercel build (Preview or controlled Production release).");
process.exit(1);
