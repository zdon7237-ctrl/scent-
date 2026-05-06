import { createServer } from "node:http";
import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const modulePath = fileURLToPath(import.meta.url);
const __dirname = path.dirname(modulePath);
const rootDir = path.resolve(__dirname, "../..");
const publicDir = path.resolve(process.env.PUBLIC_DIR || path.join(rootDir, "dist"));
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

function addYears(dateString, years) {
  const date = new Date(dateString || now());
  date.setFullYear(date.getFullYear() + years);
  return date.toISOString();
}

function defaultTierDefinitions() {
  return [
    {
      code: "base",
      name: "普通会员",
      minLifetimePaidAmount: 0,
      discountRate: 1,
      pointMultiplier: 1,
      freeShippingThreshold: 59900,
      sortOrder: 1,
      isActive: true
    },
    {
      code: "silver",
      name: "银卡会员",
      minLifetimePaidAmount: 100000,
      discountRate: 0.95,
      pointMultiplier: 1.1,
      freeShippingThreshold: 49900,
      sortOrder: 2,
      isActive: true
    },
    {
      code: "gold",
      name: "金卡会员",
      minLifetimePaidAmount: 1000000,
      discountRate: 0.92,
      pointMultiplier: 1.2,
      freeShippingThreshold: 39900,
      sortOrder: 3,
      isActive: true
    },
    {
      code: "diamond",
      name: "钻卡会员",
      minLifetimePaidAmount: 2000000,
      discountRate: 0.88,
      pointMultiplier: 1.5,
      freeShippingThreshold: 0,
      sortOrder: 4,
      isActive: true
    },
    {
      code: "black",
      name: "黑卡会员",
      minLifetimePaidAmount: 5000000,
      discountRate: 0.85,
      pointMultiplier: 2,
      freeShippingThreshold: 0,
      sortOrder: 5,
      isActive: true
    },
    {
      code: "supreme",
      name: "至尊会员",
      minLifetimePaidAmount: 20000000,
      discountRate: 0.8,
      pointMultiplier: 2,
      freeShippingThreshold: 0,
      sortOrder: 6,
      isActive: true
    }
  ];
}

function defaultPointsMallItems() {
  const createdAt = now();
  return [
    {
      id: "pm-random-sample-1",
      productId: null,
      name: "官方随机小样 1 支",
      description: "由后台根据库存随机发出 1 支官方小样，适合低积分试用。",
      image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=1200&q=82",
      pointsPrice: 300,
      stockQuantity: 50,
      status: "active",
      sortOrder: 1,
      startsAt: null,
      endsAt: null,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "pm-random-sample-3",
      productId: null,
      name: "官方随机小样 3 支",
      description: "由后台根据库存随机发出 3 支官方小样，适合想一次试更多气味的会员。",
      image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=1200&q=82",
      pointsPrice: 800,
      stockQuantity: 30,
      status: "active",
      sortOrder: 2,
      startsAt: null,
      endsAt: null,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "pm-tea-official-samples",
      productId: null,
      name: "茶香官方小样组合",
      description: "围绕茶香方向搭配的官方小样组合，适合喜欢红茶、乌龙和低甜香气的会员。",
      image: "https://images.unsplash.com/photo-1615634260167-c8cdede054de?auto=format&fit=crop&w=1200&q=82",
      pointsPrice: 600,
      stockQuantity: 30,
      status: "active",
      sortOrder: 3,
      startsAt: null,
      endsAt: null,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "pm-tea-sample",
      productId: "tea-sample",
      name: "茶香主题试香套装",
      description: "从清透乌龙到温柔红茶，适合低甜度和东方感偏好。",
      image: "",
      pointsPrice: 1600,
      stockQuantity: 10,
      status: "active",
      sortOrder: 4,
      startsAt: null,
      endsAt: null,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "pm-wood-sample",
      productId: "wood-sample",
      name: "木质与焚香试香套装",
      description: "偏冷感、雨天和树脂质地，适合想找更成熟气味的人。",
      image: "",
      pointsPrice: 1800,
      stockQuantity: 10,
      status: "active",
      sortOrder: 5,
      startsAt: null,
      endsAt: null,
      createdAt,
      updatedAt: createdAt
    }
  ];
}

