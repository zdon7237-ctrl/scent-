import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { after, before, beforeEach, describe, it } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(path.join(tmpdir(), "scent-api-test-"));
const dbFile = path.join(tempRoot, "db.json");
const seedAdminEmail = "admin@scent.local";
const seedAdminPassword = "dev-admin";
const requestedDatabaseUrl = process.env.DATABASE_URL || "";
let postgresSmokeSkipReason = "";

function looksLikeTestDatabaseUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const databaseName = parsed.pathname.replace(/^\//, "");
    return /(^|[_-])(test|testing)($|[_-])|_test$|^test_/i.test(databaseName);
  } catch {
    return false;
  }
}

if (requestedDatabaseUrl && !looksLikeTestDatabaseUrl(requestedDatabaseUrl)) {
  delete process.env.DATABASE_URL;
  postgresSmokeSkipReason = "DATABASE_URL does not look like a test database; PostgreSQL smoke test skipped.";
}

if (process.env.DATABASE_URL) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("select 1");
  } catch (error) {
    delete process.env.DATABASE_URL;
    postgresSmokeSkipReason = `DATABASE_URL is set but PostgreSQL is not reachable: ${error.message}`;
  } finally {
    await pool.end().catch(() => {});
  }
}

process.env.MEMBER_DB = dbFile;
process.env.SEED_ADMIN_EMAIL = seedAdminEmail;
process.env.SEED_ADMIN_PASSWORD = seedAdminPassword;
process.env.PAYMENT_WEBHOOK_SECRET = "test-webhook-secret";
process.env.CRON_SECRET = "test-reservation-cron-secret-at-least-32-characters";
process.env.PUBLIC_DIR = path.join(projectRoot, "dist");

const { server } = await import(pathToFileURL(path.join(projectRoot, "server/src/app.mjs")).href);
const { closePool, hasDatabaseUrl, isSafeTestDatabaseUrl, withPgClient } = await import(pathToFileURL(path.join(projectRoot, "server/src/db.mjs")).href);
const { migrate } = await import(pathToFileURL(path.join(projectRoot, "server/src/migrate.mjs")).href);
const { createRepository } = await import(pathToFileURL(path.join(projectRoot, "server/src/repository.mjs")).href);
const { seed } = await import(pathToFileURL(path.join(projectRoot, "server/src/seed.mjs")).href);
const testRepository = createRepository({ dataFile: dbFile });

let baseUrl;
let cachedAdminCookie;

