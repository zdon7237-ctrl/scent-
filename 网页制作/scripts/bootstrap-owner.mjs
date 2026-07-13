import { randomUUID, scryptSync } from "node:crypto";
import { loadProductionEnv } from "./load-env.mjs";
import { hasDatabaseUrl, withPgTransaction } from "../server/src/db.mjs";

loadProductionEnv();

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function hashPassword(password) {
  const salt = randomUUID().replaceAll("-", "");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

if (!hasDatabaseUrl()) throw new Error("DATABASE_URL is required.");
if (required("BOOTSTRAP_CONFIRM") !== "create-first-owner") {
  throw new Error("BOOTSTRAP_CONFIRM must equal create-first-owner.");
}

const email = required("BOOTSTRAP_OWNER_EMAIL").toLowerCase();
const password = required("BOOTSTRAP_OWNER_PASSWORD");
const name = String(process.env.BOOTSTRAP_OWNER_NAME || "Scent Atoll Owner").trim();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("BOOTSTRAP_OWNER_EMAIL is invalid.");
if (password.length < 14) throw new Error("BOOTSTRAP_OWNER_PASSWORD must contain at least 14 characters.");

await withPgTransaction(async (client) => {
  const owners = await client.query("select id from admin_users where role = 'owner' and status = 'active' for update");
  if (owners.rowCount) throw new Error("An active owner already exists; bootstrap is one-time only.");
  const id = randomUUID();
  await client.query(
    `insert into admin_users (id, email, name, password_hash, role, status)
     values ($1, $2, $3, $4, 'owner', 'active')`,
    [id, email, name, hashPassword(password)]
  );
  await client.query(
    `insert into operation_logs (id, actor, actor_admin_id, actor_name, actor_email, actor_role, action, entity_type, entity_id, reason)
     values ($1, 'bootstrap', $2, $3, $4, 'owner', 'bootstrap_owner', 'admin_user', $2, 'One-time production owner bootstrap')`,
    [randomUUID(), id, name, email]
  );
});

console.log(`Production owner created for ${email}. Remove BOOTSTRAP_OWNER_* variables now.`);
