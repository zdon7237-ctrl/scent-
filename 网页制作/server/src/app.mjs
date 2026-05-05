import { createServer } from "node:http";
import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const publicDir = path.resolve(process.env.PUBLIC_DIR || rootDir);
const dataFile = path.resolve(process.env.MEMBER_DB || path.join(rootDir, "server/data/db.json"));
const port = Number(process.env.PORT || 8788);
const sessionMaxAgeMs = 1000 * 60 * 60 * 24 * 30;
const adminKey = process.env.ADMIN_KEY || "dev-admin";

const money = {
  fromYuan(value) {
    return Math.round(Number(value) * 100);
  },
  toYuan(cents) {
    return Number((Number(cents || 0) / 100).toFixed(2));
  }
};

function now() {
  return new Date().toISOString();
}

function defaultDb() {
  const tiers = [
    {
      id: randomUUID(),
      code: "base",
      name: "普通会员",
      minLifetimePaidAmount: 0,
      discountRate: 1,
      freeShippingThreshold: 59900,
      sortOrder: 1,
      isActive: true
    },
    {
      id: randomUUID(),
      code: "silver",
      name: "银卡会员",
      minLifetimePaidAmount: 300000,
      discountRate: 0.98,
      freeShippingThreshold: 49900,
      sortOrder: 2,
      isActive: true
    },
    {
      id: randomUUID(),
      code: "gold",
      name: "金卡会员",
      minLifetimePaidAmount: 800000,
      discountRate: 0.95,
      freeShippingThreshold: 39900,
      sortOrder: 3,
      isActive: true
    },
    {
      id: randomUUID(),
      code: "black",
      name: "黑卡会员",
      minLifetimePaidAmount: 2000000,
      discountRate: 0.92,
      freeShippingThreshold: 0,
      sortOrder: 4,
      isActive: true
    }
  ];

  return {
    users: [],
    memberProfiles: [],
    memberTiers: tiers,
    orders: [],
    orderItems: [],
    pointTransactions: [],
    tierHistory: [],
    operationLogs: [],
    sessions: [],
    coupons: [],
    couponRedemptions: []
  };
}

function normalizeDb(db) {
  const normalized = db && typeof db === "object" ? db : defaultDb();
  [
    "users",
    "memberProfiles",
    "memberTiers",
    "orders",
    "orderItems",
    "pointTransactions",
    "tierHistory",
    "operationLogs",
    "sessions",
    "coupons",
    "couponRedemptions"
  ].forEach((key) => {
    if (!Array.isArray(normalized[key])) normalized[key] = [];
  });
  normalized.memberTiers.forEach((tier) => {
    delete tier.pointMultiplier;
  });
  return normalized;
}

async function ensureDb() {
  await mkdir(path.dirname(dataFile), { recursive: true });
  if (!existsSync(dataFile)) {
    await writeFile(dataFile, JSON.stringify(defaultDb(), null, 2));
  }
}

async function readDb() {
  await ensureDb();
  return normalizeDb(JSON.parse(await readFile(dataFile, "utf8")));
}

async function writeDb(db) {
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, JSON.stringify(db, null, 2));
}

function getBaseTier(db) {
  return db.memberTiers
    .filter((tier) => tier.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
}

function resolveTier(db, lifetimePaidAmount) {
  return db.memberTiers
    .filter((tier) => tier.isActive && tier.minLifetimePaidAmount <= lifetimePaidAmount)
    .sort((a, b) => b.minLifetimePaidAmount - a.minLifetimePaidAmount)[0] || getBaseTier(db);
}

function nextTier(db, tier) {
  return db.memberTiers
    .filter((item) => item.isActive && item.minLifetimePaidAmount > tier.minLifetimePaidAmount)
    .sort((a, b) => a.minLifetimePaidAmount - b.minLifetimePaidAmount)[0] || null;
}

function hashPassword(password) {
  const salt = randomUUID().replaceAll("-", "");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const actual = Buffer.from(scryptSync(password, salt, 64).toString("hex"));
  const expected = Buffer.from(hash);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

async function requestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...headers
  });
  res.end(JSON.stringify(payload));
}