function listen(serverInstance) {
  return new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    serverInstance.once("error", onError);
    serverInstance.listen(0, "127.0.0.1", () => {
      serverInstance.off("error", onError);
      const address = serverInstance.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
}

function close(serverInstance) {
  if (!serverInstance.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    serverInstance.close((error) => (error ? reject(error) : resolve()));
  });
}

async function resetDb() {
  if (hasDatabaseUrl()) {
    await testRepository.write({});
    return;
  }
  await rm(dbFile, { force: true });
}

async function readDb() {
  return hasDatabaseUrl()
    ? testRepository.read()
    : JSON.parse(await readFile(dbFile, "utf8"));
}

async function writeDb(db) {
  if (hasDatabaseUrl()) {
    await testRepository.write(db);
    return;
  }
  await mkdir(path.dirname(dbFile), { recursive: true });
  await writeFile(dbFile, JSON.stringify(db, null, 2));
}

async function api(pathname, options = {}) {
  const method = options.method || "GET";
  const headers = { ...(options.headers || {}) };
  if (options.cookie) headers.cookie = options.cookie;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (!options.skipOrigin && ["POST", "PATCH", "PUT", "DELETE"].includes(method) && !headers.origin) {
    headers.origin = baseUrl;
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const payload = text && contentType.includes("application/json") ? JSON.parse(text) : text || null;
  if (options.expectedStatus !== undefined) {
    assert.equal(response.status, options.expectedStatus, payload?.error || text);
  }
  return { response, payload };
}

function cookieFrom(response) {
  const header = response.headers.get("set-cookie");
  assert.ok(header, "expected response to set a session cookie");
  return header.split(";")[0];
}

async function registerMember(overrides = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const result = await api("/api/auth/register", {
    method: "POST",
    expectedStatus: 201,
    body: {
      email: `member-${suffix}@example.com`,
      phone: `139${String(Math.floor(Math.random() * 100000000)).padStart(8, "0")}`,
      password: "secret123",
      name: "测试会员",
      acceptTerms: true,
      acceptPrivacy: true,
      ...overrides
    }
  });
  return {
    cookie: cookieFrom(result.response),
    member: result.payload
  };
}

async function getAdminCookie() {
  if (cachedAdminCookie) return cachedAdminCookie;
  const result = await api("/api/admin/auth/login", {
    method: "POST",
    expectedStatus: 200,
    body: {
      email: seedAdminEmail,
      password: seedAdminPassword
    }
  });
  cachedAdminCookie = cookieFrom(result.response);
  return cachedAdminCookie;
}

async function adminApi(pathname, options = {}) {
  return api(pathname, {
    ...options,
    cookie: options.cookie || await getAdminCookie()
  });
}

async function loginAdmin(email = seedAdminEmail, password = seedAdminPassword) {
  const result = await api("/api/admin/auth/login", {
    method: "POST",
    expectedStatus: 200,
    body: { email, password }
  });
  return {
    cookie: cookieFrom(result.response),
    admin: result.payload.admin
  };
}

async function supportAdminCookie() {
  await api("/api/admin/auth/login", {
    method: "POST",
    expectedStatus: 200,
    body: {
      email: seedAdminEmail,
      password: seedAdminPassword
    }
  });
  const db = await readDb();
  assert.equal(db.adminUsers.length, 1);
  db.adminUsers[0].role = "support";
  db.adminSessions = [];
  await writeDb(db);
  cachedAdminCookie = null;
  return (await loginAdmin()).cookie;
}

function productionEnv(overrides = {}) {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    MEMBER_DB: path.join(tempRoot, `production-${Date.now()}-${Math.random().toString(16).slice(2)}.json`),
    PUBLIC_DIR: path.join(projectRoot, "dist"),
    ...overrides
  };
  delete env.PORT;
  return env;
}

function runImportWithEnv(env) {
  return spawnSync(process.execPath, ["--input-type=module", "--eval", "await import('./server/src/app.mjs');"], {
    cwd: projectRoot,
    env,
    encoding: "utf8"
  });
}

function runScriptWithoutDatabaseUrl(scriptPath) {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  return spawnSync(process.execPath, [scriptPath], {
    cwd: projectRoot,
    env,
    encoding: "utf8"
  });
}

async function memberProfile(cookie) {
  return api("/api/auth/me", { cookie, expectedStatus: 200 });
}

async function adminMallItem(itemId = "pm-random-sample-1") {
  const result = await adminApi("/api/admin/points-mall/items", {
    expectedStatus: 200
  });
  return result.payload.items.find((item) => item.id === itemId);
}

async function createOrder(cookie, quantity = 2) {
  await api("/api/products", { expectedStatus: 200 });
  const result = await api("/api/checkout/create-order", {
    method: "POST",
    cookie,
    expectedStatus: 201,
    body: {
      items: [{ productId: "vespree", quantity }],
      acceptTerms: true,
      acceptPrivacy: true
    }
  });
  return result.payload.order;
}

async function completeOrder(cookie, quantity = 2) {
  const order = await createOrder(cookie, quantity);
  const paid = await adminApi(`/api/admin/orders/${order.id}/pay`, {
    method: "POST",
    expectedStatus: 200
  });
  assert.equal(paid.payload.order.status, "paid");

  const shipped = await adminApi(`/api/admin/orders/${order.id}/ship`, {
    method: "POST",
    expectedStatus: 200,
    body: {
      carrier: "顺丰速运",
      trackingNo: `SF${Date.now()}${Math.floor(Math.random() * 1000)}`
    }
  });
  assert.equal(shipped.payload.order.status, "shipped");

  const completed = await api(`/api/member/orders/${order.id}/confirm-receipt`, {
    method: "POST",
    cookie,
    expectedStatus: 200
  });
  assert.equal(completed.payload.order.status, "completed");
  return completed.payload.order;
}

describe("server API business rules", { concurrency: false }, () => {
  before(async () => {
    if (hasDatabaseUrl()) await migrate();
    await listen(server);
  });

  beforeEach(async () => {
    await resetDb();
    cachedAdminCookie = null;
  });

  after(async () => {
    await close(server);
    await closePool();
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("keeps JSON fallback when DATABASE_URL is not configured", () => {
    const migrateResult = runScriptWithoutDatabaseUrl("scripts/migrate.mjs");
    assert.equal(migrateResult.status, 0, migrateResult.stderr || migrateResult.stdout);
    assert.match(migrateResult.stdout, /Migration skipped: DATABASE_URL is not set/);

    const seedResult = runScriptWithoutDatabaseUrl("scripts/seed.mjs");
    assert.equal(seedResult.status, 0, seedResult.stderr || seedResult.stdout);
    assert.match(seedResult.stdout, /Seed skipped: DATABASE_URL is not set/);
  });

  it("runs idempotent PostgreSQL migration and seed smoke when a safe test database is available", async (t) => {
    if (!hasDatabaseUrl()) return t.skip(postgresSmokeSkipReason || "DATABASE_URL is not set; PostgreSQL smoke test skipped.");
    if (!isSafeTestDatabaseUrl()) return t.skip("DATABASE_URL does not look like a test database; PostgreSQL smoke test skipped.");

    try {
      await withPgClient((client) => client.query("select 1"));
    } catch (error) {
      return t.skip(`DATABASE_URL is set but PostgreSQL is not reachable: ${error.message}`);
    }

    await migrate();
    await migrate();
    await seed();
    await seed();

    const result = await withPgClient((client) => client.query(`
      select
        (select count(*)::int from member_tiers where code in ('base','silver','gold','diamond','black','supreme')) as default_tier_count,
        (select count(*)::int from admin_users where email = $1) as seed_admin_count,
        (select count(*)::int from points_mall_items where id in ('pm-random-sample-1','pm-random-sample-3','pm-tea-official-samples','pm-tea-sample','pm-wood-sample')) as mall_item_count,
        (select count(*)::int from products where slug = 'vespree') as vespree_count,
        (select count(*)::int from schema_migrations where id = '001_initial_postgres_foundation') as migration_count
    `, [seedAdminEmail]));
    assert.equal(result.rows[0].default_tier_count, 6);
    assert.equal(result.rows[0].seed_admin_count, 1);
    assert.equal(result.rows[0].mall_item_count, 5);
    assert.equal(result.rows[0].vespree_count, 1);
    assert.equal(result.rows[0].migration_count, 1);
  });

  it("authenticates the seed owner admin and exposes session-scoped permissions", async () => {
    await api("/api/admin/orders", { expectedStatus: 401 });

    await api("/api/admin/auth/login", {
      method: "POST",
      expectedStatus: 401,
      body: { email: seedAdminEmail, password: "wrong-password" }
    });

    const { cookie, admin } = await loginAdmin();
    assert.equal(admin.email, seedAdminEmail);
    assert.equal(admin.role, "owner");
    assert.ok(admin.permissions.includes("admin:export"));
    assert.ok(admin.permissions.includes("orders:write"));

    const me = await api("/api/admin/auth/me", {
      cookie,
      expectedStatus: 200
    });
    assert.equal(me.payload.admin.email, seedAdminEmail);
    assert.equal(me.payload.admin.role, "owner");
    assert.ok(me.payload.admin.permissions.includes("admin:export"));

    const exported = await api("/api/admin/members/export.csv", {
      cookie,
      expectedStatus: 200
    });
    assert.match(exported.payload, /"id","name","email","phone","tier","available_points","lifetime_paid_yuan","created_at"/);

    const db = await readDb();
    const adminAttempts = db.loginAttempts.filter((item) => item.kind === "admin_login");
    assert.equal(adminAttempts.length, 2);
    assert.deepEqual(adminAttempts.map((item) => item.succeeded).sort(), [false, true]);
    assert.ok(adminAttempts.every((item) => item.identityHash && !item.identityHash.includes("@")));
  });

  it("rotates the owner session on password change and revokes other admin sessions", async () => {
    const first = await loginAdmin();
    let db = await readDb();
    const secondSessionId = "second-owner-session";
    db.adminSessions.push({
      id: secondSessionId,
      adminUserId: first.admin.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      lastSeenAt: new Date().toISOString(),
      revokedAt: null
    });
    await writeDb(db);
    const secondCookie = `sa_admin_session=${secondSessionId}`;
    const newPassword = "new-owner-password-2026";

    await api("/api/admin/auth/change-password", {
      method: "POST",
      cookie: first.cookie,
      expectedStatus: 403,
      body: { currentPassword: "wrong-password", newPassword }
    });

    const changed = await api("/api/admin/auth/change-password", {
      method: "POST",
      cookie: first.cookie,
      expectedStatus: 200,
      body: { currentPassword: seedAdminPassword, newPassword }
    });
    const rotatedCookie = cookieFrom(changed.response);
    assert.equal(changed.payload.admin.email, seedAdminEmail);

    await api("/api/admin/auth/me", { cookie: first.cookie, expectedStatus: 401 });
    await api("/api/admin/auth/me", { cookie: secondCookie, expectedStatus: 401 });
    await api("/api/admin/auth/me", { cookie: rotatedCookie, expectedStatus: 200 });

    const another = await loginAdmin(seedAdminEmail, newPassword);
    const revoked = await api("/api/admin/auth/sessions/revoke-others", {
      method: "POST",
      cookie: rotatedCookie,
      expectedStatus: 200
    });
    assert.equal(revoked.payload.revokedSessions, 1);
    await api("/api/admin/auth/me", { cookie: another.cookie, expectedStatus: 401 });
    await api("/api/admin/auth/me", { cookie: rotatedCookie, expectedStatus: 200 });
  });

  it("routes admin and member accounts through the shared login endpoint", async () => {
    const adminLogin = await api("/api/auth/login", {
      method: "POST",
      expectedStatus: 200,
      body: { account: seedAdminEmail, password: seedAdminPassword }
    });
    assert.equal(adminLogin.payload.accountType, "admin");
    assert.equal(adminLogin.payload.destination, "admin.html#overview");
    assert.equal(adminLogin.payload.admin.role, "owner");
    assert.match(adminLogin.response.headers.get("set-cookie") || "", /^sa_admin_session=/);

    const email = `shared-login-${Date.now()}@example.com`;
    const password = "secret123";
    await registerMember({ email, password });
    const memberLogin = await api("/api/auth/login", {
      method: "POST",
      expectedStatus: 200,
      body: { account: email, password }
    });
    assert.equal(memberLogin.payload.accountType, "member");
    assert.equal(memberLogin.payload.destination, "account.html");
    assert.equal(memberLogin.payload.user.email, email);
    assert.match(memberLogin.response.headers.get("set-cookie") || "", /^sa_session=/);
  });

  it("serves a database-backed sitemap with stable product slug URLs", async () => {
    const result = await api("/api/sitemap", { expectedStatus: 200 });
    assert.match(result.response.headers.get("content-type") || "", /application\/xml/);
    assert.match(result.payload, /\/products\/vespree/);
    assert.doesNotMatch(result.payload, /product-vespree\.html/);
  });

  it("rate limits verification resend requests without revealing account existence", async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const result = await api("/api/auth/resend-verification", {
        method: "POST",
        expectedStatus: 200,
        body: { email: "missing-rate-limit@example.com" }
      });
      assert.deepEqual(result.payload, { ok: true });
    }
    const blocked = await api("/api/auth/resend-verification", {
      method: "POST",
      expectedStatus: 429,
      body: { email: "missing-rate-limit@example.com" }
    });
    assert.match(blocked.payload.error, /请求过于频繁/);
    assert.ok(Number(blocked.response.headers.get("retry-after")) > 0);
  });

  it("releases expired order reservations only through the authenticated cron endpoint", async () => {
    const { cookie } = await registerMember();
    const order = await createOrder(cookie, 1);
    const before = await readDb();
    const reservation = before.stockReservations.find((item) => item.orderId === order.id);
    assert.ok(reservation);
    reservation.expiresAt = new Date(Date.now() - 60_000).toISOString();
    await writeDb(before);

    await api("/api/internal/release-expired-reservations", { expectedStatus: 401 });

    const released = await api("/api/internal/release-expired-reservations", {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      expectedStatus: 200
    });
    assert.deepEqual(released.payload, { ok: true, releasedOrders: 1 });

    const after = await readDb();
    assert.equal(after.orders.find((item) => item.id === order.id).status, "cancelled");
    assert.equal(after.stockReservations.find((item) => item.orderId === order.id).status, "released");
    assert.equal(after.inventoryItems.find((item) => item.id === reservation.inventoryItemId).quantityReserved, 0);
    assert.ok(after.operationLogs.some((item) => item.action === "release_expired_reservations"));

    const repeated = await api("/api/internal/release-expired-reservations", {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      expectedStatus: 200
    });
    assert.equal(repeated.payload.releasedOrders, 0);
  });

  it("rejects member export for support admins", async () => {
    const cookie = await supportAdminCookie();
    const result = await api("/api/admin/auth/me", {
      cookie,
      expectedStatus: 200
    });
    assert.equal(result.payload.admin.role, "support");
    assert.ok(!result.payload.admin.permissions.includes("admin:export"));

    await api("/api/admin/members/export.csv", {
      cookie,
      expectedStatus: 403
    });
  });

  it("requires trusted Origin or Referer on admin writes and records trusted admin identity", async () => {
    const cookie = await getAdminCookie();

    const blocked = await api("/api/admin/points-mall/items", {
      method: "POST",
      cookie,
      skipOrigin: true,
      expectedStatus: 403,
      body: {
        name: "Blocked Admin Write",
        pointsPrice: 100,
        stockQuantity: 1,
        status: "active"
      }
    });
    assert.equal(blocked.payload.error, "后台请求来源校验失败。");

    const created = await api("/api/admin/points-mall/items", {
      method: "POST",
      cookie,
      expectedStatus: 201,
      body: {
        name: "Trusted Admin Write",
        pointsPrice: 100,
        stockQuantity: 1,
        status: "active",
        reason: "origin verification"
      }
    });
    assert.equal(created.payload.item.name, "Trusted Admin Write");

    const logs = await api("/api/admin/audit-logs", {
      cookie,
      expectedStatus: 200
    });
    const log = logs.payload.logs.find((item) => item.entityId === created.payload.item.id);
    assert.ok(log, "expected admin operation log for created mall item");
    assert.ok(log.actorAdminId);
    assert.equal(log.actorEmail, seedAdminEmail);
    assert.equal(log.actorRole, "owner");
  });

  it("lets owner admins manage products, images, listing status, and inventory", async () => {
    const blocked = await adminApi("/api/admin/products", {
      method: "POST",
      expectedStatus: 400,
      body: {
        name: "Blocked Active Product",
        slug: "blocked-active-product",
        status: "active",
        priceAmountYuan: 880,
        stockQuantity: 3,
        sku: "blocked-active-product"
      }
    });
    assert.match(blocked.payload.error, /商品图/);

    const created = await adminApi("/api/admin/products", {
      method: "POST",
      expectedStatus: 201,
      body: {
        name: "Ruby Test Tea",
        slug: "ruby-test-tea",
        brandName: "P. Seven",
        category: "fragrance",
        family: "东方茶香",
        notes: "茶香、木质",
        scenes: "daily、gift",
        statusTags: "New、买手推荐",
        description: "测试用商品。",
        buyerNote: "后台 API 测试商品。",
        imageLayout: "editorial",
        sku: "ruby-test-tea-66ml",
        variantName: "66ml",
        priceAmountYuan: 520,
        stockQuantity: 6,
        status: "active",
        images: [
          {
            imageUrl: "https://images.unsplash.com/photo-1615634260167-c8cdede054de?auto=format&fit=crop&w=1200&q=82",
            alt: "Ruby Test Tea 商品图"
          }
        ],
        reason: "product admin api test"
      }
    });
    assert.equal(created.payload.product.status, "active");
    assert.equal(created.payload.product.availableQuantity, 6);
    assert.equal(created.payload.product.priceAmountYuan, 520);
    assert.equal(created.payload.product.images.length, 1);
    assert.equal(created.payload.product.notes[0], "茶香");

    const productId = created.payload.product.id;
    const variantId = created.payload.product.primaryVariant.id;
    const inventoryKey = "inventory-test-once";
    const adjusted = await adminApi(`/api/admin/products/${productId}/variants/${variantId}/inventory`, {
      method: "POST",
      headers: { "idempotency-key": inventoryKey },
      expectedStatus: 200,
      body: {
        mode: "adjust",
        quantityDelta: -2,
        reason: "manual stock correction"
      }
    });
    assert.equal(adjusted.payload.product.availableQuantity, 4);
    assert.equal(adjusted.payload.movement.quantityDelta, -2);

    const repeatedAdjustment = await adminApi(`/api/admin/products/${productId}/variants/${variantId}/inventory`, {
      method: "POST",
      headers: { "idempotency-key": inventoryKey },
      expectedStatus: 200,
      body: {
        mode: "adjust",
        quantityDelta: -2,
        reason: "manual stock correction"
      }
    });
    assert.deepEqual(repeatedAdjustment.payload, adjusted.payload);

    await adminApi(`/api/admin/products/${productId}/variants/${variantId}/inventory`, {
      method: "POST",
      headers: { "idempotency-key": inventoryKey },
      expectedStatus: 409,
      body: {
        mode: "adjust",
        quantityDelta: -1,
        reason: "different request"
      }
    });

    const updated = await adminApi(`/api/admin/products/${productId}`, {
      method: "PATCH",
      expectedStatus: 200,
      body: {
        name: "Ruby Test Tea Updated",
        status: "inactive",
        stockQuantity: 8,
        priceAmountYuan: 530,
        variantId,
        images: [
          { imageUrl: "https://example.com/ruby-test-tea-1.jpg", alt: "主图" },
          { imageUrl: "https://example.com/ruby-test-tea-2.jpg", alt: "细节图" }
        ],
        reason: "product update api test"
      }
    });
    assert.equal(updated.payload.product.name, "Ruby Test Tea Updated");
    assert.equal(updated.payload.product.status, "inactive");
    assert.equal(updated.payload.product.availableQuantity, 8);
    assert.equal(updated.payload.product.priceAmountYuan, 530);
    assert.equal(updated.payload.product.images.length, 2);

    const activated = await adminApi(`/api/admin/products/${productId}/activate`, {
      method: "POST",
      expectedStatus: 200
    });
    assert.equal(activated.payload.product.status, "active");

    const archived = await adminApi(`/api/admin/products/${productId}/archive`, {
      method: "POST",
      expectedStatus: 200
    });
    assert.equal(archived.payload.product.status, "archived");

    const listed = await adminApi("/api/admin/products", { expectedStatus: 200 });
    assert.ok(listed.payload.products.some((product) => product.id === productId));

    const logs = await adminApi("/api/admin/audit-logs", { expectedStatus: 200 });
    assert.ok(logs.payload.logs.some((item) => item.action === "adjust_product_inventory" && item.entityId === productId));
    assert.ok(logs.payload.logs.some((item) => item.action === "archive_product" && item.entityId === productId));
  });

  it("does not expose product operations to support admins", async () => {
    const cookie = await supportAdminCookie();
    await api("/api/admin/products", {
      cookie,
      expectedStatus: 403
    });
    await api("/api/admin/products", {
      method: "POST",
      cookie,
      expectedStatus: 403,
      body: {
        name: "Support Blocked Product",
        slug: "support-blocked-product"
      }
    });
  });

  it("uses only x-webhook-secret for payment webhooks", async () => {
    await api("/api/webhooks/payment", {
      method: "POST",
      headers: {
        [["x-admin", "key"].join("-")]: "dev-admin"
      },
      expectedStatus: 403,
      body: {
        orderId: "missing-order",
        status: "paid"
      }
    });

    await api("/api/webhooks/payment", {
      method: "POST",
      headers: {
        "x-webhook-secret": "test-webhook-secret"
      },
      expectedStatus: 404,
      body: {
        orderId: "missing-order",
        status: "paid"
      }
    });
  });

  it("rejects production seed admins and the legacy payment webhook", () => {
    const seedAdminEnv = productionEnv({
      SEED_ADMIN_PASSWORD: "prod-admin-password"
    });
    delete seedAdminEnv.PAYMENT_WEBHOOK_SECRET;
    const seedAdmin = runImportWithEnv(seedAdminEnv);
    assert.notEqual(seedAdmin.status, 0);
    assert.match(seedAdmin.stderr, /SEED_ADMIN_(?:EMAIL|PASSWORD)/);

    const legacyWebhookEnv = productionEnv({
      PAYMENT_WEBHOOK_SECRET: "prod-webhook-secret"
    });
    delete legacyWebhookEnv.SEED_ADMIN_EMAIL;
    delete legacyWebhookEnv.SEED_ADMIN_PASSWORD;
    const legacyWebhook = runImportWithEnv(legacyWebhookEnv);
    assert.notEqual(legacyWebhook.status, 0);
    assert.match(legacyWebhook.stderr, /PAYMENT_WEBHOOK_SECRET/);
  });

  it("keeps the default seed admin available outside production", () => {
    const env = {
      ...process.env,
      NODE_ENV: "development",
      MEMBER_DB: path.join(tempRoot, `development-${Date.now()}-${Math.random().toString(16).slice(2)}.json`),
      PUBLIC_DIR: path.join(projectRoot, "dist")
    };
    delete env.SEED_ADMIN_PASSWORD;
    delete env.PAYMENT_WEBHOOK_SECRET;
    delete env.PORT;

    const script = `
      const { server } = await import('./server/src/app.mjs');
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const address = server.address();
      const origin = \`http://127.0.0.1:\${address.port}\`;
      const response = await fetch(\`\${origin}/api/admin/auth/login\`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify({ email: 'admin@scent.local', password: 'dev-admin' })
      });
      const text = await response.text();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      if (response.status !== 200) {
        console.error(text);
        process.exit(1);
      }
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
      cwd: projectRoot,
      env,
      encoding: "utf8"
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });

  it("requires and records policy consent and protects member writes by Origin", async () => {
    await api("/api/auth/register", {
      method: "POST",
      expectedStatus: 400,
      body: {
        email: "missing-consent@example.com",
        password: "secret123",
        acceptTerms: true,
        acceptPrivacy: false
      }
    });

    const { cookie, member } = await registerMember();
    const db = await readDb();
    const user = db.users.find((item) => item.id === member.user.id);
    assert.equal(user.termsVersion, "2026-07-10");
    assert.equal(user.privacyVersion, "2026-07-10");
    assert.ok(user.termsAcceptedAt);
    assert.ok(user.privacyAcceptedAt);

    await api("/api/member/profile", {
      method: "PATCH",
      cookie,
      skipOrigin: true,
      expectedStatus: 403,
      body: { name: "Blocked member write" }
    });
  });

  it("protects member routes and creates a base member profile on registration", async () => {
    await api("/api/member/profile", { expectedStatus: 401 });

    const { cookie, member } = await registerMember();
    assert.equal(member.tier.code, "base");
    assert.equal(member.profile.availablePoints, 0);
    assert.equal(member.profile.lifetimePaidAmount, 0);

    const me = await memberProfile(cookie);
    assert.equal(me.payload.user.email, member.user.email);
    assert.equal(me.payload.tier.code, "base");
    assert.equal(me.payload.profile.availablePoints, 0);
    assert.equal(me.payload.profile.lifetimePaidAmountYuan, 0);

    const adminCookie = await getAdminCookie();
    await api("/api/admin/orders/not-real/pay", {
      method: "POST",
      cookie: adminCookie,
      skipOrigin: true,
      expectedStatus: 403
    });
  });

  it("quotes, creates, pays, completes, and re-quotes orders with member upgrade rules", async () => {
    const { cookie } = await registerMember();

    const quote = await api("/api/checkout/quote", {
      method: "POST",
      cookie,
      expectedStatus: 200,
      body: {
        items: [{ productId: "vespree", quantity: 2, unitPrice: 1, subtotalAmount: 1 }]
      }
    });
    assert.equal(quote.payload.subtotalAmount, 196000);
    assert.equal(quote.payload.memberDiscountAmount, 0);
    assert.equal(quote.payload.shippingAmount, 0);
    assert.equal(quote.payload.pointsToEarn, 1960);

    const created = await api("/api/checkout/create-order", {
      method: "POST",
      cookie,
      expectedStatus: 201,
      body: {
        items: [{ productId: "vespree", quantity: 2 }],
        acceptTerms: true,
        acceptPrivacy: true
      }
    });
    const order = created.payload.order;
    assert.equal(order.status, "pending_payment");
    assert.equal(order.pointsAwarded, 0);
    assert.equal(order.eligiblePaidAmount, 196000);

    let me = await memberProfile(cookie);
    assert.equal(me.payload.profile.availablePoints, 0);
    assert.equal(me.payload.profile.lifetimePaidAmount, 0);

    await adminApi(`/api/admin/orders/${order.id}/status`, {
      method: "PATCH",
      expectedStatus: 409,
      body: { status: "paid", paymentReference: "BYPASS-NOT-ALLOWED" }
    });

    const paid = await adminApi(`/api/admin/orders/${order.id}/pay`, {
      method: "POST",
      expectedStatus: 200
    });
    assert.equal(paid.payload.order.status, "paid");
    assert.equal(paid.payload.member.profile.availablePoints, 0);
    assert.equal(paid.payload.member.profile.lifetimePaidAmount, 0);

    const repeatedPay = await adminApi(`/api/admin/orders/${order.id}/pay`, {
      method: "POST",
      expectedStatus: 200
    });
    assert.equal(repeatedPay.payload.alreadyProcessed, true);
    assert.equal(repeatedPay.payload.order.payments.length, 1);

    await api(`/api/member/orders/${order.id}/confirm-receipt`, {
      method: "POST",
      cookie,
      expectedStatus: 400
    });

    await adminApi(`/api/admin/orders/${order.id}/status`, {
      method: "PATCH",
      expectedStatus: 409,
      body: { status: "completed" }
    });

    const shipped = await adminApi(`/api/admin/orders/${order.id}/ship`, {
      method: "POST",
      expectedStatus: 200,
      body: { carrier: "顺丰速运", trackingNo: "SF-ORDER-FLOW-1" }
    });
    assert.equal(shipped.payload.order.status, "shipped");

    const repeatedShip = await adminApi(`/api/admin/orders/${order.id}/ship`, {
      method: "POST",
      expectedStatus: 200,
      body: { carrier: "顺丰速运", trackingNo: "SF-ORDER-FLOW-1" }
    });
    assert.equal(repeatedShip.payload.alreadyProcessed, true);
    await adminApi(`/api/admin/orders/${order.id}/ship`, {
      method: "POST",
      expectedStatus: 409,
      body: { carrier: "顺丰速运", trackingNo: "SF-DIFFERENT" }
    });

    const completed = await api(`/api/member/orders/${order.id}/confirm-receipt`, {
      method: "POST",
      cookie,
      expectedStatus: 200
    });
    assert.equal(completed.payload.order.status, "completed");
    assert.equal(completed.payload.result.points, 1960);
    assert.equal(completed.payload.result.upgraded, true);
    assert.equal(completed.payload.member.tier.code, "silver");
    assert.equal(completed.payload.member.profile.availablePoints, 1960);
    assert.equal(completed.payload.member.profile.lifetimePaidAmount, 196000);

    const repeated = await api(`/api/member/orders/${order.id}/confirm-receipt`, {
      method: "POST",
      cookie,
      expectedStatus: 200
    });
    assert.equal(repeated.payload.result.alreadyProcessed, true);
    assert.equal(repeated.payload.member.profile.availablePoints, 1960);
    assert.equal(repeated.payload.member.profile.lifetimePaidAmount, 196000);

    const points = await api("/api/member/points", { cookie, expectedStatus: 200 });
    assert.equal(points.payload.transactions.filter((item) => item.type === "earn_order").length, 1);

    await adminApi(`/api/admin/orders/${order.id}/status`, {
      method: "PATCH",
      expectedStatus: 409,
      body: { status: "paid" }
    });
    const afterRejectedTransition = await api("/api/member/orders", { cookie, expectedStatus: 200 });
    assert.equal(afterRejectedTransition.payload.orders.find((item) => item.id === order.id).status, "completed");

    const silverQuote = await api("/api/checkout/quote", {
      method: "POST",
      cookie,
      expectedStatus: 200,
      body: {
        items: [{ productId: "vespree", quantity: 1 }]
      }
    });
    assert.equal(silverQuote.payload.tier.code, "silver");
    assert.equal(silverQuote.payload.memberDiscountAmount, 4900);
    assert.equal(silverQuote.payload.paidAmount, 93100);
  });

  it("refunds completed orders without double reversing points or lifetime spend", async () => {
    const { cookie } = await registerMember();
    const order = await completeOrder(cookie, 2);

    await adminApi(`/api/admin/orders/${order.id}/status`, {
      method: "PATCH",
      expectedStatus: 409,
      body: { status: "refunded" }
    });

    const refunded = await adminApi(`/api/admin/orders/${order.id}/refund`, {
      method: "POST",
      expectedStatus: 200
    });
    assert.equal(refunded.payload.order.status, "refunded");
    assert.equal(refunded.payload.result.pointsReversed, 1960);
    assert.equal(refunded.payload.member.profile.availablePoints, 0);
    assert.equal(refunded.payload.member.profile.lifetimePaidAmount, 0);
    assert.equal(refunded.payload.member.tier.code, "base");

    const repeated = await adminApi(`/api/admin/orders/${order.id}/refund`, {
      method: "POST",
      expectedStatus: 200
    });
    assert.equal(repeated.payload.result.alreadyProcessed, true);
    assert.equal(repeated.payload.member.profile.availablePoints, 0);
    assert.equal(repeated.payload.member.profile.lifetimePaidAmount, 0);

    const points = await api("/api/member/points", { cookie, expectedStatus: 200 });
    assert.equal(points.payload.transactions.filter((item) => item.type === "earn_order").length, 1);
    assert.equal(points.payload.transactions.filter((item) => item.type === "refund_reversal").length, 1);

    await adminApi(`/api/admin/orders/${order.id}/complete`, {
      method: "POST",
      expectedStatus: 400
    });
    const afterCompleteAttempt = await api("/api/member/orders", { cookie, expectedStatus: 200 });
    assert.equal(afterCompleteAttempt.payload.orders.find((item) => item.id === order.id).status, "refunded");
  });

  it("rejects a refund atomically while that order's reward point batch is consumed", async () => {
    const { cookie } = await registerMember();
    const order = await completeOrder(cookie, 2);

    const redeemed = await api("/api/points-mall/redeem", {
      method: "POST",
      cookie,
      expectedStatus: 201,
      body: {
        mallItemId: "pm-random-sample-1",
        quantity: 2,
        requestId: "consume-order-reward",
        recipientName: "测试会员",
        recipientPhone: "13900000000",
        shippingAddress: "上海市静安区测试路 1 号"
      }
    });
    assert.equal(redeemed.payload.member.profile.availablePoints, 1360);

    const rejected = await adminApi(`/api/admin/orders/${order.id}/refund`, {
      method: "POST",
      expectedStatus: 400
    });
    assert.match(rejected.payload.error, /奖励积分.*被使用/);

    let db = await readDb();
    assert.equal(db.orders.find((item) => item.id === order.id).status, "completed");
    assert.equal(db.memberProfiles.find((item) => item.userId === order.userId).availablePoints, 1360);
    assert.equal(db.refunds.filter((item) => item.orderId === order.id).length, 0);
    assert.equal(db.pointTransactions.filter((item) => item.orderId === order.id && item.type === "refund_reversal").length, 0);

    await adminApi(`/api/admin/points-mall/redemptions/${redeemed.payload.order.id}/cancel`, {
      method: "POST",
      expectedStatus: 200
    });
    const refunded = await adminApi(`/api/admin/orders/${order.id}/refund`, {
      method: "POST",
      expectedStatus: 200
    });
    assert.equal(refunded.payload.member.profile.availablePoints, 0);

    db = await readDb();
    const earned = db.pointTransactions.find((item) => item.orderId === order.id && item.type === "earn_order");
    const reversal = db.pointTransactions.find((item) => item.orderId === order.id && item.type === "refund_reversal");
    assert.equal(reversal.sourceTransactionId, earned.id);
    assert.equal(reversal.balanceAfter, 0);
  });

  it("does not create a negative balance when expired order points are refunded", async () => {
    const { cookie } = await registerMember();
    const order = await completeOrder(cookie, 2);
    const db = await readDb();
    const earned = db.pointTransactions.find((item) => item.orderId === order.id && item.type === "earn_order");
    earned.expiresAt = new Date(Date.now() - 1000).toISOString();
    await writeDb(db);

    const expired = await api("/api/member/points", { cookie, expectedStatus: 200 });
    assert.equal(expired.payload.transactions.filter((item) => item.type === "expire_points").length, 1);
    assert.equal((await memberProfile(cookie)).payload.profile.availablePoints, 0);

    const refunded = await adminApi(`/api/admin/orders/${order.id}/refund`, {
      method: "POST",
      expectedStatus: 200
    });
    assert.equal(refunded.payload.result.pointsReversed, 0);
    assert.equal(refunded.payload.member.profile.availablePoints, 0);
    assert.equal(refunded.payload.order.status, "refunded");
  });

  it("redeems points mall items idempotently and restores points and stock on cancel", async () => {
    const { cookie, member } = await registerMember();

    await adminApi(`/api/admin/members/${member.user.id}/points`, {
      method: "POST",
      expectedStatus: 200,
      body: {
        points: 1000,
        note: "测试积分"
      }
    });

    const beforeItem = await adminMallItem();
    assert.equal(beforeItem.stockQuantity, 50);

    const redeemed = await api("/api/points-mall/redeem", {
      method: "POST",
      cookie,
      expectedStatus: 201,
      body: {
        mallItemId: "pm-random-sample-1",
        quantity: 2,
        requestId: "redeem-once",
        recipientName: "测试会员",
        recipientPhone: "13900000000",
        shippingAddress: "测试地址"
      }
    });
    assert.equal(redeemed.payload.order.totalPoints, 600);
    assert.equal(redeemed.payload.member.profile.availablePoints, 400);
    assert.equal((await adminMallItem()).stockQuantity, 48);

    const repeatedRedeem = await api("/api/points-mall/redeem", {
      method: "POST",
      cookie,
      expectedStatus: 201,
      body: {
        mallItemId: "pm-random-sample-1",
        quantity: 2,
        requestId: "redeem-once",
        recipientName: "测试会员",
        recipientPhone: "13900000000",
        shippingAddress: "测试地址"
      }
    });
    assert.deepEqual(repeatedRedeem.payload, redeemed.payload);
    assert.equal(repeatedRedeem.payload.member.profile.availablePoints, 400);
    assert.equal((await adminMallItem()).stockQuantity, 48);

    await api("/api/points-mall/redeem", {
      method: "POST",
      cookie,
      expectedStatus: 400,
      body: {
        mallItemId: "pm-random-sample-1",
        quantity: 2,
        requestId: "not-enough-points",
        recipientName: "测试会员",
        recipientPhone: "13900000000",
        shippingAddress: "测试地址"
      }
    });
    assert.equal((await memberProfile(cookie)).payload.profile.availablePoints, 400);
    assert.equal((await adminMallItem()).stockQuantity, 48);

    const cancelled = await adminApi(`/api/admin/points-mall/redemptions/${redeemed.payload.order.id}/cancel`, {
      method: "POST",
      expectedStatus: 200,
      body: {
        reason: "测试取消"
      }
    });
    assert.equal(cancelled.payload.redemption.status, "cancelled");
    assert.equal(cancelled.payload.result.pointsRefunded, 600);
    assert.equal((await memberProfile(cookie)).payload.profile.availablePoints, 1000);
    assert.equal((await adminMallItem()).stockQuantity, 50);

    const repeatedCancel = await adminApi(`/api/admin/points-mall/redemptions/${redeemed.payload.order.id}/cancel`, {
      method: "POST",
      expectedStatus: 200
    });
    assert.equal(repeatedCancel.payload.result.alreadyProcessed, true);
    assert.equal((await memberProfile(cookie)).payload.profile.availablePoints, 1000);
    assert.equal((await adminMallItem()).stockQuantity, 50);
  });

  it("requires complete shipping details before redeeming a physical points item", async () => {
    const { cookie, member } = await registerMember();
    await adminApi(`/api/admin/members/${member.user.id}/points`, {
      method: "POST",
      expectedStatus: 200,
      body: { points: 1000, note: "测试积分" }
    });

    await api("/api/points-mall/redeem", {
      method: "POST",
      cookie,
      expectedStatus: 400,
      body: {
        mallItemId: "pm-random-sample-1",
        quantity: 1,
        requestId: "missing-redemption-address"
      }
    });

    const db = await readDb();
    assert.equal(db.pointsRedemptionOrders.length, 0);
    assert.equal(db.memberProfiles.find((item) => item.userId === member.user.id).availablePoints, 1000);
    assert.equal(db.pointsMallItems.find((item) => item.id === "pm-random-sample-1").stockQuantity, 50);
  });

  it("blocks account deletion with an active redemption and clears private profile residue after cancellation", async () => {
    const { cookie, member } = await registerMember({ password: "delete-account-password" });
    await api("/api/member/profile", {
      method: "PATCH",
      cookie,
      expectedStatus: 200,
      body: { birthday: "1990-01-01", acceptsMarketing: true }
    });
    await api("/api/auth/request-password-reset", {
      method: "POST",
      expectedStatus: 200,
      body: { email: member.user.email }
    });
    await adminApi(`/api/admin/members/${member.user.id}/points`, {
      method: "POST",
      expectedStatus: 200,
      body: { points: 1000, note: "测试积分" }
    });
    const redeemed = await api("/api/points-mall/redeem", {
      method: "POST",
      cookie,
      expectedStatus: 201,
      body: {
        mallItemId: "pm-random-sample-1",
        quantity: 1,
        requestId: "deletion-block-redemption",
        recipientName: "待注销会员",
        recipientPhone: "13900000000",
        shippingAddress: "北京市朝阳区测试路 1 号"
      }
    });

    await api("/api/member/account", {
      method: "DELETE",
      cookie,
      expectedStatus: 409,
      body: { password: "delete-account-password" }
    });

    await adminApi(`/api/admin/points-mall/redemptions/${redeemed.payload.order.id}/cancel`, {
      method: "POST",
      expectedStatus: 200
    });
    await api("/api/member/account", {
      method: "DELETE",
      cookie,
      expectedStatus: 200,
      body: { password: "delete-account-password" }
    });

    const db = await readDb();
    const deletedUser = db.users.find((item) => item.id === member.user.id);
    const profile = db.memberProfiles.find((item) => item.userId === member.user.id);
    assert.equal(deletedUser.status, "deleted");
    assert.equal(profile.birthday, null);
    assert.equal(profile.acceptsMarketing, false);
    assert.equal(db.emailVerificationTokens.some((item) => item.userId === member.user.id), false);
    assert.equal(db.passwordResetTokens.some((item) => item.userId === member.user.id), false);
    assert.equal(db.emailDeliveries.some((item) => item.userId === member.user.id), false);
    assert.equal(db.emailDeliveries.some((item) => item.recipient === member.user.email), false);
  });

  it("uses FIFO point batches and restores original expiry metadata on redemption cancel", async () => {
    const { cookie, member } = await registerMember();
    const db = await readDb();
    const profile = db.memberProfiles.find((item) => item.userId === member.user.id);
    const earlyExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const lateExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    profile.availablePoints = 1200;
    profile.updatedAt = new Date().toISOString();
    db.pointTransactions.push(
      {
        id: "early-batch",
        userId: member.user.id,
        orderId: null,
        type: "admin_adjust",
        points: 500,
        balanceAfter: 500,
        expiresAt: earlyExpiry,
        note: "较早过期积分",
        createdAt: new Date(Date.now() - 1000).toISOString()
      },
      {
        id: "late-batch",
        userId: member.user.id,
        orderId: null,
        type: "admin_adjust",
        points: 700,
        balanceAfter: 1200,
        expiresAt: lateExpiry,
        note: "较晚过期积分",
        createdAt: new Date().toISOString()
      }
    );
    await writeDb(db);

    const redeemed = await api("/api/points-mall/redeem", {
      method: "POST",
      cookie,
      expectedStatus: 201,
      body: {
        mallItemId: "pm-random-sample-1",
        quantity: 2,
        requestId: "fifo-redeem",
        recipientName: "测试会员",
        recipientPhone: "13900000000",
        shippingAddress: "上海市静安区测试路 1 号"
      }
    });
    assert.equal(redeemed.payload.member.profile.availablePoints, 600);

    let updatedDb = await readDb();
    const deductions = updatedDb.pointTransactions
      .filter((item) => item.redemptionOrderId === redeemed.payload.order.id && item.type === "redeem_points")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    assert.equal(deductions.length, 2);
    assert.equal(deductions[0].sourceTransactionId, "early-batch");
    assert.equal(deductions[0].points, -500);
    assert.equal(deductions[1].sourceTransactionId, "late-batch");
    assert.equal(deductions[1].points, -100);

    const cancelled = await adminApi(`/api/admin/points-mall/redemptions/${redeemed.payload.order.id}/cancel`, {
      method: "POST",
      expectedStatus: 200
    });
    assert.equal(cancelled.payload.result.pointsRefunded, 600);
    assert.equal((await memberProfile(cookie)).payload.profile.availablePoints, 1200);
    assert.equal((await adminMallItem()).stockQuantity, 50);

    updatedDb = await readDb();
    const refunds = updatedDb.pointTransactions.filter((item) => item.redemptionOrderId === redeemed.payload.order.id && item.type === "redeem_refund");
    assert.equal(refunds.length, 2);
    const earlyRefund = refunds.find((item) => item.sourceTransactionId === "early-batch");
    const lateRefund = refunds.find((item) => item.sourceTransactionId === "late-batch");
    assert.equal(earlyRefund.points, 500);
    assert.equal(earlyRefund.expiresAt, earlyExpiry);
    assert.equal(lateRefund.points, 100);
    assert.equal(lateRefund.expiresAt, lateExpiry);
  });

  it("expires restored points again when an already-expired batch redemption is cancelled", async () => {
    const { cookie, member } = await registerMember();
    const db = await readDb();
    const profile = db.memberProfiles.find((item) => item.userId === member.user.id);
    const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    profile.availablePoints = 1000;
    profile.updatedAt = new Date().toISOString();
    db.pointTransactions.push({
      id: "partially-redeemed-expiring-batch",
      userId: member.user.id,
      orderId: null,
      type: "admin_adjust",
      points: 1000,
      balanceAfter: 1000,
      expiresAt: futureExpiry,
      note: "部分兑换后到期的积分",
      createdAt: new Date().toISOString()
    });
    await writeDb(db);

    const redeemed = await api("/api/points-mall/redeem", {
      method: "POST",
      cookie,
      expectedStatus: 201,
      body: {
        mallItemId: "pm-random-sample-1",
        quantity: 2,
        requestId: "cancel-after-partial-expiry",
        recipientName: "测试会员",
        recipientPhone: "13900000000",
        shippingAddress: "上海市静安区测试路 1 号"
      }
    });
    assert.equal(redeemed.payload.member.profile.availablePoints, 400);

    const expiringDb = await readDb();
    const sourceBatch = expiringDb.pointTransactions.find((item) => item.id === "partially-redeemed-expiring-batch");
    sourceBatch.expiresAt = new Date(Date.now() - 1000).toISOString();
    const adminSessionId = "expired-points-cancel-admin-session";
    expiringDb.adminSessions.push({
      id: adminSessionId,
      adminUserId: expiringDb.adminUsers[0].id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      lastSeenAt: new Date().toISOString(),
      revokedAt: null
    });
    await writeDb(expiringDb);

    const expired = await api("/api/member/points", { cookie, expectedStatus: 200 });
    assert.equal((await memberProfile(cookie)).payload.profile.availablePoints, 0);
    assert.equal(expired.payload.transactions.filter((item) => item.type === "expire_points").length, 1);

    const cancelled = await adminApi(`/api/admin/points-mall/redemptions/${redeemed.payload.order.id}/cancel`, {
      method: "POST",
      cookie: `sa_admin_session=${adminSessionId}`,
      expectedStatus: 200
    });
    assert.equal(cancelled.payload.result.pointsRefunded, 600);
    assert.equal((await memberProfile(cookie)).payload.profile.availablePoints, 0);

    const finalDb = await readDb();
    const expirations = finalDb.pointTransactions.filter((item) => (
      item.type === "expire_points"
      && item.sourceTransactionId === "partially-redeemed-expiring-batch"
    ));
    assert.deepEqual(expirations.map((item) => item.points), [-400, -600]);
  });
});
