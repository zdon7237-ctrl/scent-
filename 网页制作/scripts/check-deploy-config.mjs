import { readFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot as defaultProjectRoot, repoRoot as defaultRepoRoot } from "./paths.mjs";

const failures = [];
const projectRoot = process.env.SCENT_ATOLL_PROJECT_ROOT
  ? path.resolve(process.env.SCENT_ATOLL_PROJECT_ROOT)
  : defaultProjectRoot;
const repoRoot = process.env.SCENT_ATOLL_REPO_ROOT
  ? path.resolve(process.env.SCENT_ATOLL_REPO_ROOT)
  : defaultRepoRoot;

async function readRequired(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    failures.push(`Missing deployment config: ${path.relative(repoRoot, filePath)} (${error.message})`);
    return "";
  }
}

function parseJson(label, text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    failures.push(`${label} is not valid JSON: ${error.message}`);
    return {};
  }
}

const securityHeaders = [
  ["X-Frame-Options", "DENY"],
  ["X-Content-Type-Options", "nosniff"],
  ["Strict-Transport-Security", "max-age=31536000"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"],
  ["Content-Security-Policy", "default-src 'self'"]
];

function entriesForSource(config, source) {
  return (config.headers || []).filter((entry) => entry.source === source);
}

function sourceHeaders(config, source) {
  return entriesForSource(config, source).flatMap((entry) => entry.headers || []);
}

function hasHeader(headers, key, value) {
  return headers.some((header) => {
    return header.key === key && String(header.value || "").includes(value);
  });
}

function netlifyHeaderBlock(text, source) {
  const marker = `for = "${source}"`;
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) return "";
  const sectionStart = text.lastIndexOf("[[headers]]", markerIndex);
  const nextSection = text.indexOf("[[headers]]", markerIndex + marker.length);
  return text.slice(sectionStart === -1 ? markerIndex : sectionStart, nextSection === -1 ? text.length : nextSection);
}

function hasTomlHeader(block, key, value) {
  return block.includes(`${key} = `) && block.includes(value);
}

function checkTomlHeaderSet(label, source, block, includeRobots = false) {
  if (!block) {
    failures.push(`${label} is missing header block for ${source}`);
    return;
  }
  for (const [key, value] of securityHeaders) {
    if (!hasTomlHeader(block, key, value)) failures.push(`${label} ${source} is missing ${key}: ${value}`);
  }
  if (includeRobots && !hasTomlHeader(block, "X-Robots-Tag", "noindex, nofollow")) {
    failures.push(`${label} ${source} is missing X-Robots-Tag: noindex, nofollow`);
  }
}

function checkHeaderSet(label, source, headers, includeRobots = false) {
  for (const [key, value] of securityHeaders) {
    if (!hasHeader(headers, key, value)) failures.push(`${label} ${source} is missing ${key}: ${value}`);
  }
  if (includeRobots && !hasHeader(headers, "X-Robots-Tag", "noindex, nofollow")) {
    failures.push(`${label} ${source} is missing X-Robots-Tag: noindex, nofollow`);
  }
}

function checkNetlify(label, text, options = {}) {
  if (options.requireBase && !text.includes('base = "网页制作"')) {
    failures.push(`${label} should set base = "网页制作"`);
  }
  if (text.includes("npm run launch:ready")) {
    failures.push(`${label} should not run npm run launch:ready; it is a local release gate`);
  }
  if (!text.includes('command = "npm run launch:strict"')) {
    failures.push(`${label} should run npm run launch:strict`);
  }
  if (!text.includes('publish = "dist-public"')) {
    failures.push(`${label} should publish dist-public`);
  }
  if (!text.includes('NODE_VERSION = "22"')) {
    failures.push(`${label} should set NODE_VERSION = "22"`);
  }
  checkTomlHeaderSet(label, "/*", netlifyHeaderBlock(text, "/*"));
  checkTomlHeaderSet(label, "/cart.html", netlifyHeaderBlock(text, "/cart.html"), true);
  checkTomlHeaderSet(label, "/404.html", netlifyHeaderBlock(text, "/404.html"), true);
}