function sendCsv(res, filename, content) {
  res.writeHead(200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${filename}"`
  });
  res.end(content);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function snapshot(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function adminActor(req) {
  return String(req.headers["x-admin-actor"] || "admin").slice(0, 80);
}

function logAdminOperation(db, req, action, entityType, entityId, before, after, reason = "") {
  db.operationLogs.push({
    id: randomUUID(),
    actor: adminActor(req),
    action,
    entityType,
    entityId,
    before: snapshot(before),
    after: snapshot(after),
    reason: String(reason || ""),
    createdAt: now()
  });
}

function sessionCookie(sessionId) {
  return `sa_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(sessionMaxAgeMs / 1000)}`;
}

function clearSessionCookie() {
  return "sa_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

async function currentUser(req, db) {
  const sessionId = parseCookies(req.headers.cookie).sa_session;
  if (!sessionId) return null;
  const session = db.sessions.find((item) => item.id === sessionId);
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
  return db.users.find((user) => user.id === session.userId && user.status === "active") || null;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    createdAt: user.createdAt
  };
}

function profilePayload(db, user) {
  const profile = db.memberProfiles.find((item) => item.userId === user.id);
  const tier = db.memberTiers.find((item) => item.id === profile.tierId);
  const upcomingTier = nextTier(db, tier);
  const amountToNextTier = upcomingTier
    ? Math.max(0, upcomingTier.minLifetimePaidAmount - profile.lifetimePaidAmount)
    : 0;

  return {
    user: publicUser(user),
    profile: {
      lifetimePaidAmount: profile.lifetimePaidAmount,
      lifetimePaidAmountYuan: money.toYuan(profile.lifetimePaidAmount),
      availablePoints: profile.availablePoints,
      birthday: profile.birthday || null,
      acceptsMarketing: Boolean(profile.acceptsMarketing),
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    },
    tier,
    nextTier: upcomingTier,
    amountToNextTier,
    amountToNextTierYuan: money.toYuan(amountToNextTier)
  };
}

function loadCatalog() {
  const source = existsSync(path.join(rootDir, "src/assets/data.js"))
    ? path.join(rootDir, "src/assets/data.js")
    : path.join(rootDir, "data.js");
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(source, "utf8"), sandbox);
  return sandbox.window.SA_DATA || {};
}

const catalog = loadCatalog();

function catalogItemById(id) {
  const sampleSets = (catalog.sampleSets || []).map((set) => ({
    ...set,
    brand: "Scent Archive",
    category: "sample",
    stock: "现货",
    concentration: "Sample Set",
    family: "试香套装"
  }));
  return [...(catalog.products || []), ...sampleSets].find((item) => item.id === id);
}

function canPurchase(item) {
  return Boolean(item && Number(item.price) > 0 && item.stock !== "售罄");
}

function normalizeItems(items = []) {
  return items
    .map((entry) => ({
      productId: String(entry.productId || entry.id || ""),
      quantity: Math.max(0, Math.floor(Number(entry.quantity || entry.qty || 0)))
    }))
    .filter((entry) => entry.productId && entry.quantity > 0);
}

