import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(path.join(tmpdir(), "scent-api-test-"));
const dbFile = path.join(tempRoot, "db.json");
const adminKey = "test-admin-key";

process.env.MEMBER_DB = dbFile;
process.env.ADMIN_KEY = adminKey;
process.env.PUBLIC_DIR = path.join(projectRoot, "dist");

const { server } = await import(pathToFileURL(path.join(projectRoot, "server/src/app.mjs")).href);

let baseUrl;

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
  await rm(dbFile, { force: true });
}

async function readDb() {
  return JSON.parse(await readFile(dbFile, "utf8"));
}

async function writeDb(db) {
  await mkdir(path.dirname(dbFile), { recursive: true });
  await writeFile(dbFile, JSON.stringify(db, null, 2));
}

async function api(pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.cookie) headers.cookie = options.cookie;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
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
      ...overrides
    }
  });
  return {
    cookie: cookieFrom(result.response),
    member: result.payload
  };
}

function adminHeaders() {
  return { "x-admin-key": adminKey };
}

async function memberProfile(cookie) {
  return api("/api/auth/me", { cookie, expectedStatus: 200 });
}

async function adminMallItem(itemId = "pm-random-sample-1") {
  const result = await api("/api/admin/points-mall/items", {
    headers: adminHeaders(),
    expectedStatus: 200
  });
  return result.payload.items.find((item) => item.id === itemId);
}

async function createOrder(cookie, quantity = 2) {
  const result = await api("/api/checkout/create-order", {
    method: "POST",
    cookie,
    expectedStatus: 201,
    body: {
      items: [{ productId: "vespree", quantity }]
    }
  });
  return result.payload.order;
}

async function completeOrder(cookie, quantity = 2) {
  const order = await createOrder(cookie, quantity);
  const paid = await api(`/api/admin/orders/${order.id}/pay`, {
    method: "POST",
    headers: adminHeaders(),
    expectedStatus: 200
  });
  assert.equal(paid.payload.order.status, "paid");

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
    await listen(server);
  });

  beforeEach(async () => {
    await resetDb();
  });

  after(async () => {
    await close(server);
    await rm(tempRoot, { recursive: true, force: true });
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
        items: [{ productId: "vespree", quantity: 2 }]
      }
    });
    const order = created.payload.order;
    assert.equal(order.status, "pending_payment");
    assert.equal(order.pointsAwarded, 0);
    assert.equal(order.eligiblePaidAmount, 196000);

    let me = await memberProfile(cookie);
    assert.equal(me.payload.profile.availablePoints, 0);
    assert.equal(me.payload.profile.lifetimePaidAmount, 0);

    const paid = await api(`/api/admin/orders/${order.id}/pay`, {
      method: "POST",
      headers: adminHeaders(),
      expectedStatus: 200
    });
    assert.equal(paid.payload.order.status, "paid");
    assert.equal(paid.payload.member.profile.availablePoints, 0);
    assert.equal(paid.payload.member.profile.lifetimePaidAmount, 0);

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

    const refunded = await api(`/api/admin/orders/${order.id}/refund`, {
      method: "POST",
      headers: adminHeaders(),
      expectedStatus: 200
    });
    assert.equal(refunded.payload.order.status, "refunded");
    assert.equal(refunded.payload.result.pointsReversed, 1960);
    assert.equal(refunded.payload.member.profile.availablePoints, 0);
    assert.equal(refunded.payload.member.profile.lifetimePaidAmount, 0);
    assert.equal(refunded.payload.member.tier.code, "base");

    const repeated = await api(`/api/admin/orders/${order.id}/refund`, {
      method: "POST",
      headers: adminHeaders(),
      expectedStatus: 200
    });
    assert.equal(repeated.payload.result.alreadyProcessed, true);
    assert.equal(repeated.payload.member.profile.availablePoints, 0);
    assert.equal(repeated.payload.member.profile.lifetimePaidAmount, 0);

    const points = await api("/api/member/points", { cookie, expectedStatus: 200 });
    assert.equal(points.payload.transactions.filter((item) => item.type === "earn_order").length, 1);
    assert.equal(points.payload.transactions.filter((item) => item.type === "refund_reversal").length, 1);
  });

  it("redeems points mall items idempotently and restores points and stock on cancel", async () => {
    const { cookie, member } = await registerMember();

    await api(`/api/admin/members/${member.user.id}/points`, {
      method: "POST",
      headers: adminHeaders(),
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
      expectedStatus: 200,
      body: {
        mallItemId: "pm-random-sample-1",
        quantity: 2,
        requestId: "redeem-once"
      }
    });
    assert.equal(repeatedRedeem.payload.alreadyProcessed, true);
    assert.equal(repeatedRedeem.payload.member.profile.availablePoints, 400);
    assert.equal((await adminMallItem()).stockQuantity, 48);

    await api("/api/points-mall/redeem", {
      method: "POST",
      cookie,
      expectedStatus: 400,
      body: {
        mallItemId: "pm-random-sample-1",
        quantity: 2,
        requestId: "not-enough-points"
      }
    });
    assert.equal((await memberProfile(cookie)).payload.profile.availablePoints, 400);
    assert.equal((await adminMallItem()).stockQuantity, 48);

    const cancelled = await api(`/api/admin/points-mall/redemptions/${redeemed.payload.order.id}/cancel`, {
      method: "POST",
      headers: adminHeaders(),
      expectedStatus: 200,
      body: {
        reason: "测试取消"
      }
    });
    assert.equal(cancelled.payload.redemption.status, "cancelled");
    assert.equal(cancelled.payload.result.pointsRefunded, 600);
    assert.equal((await memberProfile(cookie)).payload.profile.availablePoints, 1000);
    assert.equal((await adminMallItem()).stockQuantity, 50);

    const repeatedCancel = await api(`/api/admin/points-mall/redemptions/${redeemed.payload.order.id}/cancel`, {
      method: "POST",
      headers: adminHeaders(),
      expectedStatus: 200
    });
    assert.equal(repeatedCancel.payload.result.alreadyProcessed, true);
    assert.equal((await memberProfile(cookie)).payload.profile.availablePoints, 1000);
    assert.equal((await adminMallItem()).stockQuantity, 50);
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
        requestId: "fifo-redeem"
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

    const cancelled = await api(`/api/admin/points-mall/redemptions/${redeemed.payload.order.id}/cancel`, {
      method: "POST",
      headers: adminHeaders(),
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
});
