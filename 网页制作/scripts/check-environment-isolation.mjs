import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";

const args = process.argv.slice(2);
const failures = [];

function prefixedEnvironment(prefix) {
  return Object.fromEntries(
    Object.entries(process.env)
      .filter(([name]) => name.startsWith(prefix))
      .map(([name, value]) => [name.slice(prefix.length), value])
  );
}

async function readEnvironment(label, filePath) {
  try {
    return parseEnv(await readFile(filePath, "utf8"));
  } catch (error) {
    failures.push(`${label} environment file could not be read: ${error.message}`);
    return {};
  }
}

let production;
let preview;
if (args[0] === "--prefixed-env") {
  production = prefixedEnvironment("ISOLATION_PRODUCTION_");
  preview = prefixedEnvironment("ISOLATION_PREVIEW_");
} else {
  const [productionPath, previewPath] = args;
  if (!productionPath || !previewPath) {
    console.error("Usage: node scripts/check-environment-isolation.mjs <production-env-file> <preview-env-file>");
    console.error("   or: node scripts/check-environment-isolation.mjs --prefixed-env");
    process.exit(1);
  }
  [production, preview] = await Promise.all([
    readEnvironment("Production", productionPath),
    readEnvironment("Preview", previewPath)
  ]);
}

function value(environment, ...names) {
  for (const name of names) {
    const current = String(environment[name] || "").trim();
    if (current) return current;
  }
  return "";
}

function requireDifferent(label, productionValue, previewValue) {
  if (!productionValue) failures.push(`Production ${label} is required for isolation verification.`);
  if (!previewValue) failures.push(`Preview ${label} is required for isolation verification.`);
  if (productionValue && previewValue && productionValue === previewValue) {
    failures.push(`${label} must identify different Production and Preview resources.`);
  }
}

function databaseIdentity(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) return "";
    const hostname = parsed.hostname.toLowerCase().replace(/-pooler(?=\.)/, "");
    return `${hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "";
  }
}

function urlIdentity(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return "";
  }
}

function managedIdentity(environment, { idNames = [], legacyNames = [] }) {
  const id = value(environment, ...idNames);
  if (id) return { kind: "resource ID", value: id };
  const legacy = value(environment, ...legacyNames);
  if (legacy) return { kind: "legacy credential", value: legacy };
  return { kind: "", value: "" };
}

if (production.DEPLOYMENT_ENV !== "production") {
  failures.push("Production DEPLOYMENT_ENV must equal production.");
}
if (preview.DEPLOYMENT_ENV !== "preview") {
  failures.push("Preview DEPLOYMENT_ENV must equal preview.");
}

for (const name of ["SITE_URL", "APP_ORIGIN", "EMAIL_FROM", "CRON_SECRET"]) {
  requireDifferent(name, value(production, name), value(preview, name));
}

const productionDatabaseUrl = value(production, "DATABASE_URL");
const previewDatabaseUrl = value(preview, "DATABASE_URL");
const productionDatabase = databaseIdentity(productionDatabaseUrl);
const previewDatabase = databaseIdentity(previewDatabaseUrl);
if (productionDatabaseUrl && !productionDatabase) failures.push("Production DATABASE_URL must be a PostgreSQL URL.");
if (previewDatabaseUrl && !previewDatabase) failures.push("Preview DATABASE_URL must be a PostgreSQL URL.");
requireDifferent("DATABASE_URL resource", productionDatabase, previewDatabase);

const productionBlob = managedIdentity(production, {
  idNames: ["BLOB_STORE_ID"],
  legacyNames: ["BLOB_READ_WRITE_TOKEN"]
});
const previewBlob = managedIdentity(preview, {
  idNames: ["BLOB_STORE_ID"],
  legacyNames: ["BLOB_READ_WRITE_TOKEN"]
});
if (productionBlob.kind && previewBlob.kind && productionBlob.kind !== previewBlob.kind) {
  failures.push("Blob isolation must use the same identity type in Production and Preview (prefer BLOB_STORE_ID).");
}
requireDifferent("Blob resource", productionBlob.value, previewBlob.value);

const productionRedisUrl = value(production, "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_KV_REST_API_URL");
const previewRedisUrl = value(preview, "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_KV_REST_API_URL");
const productionRedis = urlIdentity(productionRedisUrl);
const previewRedis = urlIdentity(previewRedisUrl);
if (productionRedisUrl && !productionRedis) failures.push("Production Upstash REST URL must be a valid URL.");
if (previewRedisUrl && !previewRedis) failures.push("Preview Upstash REST URL must be a valid URL.");
requireDifferent("Upstash Redis resource", productionRedis, previewRedis);

const productionResend = managedIdentity(production, {
  idNames: ["RESEND_RESOURCE_ID"],
  legacyNames: ["RESEND_API_KEY"]
});
const previewResend = managedIdentity(preview, {
  idNames: ["RESEND_RESOURCE_ID"],
  legacyNames: ["RESEND_API_KEY"]
});
if (productionResend.kind && previewResend.kind && productionResend.kind !== previewResend.kind) {
  failures.push("Resend isolation must use the same identity type in Production and Preview (prefer RESEND_RESOURCE_ID).");
}
requireDifferent("Resend resource", productionResend.value, previewResend.value);

for (const [label, environment] of [["Production", production], ["Preview", preview]]) {
  if (value(environment, "PAYMENT_WEBHOOK_SECRET")) {
    failures.push(`${label} must not define PAYMENT_WEBHOOK_SECRET.`);
  }
}

if (failures.length) {
  console.error("Environment isolation check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Production and Preview environment isolation check passed.");