function defaultDb() {
  const tiers = defaultTierDefinitions().map((tier) => ({
    id: randomUUID(),
    ...tier
  }));

  return {
    users: [],
    memberProfiles: [],
    memberTiers: tiers,
    orders: [],
    orderItems: [],
    pointTransactions: [],
    tierHistory: [],
    pointsMallItems: defaultPointsMallItems(),
    pointsRedemptionOrders: [],
    pointsRedemptionItems: [],
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
    "pointsMallItems",
    "pointsRedemptionOrders",
    "pointsRedemptionItems",
    "operationLogs",
    "sessions",
    "coupons",
    "couponRedemptions"
  ].forEach((key) => {
    if (!Array.isArray(normalized[key])) normalized[key] = [];
  });
  const oldSeededTiers = {
    base: { minLifetimePaidAmount: 0, discountRate: 1 },
    silver: { minLifetimePaidAmount: 300000, discountRate: 0.98 },
    gold: { minLifetimePaidAmount: 800000, discountRate: 0.95 },
    black: { minLifetimePaidAmount: 2000000, discountRate: 0.92 }
  };
  defaultTierDefinitions().forEach((definition) => {
    const existing = normalized.memberTiers.find((tier) => tier.code === definition.code);
    if (!existing) {
      normalized.memberTiers.push({
        id: randomUUID(),
        ...definition,
        createdAt: now(),
        updatedAt: now()
      });
      return;
    }
    const oldSeed = oldSeededTiers[definition.code];
    const looksLikeOldSeed = oldSeed
      && existing.minLifetimePaidAmount === oldSeed.minLifetimePaidAmount
      && Number(existing.discountRate) === oldSeed.discountRate;
    if (looksLikeOldSeed || existing.pointMultiplier === undefined) {
      Object.assign(existing, definition);
    } else if (existing.pointMultiplier === undefined || existing.pointMultiplier === null) {
      existing.pointMultiplier = definition.pointMultiplier;
    }
  });
  if (!normalized.pointsMallItems.length) {
    normalized.pointsMallItems.push(...defaultPointsMallItems());
  }
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

function expirePointsForUser(db, userId) {
  const profile = db.memberProfiles.find((item) => item.userId === userId);
  if (!profile) return false;
  const expiredSourceIds = new Set(
    db.pointTransactions
      .filter((item) => item.type === "expire_points" && item.sourceTransactionId)
      .map((item) => item.sourceTransactionId)
  );
  const nowMs = Date.now();
  let changed = false;
  db.pointTransactions
    .filter((item) => isPointBatch(item) && item.userId === userId && item.expiresAt && new Date(item.expiresAt).getTime() <= nowMs)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach((item) => {
      if (expiredSourceIds.has(item.id)) return;
      const pointsToExpire = Math.min(pointBatchRemaining(db, item), Math.max(0, profile.availablePoints));
      if (pointsToExpire <= 0) return;
      profile.availablePoints -= pointsToExpire;
      profile.updatedAt = now();
      db.pointTransactions.push({
        id: randomUUID(),
        userId,
        orderId: item.orderId || null,
        sourceTransactionId: item.id,
        type: "expire_points",
        points: -pointsToExpire,
        balanceAfter: profile.availablePoints,
        expiresAt: null,
        note: `积分于 ${new Date(item.expiresAt).toLocaleDateString("zh-CN")} 到期`,
        createdAt: now()
      });
      changed = true;
    });
  return changed;
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

function mallItemPayload(item) {
  const linkedProduct = item.productId ? catalogItemById(item.productId) : null;
  const status = item.stockQuantity <= 0 && item.status === "active" ? "sold_out" : item.status;
  return {
    ...item,
    productId: item.productId || null,
    name: item.name || linkedProduct?.name || "积分商品",
    description: item.description || linkedProduct?.intro || linkedProduct?.description || "",
    image: item.image || linkedProduct?.image || "",
    pointsPrice: Number(item.pointsPrice || 0),
    stockQuantity: Math.max(0, Math.trunc(Number(item.stockQuantity || 0))),
    status,
    isRedeemable: status === "active" && Number(item.pointsPrice || 0) > 0 && Number(item.stockQuantity || 0) > 0
  };
}

function activeMallItem(item) {
  const payload = mallItemPayload(item);
  const nowMs = Date.now();
  const startsAt = item.startsAt ? new Date(item.startsAt).getTime() : null;
  const endsAt = item.endsAt ? new Date(item.endsAt).getTime() : null;
  return payload.status === "active"
    && payload.stockQuantity > 0
    && (!startsAt || startsAt <= nowMs)
    && (!endsAt || endsAt >= nowMs);
}

function redemptionPayload(db, order, includeUser = false) {
  const items = db.pointsRedemptionItems.filter((item) => item.redemptionOrderId === order.id);
  const payload = {
    ...order,
    items
  };
  if (includeUser) {
    payload.user = publicUser(db.users.find((item) => item.id === order.userId));
  }
  return payload;
}

function createRedemptionOrderNo() {
  return `PM${new Date().toISOString().slice(0, 10).replaceAll("-", "")}${String(Math.floor(Math.random() * 1000000)).padStart(6, "0")}`;
}

function isPointBatch(transaction) {
  return Number(transaction.points || 0) > 0 && transaction.type !== "redeem_refund";
}

function pointBatchRemaining(db, batch) {
  const usedOrRestored = db.pointTransactions
    .filter((item) => item.sourceTransactionId === batch.id)
    .reduce((sum, item) => sum + Number(item.points || 0), 0);
  return Math.max(0, Number(batch.points || 0) + usedOrRestored);
}

function availablePointBatches(db, userId) {
  const nowMs = Date.now();
  return db.pointTransactions
    .filter((item) => isPointBatch(item)
      && item.userId === userId
      && (!item.expiresAt || new Date(item.expiresAt).getTime() > nowMs))
    .map((item) => ({
      ...item,
      remainingPoints: pointBatchRemaining(db, item)
    }))
    .filter((item) => item.remainingPoints > 0)
    .sort((a, b) => {
      const aExpiry = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bExpiry = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
      if (aExpiry !== bExpiry) return aExpiry - bExpiry;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
}

function redeemMemberPoints(db, userId, pointsNeeded, redemptionOrderId) {
  expirePointsForUser(db, userId);
  const profile = db.memberProfiles.find((item) => item.userId === userId);
  const points = Math.trunc(Number(pointsNeeded || 0));
  if (points <= 0) throw new Error("兑换积分必须大于 0。");
  if (profile.availablePoints < points) throw new Error("可用积分不足。");
  const batches = availablePointBatches(db, userId);
  const availableFromBatches = batches.reduce((sum, item) => sum + item.remainingPoints, 0);
  if (availableFromBatches < points) throw new Error("可用积分不足或积分已过期。");

  let remaining = points;
  const transactions = [];
  batches.forEach((batch) => {
    if (remaining <= 0) return;
    const used = Math.min(batch.remainingPoints, remaining);
    profile.availablePoints -= used;
    profile.updatedAt = now();
    const transaction = {
      id: randomUUID(),
      userId,
      orderId: null,
      redemptionOrderId,
      sourceTransactionId: batch.id,
      type: "redeem_points",
      points: -used,
      balanceAfter: profile.availablePoints,
      expiresAt: null,
      note: `积分商城兑换 ${redemptionOrderId}`,
      createdAt: now()
    };
    db.pointTransactions.push(transaction);
    transactions.push(transaction);
    remaining -= used;
  });

  if (remaining > 0) throw new Error("可用积分不足。");
  return transactions;
}

function createPointsRedemption(db, user, body) {
  expirePointsForUser(db, user.id);
  const itemId = String(body.mallItemId || body.itemId || body.id || "").trim();
  const quantity = Math.max(1, Math.trunc(Number(body.quantity || 1)));
  const requestId = String(body.requestId || "").trim();
  if (!itemId) throw new Error("请选择要兑换的积分商品。");
  if (requestId) {
    const existing = db.pointsRedemptionOrders.find((item) => item.userId === user.id && item.requestId === requestId);
    if (existing) return { order: existing, alreadyProcessed: true };
  }
  const item = db.pointsMallItems.find((entry) => entry.id === itemId);
  if (!item) throw new Error("积分商品不存在。");
  if (!activeMallItem(item)) throw new Error("该积分商品暂不可兑换。");
  if (quantity > item.stockQuantity) throw new Error("积分商品库存不足。");
  const itemPayload = mallItemPayload(item);
  const totalPoints = itemPayload.pointsPrice * quantity;
  const order = {
    id: randomUUID(),
    orderNo: createRedemptionOrderNo(),
    requestId: requestId || null,
    userId: user.id,
    status: "pending_fulfillment",
    totalPoints,
    recipientName: String(body.recipientName || user.name || "").trim(),
    recipientPhone: String(body.recipientPhone || user.phone || "").trim(),
    shippingAddress: String(body.shippingAddress || "").trim(),
    trackingNo: null,
    shippedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: now(),
    updatedAt: now()
  };
  db.pointsRedemptionOrders.push(order);
  db.pointsRedemptionItems.push({
    id: randomUUID(),
    redemptionOrderId: order.id,
    mallItemId: item.id,
    productId: item.productId || null,
    name: itemPayload.name,
    pointsPrice: itemPayload.pointsPrice,
    quantity,
    subtotalPoints: totalPoints,
    createdAt: now()
  });
  redeemMemberPoints(db, user.id, totalPoints, order.id);
  item.stockQuantity -= quantity;
  if (item.stockQuantity <= 0) {
    item.stockQuantity = 0;
    item.status = "sold_out";
  }
  item.updatedAt = now();
  return { order, alreadyProcessed: false };
}

function cancelPointsRedemption(db, order, reason = "后台取消兑换") {
  if (order.status === "cancelled") return { alreadyProcessed: true };
  if (order.status === "completed") throw new Error("已完成兑换订单不能取消。");
  const profile = db.memberProfiles.find((item) => item.userId === order.userId);
  const deductions = db.pointTransactions.filter((item) => item.redemptionOrderId === order.id && item.type === "redeem_points");
  const totalRefunded = deductions.reduce((sum, deduction) => {
    const source = db.pointTransactions.find((item) => item.id === deduction.sourceTransactionId);
    const points = Math.abs(Number(deduction.points || 0));
    profile.availablePoints += points;
    profile.updatedAt = now();
    db.pointTransactions.push({
      id: randomUUID(),
      userId: order.userId,
      orderId: null,
      redemptionOrderId: order.id,
      sourceTransactionId: deduction.sourceTransactionId || deduction.id,
      type: "redeem_refund",
      points,
      balanceAfter: profile.availablePoints,
      expiresAt: source ? source.expiresAt : addYears(now(), 1),
      note: `积分商城兑换 ${order.orderNo} 取消返还`,
      createdAt: now()
    });
    return sum + points;
  }, 0);
  db.pointsRedemptionItems
    .filter((item) => item.redemptionOrderId === order.id)
    .forEach((line) => {
      const mallItem = db.pointsMallItems.find((item) => item.id === line.mallItemId);
      if (!mallItem) return;
      mallItem.stockQuantity += line.quantity;
      if (mallItem.status === "sold_out") mallItem.status = "active";
      mallItem.updatedAt = now();
    });
  order.status = "cancelled";
  order.cancelReason = String(reason || "后台取消兑换");
  order.cancelledAt = now();
  order.updatedAt = now();
  expirePointsForUser(db, order.userId);
  return { pointsRefunded: totalRefunded };
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
    const discountedAmount = memberDiscountExcluded
      ? subtotalAmount
      : Math.round(subtotalAmount * Number(tier.discountRate));
    const memberDiscountAmount = subtotalAmount - discountedAmount;
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
  const pointsToEarn = Math.floor((eligiblePaidAmount / 100) * Number(tier.pointMultiplier || 1));
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

function markOrderPaid(order) {
  if (order.status !== "pending_payment") return { alreadyProcessed: true };
  order.status = "paid";
  order.paidAt = order.paidAt || now();
  order.updatedAt = now();
  return { paid: true };
}

function settleCompletedOrder(db, order) {
  if (order.pointsAwarded > 0) {
    if (order.status !== "completed") {
      order.status = "completed";
      order.completedAt = order.completedAt || now();
      order.updatedAt = now();
    }
    return { points: order.pointsAwarded, upgraded: false, alreadyProcessed: true };
  }
  if (!["paid", "processing", "shipped", "completed"].includes(order.status)) {
    throw new Error("只有已支付或已发货订单可以确认收货。");
  }
  const profile = db.memberProfiles.find((item) => item.userId === order.userId);
  const oldTier = db.memberTiers.find((item) => item.id === profile.tierId);
  const orderTier = db.memberTiers.find((item) => item.id === order.memberTierId) || oldTier;
  const completedAt = now();
  const points = Math.floor((order.eligiblePaidAmount / 100) * Number(orderTier.pointMultiplier || 1));
  profile.availablePoints += points;
  profile.lifetimePaidAmount += order.eligiblePaidAmount;
  profile.updatedAt = now();
  order.pointsAwarded = points;
  order.status = "completed";
  order.completedAt = completedAt;
  order.updatedAt = now();
  db.pointTransactions.push({
    id: randomUUID(),
    userId: order.userId,
    orderId: order.id,
    type: "earn_order",
    points,
    balanceAfter: profile.availablePoints,
    expiresAt: addYears(completedAt, 1),
    note: `订单 ${order.orderNo} 确认收货积分`,
    createdAt: completedAt
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
      reason: "order_completed",
      orderId: order.id,
      createdAt: now()
    });
    return { points, upgraded: true, fromTier: oldTier, toTier: newTier };
  }
  return { points, upgraded: false };
}

function refundPaidOrder(db, order) {
  if (order.status === "refunded") return { alreadyProcessed: true };
  if (!["paid", "processing", "shipped", "completed"].includes(order.status)) throw new Error("只有已支付订单可以退款。");
  const profile = db.memberProfiles.find((item) => item.userId === order.userId);
  const oldTier = db.memberTiers.find((item) => item.id === profile.tierId);
  const wasSettled = order.status === "completed" || Number(order.pointsAwarded || 0) > 0;
  const pointsToReverse = Number(order.pointsAwarded || 0);
  if (pointsToReverse > 0) profile.availablePoints -= pointsToReverse;
  if (wasSettled) profile.lifetimePaidAmount = Math.max(0, profile.lifetimePaidAmount - order.eligiblePaidAmount);
  profile.updatedAt = now();
  order.status = "refunded";
  order.refundedAt = now();
  order.updatedAt = now();
  if (pointsToReverse > 0) {
    db.pointTransactions.push({
      id: randomUUID(),
      userId: order.userId,
      orderId: order.id,
      type: "refund_reversal",
      points: -pointsToReverse,
      balanceAfter: profile.availablePoints,
      expiresAt: null,
      note: `订单 ${order.orderNo} 退款扣回积分`,
      createdAt: now()
    });
  }
  const newTier = resolveTier(db, profile.lifetimePaidAmount);
  let tierChanged = false;
  if (newTier.id !== oldTier.id) {
    profile.tierId = newTier.id;
    profile.updatedAt = now();
    tierChanged = true;
    db.tierHistory.push({
      id: randomUUID(),
      userId: order.userId,
      fromTierId: oldTier.id,
      toTierId: newTier.id,
      reason: "order_refunded",
      orderId: order.id,
      createdAt: now()
    });
  }
  return {
    pointsReversed: pointsToReverse,
    lifetimePaidAmount: profile.lifetimePaidAmount,
    tierChanged,
    toTier: newTier
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
      if (user && expirePointsForUser(db, user.id)) await writeDb(db);
      return sendJson(res, 200, user ? profilePayload(db, user) : { user: null });
    }

    if (pathname.startsWith("/api/member") && !user) return sendError(res, 401, "请先登录。");

    if (req.method === "GET" && pathname === "/api/member/profile") {
      if (expirePointsForUser(db, user.id)) await writeDb(db);
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
      if (expirePointsForUser(db, user.id)) await writeDb(db);
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

    const confirmReceiptMatch = pathname.match(/^\/api\/member\/orders\/([^/]+)\/confirm-receipt$/);
    if (req.method === "POST" && confirmReceiptMatch) {
      const order = db.orders.find((item) => item.id === confirmReceiptMatch[1] && item.userId === user.id);
      if (!order) return sendError(res, 404, "订单不存在。");
      const result = settleCompletedOrder(db, order);
      await writeDb(db);
      return sendJson(res, 200, {
        order: orderPayload(db, order),
        result,
        member: profilePayload(db, user)
      });
    }

    if (req.method === "GET" && pathname === "/api/member/tier-progress") {
      if (expirePointsForUser(db, user.id)) await writeDb(db);
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

    if (req.method === "GET" && pathname === "/api/points-mall/items") {
      return sendJson(res, 200, {
        items: db.pointsMallItems
          .filter((item) => activeMallItem(item))
          .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
          .map(mallItemPayload)
      });
    }

    const mallItemMatch = pathname.match(/^\/api\/points-mall\/items\/([^/]+)$/);
    if (req.method === "GET" && mallItemMatch) {
      const item = db.pointsMallItems.find((entry) => entry.id === mallItemMatch[1]);
      if (!item || !activeMallItem(item)) return sendError(res, 404, "积分商品不存在或已下架。");
      return sendJson(res, 200, { item: mallItemPayload(item) });
    }

    if (req.method === "POST" && pathname === "/api/points-mall/redeem") {
      if (!user) return sendError(res, 401, "请先登录后兑换。");
      const result = createPointsRedemption(db, user, body);
      await writeDb(db);
      return sendJson(res, result.alreadyProcessed ? 200 : 201, {
        order: redemptionPayload(db, result.order),
        alreadyProcessed: result.alreadyProcessed,
        member: profilePayload(db, user)
      });
    }

    if (req.method === "GET" && pathname === "/api/points-mall/redemptions") {
      if (!user) return sendError(res, 401, "请先登录后查看兑换记录。");
      return sendJson(res, 200, {
        redemptions: db.pointsRedemptionOrders
          .filter((item) => item.userId === user.id)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map((order) => redemptionPayload(db, order))
      });
    }

    const redemptionMatch = pathname.match(/^\/api\/points-mall\/redemptions\/([^/]+)$/);
    if (req.method === "GET" && redemptionMatch) {
      if (!user) return sendError(res, 401, "请先登录后查看兑换记录。");
      const order = db.pointsRedemptionOrders.find((item) => item.id === redemptionMatch[1] && item.userId === user.id);
      if (!order) return sendError(res, 404, "兑换订单不存在。");
      return sendJson(res, 200, { redemption: redemptionPayload(db, order) });
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
        memberTierId: quote.tier.id,
        paymentProvider: "manual",
        paymentReference: null,
        paidAt: null,
        completedAt: null,
        refundedAt: null,
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
        message: `订单 ${order.orderNo} 已创建。后台确认支付后，客户确认收货才会发放积分并更新等级。`
      });
    }

    if (req.method === "POST" && pathname === "/api/webhooks/payment") {
      if (req.headers["x-admin-key"] !== adminKey) return sendError(res, 403, "Webhook 密钥错误。");
      const order = db.orders.find((item) => item.id === body.orderId || item.orderNo === body.orderNo);
      if (!order) return sendError(res, 404, "订单不存在。");
      if (body.status !== "paid") return sendError(res, 400, "当前只支持 paid 支付事件。");
      if (order.status !== "pending_payment") return sendJson(res, 200, { order: orderPayload(db, order), alreadyProcessed: true });
      const result = markOrderPaid(order);
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
        let changed = false;
        db.users.forEach((item) => {
          if (expirePointsForUser(db, item.id)) changed = true;
        });
        if (changed) await writeDb(db);
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

      if (req.method === "GET" && pathname === "/api/admin/points-mall/items") {
        return sendJson(res, 200, {
          items: db.pointsMallItems
            .slice()
            .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
            .map(mallItemPayload)
        });
      }

      if (req.method === "POST" && pathname === "/api/admin/points-mall/items") {
        const productId = body.productId ? String(body.productId).trim() : null;
        const linkedProduct = productId ? catalogItemById(productId) : null;
        if (productId && !linkedProduct) return sendError(res, 404, "关联商品不存在。");
        const name = String(body.name || linkedProduct?.name || "").trim();
        const pointsPrice = Math.trunc(Number(body.pointsPrice || 0));
        const stockQuantity = Math.max(0, Math.trunc(Number(body.stockQuantity || 0)));
        const status = String(body.status || "draft");
        const allowed = ["draft", "active", "inactive", "sold_out"];
        if (!name) return sendError(res, 400, "积分商品名称必填。");
        if (pointsPrice <= 0) return sendError(res, 400, "兑换积分必须大于 0。");
        if (!allowed.includes(status)) return sendError(res, 400, "积分商品状态不合法。");
        const item = {
          id: randomUUID(),
          productId,
          name,
          description: String(body.description || linkedProduct?.intro || linkedProduct?.description || "").trim(),
          image: String(body.image || linkedProduct?.image || "").trim(),
          pointsPrice,
          stockQuantity,
          status,
          sortOrder: Math.trunc(Number(body.sortOrder || db.pointsMallItems.length + 1)),
          startsAt: body.startsAt || null,
          endsAt: body.endsAt || null,
          createdAt: now(),
          updatedAt: now()
        };
        db.pointsMallItems.push(item);
        logAdminOperation(db, req, "create_points_mall_item", "points_mall_item", item.id, null, item, body.reason || "新增积分商品");
        await writeDb(db);
        return sendJson(res, 201, { item: mallItemPayload(item) });
      }

      const mallAdminActionMatch = pathname.match(/^\/api\/admin\/points-mall\/items\/([^/]+)\/(activate|deactivate)$/);
      if (req.method === "POST" && mallAdminActionMatch) {
        const item = db.pointsMallItems.find((entry) => entry.id === mallAdminActionMatch[1]);
        if (!item) return sendError(res, 404, "积分商品不存在。");
        const before = snapshot(item);
        item.status = mallAdminActionMatch[2] === "activate" ? "active" : "inactive";
        if (item.status === "active" && item.stockQuantity <= 0) return sendError(res, 400, "库存为 0，不能上架。");
        item.updatedAt = now();
        logAdminOperation(
          db,
          req,
          mallAdminActionMatch[2] === "activate" ? "activate_points_mall_item" : "deactivate_points_mall_item",
          "points_mall_item",
          item.id,
          before,
          item,
          body.reason || (mallAdminActionMatch[2] === "activate" ? "上架积分商品" : "下架积分商品")
        );
        await writeDb(db);
        return sendJson(res, 200, { item: mallItemPayload(item) });
      }

      const mallAdminItemMatch = pathname.match(/^\/api\/admin\/points-mall\/items\/([^/]+)$/);
      if (req.method === "PATCH" && mallAdminItemMatch) {
        const item = db.pointsMallItems.find((entry) => entry.id === mallAdminItemMatch[1]);
        if (!item) return sendError(res, 404, "积分商品不存在。");
        const before = snapshot(item);
        if ("productId" in body) {
          const productId = body.productId ? String(body.productId).trim() : null;
          if (productId && !catalogItemById(productId)) return sendError(res, 404, "关联商品不存在。");
          item.productId = productId;
        }
        if ("name" in body) item.name = String(body.name || "").trim();
        if ("description" in body) item.description = String(body.description || "").trim();
        if ("image" in body) item.image = String(body.image || "").trim();
        if ("pointsPrice" in body) {
          const pointsPrice = Math.trunc(Number(body.pointsPrice));
          if (pointsPrice <= 0) return sendError(res, 400, "兑换积分必须大于 0。");
          item.pointsPrice = pointsPrice;
        }
        if ("stockQuantity" in body) item.stockQuantity = Math.max(0, Math.trunc(Number(body.stockQuantity)));
        if ("status" in body) {
          const status = String(body.status || "");
          if (!["draft", "active", "inactive", "sold_out"].includes(status)) return sendError(res, 400, "积分商品状态不合法。");
          if (status === "active" && item.stockQuantity <= 0) return sendError(res, 400, "库存为 0，不能上架。");
          item.status = status;
        }
        if ("sortOrder" in body) item.sortOrder = Math.trunc(Number(body.sortOrder));
        if ("startsAt" in body) item.startsAt = body.startsAt || null;
        if ("endsAt" in body) item.endsAt = body.endsAt || null;
        item.updatedAt = now();
        logAdminOperation(db, req, "update_points_mall_item", "points_mall_item", item.id, before, item, body.reason || "更新积分商品");
        await writeDb(db);
        return sendJson(res, 200, { item: mallItemPayload(item) });
      }

      if (req.method === "GET" && pathname === "/api/admin/points-mall/redemptions") {
        return sendJson(res, 200, {
          redemptions: db.pointsRedemptionOrders
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((order) => redemptionPayload(db, order, true))
        });
      }

      const adminRedemptionStatusMatch = pathname.match(/^\/api\/admin\/points-mall\/redemptions\/([^/]+)\/status$/);
      if (req.method === "PATCH" && adminRedemptionStatusMatch) {
        const order = db.pointsRedemptionOrders.find((item) => item.id === adminRedemptionStatusMatch[1]);
        if (!order) return sendError(res, 404, "兑换订单不存在。");
        const before = redemptionPayload(db, order, true);
        const status = String(body.status || "");
        const allowed = ["pending_fulfillment", "processing", "shipped", "completed", "cancelled"];
        if (!allowed.includes(status)) return sendError(res, 400, "兑换订单状态不合法。");
        let result = null;
        if (status === "cancelled") {
          result = cancelPointsRedemption(db, order, body.reason || "后台取消兑换");
        } else {
          if (order.status === "cancelled") return sendError(res, 400, "已取消兑换订单不能改状态。");
          order.status = status;
          if ("trackingNo" in body) order.trackingNo = String(body.trackingNo || "").trim() || null;
          if (status === "shipped") order.shippedAt = order.shippedAt || now();
          if (status === "completed") order.completedAt = order.completedAt || now();
          order.updatedAt = now();
        }
        logAdminOperation(db, req, "update_points_redemption_status", "points_redemption_order", order.id, before, redemptionPayload(db, order, true), body.reason || `兑换订单状态调整为 ${status}`);
        await writeDb(db);
        return sendJson(res, 200, { redemption: redemptionPayload(db, order, true), result });
      }

      const adminRedemptionCancelMatch = pathname.match(/^\/api\/admin\/points-mall\/redemptions\/([^/]+)\/cancel$/);
      if (req.method === "POST" && adminRedemptionCancelMatch) {
        const order = db.pointsRedemptionOrders.find((item) => item.id === adminRedemptionCancelMatch[1]);
        if (!order) return sendError(res, 404, "兑换订单不存在。");
        const before = redemptionPayload(db, order, true);
        const result = cancelPointsRedemption(db, order, body.reason || "后台取消兑换");
        logAdminOperation(db, req, "cancel_points_redemption", "points_redemption_order", order.id, before, redemptionPayload(db, order, true), body.reason || "后台取消兑换");
        await writeDb(db);
        return sendJson(res, 200, { redemption: redemptionPayload(db, order, true), result });
      }

      const adminRedemptionMatch = pathname.match(/^\/api\/admin\/points-mall\/redemptions\/([^/]+)$/);
      if (req.method === "GET" && adminRedemptionMatch) {
        const order = db.pointsRedemptionOrders.find((item) => item.id === adminRedemptionMatch[1]);
        if (!order) return sendError(res, 404, "兑换订单不存在。");
        return sendJson(res, 200, { redemption: redemptionPayload(db, order, true) });
      }

      if (req.method === "GET" && pathname === "/api/admin/members") {
        let changed = false;
        db.users.forEach((item) => {
          if (expirePointsForUser(db, item.id)) changed = true;
        });
        if (changed) await writeDb(db);
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
          expiresAt: points > 0 ? addYears(now(), 1) : null,
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
          result = markOrderPaid(order);
        } else if (body.status === "completed") {
          result = settleCompletedOrder(db, order);
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
        const pointMultiplier = Number(body.pointMultiplier ?? 1);
        if (!Number.isFinite(pointMultiplier) || pointMultiplier <= 0) return sendError(res, 400, "积分倍数必须大于 0。");
        const tier = {
          id: randomUUID(),
          code,
          name,
          minLifetimePaidAmount: "minLifetimePaidAmountYuan" in body
            ? money.fromYuan(body.minLifetimePaidAmountYuan)
            : Math.max(0, Math.trunc(Number(body.minLifetimePaidAmount || 0))),
          discountRate,
          pointMultiplier,
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
        if ("pointMultiplier" in body) {
          const pointMultiplier = Number(body.pointMultiplier);
          if (!Number.isFinite(pointMultiplier) || pointMultiplier <= 0) return sendError(res, 400, "积分倍数必须大于 0。");
          tier.pointMultiplier = pointMultiplier;
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
        const result = markOrderPaid(order);
        logAdminOperation(db, req, "confirm_order_paid", "order", order.id, before, orderPayload(db, order), body.reason || "后台确认支付");
        await writeDb(db);
        return sendJson(res, 200, {
          order: orderPayload(db, order),
          result,
          member: profilePayload(db, db.users.find((item) => item.id === order.userId))
        });
      }

      const completeMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/complete$/);
      if (req.method === "POST" && completeMatch) {
        const order = db.orders.find((item) => item.id === completeMatch[1]);
        if (!order) return sendError(res, 404, "订单不存在。");
        const before = orderPayload(db, order);
        const result = settleCompletedOrder(db, order);
        logAdminOperation(db, req, "confirm_order_received", "order", order.id, before, orderPayload(db, order), body.reason || "确认收货结算会员权益");
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

export { server };

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  server.listen(port, () => {
    console.log(`Scent Archive server running at http://localhost:${port}`);
    console.log(`Admin key: ${adminKey}`);
  });
}
