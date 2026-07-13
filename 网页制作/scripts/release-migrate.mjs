import { closePool } from "../server/src/db.mjs";
import { migrate } from "../server/src/migrate.mjs";

const deploymentEnvironment = String(process.env.DEPLOYMENT_ENV || "").trim();
const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const confirmation = String(process.env.ALLOW_RELEASE_MIGRATION || "").trim();

if (!["preview", "production"].includes(deploymentEnvironment)) {
  throw new Error("DEPLOYMENT_ENV must be preview or production before a release migration.");
}

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required; release migrations must never silently skip.");
}

if (confirmation !== deploymentEnvironment) {
  throw new Error(`Set ALLOW_RELEASE_MIGRATION=${deploymentEnvironment} to confirm the target environment.`);
}

let database;
try {
  const parsed = new URL(databaseUrl);
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) throw new Error("not PostgreSQL");
  database = `${parsed.hostname}${parsed.pathname}`;
} catch {
  throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
}

try {
  console.log(`Applying ${deploymentEnvironment} migration to ${database}.`);
  const result = await migrate();
  if (result.skipped) throw new Error(`Migration unexpectedly skipped: ${result.reason}`);
  console.log(`Release migration verified: ${result.migrationId}`);
} finally {
  await closePool();
}