function checkVercel(label, config, options = {}) {
  const {
    expectedOutput,
    expectedBuildFragments = ["npm run build"],
    expectedRewriteDestination,
    expectedProductRewriteDestination,
    expectedFunctionIncludes = {}
  } = options;
  const buildCommand = String(config.buildCommand || "");
  if (config.outputDirectory !== expectedOutput) {
    failures.push(`${label} outputDirectory should be ${expectedOutput}`);
  }
  if (!String(config.installCommand || "").includes("npm ci")) {
    failures.push(`${label} installCommand should run npm ci`);
  }
  for (const fragment of expectedBuildFragments) {
    if (!buildCommand.includes(fragment)) {
      failures.push(`${label} buildCommand should run ${fragment}`);
    }
  }
  if (buildCommand.includes("npm run launch:ready")) {
    failures.push(`${label} buildCommand should not run npm run launch:ready; it is a local release gate`);
  }
  for (const forbidden of ["db:migrate", "db:seed", "launch:strict", "build:public", "dist-public"]) {
    if (buildCommand.includes(forbidden)) {
      failures.push(`${label} buildCommand must not run ${forbidden}; migrations and fallback builds are separate release steps`);
    }
  }
  if (expectedRewriteDestination) {
    const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
    const hasApiRewrite = rewrites.some((rewrite) => {
      return rewrite.source === "/api/(.*)" && rewrite.destination === expectedRewriteDestination;
    });
    if (!hasApiRewrite) {
      failures.push(`${label} should rewrite /api/(.*) to ${expectedRewriteDestination}`);
    }
  }
  if (expectedProductRewriteDestination) {
    const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
    const hasProductRewrite = rewrites.some((rewrite) => {
      return rewrite.source === "/products/:slug" && rewrite.destination === expectedProductRewriteDestination;
    });
    if (!hasProductRewrite) {
      failures.push(`${label} should rewrite /products/:slug to ${expectedProductRewriteDestination}`);
    }
  }
  const hasSitemapRewrite = (config.rewrites || []).some((rewrite) => {
    return rewrite.source === "/sitemap.xml" && rewrite.destination === "/api/sitemap";
  });
  if (!hasSitemapRewrite) {
    failures.push(`${label} should rewrite /sitemap.xml to /api/sitemap so the production sitemap follows database products`);
  }
  const hasLegacyProductRedirect = (config.redirects || []).some((redirect) => {
    return redirect.source === "/product-:slug.html"
      && redirect.destination === "/products/:slug"
      && redirect.permanent === true;
  });
  if (!hasLegacyProductRedirect) {
    failures.push(`${label} should permanently redirect /product-:slug.html to /products/:slug`);
  }
  for (const [functionPath, expectedFiles] of Object.entries(expectedFunctionIncludes)) {
    const includeFiles = config.functions?.[functionPath]?.includeFiles;
    const included = Array.isArray(includeFiles) ? includeFiles : [includeFiles].filter(Boolean);
    for (const expectedFile of expectedFiles) {
      const isIncluded = included.some((pattern) => {
        if (pattern === expectedFile) return true;
        const brace = String(pattern).match(/^(.*)\{([^{}]+)\}(.*)$/);
        if (!brace) return false;
        return brace[2].split(",").some((part) => `${brace[1]}${part}${brace[3]}` === expectedFile);
      });
      if (!isIncluded) {
        failures.push(`${label} functions.${functionPath}.includeFiles should include ${expectedFile}`);
      }
    }
  }
  checkHeaderSet(label, "/(.*)", sourceHeaders(config, "/(.*)"));
  checkHeaderSet(label, "/cart.html", sourceHeaders(config, "/cart.html"), true);
  checkHeaderSet(label, "/404.html", sourceHeaders(config, "/404.html"), true);
}

function checkScript(packageJson, name, fragments) {
  const script = String(packageJson.scripts?.[name] || "");
  if (!script) {
    failures.push(`网页制作/package.json scripts.${name} is required`);
    return;
  }
  for (const fragment of fragments) {
    if (!script.includes(fragment)) {
      failures.push(`网页制作/package.json scripts.${name} should include ${fragment}`);
    }
  }
}