function calculateQuote(db, user, rawItems) {
  const items = normalizeItems(rawItems);
  if (!items.length) throw new Error("购物车是空的。");

  const profile = user ? db.memberProfiles.find((item) => item.userId === user.id) : null;
  const tier = profile
    ? db.memberTiers.find((item) => item.id === profile.tierId)
    : getBaseTier(db);

  const lines = items.map((entry) => {
    const item = catalogItemById(entry.productId);
    if (!canPurchase(item)) throw new Error(`商品 ${entry.productId} 暂不可购买。`);
    const unitPrice = money.fromYuan(item.price);
    const subtotalAmount = unitPrice * entry.quantity;
    const memberDiscountExcluded = Boolean(item.member_discount_excluded);
    const memberDiscountAmount = memberDiscountExcluded
      ? 0
      : Math.floor(subtotalAmount * (1 - tier.discountRate));
    return {
      productId: item.id,
      productName: item.name,
      brandName: item.brand || "Scent Archive",
      unitPrice,
      unitPriceYuan: money.toYuan(unitPrice),
      quantity: entry.quantity,
      subtotalAmount,
      subtotalAmountYuan: money.toYuan(subtotalAmount),
      memberDiscountAmount,
      memberDiscountAmountYuan: money.toYuan(memberDiscountAmount),
      memberDiscountExcluded
    };
  });

  const subtotalAmount = lines.reduce((sum, line) => sum + line.subtotalAmount, 0);
  const memberDiscountAmount = lines.reduce((sum, line) => sum + line.memberDiscountAmount, 0);
  const productDiscountAmount = 0;
  const couponDiscountAmount = 0;
  const pointsDiscountAmount = 0;
  const discountedProductAmount = subtotalAmount - productDiscountAmount - memberDiscountAmount - couponDiscountAmount - pointsDiscountAmount;
  const shippingAmount = tier.freeShippingThreshold === 0 || discountedProductAmount >= tier.freeShippingThreshold ? 0 : 2500;
  const paidAmount = discountedProductAmount + shippingAmount;
  const eligiblePaidAmount = Math.max(0, discountedProductAmount);
  const pointsToEarn = Math.floor(eligiblePaidAmount / 100);
  const upcomingTier = nextTier(db, tier);

  return {
    lines,
    subtotalAmount,
    subtotalAmountYuan: money.toYuan(subtotalAmount),
    productDiscountAmount,
    productDiscountAmountYuan: money.toYuan(productDiscountAmount),
    memberDiscountAmount,
    memberDiscountAmountYuan: money.toYuan(memberDiscountAmount),
    couponDiscountAmount,
    couponDiscountAmountYuan: money.toYuan(couponDiscountAmount),
    pointsDiscountAmount,
    pointsDiscountAmountYuan: money.toYuan(pointsDiscountAmount),
    shippingAmount,
    shippingAmountYuan: money.toYuan(shippingAmount),
    paidAmount,
    paidAmountYuan: money.toYuan(paidAmount),
    eligiblePaidAmount,
    eligiblePaidAmountYuan: money.toYuan(eligiblePaidAmount),
    pointsToEarn,
    tier,
    nextTier: upcomingTier,
    amountToNextTier: profile && upcomingTier
      ? Math.max(0, upcomingTier.minLifetimePaidAmount - profile.lifetimePaidAmount)
      : null
  };
}

function createOrderNo() {
  return `SA${new Date().toISOString().slice(0, 10).replaceAll("-", "")}${String(Math.floor(Math.random() * 1000000)).padStart(6, "0")}`;
}

function orderPayload(db, order) {
  const items = db.orderItems.filter((item) => item.orderId === order.id);
  return {
    ...order,
    subtotalAmountYuan: money.toYuan(order.subtotalAmount),
    memberDiscountAmountYuan: money.toYuan(order.memberDiscountAmount),
    shippingAmountYuan: money.toYuan(order.shippingAmount),
    paidAmountYuan: money.toYuan(order.paidAmount),
    eligiblePaidAmountYuan: money.toYuan(order.eligiblePaidAmount),
    items: items.map((item) => ({
      ...item,
      unitPriceYuan: money.toYuan(item.unitPrice),
      subtotalAmountYuan: money.toYuan(item.subtotalAmount),
      discountAmountYuan: money.toYuan(item.discountAmount)
    }))
  };
}

function earnPointsForPaidOrder(db, order) {
  if (order.pointsAwarded > 0) return { points: order.pointsAwarded, upgraded: false };
  const profile = db.memberProfiles.find((item) => item.userId === order.userId);
  const oldTier = db.memberTiers.find((item) => item.id === profile.tierId);
  const points = Math.floor(order.eligiblePaidAmount / 100);
  profile.availablePoints += points;
  profile.lifetimePaidAmount += order.eligiblePaidAmount;
  profile.updatedAt = now();
  order.pointsAwarded = points;
  order.status = "paid";
  order.paidAt = now();
  order.updatedAt = now();
  db.pointTransactions.push({
    id: randomUUID(),
    userId: order.userId,
    orderId: order.id,
    type: "earn_order",
    points,
    balanceAfter: profile.availablePoints,
    expiresAt: null,
    note: `订单 ${order.orderNo} 实付积分`,
    createdAt: now()
  });

  const newTier = resolveTier(db, profile.lifetimePaidAmount);
  if (newTier.id !== oldTier.id) {
    profile.tierId = newTier.id;
    profile.updatedAt = now();
    db.tierHistory.push({
      id: randomUUID(),
      userId: order.userId,
      fromTierId: oldTier.id,
      toTierId: newTier.id,
      reason: "order_paid",
      orderId: order.id,
      createdAt: now()
    });
    return { points, upgraded: true, fromTier: oldTier, toTier: newTier };
  }
  return { points, upgraded: false };
}

