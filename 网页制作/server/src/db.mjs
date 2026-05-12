import pg from "pg";

const { Pool } = pg;

let pool = null;

export function databaseUrl() {
  return process.env.DATABASE_URL || "";
}

export function hasDatabaseUrl() {
  return Boolean(databaseUrl());
}

export function getPool() {
  if (!hasDatabaseUrl()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl()
    });
  }
  return pool;
}

export async function withPgClient(callback) {
  const activePool = getPool();
  if (!activePool) throw new Error("DATABASE_URL is not set.");
  const client = await activePool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function withPgTransaction(callback) {
  return withPgClient(async (client) => {
    await client.query("BEGIN");
    try {
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

export function isSafeTestDatabaseUrl(url = databaseUrl()) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const databaseName = parsed.pathname.replace(/^\//, "");
    return /(^|[_-])(test|testing)($|[_-])|_test$|^test_/i.test(databaseName);
  } catch {
    return false;
  }
}