function checkCiWorkflow(text) {
  const requiredFragments = [
    "working-directory: 网页制作",
    "node-version-file: 网页制作/.nvmrc",
    "cache-dependency-path: 网页制作/package-lock.json",
    "npm ci",
    "for file in scripts/*.mjs",
    "for file in tests/*.test.mjs",
    "npm run launch:preflight",
    "npm run launch:strict",
    "Verify commercial Vercel deployment contract",
    "PUBLIC_OUTPUT_DIR: /tmp/scent-atoll-ci-strict",
    "SITE_URL: https://www.scent-atoll.test",
    "CONTACT_EMAIL: hello@scent-atoll.test",
    "CONTACT_WECHAT: ScentAtoll",
    "BUSINESS_NAME: Scent Atoll Studio Ltd",
    "STUDIO_BOOKING: Wechat appointment"
  ];
  for (const fragment of requiredFragments) {
    if (!text.includes(fragment)) {
      failures.push(`.github/workflows/scent-atoll-ci.yml should include ${fragment}`);
    }
  }
  if (text.includes("npm run launch:ready")) {
    failures.push(".github/workflows/scent-atoll-ci.yml should not run npm run launch:ready; it is a local release gate");
  }
}

function checkReleaseWorkflow(text) {
  const requiredFragments = [
    "workflow_dispatch:",
    "environment: production",
    "concurrency:",
    "VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}",
    "VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}",
    "VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}",
    "PRODUCTION_URL: ${{ vars.PRODUCTION_URL }}",
    "npm install --global vercel@55.0.0",
    "Validate release controls",
    "vercel pull --yes --environment=production",
    "vercel env pull /tmp/scent-atoll-production.env",
    "vercel env pull /tmp/scent-atoll-preview.env",
    "scripts/check-launch-env.mjs",
    "scripts/check-environment-isolation.mjs",
    "ALLOW_RELEASE_MIGRATION: production",
    "scripts/release-migrate.mjs",
    "vercel build --prod",
    "vercel deploy --prebuilt --prod --skip-domain",
    "scripts/check-commercial-deployment.mjs",
    "vercel promote",
    "DEPLOYMENT_URL: ${{ env.PRODUCTION_URL }}"
  ];
  for (const fragment of requiredFragments) {
    if (!text.includes(fragment)) failures.push(`.github/workflows/scent-atoll-release.yml should include ${fragment}`);
  }
  if (text.includes("db:seed")) {
    failures.push(".github/workflows/scent-atoll-release.yml must not seed a release database");
  }

  const migrationIndex = text.indexOf("scripts/release-migrate.mjs");
  const deploymentIndex = text.indexOf("vercel deploy --prebuilt --prod --skip-domain");
  const verificationIndex = text.indexOf("scripts/check-commercial-deployment.mjs", deploymentIndex);
  const promotionIndex = text.indexOf("vercel promote", deploymentIndex);
  if (!(migrationIndex !== -1 && migrationIndex < deploymentIndex && deploymentIndex < verificationIndex && verificationIndex < promotionIndex)) {
    failures.push(".github/workflows/scent-atoll-release.yml must run migration, candidate deploy, verification, then promotion in that order");
  }
}

function checkReservationWorkflow(text) {
  const requiredFragments = [
    "schedule:",
    'cron: "*/10 * * * *"',
    "PRODUCTION_URL: ${{ vars.PRODUCTION_URL }}",
    "CRON_SECRET: ${{ secrets.CRON_SECRET }}",
    "/api/internal/release-expired-reservations",
    "Authorization: Bearer $CRON_SECRET"
  ];
  for (const fragment of requiredFragments) {
    if (!text.includes(fragment)) {
      failures.push(`.github/workflows/release-expired-reservations.yml should include ${fragment}`);
    }
  }
}

const projectNvmrc = (await readRequired(path.join(projectRoot, ".nvmrc"))).trim();
if (projectNvmrc !== "22") {
  failures.push("网页制作/.nvmrc should pin Node 22");
}

const repoNvmrc = (await readRequired(path.join(repoRoot, ".nvmrc"))).trim();
if (repoNvmrc !== "22") {
  failures.push(".nvmrc should pin Node 22");
}