function refundPaidOrder(db, order) {
  if (order.status === "refunded") return { alreadyProcessed: true };
  if (order.status !== "paid") throw new Error("只有已支付订单可以退款。");
  const profile = db.memberProfiles.find((item) => item.userId === order.userId);
  profile.availablePoints -= order.pointsAwarded;
  profile.lifetimePaidAmount = Math.max(0, profile.lifetimePaidAmount - order.eligiblePaidAmount);
  profile.updatedAt = now();
  order.status = "refunded";
  order.updatedAt = now();
  db.pointTransactions.push({
    id: randomUUID(),
    userId: order.userId,
    orderId: order.id,
    type: "refund_reversal",
    points: -order.pointsAwarded,
    balanceAfter: profile.availablePoints,
    expiresAt: null,
    note: `订单 ${order.orderNo} 退款扣回积分`,
    createdAt: now()
  });
  return {
    pointsReversed: order.pointsAwarded,
    lifetimePaidAmount: profile.lifetimePaidAmount
  };
}

async function handleApi(req, res, pathname) {
  const db = await readDb();
  const user = await currentUser(req, db);
  const body = ["POST", "PATCH", "PUT"].includes(req.method) ? await requestBody(req) : {};

  try {
    if (req.method === "POST" && pathname === "/api/auth/register") {
      const email = String(body.email || "").trim().toLowerCase();
      const phone = String(body.phone || "").trim();
      const password = String(body.password || "");
      const name = String(body.name || "").trim();
      if (!email && !phone) return sendError(res, 400, "请输入邮箱或手机。");
      if (password.length < 6) return sendError(res, 400, "密码至少需要 6 位。");
      if (email && db.users.some((item) => item.email === email)) return sendError(res, 409, "邮箱已注册。");
      if (phone && db.users.some((item) => item.phone === phone)) return sendError(res, 409, "手机已注册。");
      const baseTier = getBaseTier(db);
      const newUser = {
        id: randomUUID(),
        email,
        phone,
        name,
        passwordHash: hashPassword(password),
        status: "active",
        createdAt: now(),
        updatedAt: now()
      };
      db.users.push(newUser);
      db.memberProfiles.push({
        userId: newUser.id,
        tierId: baseTier.id,
        lifetimePaidAmount: 0,
        availablePoints: 0,
        birthday: null,
        acceptsMarketing: false,
        createdAt: now(),
        updatedAt: now()
      });
      const session = {
        id: randomUUID(),
        userId: newUser.id,
        createdAt: now(),
        expiresAt: new Date(Date.now() + sessionMaxAgeMs).toISOString()
      };
      db.sessions.push(session);
      await writeDb(db);
      return sendJson(res, 201, profilePayload(db, newUser), { "set-cookie": sessionCookie(session.id) });
    }

    if (req.method === "POST" && pathname === "/api/auth/login") {
      const account = String(body.account || body.email || body.phone || "").trim().toLowerCase();
      const password = String(body.password || "");
      const foundUser = db.users.find((item) => item.email === account || item.phone === account);
      if (!foundUser || !verifyPassword(password, foundUser.passwordHash)) return sendError(res, 401, "账号或密码错误。");
      const session = {
        id: randomUUID(),
        userId: foundUser.id,
        createdAt: now(),
        expiresAt: new Date(Date.now() + sessionMaxAgeMs).toISOString()
      };
      db.sessions.push(session);
      await writeDb(db);
      return sendJson(res, 200, profilePayload(db, foundUser), { "set-cookie": sessionCookie(session.id) });
    }

    if (req.method === "POST" && pathname === "/api/auth/logout") {
      const sessionId = parseCookies(req.headers.cookie).sa_session;
      if (sessionId) db.sessions = db.sessions.filter((session) => session.id !== sessionId);
      await writeDb(db);
      return sendJson(res, 200, { ok: true }, { "set-cookie": clearSessionCookie() });
    }

    if (req.method === "GET" && pathname === "/api/auth/me") {
      return sendJson(res, 200, user ? profilePayload(db, user) : { user: null });
    }

    if (pathname.startsWith("/api/member") && !user) return sendError(res, 401, "请先登录。");

    if (req.method === "GET" && pathname === "/api/member/profile") {
      return sendJson(res, 200, profilePayload(db, user));
    }

    if (req.method === "PATCH" && pathname === "/api/member/profile") {
      const profile = db.memberProfiles.find((item) => item.userId === user.id);
      user.name = String(body.name ?? user.name ?? "").trim();
      if ("birthday" in body) profile.birthday = body.birthday || null;
      if ("acceptsMarketing" in body) profile.acceptsMarketing = Boolean(body.acceptsMarketing);
      user.updatedAt = now();
      profile.updatedAt = now();
      await writeDb(db);
      return sendJson(res, 200, profilePayload(db, user));
    }

    if (req.method === "GET" && pathname === "/api/member/points") {
      return sendJson(res, 200, {
        transactions: db.pointTransactions
          .filter((item) => item.userId === user.id)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      });
    }

    if (req.method === "GET" && pathname === "/api/member/orders") {
      return sendJson(res, 200, {
        orders: db.orders
          .filter((item) => item.userId === user.id)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map((order) => orderPayload(db, order))
      });
    }

    if (req.method === "GET" && pathname === "/api/member/tier-progress") {
      const payload = profilePayload(db, user);
      return sendJson(res, 200, {
        tier: payload.tier,
        nextTier: payload.nextTier,
        lifetimePaidAmount: payload.profile.lifetimePaidAmount,
        lifetimePaidAmountYuan: payload.profile.lifetimePaidAmountYuan,
        amountToNextTier: payload.amountToNextTier,
        amountToNextTierYuan: payload.amountToNextTierYuan
      });
    }

    if (req.method === "POST" && pathname === "/api/checkout/quote") {
      return sendJson(res, 200, calculateQuote(db, user, body.items));
    }

    if (req.method === "POST" && pathname === "/api/checkout/create-order") {
      if (!user) return sendError(res, 401, "请先登录后结账。");
      const quote = calculateQuote(db, user, body.items);
      const order = {
        id: randomUUID(),
        orderNo: createOrderNo(),
        userId: user.id,
        status: "pending_payment",
        subtotalAmount: quote.subtotalAmount,
        productDiscountAmount: quote.productDiscountAmount,
        memberDiscountAmount: quote.memberDiscountAmount,
        couponDiscountAmount: quote.couponDiscountAmount,
        pointsDiscountAmount: quote.pointsDiscountAmount,
        shippingAmount: quote.shippingAmount,
        paidAmount: quote.paidAmount,
        eligiblePaidAmount: quote.eligiblePaidAmount,
        pointsUsed: 0,
        pointsAwarded: 0,
        paymentProvider: "manual",
        paymentReference: null,
        paidAt: null,
        createdAt: now(),
        updatedAt: now()
      };
      db.orders.push(order);
      quote.lines.forEach((line) => {
        db.orderItems.push({
          id: randomUUID(),
          orderId: order.id,
          productId: line.productId,
          productName: line.productName,
          brandName: line.brandName,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          subtotalAmount: line.subtotalAmount,
          discountAmount: line.memberDiscountAmount,
          memberDiscountExcluded: line.memberDiscountExcluded,
          createdAt: now()
        });
      });
      await writeDb(db);
      return sendJson(res, 201, { order: orderPayload(db, order), quote });
    }

    if (req.method === "POST" && pathname === "/api/checkout/start-payment") {
      if (!user) return sendError(res, 401, "请先登录后结账。");
      const order = db.orders.find((item) => item.id === body.orderId && item.userId === user.id);
      if (!order) return sendError(res, 404, "订单不存在。");
      return sendJson(res, 200, {
        status: "pending_manual_payment",
        order: orderPayload(db, order),
        message: `订单 ${order.orderNo} 已创建，待后台确认支付后会自动发放积分并更新等级。`
      });
    }

    if (req.method === "POST" && pathname === "/api/webhooks/payment") {
      if (req.headers["x-admin-key"] !== adminKey) return sendError(res, 403, "Webhook 密钥错误。");
      const order = db.orders.find((item) => item.id === body.orderId || item.orderNo === body.orderNo);
      if (!order) return sendError(res, 404, "订单不存在。");
      if (body.status !== "paid") return sendError(res, 400, "当前只支持 paid 支付事件。");
      if (order.status !== "pending_payment") return sendJson(res, 200, { order: orderPayload(db, order), alreadyProcessed: true });
      const result = earnPointsForPaidOrder(db, order);
      await writeDb(db);
      return sendJson(res, 200, {
        order: orderPayload(db, order),
        result,
        member: profilePayload(db, db.users.find((item) => item.id === order.userId))
      });
    }

    if (pathname.startsWith("/api/admin")) {
      if (req.headers["x-admin-key"] !== adminKey) return sendError(res, 403, "后台密钥错误。");

      if (req.method === "GET" && pathname === "/api/admin/audit-logs") {
        return sendJson(res, 200, {
          logs: db.operationLogs
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 200)
        });
      }

      if (req.method === "GET" && pathname === "/api/admin/points") {
        return sendJson(res, 200, {
          transactions: db.pointTransactions
            .map((transaction) => {
              const transactionUser = db.users.find((item) => item.id === transaction.userId);
              const order = transaction.orderId ? db.orders.find((item) => item.id === transaction.orderId) : null;
              return {
                ...transaction,
                user: transactionUser ? publicUser(transactionUser) : null,
                orderNo: order ? order.orderNo : null
              };
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        });
      }

      if (req.method === "GET" && pathname === "/api/admin/members") {
        return sendJson(res, 200, {
          members: db.users.map((item) => profilePayload(db, item))
        });
      }

      if (req.method === "GET" && pathname === "/api/admin/members/export.csv") {
        const rows = [
          ["id", "name", "email", "phone", "tier", "available_points", "lifetime_paid_yuan", "created_at"],
          ...db.users.map((item) => {
            const profile = profilePayload(db, item);
            return [
              item.id,
              item.name,
              item.email,
              item.phone,
              profile.tier.name,
              profile.profile.availablePoints,
              profile.profile.lifetimePaidAmountYuan,
              item.createdAt
            ];
          })
        ];
        return sendCsv(
          res,
          `scent-archive-members-${new Date().toISOString().slice(0, 10)}.csv`,
          rows.map((row) => row.map(csvCell).join(",")).join("\n")
        );
      }

      const memberMatch = pathname.match(/^\/api\/admin\/members\/([^/]+)$/);
      if (req.method === "GET" && memberMatch) {
        const member = db.users.find((item) => item.id === memberMatch[1]);
        if (!member) return sendError(res, 404, "会员不存在。");
        return sendJson(res, 200, profilePayload(db, member));
      }

      const memberTierMatch = pathname.match(/^\/api\/admin\/members\/([^/]+)\/tier$/);
      if (req.method === "PATCH" && memberTierMatch) {
        const member = db.users.find((item) => item.id === memberTierMatch[1]);
        if (!member) return sendError(res, 404, "会员不存在。");
        const profile = db.memberProfiles.find((item) => item.userId === member.id);
        const currentTier = db.memberTiers.find((item) => item.id === profile.tierId);
        const targetTier = db.memberTiers.find((item) => item.id === body.tierId || item.code === body.tierCode);
        if (!targetTier) return sendError(res, 404, "等级不存在。");
        const before = { tierId: profile.tierId, tierName: currentTier.name };
        profile.tierId = targetTier.id;
        profile.updatedAt = now();
        db.tierHistory.push({
          id: randomUUID(),
          userId: member.id,
          fromTierId: currentTier.id,
          toTierId: targetTier.id,
          reason: "admin_adjust",
          orderId: null,
          createdAt: now()
        });
        logAdminOperation(
          db,
          req,
          "adjust_member_tier",
          "member",
          member.id,
          before,
          { tierId: profile.tierId, tierName: targetTier.name },
          body.reason || body.note || "后台调整会员等级"
        );
        await writeDb(db);
        return sendJson(res, 200, profilePayload(db, member));
      }

      const memberPointsMatch = pathname.match(/^\/api\/admin\/members\/([^/]+)\/points$/);
      if (req.method === "POST" && memberPointsMatch) {
        const member = db.users.find((item) => item.id === memberPointsMatch[1]);
        if (!member) return sendError(res, 404, "会员不存在。");
        const points = Math.trunc(Number(body.points || 0));
        if (!points) return sendError(res, 400, "积分调整数量不能为 0。");
        const profile = db.memberProfiles.find((item) => item.userId === member.id);
        const before = { availablePoints: profile.availablePoints };
        profile.availablePoints += points;
        profile.updatedAt = now();
        db.pointTransactions.push({
          id: randomUUID(),
          userId: member.id,
          orderId: null,
          type: "admin_adjust",
          points,
          balanceAfter: profile.availablePoints,
          expiresAt: null,
          note: String(body.note || "后台积分调整"),
          createdAt: now()
        });
        logAdminOperation(
          db,
          req,
          "adjust_member_points",
          "member",
          member.id,
          before,
          { availablePoints: profile.availablePoints },
          body.reason || body.note || "后台积分调整"
        );
        await writeDb(db);
        return sendJson(res, 200, profilePayload(db, member));
      }

      if (req.method === "GET" && pathname === "/api/admin/orders") {
        return sendJson(res, 200, {
          orders: db.orders
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((order) => orderPayload(db, order))
        });
      }

      const orderStatusMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/status$/);
      if (req.method === "PATCH" && orderStatusMatch) {
        const order = db.orders.find((item) => item.id === orderStatusMatch[1]);
        if (!order) return sendError(res, 404, "订单不存在。");
        const allowed = ["pending_payment", "paid", "processing", "shipped", "completed", "cancelled", "refunded"];
        if (!allowed.includes(body.status)) return sendError(res, 400, "订单状态不合法。");
        const before = orderPayload(db, order);
        let result = null;
        if (body.status === "paid" && order.status === "pending_payment") {
          result = earnPointsForPaidOrder(db, order);
        } else if (body.status === "refunded" && order.status !== "refunded") {
          result = refundPaidOrder(db, order);
        } else {
          order.status = body.status;
          order.updatedAt = now();
        }
        logAdminOperation(
          db,
          req,
          "update_order_status",
          "order",
          order.id,
          before,
          orderPayload(db, order),
          body.reason || `订单状态调整为 ${body.status}`
        );
        await writeDb(db);
        return sendJson(res, 200, { order: orderPayload(db, order), result });
      }

      if (req.method === "GET" && pathname === "/api/admin/member-tiers") {
        return sendJson(res, 200, { tiers: db.memberTiers });
      }

      if (req.method === "POST" && pathname === "/api/admin/member-tiers") {
        const code = String(body.code || "").trim().toLowerCase();
        const name = String(body.name || "").trim();
        if (!code || !name) return sendError(res, 400, "等级 code 和 name 必填。");
        if (db.memberTiers.some((item) => item.code === code)) return sendError(res, 409, "等级 code 已存在。");
        const discountRate = Number(body.discountRate ?? 1);
        if (!Number.isFinite(discountRate) || discountRate <= 0 || discountRate > 1) return sendError(res, 400, "折扣率必须在 0 到 1 之间。");
        const tier = {
          id: randomUUID(),
          code,
          name,
          minLifetimePaidAmount: "minLifetimePaidAmountYuan" in body
            ? money.fromYuan(body.minLifetimePaidAmountYuan)
            : Math.max(0, Math.trunc(Number(body.minLifetimePaidAmount || 0))),
          discountRate,
          freeShippingThreshold: "freeShippingThresholdYuan" in body
            ? money.fromYuan(body.freeShippingThresholdYuan)
            : Math.max(0, Math.trunc(Number(body.freeShippingThreshold || 0))),
          sortOrder: Math.trunc(Number(body.sortOrder || db.memberTiers.length + 1)),
          isActive: body.isActive !== false,
          createdAt: now(),
          updatedAt: now()
        };
        db.memberTiers.push(tier);
        logAdminOperation(db, req, "create_member_tier", "member_tier", tier.id, null, tier, body.reason || "新增会员等级");
        await writeDb(db);
        return sendJson(res, 201, { tier });
      }

      const tierMatch = pathname.match(/^\/api\/admin\/member-tiers\/([^/]+)$/);
      if (req.method === "PATCH" && tierMatch) {
        const tier = db.memberTiers.find((item) => item.id === tierMatch[1] || item.code === tierMatch[1]);
        if (!tier) return sendError(res, 404, "等级不存在。");
        const before = snapshot(tier);
        if ("code" in body) tier.code = String(body.code || tier.code).trim().toLowerCase();
        if ("name" in body) tier.name = String(body.name || tier.name).trim();
        if ("minLifetimePaidAmountYuan" in body) tier.minLifetimePaidAmount = money.fromYuan(body.minLifetimePaidAmountYuan);
        if ("minLifetimePaidAmount" in body) tier.minLifetimePaidAmount = Math.max(0, Math.trunc(Number(body.minLifetimePaidAmount)));
        if ("discountRate" in body) {
          const discountRate = Number(body.discountRate);
          if (!Number.isFinite(discountRate) || discountRate <= 0 || discountRate > 1) return sendError(res, 400, "折扣率必须在 0 到 1 之间。");
          tier.discountRate = discountRate;
        }
        if ("freeShippingThresholdYuan" in body) tier.freeShippingThreshold = money.fromYuan(body.freeShippingThresholdYuan);
        if ("freeShippingThreshold" in body) tier.freeShippingThreshold = Math.max(0, Math.trunc(Number(body.freeShippingThreshold)));
        if ("sortOrder" in body) tier.sortOrder = Math.trunc(Number(body.sortOrder));
        if ("isActive" in body) tier.isActive = Boolean(body.isActive);
        tier.updatedAt = now();
        logAdminOperation(db, req, "update_member_tier", "member_tier", tier.id, before, tier, body.reason || "更新会员等级配置");
        await writeDb(db);
        return sendJson(res, 200, { tier });
      }

      const payMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/pay$/);
      if (req.method === "POST" && payMatch) {
        const order = db.orders.find((item) => item.id === payMatch[1]);
        if (!order) return sendError(res, 404, "订单不存在。");
        if (order.status !== "pending_payment") return sendJson(res, 200, { order: orderPayload(db, order), alreadyProcessed: true });
        const before = orderPayload(db, order);
        const result = earnPointsForPaidOrder(db, order);
        logAdminOperation(db, req, "confirm_order_paid", "order", order.id, before, orderPayload(db, order), body.reason || "后台确认支付");
        await writeDb(db);
        return sendJson(res, 200, {
          order: orderPayload(db, order),
          result,
          member: profilePayload(db, db.users.find((item) => item.id === order.userId))
        });
      }

      const refundMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/refund$/);
      if (req.method === "POST" && refundMatch) {
        const order = db.orders.find((item) => item.id === refundMatch[1]);
        if (!order) return sendError(res, 404, "订单不存在。");
        const before = orderPayload(db, order);
        const result = refundPaidOrder(db, order);
        logAdminOperation(db, req, "refund_order", "order", order.id, before, orderPayload(db, order), body.reason || "后台退款");
        await writeDb(db);
        return sendJson(res, 200, {
          order: orderPayload(db, order),
          result,
          member: profilePayload(db, db.users.find((item) => item.id === order.userId))
        });
      }
    }

    return sendError(res, 404, "API 不存在。");
  } catch (error) {
    return sendError(res, 400, error.message || "请求失败。");
  }
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

async function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = path.resolve(publicDir, `.${safePath}`);
  if (!filePath.startsWith(publicDir)) return sendError(res, 403, "Forbidden");

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not file");
    res.writeHead(200, {
      "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });
    createReadStream(filePath).pipe(res);
  } catch {
    const fallback = path.resolve(publicDir, "index.html");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    createReadStream(fallback).pipe(res);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url.pathname);
    return;
  }
  await serveStatic(req, res, url.pathname);
});

server.listen(port, () => {
  console.log(`Scent Archive server running at http://localhost:${port}`);
  console.log(`Admin key: ${adminKey}`);
});
