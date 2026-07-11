import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";

const [productionPath, previewPath] = process.argv.slice(2);
const failures = [];

if (!productionPath || !previewPath) {
  console.error("Usage: node scripts/check-environment-isolation.mjs <production-env-file> <preview-env-file>");
  process.exit(1);
}

async function readEnvironment(label, filePath) {
  try {
    return parseEnv(await readFile(filePath, "utf8"));
  } catch (error) {
    failures.push(`${label} environment file could not be read: ${error.message}`);
    return {};
  }
}

const [production, preview] = await Promise.all([
  readEnvironment("Production", productionPath),
  readEnvironment("Preview", previewPath)
]);

if (production.DEPLOYMENT_ENV !== "production") {
  failures.push("Production DEPLOYMENT_ENV must equal production.");
}
if (preview.DEPLOYMENT_ENV !== "preview") {
  failures.push("Preview DEPLOYMENT_ENV must equal preview.");
}

const isolatedVariables = [
  "SITE_URL",
  "APP_ORIGIN",
  "DATABASE_URL",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "BLOB_READ_WRITE_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "CRON_SECRET"
];

for (const name of isolatedVariables) {
  if (!String(production[name] || "").trim()) failures.push(`Production ${name} is required for isolation verification.`);
  if (!String(preview[name] || "").trim()) failures.push(`Preview ${name} is required for isolation verification.`);
  if (production[name] && preview[name] && production[name] === preview[name]) {
    failures.push(`${name} must use different Production and Preview values.`);
  }
}

for (const [label, environment] of [["Production", production], ["Preview", preview]]) {
  if (String(environment.PAYMENT_WEBHOOK_SECRET || "").trim()) {
    failures.push(`${label} must not define PAYMENT_WEBHOOK_SECRET.`);
  }
}

if (failures.length) {
  console.error("Environment isolation check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Production and Preview environment isolation check passed.");