const projectPackage = parseJson("网页制作/package.json", await readRequired(path.join(projectRoot, "package.json")));
if (!String(projectPackage.engines?.node || "").includes(">=22")) {
  failures.push("网页制作/package.json engines.node should require >=22");
}
checkScript(projectPackage, "build", ["node scripts/build-site.mjs"]);
checkScript(projectPackage, "build:public", ["node scripts/build-public.mjs"]);
checkScript(projectPackage, "check:deploy", ["node scripts/check-deploy-config.mjs"]);
checkScript(projectPackage, "check:isolation", ["node scripts/check-environment-isolation.mjs"]);
checkScript(projectPackage, "check:env", ["node scripts/check-launch-env.mjs"]);
checkScript(projectPackage, "check:git-release", ["node scripts/check-git-release.mjs"]);
checkScript(projectPackage, "check:live", ["node scripts/check-live.mjs"]);
checkScript(projectPackage, "check:public", ["node scripts/check-public-build.mjs"]);
checkScript(projectPackage, "launch:check", [
  "npm run build:public",
  "npm run check:public",
  "npm run check:deploy"
]);
checkScript(projectPackage, "launch:preflight", [
  "npm test",
  "npm run build",
  "npm run launch:check"
]);
checkScript(projectPackage, "launch:ready", [
  "npm run check:git-release",
  "git diff --check -- :/",
  "npm run launch:preflight",
  "npm run launch:strict"
]);
checkScript(projectPackage, "launch:status", [
  "node scripts/launch-status.mjs"
]);
checkScript(projectPackage, "launch:strict", [
  "npm run check:env",
  "npm run build:public",
  "node scripts/check-public-build.mjs --strict",
  "npm run check:deploy"
]);
checkScript(projectPackage, "test", ["node --test tests/*.test.mjs"]);

const ciWorkflow = await readRequired(path.join(repoRoot, ".github/workflows/scent-atoll-ci.yml"));
checkCiWorkflow(ciWorkflow);

const releaseWorkflow = await readRequired(path.join(repoRoot, ".github/workflows/scent-atoll-release.yml"));
checkReleaseWorkflow(releaseWorkflow);

const reservationWorkflow = await readRequired(path.join(repoRoot, ".github/workflows/release-expired-reservations.yml"));
checkReservationWorkflow(reservationWorkflow);

await readRequired(path.join(projectRoot, "scripts/release-migrate.mjs"));
await readRequired(path.join(projectRoot, "scripts/check-commercial-deployment.mjs"));
await readRequired(path.join(projectRoot, "scripts/check-environment-isolation.mjs"));

const projectNetlify = await readRequired(path.join(projectRoot, "netlify.toml"));
checkNetlify("网页制作/netlify.toml", projectNetlify);

const repoNetlify = await readRequired(path.join(repoRoot, "netlify.toml"));
checkNetlify("netlify.toml", repoNetlify, { requireBase: true });

const projectVercel = parseJson("网页制作/vercel.json", await readRequired(path.join(projectRoot, "vercel.json")));
checkVercel("网页制作/vercel.json", projectVercel, {
  expectedOutput: "dist",
  expectedBuildFragments: ["npm run check:env", "npm run check:deploy", "npm run build"],
  expectedRewriteDestination: "/api/[...path]",
  expectedProductRewriteDestination: "/api/product-page?slug=:slug",
  expectedFunctionIncludes: {
    "api/[...path].mjs": ["src/assets/data.js"],
    "api/product-page.mjs": ["dist/product.html", "src/assets/data.js"]
  }
});

const repoVercel = parseJson("vercel.json", await readRequired(path.join(repoRoot, "vercel.json")));
checkVercel("vercel.json", repoVercel, {
  expectedOutput: "网页制作/dist",
  expectedBuildFragments: ["cd 网页制作", "npm run check:env", "npm run check:deploy", "npm run build"],
  expectedRewriteDestination: "/api/[...path]",
  expectedProductRewriteDestination: "/api/product-page?slug=:slug",
  expectedFunctionIncludes: {
    "api/[...path].mjs": ["网页制作/src/assets/data.js"],
    "api/product-page.mjs": ["网页制作/dist/product.html", "网页制作/src/assets/data.js"]
  }
});
if (!String(repoVercel.installCommand || "").includes("cd 网页制作")) {
  failures.push("vercel.json installCommand should install from 网页制作/");
}
if (!String(repoVercel.buildCommand || "").includes("cd 网页制作")) {
  failures.push("vercel.json buildCommand should build from 网页制作/");
}

if (failures.length) {
  console.error("Deploy config check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Deploy config check passed.");
