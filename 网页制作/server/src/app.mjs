import { createServer } from "node:http";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { stat } from "node:fs/promises";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createRepository, repositoryMode } from "./repository.mjs";
import { createEmailService } from "./services/email-service.mjs";
import { createProductImageStorage } from "./services/product-image-storage.mjs";
import { createLoginRateLimiter } from "./services/login-rate-limiter.mjs";
import { createErrorReporter, createLogger } from "./services/observability.mjs";
import {
  assertWechatPayTransaction,
  createWechatPayClient,
  WECHAT_PAY_REFUNDS_SUPPORTED,
  wechatPayConfigFromEnv
} from "./wechat-pay.mjs";

const modulePath = fileURLToPath(import.meta.url);
const __dirname = path.dirname(modulePath);
const rootDir = path.resolve(__dirname, "../..");
const publicDir = path.resolve(process.env.PUBLIC_DIR || path.join(rootDir, "dist"));
const dataFile = path.resolve(process.env.MEMBER_DB || path.join(rootDir, "server/data/db.json"));
const repository = createRepository({ dataFile });
const activeRepositoryMode = repositoryMode();
const autoWriteCatalogSeed = activeRepositoryMode !== "postgres";
const port = Number(process.env.PORT || 8788);
const sessionMaxAgeMs = 1000 * 60 * 60 * 24 * 30;
const isProduction = process.env.NODE_ENV === "production";
const runtimeDefaultsEnabled = activeRepositoryMode === "json" && !isProduction;
const defaultSeedAdminPassword = ["dev", "admin"].join("-");
const seedAdminEmail = String(process.env.SEED_ADMIN_EMAIL || (isProduction ? "" : "admin@scent.local")).trim().toLowerCase();
const seedAdminPassword = String(process.env.SEED_ADMIN_PASSWORD || (isProduction ? "" : defaultSeedAdminPassword));
const seedAdminRole = String(process.env.SEED_ADMIN_ROLE || "owner").trim().toLowerCase();
const defaultPaymentWebhookSecret = "dev-webhook";
const paymentWebhookSecret = String(process.env.PAYMENT_WEBHOOK_SECRET || (isProduction ? "" : defaultPaymentWebhookSecret));
const maxRequestBodyBytes = Math.max(1024, Number(process.env.MAX_REQUEST_BODY_BYTES || 1024 * 1024));
const termsVersion = String(process.env.TERMS_VERSION || "2026-07-10").trim();
const privacyVersion = String(process.env.PRIVACY_VERSION || "2026-07-10").trim();
const reservationCronSecret = String(process.env.RESERVATION_CRON_SECRET || process.env.CRON_SECRET || "").trim();

if (isProduction && (seedAdminEmail || process.env.SEED_ADMIN_PASSWORD)) {
  throw new Error("生产环境不允许通过 SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD 创建管理员，请使用一次性 owner bootstrap。");
}

if (isProduction && process.env.PAYMENT_WEBHOOK_SECRET) {
  throw new Error("生产环境不允许设置 PAYMENT_WEBHOOK_SECRET；开发支付 webhook 已关闭。");
}

if (isProduction && activeRepositoryMode !== "postgres") {
  throw new Error("生产环境必须设置 DATABASE_URL，不允许使用 JSON 数据库。");
}

const logger = createLogger({ service: "scent-atoll-api" });
const errorReporter = createErrorReporter({ logger });
const emailService = createEmailService({ logger: logger.child({ component: "email" }) });
const productImageStorage = createProductImageStorage({ logger: logger.child({ component: "product-images" }) });
const loginRateLimiter = createLoginRateLimiter({ logger: logger.child({ component: "login-rate-limit" }) });
const wechatPayEnabled = String(process.env.WECHAT_PAY_ENABLED || "").toLowerCase() === "true";
let wechatPayClient;

function getWechatPayClient() {
  if (!wechatPayEnabled) throw new Error("微信支付尚未开通。");
  if (!wechatPayClient) wechatPayClient = createWechatPayClient(wechatPayConfigFromEnv(), { production: isProduction });
  return wechatPayClient;
}

const adminPermissionsByRole = {
  owner: [
    "admin:read",
    "admin:export",
    "orders:read",
    "orders:write",
    "products:read",
    "products:write",
    "members:read",
    "members:write",
    "points:read",
    "points:write",
    "tiers:read",
    "tiers:write",
    "mall:read",
    "mall:write",
    "redemptions:read",
    "redemptions:write",
    "logs:read"
  ],
  manager: [
    "admin:export",
    "orders:read",
    "orders:write",
    "products:read",
    "products:write",
    "members:read",
    "members:write",
    "points:read",
    "points:write",
    "tiers:read",
    "tiers:write",
    "mall:read",
    "mall:write",
    "redemptions:read",
    "redemptions:write",
    "logs:read"
  ],
  support: ["orders:read", "orders:write", "members:read", "points:read"],
  fulfillment: ["orders:read", "orders:write", "members:read", "mall:read", "redemptions:read", "redemptions:write"]
};

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
    adminUsers: [],
    adminSessions: [],
    products: [],
    productVariants: [],
    productImages: [],
    inventoryItems: [],
    inventoryMovements: [],
    stockReservations: [],
    coupons: [],
    couponRedemptions: [],
    addresses: [],
    orderAddresses: [],
    shipments: [],
    payments: [],
    paymentEvents: [],
    refunds: [],
    refundEvents: [],
    idempotencyKeys: [],
    emailVerificationTokens: [],
    passwordResetTokens: [],
    loginAttempts: [],
    emailDeliveries: []
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
    "adminUsers",
    "adminSessions",
    "products",
    "productVariants",
    "productImages",
    "inventoryItems",
    "inventoryMovements",
    "stockReservations",
    "coupons",
    "couponRedemptions",
    "addresses",
    "orderAddresses",
    "shipments",
    "payments",
    "paymentEvents",
    "refunds",
    "refundEvents",
    "idempotencyKeys",
    "emailVerificationTokens",
    "passwordResetTokens",
    "loginAttempts",
    "emailDeliveries"
  ].forEach((key) => {
    if (!Array.isArray(normalized[key])) normalized[key] = [];
  });
  if (runtimeDefaultsEnabled && !normalized.adminUsers.length && seedAdminEmail && seedAdminPassword) {
    normalized.adminUsers.push({
      id: randomUUID(),
      email: seedAdminEmail,
      name: "Scent Admin",
      role: adminPermissionsByRole[seedAdminRole] ? seedAdminRole : "owner",
      passwordHash: hashPassword(seedAdminPassword),
      status: "active",
      createdAt: now(),
      updatedAt: now()
    });
  }
  const oldSeededTiers = {
    base: { minLifetimePaidAmount: 0, discountRate: 1 },
    silver: { minLifetimePaidAmount: 300000, discountRate: 0.98 },
    gold: { minLifetimePaidAmount: 800000, discountRate: 0.95 },
    black: { minLifetimePaidAmount: 2000000, discountRate: 0.92 }
  };
  if (runtimeDefaultsEnabled) defaultTierDefinitions().forEach((definition) => {
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
  if (runtimeDefaultsEnabled && !normalized.pointsMallItems.length) {
    normalized.pointsMallItems.push(...defaultPointsMallItems());
  }
  return normalized;
}

async function ensureDb() {
  const db = await repository.read();
  if (Object.keys(db).length) return db;
  const initialDb = defaultDb();
  await repository.write(initialDb);
  return initialDb;
}

async function readDb() {
  const db = normalizeDb(await ensureDb());
  if (autoWriteCatalogSeed && ensureCatalogProducts(db)) await writeDb(db);
  return db;
}

const productCollections = ["products", "productVariants", "productImages", "inventoryItems"];

async function readProductDb() {
  if (activeRepositoryMode !== "postgres") return readDb();
  return normalizeDb(await repository.readCollections(productCollections));
}

async function writeDb(db) {
  await repository.write(normalizeDb(db));
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

function sha256(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function createOpaqueToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: sha256(token) };
}

function requestIpHash(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return sha256(forwarded || req.socket?.remoteAddress || "unknown");
}

function applicationOrigin() {
  return cleanText(process.env.APP_ORIGIN || process.env.SITE_URL || (!isProduction ? `http://localhost:${port}` : "")).replace(/\/$/, "");
}

function secureTokenMatches(actual, expected) {
  const actualBytes = Buffer.from(String(actual || ""));
  const expectedBytes = Buffer.from(String(expected || ""));
  if (!actualBytes.length || actualBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(actualBytes, expectedBytes);
}

function authorizedReservationCron(req) {
  const authorization = String(req.headers.authorization || "");
  const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  return Boolean(reservationCronSecret) && secureTokenMatches(bearerToken, reservationCronSecret);
}

async function sendTrackedEmail({ kind, userId, recipient, send }) {
  let delivery;
  try {
    const result = await send();
    delivery = {
      id: randomUUID(), userId, kind, recipient, idempotencyKey: result.idempotencyKey,
      providerMessageId: result.providerMessageId || null, status: result.status,
      errorMessage: null, createdAt: now(), updatedAt: now()
    };
  } catch (error) {
    delivery = {
      id: randomUUID(), userId, kind, recipient,
      idempotencyKey: `failed:${kind}:${sha256(`${userId}:${Date.now()}`)}`,
      providerMessageId: null, status: "failed", errorMessage: error.message,
      createdAt: now(), updatedAt: now()
    };
    await errorReporter.capture(error, { operation: "send_email", kind, userId });
  }
  await repository.mutate(async (rawDb) => {
    const db = normalizeDb(rawDb);
    const existing = db.emailDeliveries.find((item) => item.idempotencyKey === delivery.idempotencyKey);
    if (existing) Object.assign(existing, delivery, { id: existing.id, createdAt: existing.createdAt });
    else db.emailDeliveries.push(delivery);
  });
}

async function parseWechatPayResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.code || `WeChat Pay HTTP ${response.status}`);
    error.code = payload.code || "WECHAT_PAY_REQUEST_FAILED";
    throw error;
  }
  return payload;
}

function idempotencyKey(req, body = {}) {
  const key = cleanText(req.headers["idempotency-key"] || body.requestId || body.idempotencyKey);
  return ["undefined", "null"].includes(key.toLowerCase()) ? "" : key;
}

function findIdempotentResult(db, scope, key) {
  if (!key) return null;
  return db.idempotencyKeys.find((item) => item.scope === scope && item.key === key && item.responseBody) || null;
}

function storeIdempotentResult(db, scope, key, status, responseBody, requestHash = null) {
  if (!key) return;
  const existing = db.idempotencyKeys.find((item) => item.scope === scope && item.key === key);
  const value = {
    id: existing?.id || randomUUID(),
    key,
    scope,
    requestHash,
    responseBody: snapshot(responseBody),
    responseStatus: status,
    lockedUntil: null,
    createdAt: existing?.createdAt || now(),
    updatedAt: now()
  };
  if (existing) Object.assign(existing, value);
  else db.idempotencyKeys.push(value);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => !["idempotencyKey", "requestId"].includes(key))
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

function idempotencyRequestHash(req, pathname, body) {
  return sha256(JSON.stringify({ method: req.method, pathname, body: stableValue(body) }));
}

function criticalOperationScope(req, pathname, user, admin) {
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return "";
  const memberCritical = [
    /^\/api\/checkout\/(?:create-order|start-payment)$/,
    /^\/api\/member\/orders\/[^/]+\/(?:confirm-receipt|cancel)$/,
    /^\/api\/points-mall\/redeem$/
  ];
  const adminCritical = [
    /^\/api\/admin\/products\/[^/]+\/variants\/[^/]+\/inventory$/,
    /^\/api\/admin\/members\/[^/]+\/points$/,
    /^\/api\/admin\/orders\/[^/]+\/(?:pay|ship|complete|refund|status)$/,
    /^\/api\/admin\/points-mall\/redemptions\/[^/]+\/(?:status|cancel)$/
  ];
  if (user && memberCritical.some((pattern) => pattern.test(pathname))) {
    return `member:${user.id}:${req.method}:${pathname}`;
  }
  if (admin && adminCritical.some((pattern) => pattern.test(pathname))) {
    return `admin:${admin.id}:${req.method}:${pathname}`;
  }
  return "";
}

function idempotencyTrackingResponse(target, db, context) {
  let status = target.statusCode || 200;
  return {
    get statusCode() { return status; },
    writeHead(nextStatus, headers = {}) {
      status = nextStatus;
      target.writeHead(nextStatus, headers);
    },
    setHeader(name, value) {
      target.setHeader(name, value);
    },
    end(value = "") {
      if (status >= 200 && status < 300) {
        try {
          const payload = value ? JSON.parse(String(value)) : null;
          storeIdempotentResult(db, context.scope, context.key, status, payload, context.requestHash);
        } catch {
          // Critical write endpoints are JSON-only; do not cache an invalid response.
        }
      }
      target.end(value);
    }
  };
}

function queueLoginAttempt(afterCommit, req, identity, kind, succeeded) {
  const attempt = {
    id: randomUUID(),
    identityHash: sha256(cleanText(identity).toLowerCase() || "missing"),
    ipHash: requestIpHash(req),
    kind,
    succeeded: Boolean(succeeded),
    createdAt: now()
  };
  afterCommit(() => repository.mutate(async (rawDb) => {
    const db = normalizeDb(rawDb);
    const retentionStart = Date.now() - 180 * 24 * 60 * 60 * 1000;
    db.loginAttempts = db.loginAttempts.filter((item) => new Date(item.createdAt).getTime() >= retentionStart);
    db.loginAttempts.push(attempt);
  }), { always: true });
}

async function allowAccountAction(req, res, identity, scope) {
  const result = await loginRateLimiter.consume({
    ip: requestIpHash(req),
    login: cleanText(identity).toLowerCase(),
    scope
  });
  if (result.allowed) return true;
  sendJson(res, 429, { error: "请求过于频繁，请稍后再试。" }, {
    "retry-after": String(Math.ceil(result.retryAfterMs / 1000))
  });
  return false;
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
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxRequestBodyBytes) throw new Error("请求内容超过大小限制。");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("请求内容不是有效 JSON。");
  }
}

async function requestBytes(req, limit = 5 * 1024 * 1024) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > limit) throw new Error("上传图片超过 5MB 限制。");
    chunks.push(chunk);
  }
  if (!totalBytes) throw new Error("上传图片不能为空。");
  return Buffer.concat(chunks);
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

function logAdminOperation(db, req, action, entityType, entityId, before, after, reason = "") {
  const admin = req?.currentAdmin || null;
  db.operationLogs.push({
    id: randomUUID(),
    actor: admin ? `${admin.name || admin.email} (${admin.role})` : "system",
    actorAdminId: admin?.id || null,
    actorName: admin?.name || null,
    actorEmail: admin?.email || null,
    actorRole: admin?.role || null,
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
  const nowMs = Date.now();
  let changed = false;
  db.pointTransactions
    .filter((item) => isPointBatch(item) && item.userId === userId && item.expiresAt && new Date(item.expiresAt).getTime() <= nowMs)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach((item) => {
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
  return `sa_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(sessionMaxAgeMs / 1000)}${isProduction ? "; Secure" : ""}`;
}

function clearSessionCookie() {
  return `sa_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? "; Secure" : ""}`;
}

function adminSessionCookie(sessionId) {
  return `sa_admin_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(sessionMaxAgeMs / 1000)}${isProduction ? "; Secure" : ""}`;
}

function clearAdminSessionCookie() {
  return `sa_admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProduction ? "; Secure" : ""}`;
}

async function currentUser(req, db) {
  const sessionId = parseCookies(req.headers.cookie).sa_session;
  if (!sessionId) return null;
  const session = db.sessions.find((item) => item.id === sessionId);
  if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) return null;
  return db.users.find((user) => user.id === session.userId && user.status === "active") || null;
}

async function currentAdmin(req, db) {
  const sessionId = parseCookies(req.headers.cookie).sa_admin_session;
  if (!sessionId) return null;
  const session = db.adminSessions.find((item) => item.id === sessionId);
  if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) return null;
  const admin = db.adminUsers.find((item) => item.id === session.adminUserId && item.status === "active");
  return admin || null;
}

function normalizeAddressInput(value, userId) {
  const input = value && typeof value === "object" ? value : {};
  const address = {
    id: cleanText(input.id) || randomUUID(),
    userId,
    recipientName: cleanText(input.recipientName),
    recipientPhone: cleanText(input.recipientPhone),
    province: cleanText(input.province),
    city: cleanText(input.city),
    district: cleanText(input.district),
    addressLine: cleanText(input.addressLine || input.address),
    postalCode: optionalText(input.postalCode),
    isDefault: Boolean(input.isDefault),
    createdAt: input.createdAt || now(),
    updatedAt: now()
  };
  if (!address.recipientName) throw new Error("收件人姓名必填。");
  if (!/^1[3-9]\d{9}$/.test(address.recipientPhone)) throw new Error("请填写有效的中国大陆手机号。");
  if (!address.province || !address.city || !address.addressLine) throw new Error("省份、城市和详细地址必填。");
  return address;
}

function orderAddressSnapshot(address, orderId) {
  if (!address) return null;
  return {
    id: randomUUID(),
    orderId,
    addressType: "shipping",
    recipientName: address.recipientName,
    recipientPhone: address.recipientPhone,
    province: address.province,
    city: address.city,
    district: address.district,
    addressLine: address.addressLine,
    postalCode: address.postalCode,
    createdAt: now()
  };
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt
  };
}

function adminPermissions(role) {
  return adminPermissionsByRole[role] || [];
}

function publicAdmin(admin) {
  if (!admin) return null;
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    permissions: adminPermissions(admin.role),
    createdAt: admin.createdAt
  };
}

function requireAdmin(res, admin) {
  if (!admin) {
    sendError(res, 401, "请先登录后台。");
    return false;
  }
  return true;
}

function requirePermission(res, admin, permission) {
  if (!requireAdmin(res, admin)) return false;
  if (!adminPermissions(admin.role).includes(permission)) {
    sendError(res, 403, "当前后台账号没有此操作权限。");
    return false;
  }
  return true;
}

function normalizedOrigin(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function configuredOrigins() {
  return String(process.env.APP_ORIGIN || "")
    .split(",")
    .map((origin) => normalizedOrigin(origin.trim()))
    .filter(Boolean);
}

function requestOrigin(req) {
  return normalizedOrigin(req.headers.origin) || normalizedOrigin(req.headers.referer);
}

function trustedRequestOrigin(req) {
  const origin = requestOrigin(req);
  if (!origin) return false;

  const allowed = new Set(configuredOrigins());
  const host = req.headers.host;
  if (host) {
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    allowed.add(`${forwardedProto || (isProduction ? "https" : "http")}://${host}`);
    if (!isProduction) {
      allowed.add(`http://${host}`);
      allowed.add(`https://${host}`);
    }
  }
  return allowed.has(origin);
}

function requireTrustedWriteOrigin(req, res, pathname) {
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return true;
  if (pathname.startsWith("/api/webhooks/")) return true;
  if (trustedRequestOrigin(req)) return true;
  sendError(res, 403, pathname.startsWith("/api/admin") ? "后台请求来源校验失败。" : "请求来源校验失败。");
  return false;
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

const allowedProductStatuses = ["draft", "active", "inactive", "archived"];

function cleanText(value) {
  return String(value ?? "").trim();
}

function decodeHeaderText(value) {
  const raw = cleanText(value);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeImageStyle(value) {
  const raw = cleanText(value);
  let safeUrl = "";
  if (raw.startsWith("/")) {
    safeUrl = raw;
  } else {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === "https:") safeUrl = parsed.toString();
    } catch {
      safeUrl = "";
    }
  }
  const cssString = JSON.stringify(safeUrl).replaceAll("<", "\\u003c");
  return `style="--image:url(${escapeHtml(cssString)})"`;
}

function sitemapXml(db) {
  const origin = applicationOrigin();
  if (!origin) throw new Error("APP_ORIGIN or SITE_URL is required to build the sitemap.");
  const staticPaths = [
    "/",
    "/shop.html",
    "/brands.html",
    "/samples.html",
    "/journal.html",
    "/about.html",
    "/service.html",
    "/payment.html",
    "/privacy.html",
    "/terms.html"
  ];
  const productPaths = publicProducts(db).map((product) => `/products/${encodeURIComponent(product.id)}`);
  const editorialPaths = [
    ...(catalog.brands || []).map((brand) => `/brand-${encodeURIComponent(brand.id)}.html`),
    ...(catalog.articles || []).map((article) => `/article-${encodeURIComponent(article.id)}.html`)
  ];
  const urls = [...staticPaths, ...productPaths, ...editorialPaths]
    .map((pathname) => `  <url><loc>${escapeHtml(`${origin}${pathname}`)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function optionalText(value) {
  const text = cleanText(value);
  return text || null;
}

function listValue(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  return cleanText(value)
    .split(/[\n,，、]/)
    .map(cleanText)
    .filter(Boolean);
}

function productByIdOrSlug(db, id) {
  const key = cleanText(id);
  return db.products.find((item) => item.id === key || item.slug === key) || null;
}

function inventoryForVariant(db, variantId) {
  return db.inventoryItems.find((item) => item.variantId === variantId) || null;
}

function ensureInventoryItem(db, variantId) {
  let inventory = inventoryForVariant(db, variantId);
  if (!inventory) {
    inventory = {
      id: randomUUID(),
      variantId,
      quantityOnHand: 0,
      quantityReserved: 0,
      createdAt: now(),
      updatedAt: now()
    };
    db.inventoryItems.push(inventory);
  }
  return inventory;
}

function variantPayload(db, variant) {
  const inventory = inventoryForVariant(db, variant.id);
  const quantityOnHand = Math.max(0, Math.trunc(Number(inventory?.quantityOnHand || 0)));
  const quantityReserved = Math.max(0, Math.trunc(Number(inventory?.quantityReserved || 0)));
  return {
    ...variant,
    priceAmount: Math.max(0, Math.trunc(Number(variant.priceAmount || 0))),
    priceAmountYuan: money.toYuan(variant.priceAmount),
    inventory: inventory
      ? {
          ...inventory,
          quantityOnHand,
          quantityReserved,
          availableQuantity: Math.max(0, quantityOnHand - quantityReserved)
        }
      : {
          id: null,
          variantId: variant.id,
          quantityOnHand: 0,
          quantityReserved: 0,
          availableQuantity: 0
        }
  };
}

function productPayload(db, product) {
  const variants = db.productVariants
    .filter((item) => item.productId === product.id)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    .map((item) => variantPayload(db, item));
  const images = db.productImages
    .filter((item) => item.productId === product.id)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  const activeVariants = variants.filter((item) => item.status === "active");
  const availableQuantity = activeVariants.reduce((sum, item) => sum + Number(item.inventory.availableQuantity || 0), 0);
  const primaryVariant = activeVariants[0] || variants[0] || null;
  return {
    ...product,
    notes: Array.isArray(product.notes) ? product.notes : [],
    scenes: Array.isArray(product.scenes) ? product.scenes : [],
    mood: Array.isArray(product.mood) ? product.mood : [],
    statusTags: Array.isArray(product.statusTags) ? product.statusTags : [],
    images,
    variants,
    primaryVariant,
    primaryImage: product.heroImageUrl || images[0]?.imageUrl || "",
    priceAmount: primaryVariant ? primaryVariant.priceAmount : 0,
    priceAmountYuan: primaryVariant ? primaryVariant.priceAmountYuan : 0,
    availableQuantity,
    isListed: product.status === "active",
    canPurchase: product.status === "active" && availableQuantity > 0 && Number(primaryVariant?.priceAmount || 0) > 0
  };
}

function productActivationError(db, product) {
  const payload = productPayload(db, product);
  const activeVariant = payload.variants.find((item) => item.status === "active");
  if (!cleanText(product.name)) return "商品名称必填，不能上架。";
  if (!cleanText(product.slug)) return "商品链接 slug 必填，不能上架。";
  if (!activeVariant) return "至少需要一个启用规格，才能上架。";
  if (Number(activeVariant.priceAmount || 0) <= 0) return "启用规格需要设置价格，才能上架。";
  if (payload.availableQuantity <= 0) return "可售库存为 0，不能上架。";
  if (!payload.primaryImage) return "至少需要一张商品图，才能上架。";
  return "";
}

function applyProductFields(db, product, body, { isCreate = false } = {}) {
  if (isCreate || "slug" in body) {
    const slug = cleanText(body.slug).toLowerCase();
    if (!slug) throw new Error("商品 slug 必填。");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("商品 slug 只能使用小写英文、数字和连字符。");
    if (db.products.some((item) => item.id !== product.id && item.slug === slug)) throw new Error("商品 slug 已存在。");
    product.slug = slug;
  }
  if (isCreate || "name" in body) {
    product.name = cleanText(body.name);
    if (!product.name) throw new Error("商品名称必填。");
  }
  if ("brandName" in body || "brand" in body) product.brandName = optionalText(body.brandName ?? body.brand);
  if ("brandId" in body) product.brandId = optionalText(body.brandId);
  if ("category" in body) product.category = optionalText(body.category);
  if ("country" in body) product.country = optionalText(body.country);
  if ("description" in body) product.description = optionalText(body.description);
  if ("volume" in body) product.volume = optionalText(body.volume);
  if ("concentration" in body) product.concentration = optionalText(body.concentration);
  if ("stockLabel" in body) product.stockLabel = optionalText(body.stockLabel);
  if ("year" in body) product.year = optionalText(body.year);
  if ("perfumer" in body) product.perfumer = optionalText(body.perfumer);
  if ("family" in body) product.family = optionalText(body.family);
  if ("notes" in body) product.notes = listValue(body.notes);
  if ("scenes" in body) product.scenes = listValue(body.scenes);
  if ("mood" in body) product.mood = listValue(body.mood);
  if ("sweetness" in body) product.sweetness = optionalText(body.sweetness);
  if ("statusTags" in body || "tags" in body) product.statusTags = listValue(body.statusTags ?? body.tags);
  if ("heroImageUrl" in body || "image" in body) product.heroImageUrl = optionalText(body.heroImageUrl ?? body.image);
  if ("imageLayout" in body) product.imageLayout = cleanText(body.imageLayout) || "grid";
  if ("buyerNote" in body || "buyer" in body) product.buyerNote = optionalText(body.buyerNote ?? body.buyer);
  if ("bestFor" in body) product.bestFor = optionalText(body.bestFor);
  if ("caution" in body) product.caution = optionalText(body.caution);
  if ("topNotes" in body || "top" in body) product.topNotes = optionalText(body.topNotes ?? body.top);
  if ("middleNotes" in body || "middle" in body) product.middleNotes = optionalText(body.middleNotes ?? body.middle);
  if ("baseNotes" in body || "base" in body) product.baseNotes = optionalText(body.baseNotes ?? body.base);
  if ("sortOrder" in body) product.sortOrder = Math.trunc(Number(body.sortOrder || 0));
  if ("status" in body) {
    const status = cleanText(body.status || "draft");
    if (!allowedProductStatuses.includes(status)) throw new Error("商品状态不合法。");
    product.status = status;
  }
  product.updatedAt = now();
}

function imageInputs(value) {
  if (Array.isArray(value)) return value;
  return listValue(value).map((imageUrl) => ({ imageUrl }));
}

function replaceProductImages(db, product, images) {
  const existingImages = db.productImages.filter((item) => item.productId === product.id);
  const parsed = imageInputs(images)
    .map((entry, index) => {
      const requestedId = cleanText(entry.id);
      const imageUrl = cleanText(entry.imageUrl || entry.url || entry.image);
      const existing = existingImages.find((item) => requestedId && item.id === requestedId)
        || existingImages.find((item) => item.imageUrl === imageUrl);
      return {
        id: requestedId || existing?.id || randomUUID(),
        productId: product.id,
        imageUrl,
        alt: optionalText(entry.alt) || existing?.alt || product.name,
        role: cleanText(entry.role || existing?.role || (index === 0 ? "hero" : "gallery")) || "gallery",
        sortOrder: Math.trunc(Number(entry.sortOrder ?? index + 1)),
        blobPath: optionalText(entry.blobPath) || existing?.blobPath || null,
        contentType: optionalText(entry.contentType) || existing?.contentType || null,
        byteSize: entry.byteSize === undefined ? existing?.byteSize ?? null : Math.max(0, Math.trunc(Number(entry.byteSize || 0))),
        createdAt: entry.createdAt || existing?.createdAt || now()
      };
    })
    .filter((entry) => entry.imageUrl);
  const retainedIds = new Set(parsed.map((item) => item.id));
  const removedBlobImages = existingImages.filter((item) => item.blobPath && !retainedIds.has(item.id));
  db.productImages = db.productImages.filter((item) => item.productId !== product.id);
  db.productImages.push(...parsed);
  product.heroImageUrl = parsed.find((item) => item.role === "hero")?.imageUrl || parsed[0]?.imageUrl || null;
  product.updatedAt = now();
  return removedBlobImages;
}

function updatePrimaryVariant(db, product, body, { isCreate = false } = {}) {
  const explicitVariantObject = body.variant && typeof body.variant === "object";
  const variantInput = explicitVariantObject ? body.variant : body;
  const hasVariantFields = isCreate || ["variantId", "variantName", "sku", "priceAmount", "priceAmountYuan", "priceYuan", "variantStatus"].some((key) => key in body || key in variantInput);
  if (!hasVariantFields) return null;
  const requestedId = cleanText(variantInput.variantId || variantInput.id);
  let variant = requestedId
    ? db.productVariants.find((item) => item.id === requestedId && item.productId === product.id)
    : db.productVariants.find((item) => item.productId === product.id);
  if (!variant) {
    variant = {
      id: requestedId || randomUUID(),
      productId: product.id,
      sku: null,
      name: "默认规格",
      priceAmount: 0,
      status: "active",
      createdAt: now(),
      updatedAt: now()
    };
    db.productVariants.push(variant);
  }
  if ("sku" in variantInput) {
    const sku = optionalText(variantInput.sku);
    if (sku && db.productVariants.some((item) => item.id !== variant.id && item.sku === sku)) throw new Error("商品 SKU 已存在。");
    variant.sku = sku;
  }
  if ("variantName" in variantInput || (explicitVariantObject && "name" in variantInput)) {
    variant.name = cleanText(variantInput.variantName || variantInput.name || "默认规格");
  }
  if ("priceAmountYuan" in variantInput || "priceYuan" in variantInput) {
    variant.priceAmount = Math.max(0, money.fromYuan(variantInput.priceAmountYuan ?? variantInput.priceYuan));
  } else if ("priceAmount" in variantInput) {
    variant.priceAmount = Math.max(0, Math.trunc(Number(variantInput.priceAmount || 0)));
  }
  if ("variantStatus" in variantInput || (explicitVariantObject && "status" in variantInput)) {
    const status = cleanText(variantInput.variantStatus || variantInput.status || "active");
    if (!["active", "inactive", "archived"].includes(status)) throw new Error("规格状态不合法。");
    variant.status = status;
  }
  variant.updatedAt = now();
  ensureInventoryItem(db, variant.id);
  return variant;
}

function adjustInventory(db, variantId, body) {
  const variant = db.productVariants.find((item) => item.id === variantId);
  if (!variant) throw new Error("商品规格不存在。");
  const inventory = ensureInventoryItem(db, variantId);
  const before = snapshot(inventory);
  const reserved = Math.max(0, Math.trunc(Number(inventory.quantityReserved || 0)));
  const mode = cleanText(body.mode || ("quantityOnHand" in body || "quantity" in body ? "set" : "adjust"));
  const target = mode === "set"
    ? Math.max(0, Math.trunc(Number(body.quantityOnHand ?? body.quantity ?? 0)))
    : Math.max(0, Math.trunc(Number(inventory.quantityOnHand || 0)) + Math.trunc(Number(body.quantityDelta ?? body.delta ?? 0)));
  const delta = target - Math.max(0, Math.trunc(Number(inventory.quantityOnHand || 0)));
  if (target < reserved) throw new Error("现货库存不能低于已预留库存。");
  if (!delta) return { inventory, movement: null, before };
  inventory.quantityOnHand = target;
  inventory.quantityReserved = reserved;
  inventory.updatedAt = now();
  const movement = {
    id: randomUUID(),
    inventoryItemId: inventory.id,
    quantityDelta: delta,
    reason: cleanText(body.reason || "后台库存调整"),
    referenceType: cleanText(body.referenceType || "admin"),
    referenceId: optionalText(body.referenceId),
    createdAt: now()
  };
  db.inventoryMovements.push(movement);
  return { inventory, movement, before };
}

function staticProductToDbProduct(item, index = 0) {
  const createdAt = now();
  return {
    id: `product-${item.id}`,
    slug: cleanText(item.id),
    name: cleanText(item.name),
    brandName: optionalText(item.brand),
    brandId: optionalText(item.brandId),
    category: optionalText(item.category || "fragrance"),
    country: optionalText(item.country),
    status: item.stock === "售罄" ? "inactive" : "active",
    description: optionalText(item.description),
    volume: optionalText(item.volume),
    concentration: optionalText(item.concentration),
    stockLabel: optionalText(item.stock || "现货"),
    year: optionalText(item.year),
    perfumer: optionalText(item.perfumer),
    family: optionalText(item.family),
    notes: listValue(item.notes),
    scenes: listValue(item.scenes),
    mood: listValue(item.mood),
    sweetness: optionalText(item.sweetness),
    statusTags: listValue(item.status),
    heroImageUrl: optionalText(item.image),
    imageLayout: "grid",
    buyerNote: optionalText(item.buyer),
    bestFor: optionalText(item.bestFor),
    caution: optionalText(item.caution),
    topNotes: optionalText(item.top),
    middleNotes: optionalText(item.middle),
    baseNotes: optionalText(item.base),
    sortOrder: index + 1,
    createdAt,
    updatedAt: createdAt
  };
}

function staticProductVariant(item, productId = `product-${item.id}`) {
  const createdAt = now();
  return {
    id: `variant-${item.id}-default`,
    productId,
    sku: `${item.id}-default`,
    name: item.volume || "默认规格",
    priceAmount: money.fromYuan(item.price || 0),
    status: "active",
    createdAt,
    updatedAt: createdAt
  };
}

function staticProductImage(item, productId = `product-${item.id}`) {
  return {
    id: `image-${item.id}-hero`,
    productId,
    imageUrl: cleanText(item.image),
    alt: `${item.name} 商品图`,
    role: "hero",
    sortOrder: 1,
    createdAt: now()
  };
}

function stockQuantityFromLabel(label) {
  if (label === "售罄") return 0;
  if (label === "少量") return 3;
  if (label === "限量") return 2;
  return 12;
}

function staticInventoryItem(item) {
  const createdAt = now();
  return {
    id: `inventory-${item.id}-default`,
    variantId: `variant-${item.id}-default`,
    quantityOnHand: stockQuantityFromLabel(item.stock),
    quantityReserved: 0,
    createdAt,
    updatedAt: createdAt
  };
}

function ensureCatalogProducts(db) {
  let changed = false;
  (catalog.products || []).forEach((item, index) => {
    const slug = cleanText(item.id);
    let product = db.products.find((entry) => entry.slug === slug || entry.id === `product-${slug}`);
    if (!product) {
      product = staticProductToDbProduct(item, index);
      db.products.push(product);
      changed = true;
    }

    const variant = staticProductVariant(item, product.id);
    if (!db.productVariants.some((entry) => entry.id === variant.id || entry.sku === variant.sku)) {
      db.productVariants.push(variant);
      changed = true;
    }

    if (item.image) {
      const image = staticProductImage(item, product.id);
      if (!db.productImages.some((entry) => entry.id === image.id)) {
        db.productImages.push(image);
        changed = true;
      }
    }

    const inventory = staticInventoryItem(item);
    if (!db.inventoryItems.some((entry) => entry.id === inventory.id || entry.variantId === inventory.variantId)) {
      db.inventoryItems.push(inventory);
      changed = true;
    }
  });
  return changed;
}

function loadCatalog() {
  const source = existsSync(path.join(rootDir, "src/assets/data.js"))
    ? path.join(rootDir, "src/assets/data.js")
    : path.join(rootDir, "data.js");
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(source, "utf8"), sandbox);
  return sandbox.window.SA_DATA || {};
}

const sourceCatalog = loadCatalog();
const catalog = activeRepositoryMode === "postgres"
  ? { brands: sourceCatalog.brands || [], articles: sourceCatalog.articles || [], products: [], sampleSets: [] }
  : sourceCatalog;

function catalogItemById(id, db = null) {
  const managedProduct = db ? productByIdOrSlug(db, id) : null;
  if (managedProduct) {
    const payload = productPayload(db, managedProduct);
    return publicProductFromPayload(payload);
  }
  if (db && activeRepositoryMode === "postgres") return null;
  const sampleSets = (catalog.sampleSets || []).map((set) => ({
    ...set,
    brand: "Scent Atoll",
    category: "sample",
    stock: "现货",
    concentration: "Sample Set",
    family: "试香套装"
  }));
  return [...(catalog.products || []), ...sampleSets].find((item) => item.id === id);
}

function canPurchase(item) {
  return Boolean(item && Number(item.price) > 0 && item.stock !== "售罄" && item.isListed !== false && item.canPurchase !== false);
}

function publicProductFromPayload(product) {
  const fallback = activeRepositoryMode === "postgres"
    ? {}
    : catalog.products?.find((item) => item.id === product.slug || item.id === product.id) || {};
  return {
    id: product.slug || product.id,
    productId: product.id,
    variantId: product.primaryVariant?.id || null,
    brandId: product.brandId || fallback.brandId || "",
    brand: product.brandName || fallback.brand || "Scent Atoll",
    name: product.name,
    category: product.category || fallback.category || "fragrance",
    country: product.country || fallback.country || "",
    price: product.priceAmountYuan || fallback.price || 0,
    volume: product.volume || fallback.volume || "",
    concentration: product.concentration || fallback.concentration || "",
    stock: product.availableQuantity <= 0 ? "售罄" : product.stockLabel || fallback.stock || "现货",
    year: product.year || fallback.year || "",
    perfumer: product.perfumer || fallback.perfumer || "",
    family: product.family || fallback.family || "",
    notes: product.notes || [],
    scenes: product.scenes || [],
    mood: product.mood || [],
    sweetness: product.sweetness || fallback.sweetness || "",
    status: product.statusTags || [],
    image: product.primaryImage || fallback.image || "",
    imageLayout: product.imageLayout || "grid",
    description: product.description || fallback.description || "",
    top: product.topNotes || fallback.top || "",
    middle: product.middleNotes || fallback.middle || "",
    base: product.baseNotes || fallback.base || "",
    buyer: product.buyerNote || fallback.buyer || "",
    bestFor: product.bestFor || fallback.bestFor || "",
    caution: product.caution || fallback.caution || "",
    availableQuantity: product.availableQuantity,
    isListed: product.status === "active",
    canPurchase: product.canPurchase
  };
}

function publicProducts(db, { includeInactive = false } = {}) {
  return db.products
    .slice()
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    .map((item) => publicProductFromPayload(productPayload(db, item)))
    .filter((item) => includeInactive || item.isListed);
}

function mallItemPayload(item, db = null) {
  const linkedProduct = item.productId ? catalogItemById(item.productId, db) : null;
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

function activeMallItem(item, db = null) {
  const payload = mallItemPayload(item, db);
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
  if (!activeMallItem(item, db)) throw new Error("该积分商品暂不可兑换。");
  if (quantity > item.stockQuantity) throw new Error("积分商品库存不足。");
  const itemPayload = mallItemPayload(item, db);
  const totalPoints = itemPayload.pointsPrice * quantity;
  const savedAddress = body.addressId
    ? db.addresses.find((entry) => entry.id === body.addressId && entry.userId === user.id)
    : db.addresses.find((entry) => entry.userId === user.id && entry.isDefault);
  const recipientName = cleanText(body.recipientName || savedAddress?.recipientName || user.name);
  const recipientPhone = cleanText(body.recipientPhone || savedAddress?.recipientPhone || user.phone);
  const shippingAddress = cleanText(body.shippingAddress || (savedAddress
    ? [savedAddress.province, savedAddress.city, savedAddress.district, savedAddress.addressLine].filter(Boolean).join("")
    : ""));
  if (!recipientName) throw new Error("兑换商品的收件人姓名必填。");
  if (!/^1[3-9]\d{9}$/.test(recipientPhone)) throw new Error("请填写有效的中国大陆收件手机号。");
  if (!shippingAddress) throw new Error("兑换商品的收货地址必填。");
  const order = {
    id: randomUUID(),
    orderNo: createRedemptionOrderNo(),
    requestId: requestId || null,
    userId: user.id,
    status: "pending_fulfillment",
    totalPoints,
    recipientName,
    recipientPhone,
    shippingAddress,
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
    const item = catalogItemById(entry.productId, db);
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
      managedProductId: item.productId || item.id,
      variantId: item.variantId || null,
      productName: item.name,
      brandName: item.brand || "Scent Atoll",
      sku: db.productVariants.find((variant) => variant.id === item.variantId)?.sku || null,
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

function reserveOrderInventory(db, order, lines) {
  const reservations = [];
  for (const line of lines) {
    if (!line.variantId) continue;
    const inventory = inventoryForVariant(db, line.variantId);
    if (!inventory) throw new Error(`商品 ${line.productName} 没有可用库存记录。`);
    const available = Number(inventory.quantityOnHand || 0) - Number(inventory.quantityReserved || 0);
    if (available < line.quantity) throw new Error(`商品 ${line.productName} 库存不足。`);
    inventory.quantityReserved = Number(inventory.quantityReserved || 0) + line.quantity;
    inventory.updatedAt = now();
    const reservation = {
      id: randomUUID(),
      inventoryItemId: inventory.id,
      orderId: order.id,
      quantity: line.quantity,
      status: "active",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      createdAt: now(),
      updatedAt: now()
    };
    db.stockReservations.push(reservation);
    reservations.push(reservation);
  }
  return reservations;
}

function releaseOrderInventory(db, order, reason = "order_cancelled") {
  let released = 0;
  db.stockReservations
    .filter((item) => item.orderId === order.id && item.status === "active")
    .forEach((reservation) => {
      const inventory = db.inventoryItems.find((item) => item.id === reservation.inventoryItemId);
      if (inventory) {
        inventory.quantityReserved = Math.max(0, Number(inventory.quantityReserved || 0) - reservation.quantity);
        inventory.updatedAt = now();
      }
      reservation.status = "released";
      reservation.updatedAt = now();
      db.inventoryMovements.push({
        id: randomUUID(), inventoryItemId: reservation.inventoryItemId, quantityDelta: 0,
        reason, referenceType: "order", referenceId: order.id, createdAt: now()
      });
      released += reservation.quantity;
    });
  return released;
}

function captureOrderInventory(db, order) {
  let captured = 0;
  db.stockReservations
    .filter((item) => item.orderId === order.id && item.status === "active")
    .forEach((reservation) => {
      if (reservation.expiresAt && new Date(reservation.expiresAt).getTime() <= Date.now()) {
        throw new Error("订单库存预留已过期，请先取消订单并人工核对是否已经收款。");
      }
      const inventory = db.inventoryItems.find((item) => item.id === reservation.inventoryItemId);
      if (!inventory) throw new Error("订单预留库存不存在。");
      if (Number(inventory.quantityOnHand || 0) < reservation.quantity) throw new Error("订单可售库存不足。");
      inventory.quantityReserved = Math.max(0, Number(inventory.quantityReserved || 0) - reservation.quantity);
      inventory.quantityOnHand = Math.max(0, Number(inventory.quantityOnHand || 0) - reservation.quantity);
      inventory.updatedAt = now();
      reservation.status = "captured";
      reservation.updatedAt = now();
      db.inventoryMovements.push({
        id: randomUUID(), inventoryItemId: inventory.id, quantityDelta: -reservation.quantity,
        reason: "order_paid", referenceType: "order", referenceId: order.id, createdAt: now()
      });
      captured += reservation.quantity;
    });
  return captured;
}

function releaseExpiredReservations(db) {
  const expiredOrderIds = new Set(
    db.stockReservations
      .filter((item) => item.status === "active" && item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now())
      .map((item) => item.orderId)
  );
  let releasedOrders = 0;
  for (const orderId of expiredOrderIds) {
    const order = db.orders.find((item) => item.id === orderId);
    if (!order || order.status !== "pending_payment") continue;
    releaseOrderInventory(db, order, "payment_timeout");
    order.status = "cancelled";
    order.cancelledAt = now();
    order.cancellationReason = "payment_timeout";
    order.updatedAt = now();
    releasedOrders += 1;
  }
  return releasedOrders;
}

function createOrderNo() {
  return `SA${new Date().toISOString().slice(0, 10).replaceAll("-", "")}${String(Math.floor(Math.random() * 1000000)).padStart(6, "0")}`;
}

function orderPayload(db, order) {
  const items = db.orderItems.filter((item) => item.orderId === order.id);
  const shippingAddress = db.orderAddresses.find((item) => item.orderId === order.id && item.addressType === "shipping") || null;
  const shipment = db.shipments.find((item) => item.orderId === order.id) || null;
  const payments = db.payments.filter((item) => item.orderId === order.id);
  const refunds = db.refunds.filter((item) => item.orderId === order.id);
  return {
    ...order,
    subtotalAmountYuan: money.toYuan(order.subtotalAmount),
    memberDiscountAmountYuan: money.toYuan(order.memberDiscountAmount),
    shippingAmountYuan: money.toYuan(order.shippingAmount),
    paidAmountYuan: money.toYuan(order.paidAmount),
    eligiblePaidAmountYuan: money.toYuan(order.eligiblePaidAmount),
    shippingAddress,
    shipment,
    payments,
    refunds,
    items: items.map((item) => ({
      ...item,
      unitPriceYuan: money.toYuan(item.unitPrice),
      subtotalAmountYuan: money.toYuan(item.subtotalAmount),
      discountAmountYuan: money.toYuan(item.discountAmount)
    }))
  };
}

function markOrderPaid(db, order, options = {}) {
  if (order.status !== "pending_payment") return { alreadyProcessed: true };
  const paymentAmount = Math.trunc(Number(options.paymentAmount ?? order.paidAmount));
  if (paymentAmount !== order.paidAmount) throw new Error("收款金额与订单应付金额不一致。");
  const reference = cleanText(options.reference || options.providerPaymentId || (!isProduction ? `DEV-${order.orderNo}` : ""));
  if (!reference) throw new Error("人工确认收款必须填写转账参考号。");
  const provider = cleanText(options.provider || "manual_wechat");
  const key = cleanText(options.idempotencyKey || reference);
  const existingPayment = db.payments.find((item) => item.orderId === order.id && item.provider === provider && item.idempotencyKey === key);
  if (existingPayment) return { alreadyProcessed: true, payment: existingPayment };
  const inventoryCaptured = captureOrderInventory(db, order);
  const payment = {
    id: randomUUID(),
    orderId: order.id,
    provider,
    providerPaymentId: reference,
    status: "succeeded",
    paymentAmount,
    currency: "CNY",
    idempotencyKey: key,
    confirmedByAdminId: options.adminId || null,
    confirmedAt: now(),
    rawPayload: options.rawPayload || null,
    createdAt: now(),
    updatedAt: now()
  };
  db.payments.push(payment);
  order.status = "paid";
  order.paymentProvider = provider;
  order.paymentReference = reference;
  order.paidAt = order.paidAt || now();
  order.updatedAt = now();
  return { paid: true, payment, inventoryCaptured };
}

function settleCompletedOrder(db, order) {
  if (order.status === "completed") {
    return { points: order.pointsAwarded, upgraded: false, alreadyProcessed: true };
  }
  if (order.status !== "shipped") {
    throw new Error("只有已发货订单可以确认收货。");
  }
  if (Number(order.pointsAwarded || 0) > 0) {
    throw new Error("订单积分已结算但状态异常，请人工核对后再处理。");
  }
  const shipment = db.shipments.find((item) => item.orderId === order.id);
  if (!shipment) throw new Error("订单缺少发货记录，请先核对物流信息。");
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
  shipment.status = "delivered";
  shipment.deliveredAt = shipment.deliveredAt || completedAt;
  shipment.updatedAt = now();
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

function refundPaidOrder(db, order, options = {}) {
  if (order.status === "refunded") return { alreadyProcessed: true };
  if (!["paid", "processing", "shipped", "completed"].includes(order.status)) throw new Error("只有已支付订单可以退款。");
  const payment = db.payments.find((item) => item.orderId === order.id && item.status === "succeeded") || null;
  if (payment?.provider === "wechat_pay" && !WECHAT_PAY_REFUNDS_SUPPORTED) {
    throw new Error("微信支付退款尚未启用，不能只修改本地订单状态；请保持功能开关关闭。");
  }
  const providerRefundId = optionalText(
    options.providerRefundId
      || options.reference
      || (!isProduction ? `DEV-REFUND-${order.orderNo}` : "")
  );
  if (payment?.provider !== "wechat_pay" && !providerRefundId) {
    throw new Error("人工退款必须填写退款转账参考号。");
  }
  const profile = db.memberProfiles.find((item) => item.userId === order.userId);
  const oldTier = db.memberTiers.find((item) => item.id === profile.tierId);
  const wasSettled = order.status === "completed" || Number(order.pointsAwarded || 0) > 0;
  const pointsToReverse = Number(order.pointsAwarded || 0);
  const earnedBatch = pointsToReverse > 0
    ? db.pointTransactions.find((item) => item.orderId === order.id && item.type === "earn_order")
    : null;
  let pointsDeducted = pointsToReverse;
  if (pointsToReverse > 0 && (!earnedBatch || Number(earnedBatch.points || 0) !== pointsToReverse)) {
    throw new Error("订单奖励积分账本不一致，请人工核对后再退款。");
  }
  if (earnedBatch) {
    const outstandingRedemptionPoints = Math.max(0, -db.pointTransactions
      .filter((item) => item.sourceTransactionId === earnedBatch.id && ["redeem_points", "redeem_refund"].includes(item.type))
      .reduce((sum, item) => sum + Number(item.points || 0), 0));
    if (outstandingRedemptionPoints > 0) {
      throw new Error(`订单奖励积分已有 ${outstandingRedemptionPoints} 分被使用，请先取消关联积分兑换或补回后再退款。`);
    }
    pointsDeducted = Math.min(pointsToReverse, pointBatchRemaining(db, earnedBatch));
    if (Number(profile.availablePoints || 0) < pointsDeducted) {
      throw new Error("会员当前可用积分不足以扣回该订单奖励，请先核对积分账本。");
    }
  }
  if (pointsDeducted > 0) profile.availablePoints -= pointsDeducted;
  if (wasSettled) profile.lifetimePaidAmount = Math.max(0, profile.lifetimePaidAmount - order.eligiblePaidAmount);
  profile.updatedAt = now();
  order.status = "refunded";
  order.refundedAt = now();
  order.updatedAt = now();
  const refund = {
    id: randomUUID(),
    orderId: order.id,
    paymentId: payment?.id || null,
    providerRefundId,
    status: payment?.provider === "wechat_pay" ? "processing" : "succeeded",
    refundAmount: order.paidAmount,
    reason: cleanText(options.reason || "admin_refund"),
    confirmedByAdminId: options.adminId || null,
    confirmedAt: payment?.provider === "wechat_pay" ? null : now(),
    createdAt: now(),
    updatedAt: now()
  };
  db.refunds.push(refund);
  if (options.restock !== false) {
    db.orderItems.filter((item) => item.orderId === order.id && item.variantId).forEach((item) => {
      const inventory = inventoryForVariant(db, item.variantId);
      if (!inventory) return;
      inventory.quantityOnHand = Number(inventory.quantityOnHand || 0) + Number(item.quantity || 0);
      inventory.updatedAt = now();
      db.inventoryMovements.push({
        id: randomUUID(), inventoryItemId: inventory.id, quantityDelta: Number(item.quantity || 0),
        reason: "order_refunded", referenceType: "order", referenceId: order.id, createdAt: now()
      });
    });
  }
  if (pointsDeducted > 0) {
    db.pointTransactions.push({
      id: randomUUID(),
      userId: order.userId,
      orderId: order.id,
      sourceTransactionId: earnedBatch?.id || null,
      type: "refund_reversal",
      points: -pointsDeducted,
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
    pointsReversed: pointsDeducted,
    lifetimePaidAmount: profile.lifetimePaidAmount,
    tierChanged,
    toTier: newTier,
    refund
  };
}

async function handleApiWithDb(req, res, pathname, db, persist, afterCommit = () => {}) {
  try {
    const user = await currentUser(req, db);
    const admin = await currentAdmin(req, db);
    const rawImageUploadMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)\/images\/upload$/);
    const rawWechatCallback = req.method === "POST" && pathname === "/api/webhooks/wechat-pay";
    const body = ["POST", "PATCH", "PUT", "DELETE"].includes(req.method) && !(req.method === "POST" && rawImageUploadMatch) && !rawWechatCallback
      ? await requestBody(req)
      : {};
    if (!requireTrustedWriteOrigin(req, res, pathname)) return;

    const operationScope = criticalOperationScope(req, pathname, user, admin);
    if (operationScope) {
      const key = idempotencyKey(req, body);
      if (isProduction && !key) return sendError(res, 400, "此操作必须提供 Idempotency-Key。");
      if (key && (key.length < 8 || key.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(key))) {
        return sendError(res, 400, "Idempotency-Key 格式不合法。");
      }
      if (key) {
        const requestHash = idempotencyRequestHash(req, pathname, body);
        const previous = findIdempotentResult(db, operationScope, key);
        if (previous) {
          if (previous.requestHash && previous.requestHash !== requestHash) {
            return sendError(res, 409, "Idempotency-Key 已用于不同请求。");
          }
          return sendJson(res, previous.responseStatus || 200, previous.responseBody);
        }
        res = idempotencyTrackingResponse(res, db, { scope: operationScope, key, requestHash });
      }
    }

    if (req.method === "GET" && pathname === "/api/health/live") {
      return sendJson(res, 200, { status: "ok", service: "scent-atoll-api" });
    }

    if (req.method === "GET" && pathname === "/api/health/ready") {
      const hasCommerceFoundation = db.memberTiers.some((tier) => tier.code === "base" && tier.isActive) && db.products.length > 0;
      const ready = !isProduction || (activeRepositoryMode === "postgres" && hasCommerceFoundation);
      return sendJson(res, ready ? 200 : 503, {
        status: ready ? "ready" : "not_ready",
        database: activeRepositoryMode,
        products: db.products.length,
        commerceFoundation: hasCommerceFoundation
      });
    }

    if (req.method === "GET" && pathname === "/api/internal/release-expired-reservations") {
      if (!authorizedReservationCron(req)) return sendError(res, 401, "定时任务鉴权失败。");
      const releasedOrders = releaseExpiredReservations(db);
      if (releasedOrders > 0) {
        logAdminOperation(
          db,
          req,
          "release_expired_reservations",
          "maintenance",
          "stock_reservations",
          null,
          { releasedOrders },
          "定时释放超时未付款订单库存"
        );
      }
      await persist();
      return sendJson(res, 200, { ok: true, releasedOrders });
    }

    if (req.method === "POST" && pathname === "/api/auth/register") {
      const email = String(body.email || "").trim().toLowerCase();
      const phone = String(body.phone || "").trim();
      const password = String(body.password || "");
      const name = String(body.name || "").trim();
      if (body.acceptTerms !== true || body.acceptPrivacy !== true) {
        return sendError(res, 400, "注册前必须同意用户协议和隐私政策。");
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(res, 400, "请输入有效邮箱。");
      if (!await allowAccountAction(req, res, email, "registration")) return;
      if (password.length < (isProduction ? 10 : 6)) return sendError(res, 400, isProduction ? "密码至少需要 10 位。" : "密码至少需要 6 位。");
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
        emailVerifiedAt: isProduction ? null : now(),
        termsAcceptedAt: now(),
        termsVersion,
        privacyAcceptedAt: now(),
        privacyVersion,
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
      const verification = createOpaqueToken();
      db.emailVerificationTokens.push({
        id: randomUUID(), userId: newUser.id, tokenHash: verification.tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), usedAt: null, createdAt: now()
      });
      afterCommit(() => sendTrackedEmail({
        kind: "email-verification",
        userId: newUser.id,
        recipient: newUser.email,
        send: () => emailService.sendVerification({
          to: newUser.email,
          name: newUser.name,
          verificationUrl: `${applicationOrigin()}/verify-email.html?token=${encodeURIComponent(verification.token)}`,
          verificationId: db.emailVerificationTokens.at(-1).id,
          userId: newUser.id
        })
      }));
      if (isProduction) {
        await persist();
        return sendJson(res, 201, { user: publicUser(newUser), verificationRequired: true });
      }
      const session = {
        id: randomUUID(),
        userId: newUser.id,
        createdAt: now(),
        expiresAt: new Date(Date.now() + sessionMaxAgeMs).toISOString(),
        lastSeenAt: now(),
        revokedAt: null
      };
      db.sessions.push(session);
      await persist();
      return sendJson(res, 201, { ...profilePayload(db, newUser), verificationToken: verification.token }, { "set-cookie": sessionCookie(session.id) });
    }

    if (req.method === "POST" && pathname === "/api/auth/login") {
      const account = String(body.account || body.email || body.phone || "").trim().toLowerCase();
      const password = String(body.password || "");
      const adminUser = db.adminUsers.find((item) => item.email === account && item.status === "active");
      if (adminUser) {
        const rateLimitInput = { ip: requestIpHash(req), login: account, scope: "admin" };
        const rateLimit = await loginRateLimiter.consume(rateLimitInput);
        if (!rateLimit.allowed) {
          queueLoginAttempt(afterCommit, req, account, "admin_rate_limited", false);
          return sendJson(res, 429, { error: "登录尝试过多，请稍后再试。" }, { "retry-after": String(Math.ceil(rateLimit.retryAfterMs / 1000)) });
        }
        if (!verifyPassword(password, adminUser.passwordHash)) {
          queueLoginAttempt(afterCommit, req, account, "admin_login", false);
          return sendError(res, 401, "账号或密码错误。");
        }
        await loginRateLimiter.clear(rateLimitInput);
        queueLoginAttempt(afterCommit, req, account, "admin_login", true);
        const session = {
          id: randomUUID(),
          adminUserId: adminUser.id,
          createdAt: now(),
          expiresAt: new Date(Date.now() + sessionMaxAgeMs).toISOString(),
          lastSeenAt: now(),
          revokedAt: null
        };
        db.adminSessions.push(session);
        adminUser.lastLoginAt = now();
        await persist();
        return sendJson(res, 200, {
          accountType: "admin",
          destination: "admin.html#overview",
          admin: publicAdmin(adminUser)
        }, { "set-cookie": adminSessionCookie(session.id) });
      }
      const rateLimitInput = { ip: requestIpHash(req), login: account, scope: "member" };
      const rateLimit = await loginRateLimiter.consume(rateLimitInput);
      if (!rateLimit.allowed) {
        queueLoginAttempt(afterCommit, req, account, "member_rate_limited", false);
        return sendJson(res, 429, { error: "登录尝试过多，请稍后再试。" }, { "retry-after": String(Math.ceil(rateLimit.retryAfterMs / 1000)) });
      }
      const foundUser = db.users.find((item) => item.email === account || item.phone === account);
      if (!foundUser || !verifyPassword(password, foundUser.passwordHash)) {
        queueLoginAttempt(afterCommit, req, account, "member_login", false);
        return sendError(res, 401, "账号或密码错误。");
      }
      if (isProduction && !foundUser.emailVerifiedAt) {
        queueLoginAttempt(afterCommit, req, account, "member_unverified", false);
        return sendError(res, 403, "请先验证邮箱。");
      }
      await loginRateLimiter.clear(rateLimitInput);
      queueLoginAttempt(afterCommit, req, account, "member_login", true);
      const session = {
        id: randomUUID(),
        userId: foundUser.id,
        createdAt: now(),
        expiresAt: new Date(Date.now() + sessionMaxAgeMs).toISOString(),
        lastSeenAt: now(),
        revokedAt: null
      };
      db.sessions.push(session);
      await persist();
      return sendJson(res, 200, {
        ...profilePayload(db, foundUser),
        accountType: "member",
        destination: "account.html"
      }, { "set-cookie": sessionCookie(session.id) });
    }

    if (req.method === "POST" && pathname === "/api/auth/logout") {
      const sessionId = parseCookies(req.headers.cookie).sa_session;
      if (sessionId) db.sessions = db.sessions.filter((session) => session.id !== sessionId);
      await persist();
      return sendJson(res, 200, { ok: true }, { "set-cookie": clearSessionCookie() });
    }

    if (req.method === "POST" && pathname === "/api/auth/verify-email") {
      const token = db.emailVerificationTokens.find((item) => item.tokenHash === sha256(body.token));
      if (!token || token.usedAt || new Date(token.expiresAt).getTime() <= Date.now()) return sendError(res, 400, "验证链接无效或已过期。");
      const foundUser = db.users.find((item) => item.id === token.userId);
      if (!foundUser) return sendError(res, 404, "会员不存在。");
      token.usedAt = now();
      foundUser.emailVerifiedAt = now();
      foundUser.updatedAt = now();
      const session = { id: randomUUID(), userId: foundUser.id, createdAt: now(), expiresAt: new Date(Date.now() + sessionMaxAgeMs).toISOString(), lastSeenAt: now(), revokedAt: null };
      db.sessions.push(session);
      await persist();
      return sendJson(res, 200, profilePayload(db, foundUser), { "set-cookie": sessionCookie(session.id) });
    }

    if (req.method === "POST" && pathname === "/api/auth/resend-verification") {
      const email = cleanText(body.email).toLowerCase();
      if (!await allowAccountAction(req, res, email, "email_verification")) return;
      const foundUser = db.users.find((item) => item.email === email);
      let verificationToken = null;
      if (foundUser && !foundUser.emailVerifiedAt) {
        const verification = createOpaqueToken();
        verificationToken = verification.token;
        db.emailVerificationTokens.push({ id: randomUUID(), userId: foundUser.id, tokenHash: verification.tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), usedAt: null, createdAt: now() });
        const verificationId = db.emailVerificationTokens.at(-1).id;
        afterCommit(() => sendTrackedEmail({
          kind: "email-verification", userId: foundUser.id, recipient: foundUser.email,
          send: () => emailService.sendVerification({
            to: foundUser.email, name: foundUser.name,
            verificationUrl: `${applicationOrigin()}/verify-email.html?token=${encodeURIComponent(verification.token)}`,
            verificationId, userId: foundUser.id
          })
        }));
      }
      await persist();
      return sendJson(res, 200, { ok: true, ...(!isProduction && verificationToken ? { verificationToken } : {}) });
    }

    if (req.method === "POST" && pathname === "/api/auth/request-password-reset") {
      const email = cleanText(body.email).toLowerCase();
      if (!await allowAccountAction(req, res, email, "password_reset")) return;
      const foundUser = db.users.find((item) => item.email === email);
      let resetToken = null;
      if (foundUser) {
        const reset = createOpaqueToken();
        resetToken = reset.token;
        db.passwordResetTokens.push({ id: randomUUID(), userId: foundUser.id, tokenHash: reset.tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), usedAt: null, createdAt: now() });
        const resetId = db.passwordResetTokens.at(-1).id;
        afterCommit(() => sendTrackedEmail({
          kind: "password-reset", userId: foundUser.id, recipient: foundUser.email,
          send: () => emailService.sendPasswordReset({
            to: foundUser.email, name: foundUser.name,
            resetUrl: `${applicationOrigin()}/reset-password.html?token=${encodeURIComponent(reset.token)}`,
            resetId, userId: foundUser.id
          })
        }));
      }
      await persist();
      return sendJson(res, 200, { ok: true, ...(!isProduction && resetToken ? { resetToken } : {}) });
    }

    if (req.method === "POST" && pathname === "/api/auth/reset-password") {
      const password = String(body.password || "");
      if (password.length < (isProduction ? 10 : 6)) return sendError(res, 400, "新密码长度不足。");
      const token = db.passwordResetTokens.find((item) => item.tokenHash === sha256(body.token));
      if (!token || token.usedAt || new Date(token.expiresAt).getTime() <= Date.now()) return sendError(res, 400, "重置链接无效或已过期。");
      const foundUser = db.users.find((item) => item.id === token.userId);
      if (!foundUser) return sendError(res, 404, "会员不存在。");
      foundUser.passwordHash = hashPassword(password);
      foundUser.updatedAt = now();
      token.usedAt = now();
      db.sessions.forEach((session) => { if (session.userId === foundUser.id) session.revokedAt = now(); });
      await persist();
      return sendJson(res, 200, { ok: true }, { "set-cookie": clearSessionCookie() });
    }

    if (req.method === "POST" && pathname === "/api/auth/sessions/revoke-others") {
      if (!user) return sendError(res, 401, "请先登录。");
      const currentSessionId = parseCookies(req.headers.cookie).sa_session;
      db.sessions.forEach((session) => {
        if (session.userId === user.id && session.id !== currentSessionId) session.revokedAt = now();
      });
      await persist();
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "DELETE" && pathname === "/api/member/account") {
      if (!user) return sendError(res, 401, "请先登录。");
      if (!verifyPassword(String(body.password || ""), user.passwordHash)) return sendError(res, 403, "密码错误。");
      const activeOrder = db.orders.find((item) => item.userId === user.id && !["completed", "cancelled", "refunded"].includes(item.status));
      if (activeOrder) return sendError(res, 409, "存在未完成订单，暂时不能注销账号。");
      const activeRedemption = db.pointsRedemptionOrders.find((item) => item.userId === user.id && !["completed", "cancelled"].includes(item.status));
      if (activeRedemption) return sendError(res, 409, "存在待处理积分兑换，暂时不能注销账号。");
      user.status = "deleted";
      user.email = `deleted-${user.id}@invalid.local`;
      user.phone = null;
      user.name = "已注销会员";
      user.passwordHash = hashPassword(randomBytes(32).toString("hex"));
      user.updatedAt = now();
      const profile = db.memberProfiles.find((item) => item.userId === user.id);
      if (profile) {
        profile.birthday = null;
        profile.acceptsMarketing = false;
        profile.updatedAt = now();
      }
      db.addresses = db.addresses.filter((item) => item.userId !== user.id);
      db.emailVerificationTokens = db.emailVerificationTokens.filter((item) => item.userId !== user.id);
      db.passwordResetTokens = db.passwordResetTokens.filter((item) => item.userId !== user.id);
      db.pointsRedemptionOrders.forEach((item) => {
        if (item.userId !== user.id) return;
        item.recipientName = "已注销会员";
        item.recipientPhone = null;
        item.shippingAddress = null;
        item.updatedAt = now();
      });
      db.emailDeliveries.forEach((item) => {
        if (item.userId !== user.id) return;
        item.userId = null;
        item.recipient = `deleted-${user.id}@invalid.local`;
        item.errorMessage = null;
        item.updatedAt = now();
      });
      db.sessions.forEach((session) => { if (session.userId === user.id) session.revokedAt = now(); });
      await persist();
      return sendJson(res, 200, { ok: true }, { "set-cookie": clearSessionCookie() });
    }

    if (req.method === "GET" && pathname === "/api/auth/me") {
      if (user && expirePointsForUser(db, user.id)) await persist();
      return sendJson(res, 200, user ? profilePayload(db, user) : { user: null });
    }

    if (req.method === "GET" && pathname === "/api/products") {
      return sendJson(res, 200, {
        products: publicProducts(db)
      });
    }

    if (req.method === "GET" && pathname === "/api/sitemap") {
      res.writeHead(200, {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, s-maxage=300, stale-while-revalidate=3600"
      });
      res.end(sitemapXml(db));
      return;
    }

    const publicProductMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
    if (req.method === "GET" && publicProductMatch) {
      const product = productByIdOrSlug(db, decodeURIComponent(publicProductMatch[1]));
      if (!product || product.status !== "active") return sendError(res, 404, "商品不存在或已下架。");
      return sendJson(res, 200, {
        product: publicProductFromPayload(productPayload(db, product))
      });
    }

    if (pathname.startsWith("/api/member") && !user) return sendError(res, 401, "请先登录。");

    if (req.method === "GET" && pathname === "/api/member/profile") {
      if (expirePointsForUser(db, user.id)) await persist();
      return sendJson(res, 200, profilePayload(db, user));
    }

    if (req.method === "PATCH" && pathname === "/api/member/profile") {
      const profile = db.memberProfiles.find((item) => item.userId === user.id);
      user.name = String(body.name ?? user.name ?? "").trim();
      if ("birthday" in body) profile.birthday = body.birthday || null;
      if ("acceptsMarketing" in body) profile.acceptsMarketing = Boolean(body.acceptsMarketing);
      user.updatedAt = now();
      profile.updatedAt = now();
      await persist();
      return sendJson(res, 200, profilePayload(db, user));
    }

    if (req.method === "GET" && pathname === "/api/member/addresses") {
      return sendJson(res, 200, {
        addresses: db.addresses.filter((item) => item.userId === user.id).sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
      });
    }

    if (req.method === "POST" && pathname === "/api/member/addresses") {
      const address = normalizeAddressInput(body, user.id);
      if (address.isDefault || !db.addresses.some((item) => item.userId === user.id)) {
        db.addresses.forEach((item) => { if (item.userId === user.id) item.isDefault = false; });
        address.isDefault = true;
      }
      db.addresses.push(address);
      await persist();
      return sendJson(res, 201, { address });
    }

    const addressMatch = pathname.match(/^\/api\/member\/addresses\/([^/]+)$/);
    if (["PATCH", "DELETE"].includes(req.method) && addressMatch) {
      const address = db.addresses.find((item) => item.id === addressMatch[1] && item.userId === user.id);
      if (!address) return sendError(res, 404, "收货地址不存在。");
      if (req.method === "DELETE") {
        db.addresses = db.addresses.filter((item) => item.id !== address.id);
        const replacement = db.addresses.find((item) => item.userId === user.id);
        if (address.isDefault && replacement) replacement.isDefault = true;
        await persist();
        return sendJson(res, 200, { ok: true });
      }
      const updated = normalizeAddressInput({ ...address, ...body, id: address.id, createdAt: address.createdAt }, user.id);
      if (updated.isDefault) db.addresses.forEach((item) => { if (item.userId === user.id && item.id !== address.id) item.isDefault = false; });
      Object.assign(address, updated);
      await persist();
      return sendJson(res, 200, { address });
    }

    if (req.method === "GET" && pathname === "/api/member/points") {
      if (expirePointsForUser(db, user.id)) await persist();
      return sendJson(res, 200, {
        transactions: db.pointTransactions
          .filter((item) => item.userId === user.id)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      });
    }

    if (req.method === "GET" && pathname === "/api/member/orders") {
      const expired = releaseExpiredReservations(db);
      if (expired) await persist();
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
      await persist();
      return sendJson(res, 200, {
        order: orderPayload(db, order),
        result,
        member: profilePayload(db, user)
      });
    }

    const cancelOrderMatch = pathname.match(/^\/api\/member\/orders\/([^/]+)\/cancel$/);
    if (req.method === "POST" && cancelOrderMatch) {
      const order = db.orders.find((item) => item.id === cancelOrderMatch[1] && item.userId === user.id);
      if (!order) return sendError(res, 404, "订单不存在。");
      if (order.status === "cancelled") return sendJson(res, 200, { order: orderPayload(db, order), alreadyProcessed: true });
      if (order.status !== "pending_payment") return sendError(res, 409, "只有待付款订单可以取消。");
      const inventoryReleased = releaseOrderInventory(db, order, "member_cancelled");
      order.status = "cancelled";
      order.cancelledAt = now();
      order.cancellationReason = cleanText(body.reason || "member_cancelled");
      order.updatedAt = now();
      await persist();
      return sendJson(res, 200, { order: orderPayload(db, order), inventoryReleased });
    }

    if (req.method === "GET" && pathname === "/api/member/tier-progress") {
      if (expirePointsForUser(db, user.id)) await persist();
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
          .filter((item) => activeMallItem(item, db))
          .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
          .map((item) => mallItemPayload(item, db))
      });
    }

    const mallItemMatch = pathname.match(/^\/api\/points-mall\/items\/([^/]+)$/);
    if (req.method === "GET" && mallItemMatch) {
      const item = db.pointsMallItems.find((entry) => entry.id === mallItemMatch[1]);
      if (!item || !activeMallItem(item, db)) return sendError(res, 404, "积分商品不存在或已下架。");
      return sendJson(res, 200, { item: mallItemPayload(item, db) });
    }

    if (req.method === "POST" && pathname === "/api/points-mall/redeem") {
      if (!user) return sendError(res, 401, "请先登录后兑换。");
      const result = createPointsRedemption(db, user, body);
      await persist();
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
      if (body.acceptTerms !== true || body.acceptPrivacy !== true) {
        return sendError(res, 400, "提交订单前必须同意用户协议和隐私政策。");
      }
      releaseExpiredReservations(db);
      const requestKey = idempotencyKey(req, body);
      if (isProduction && !requestKey) return sendError(res, 400, "创建订单必须提供 Idempotency-Key。");
      const previousOrder = requestKey && db.orders.find((item) => item.userId === user.id && item.requestId === requestKey);
      if (previousOrder) return sendJson(res, 200, { order: orderPayload(db, previousOrder), alreadyProcessed: true });
      const quote = calculateQuote(db, user, body.items);
      let shippingAddress = body.addressId
        ? db.addresses.find((item) => item.id === body.addressId && item.userId === user.id)
        : null;
      if (!shippingAddress && body.shippingAddress) {
        shippingAddress = normalizeAddressInput(body.shippingAddress, user.id);
        if (body.saveAddress) {
          if (shippingAddress.isDefault) db.addresses.forEach((item) => { if (item.userId === user.id) item.isDefault = false; });
          db.addresses.push(shippingAddress);
        }
      }
      if (!shippingAddress) shippingAddress = db.addresses.find((item) => item.userId === user.id && item.isDefault) || null;
      if (isProduction && !shippingAddress) return sendError(res, 400, "请选择收货地址。");
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
        paymentProvider: "manual_wechat",
        paymentReference: null,
        requestId: requestKey || null,
        paidAt: null,
        completedAt: null,
        refundedAt: null,
        cancelledAt: null,
        cancellationReason: null,
        termsAcceptedAt: now(),
        termsVersion,
        privacyAcceptedAt: now(),
        privacyVersion,
        createdAt: now(),
        updatedAt: now()
      };
      db.orders.push(order);
      quote.lines.forEach((line) => {
        db.orderItems.push({
          id: randomUUID(),
          orderId: order.id,
          productId: line.managedProductId,
          variantId: line.variantId,
          productName: line.productName,
          brandName: line.brandName,
          sku: line.sku,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          subtotalAmount: line.subtotalAmount,
          discountAmount: line.memberDiscountAmount,
          memberDiscountExcluded: line.memberDiscountExcluded,
          productSnapshot: {
            id: line.productId,
            name: line.productName,
            brand: line.brandName,
            sku: line.sku,
            unitPrice: line.unitPrice
          },
          createdAt: now()
        });
      });
      reserveOrderInventory(db, order, quote.lines);
      const addressSnapshot = orderAddressSnapshot(shippingAddress, order.id);
      if (addressSnapshot) db.orderAddresses.push(addressSnapshot);
      afterCommit(() => sendTrackedEmail({
        kind: "order-confirmation", userId: user.id, recipient: user.email,
        send: () => emailService.sendOrderConfirmation({
          to: user.email, name: user.name, orderId: order.id,
          orderNumber: order.orderNo, totalCents: order.paidAmount, currency: "CNY"
        })
      }));
      await persist();
      return sendJson(res, 201, { order: orderPayload(db, order), quote });
    }

    if (req.method === "POST" && pathname === "/api/checkout/start-payment") {
      if (!user) return sendError(res, 401, "请先登录后结账。");
      const order = db.orders.find((item) => item.id === body.orderId && item.userId === user.id);
      if (!order) return sendError(res, 404, "订单不存在。");
      if (order.status !== "pending_payment") return sendError(res, 409, "订单当前不能发起支付。");
      if (body.method === "wechat_pay") {
        const client = getWechatPayClient();
        const common = {
          description: `馥屿订单 ${order.orderNo}`,
          outTradeNo: order.orderNo,
          total: order.paidAmount,
          currency: "CNY",
          timeExpire: db.stockReservations.find((item) => item.orderId === order.id && item.status === "active")?.expiresAt
        };
        if (body.channel === "jsapi") {
          const response = await client.createJsapiOrder({ ...common, openid: body.openid });
          const payload = await parseWechatPayResponse(response);
          return sendJson(res, 200, {
            status: "payment_created",
            channel: "jsapi",
            order: orderPayload(db, order),
            paymentParameters: client.createJsapiPaymentParameters(payload.prepay_id)
          });
        }
        const response = await client.createH5Order({
          ...common,
          payerClientIp: String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim(),
          h5Type: "Wap",
          appName: "馥屿 Scent Atoll",
          appUrl: applicationOrigin()
        });
        const payload = await parseWechatPayResponse(response);
        return sendJson(res, 200, { status: "payment_created", channel: "h5", order: orderPayload(db, order), h5Url: payload.h5_url });
      }
      return sendJson(res, 200, {
        status: "pending_manual_payment",
        order: orderPayload(db, order),
        paymentMethod: "manual_wechat",
        contactWechat: process.env.CONTACT_WECHAT || "",
        message: `订单 ${order.orderNo} 已预留库存 30 分钟。请联系客服微信完成转账，后台核对后更新订单。`
      });
    }

    if (rawWechatCallback) {
      if (!wechatPayEnabled) return sendError(res, 404, "API 不存在。");
      const rawBody = await requestBytes(req, maxRequestBodyBytes);
      const verified = getWechatPayClient().verifyAndDecryptCallback({ headers: req.headers, rawBody });
      const { event, resource, identifiers } = verified;
      const priorEvent = db.paymentEvents.find((item) => item.provider === "wechat_pay" && item.providerEventId === identifiers.eventId);
      if (priorEvent) return sendJson(res, 200, { code: "SUCCESS", message: "成功" });
      const order = db.orders.find((item) => item.orderNo === identifiers.outTradeNo);
      if (!order) return sendError(res, 404, "订单不存在。");
      assertWechatPayTransaction(resource, {
        mchid: wechatPayConfigFromEnv().mchid,
        appid: wechatPayConfigFromEnv().appid,
        total: order.paidAmount,
        currency: "CNY",
        outTradeNo: order.orderNo
      });
      if (resource.trade_state !== "SUCCESS") return sendError(res, 409, "支付状态尚未成功。");
      const result = markOrderPaid(db, order, {
        provider: "wechat_pay",
        providerPaymentId: identifiers.transactionId,
        reference: identifiers.transactionId,
        idempotencyKey: identifiers.idempotencyKey,
        rawPayload: event
      });
      db.paymentEvents.push({
        id: randomUUID(), provider: "wechat_pay", providerEventId: identifiers.eventId,
        paymentId: result.payment?.id || db.payments.find((item) => item.orderId === order.id)?.id || null,
        eventType: identifiers.eventType || "TRANSACTION.SUCCESS", payload: event, createdAt: now()
      });
      await persist();
      return sendJson(res, 200, { code: "SUCCESS", message: "成功" });
    }

    if (req.method === "POST" && pathname === "/api/webhooks/payment") {
      if (isProduction) return sendError(res, 404, "API 不存在。");
      if (req.headers["x-webhook-secret"] !== paymentWebhookSecret) return sendError(res, 403, "Webhook 密钥错误。");
      const order = db.orders.find((item) => item.id === body.orderId || item.orderNo === body.orderNo);
      if (!order) return sendError(res, 404, "订单不存在。");
      if (body.status !== "paid") return sendError(res, 400, "当前只支持 paid 支付事件。");
      if (order.status !== "pending_payment") return sendJson(res, 200, { order: orderPayload(db, order), alreadyProcessed: true });
      const result = markOrderPaid(db, order, {
        provider: "development_webhook",
        reference: body.reference || `DEV-WEBHOOK-${order.orderNo}`,
        idempotencyKey: idempotencyKey(req, body),
        rawPayload: body
      });
      await persist();
      return sendJson(res, 200, {
        order: orderPayload(db, order),
        result,
        member: profilePayload(db, db.users.find((item) => item.id === order.userId))
      });
    }

    if (req.method === "POST" && pathname === "/api/admin/auth/login") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const rateLimitInput = { ip: requestIpHash(req), login: email, scope: "admin" };
      const rateLimit = await loginRateLimiter.consume(rateLimitInput);
      if (!rateLimit.allowed) {
        queueLoginAttempt(afterCommit, req, email, "admin_rate_limited", false);
        return sendJson(res, 429, { error: "后台登录尝试过多，请稍后再试。" }, { "retry-after": String(Math.ceil(rateLimit.retryAfterMs / 1000)) });
      }
      const adminUser = db.adminUsers.find((item) => item.email === email && item.status === "active");
      if (!adminUser || !verifyPassword(password, adminUser.passwordHash)) {
        queueLoginAttempt(afterCommit, req, email, "admin_login", false);
        return sendError(res, 401, "后台账号或密码错误。");
      }
      await loginRateLimiter.clear(rateLimitInput);
      queueLoginAttempt(afterCommit, req, email, "admin_login", true);
      const session = {
        id: randomUUID(),
        adminUserId: adminUser.id,
        createdAt: now(),
        expiresAt: new Date(Date.now() + sessionMaxAgeMs).toISOString(),
        lastSeenAt: now(),
        revokedAt: null
      };
      db.adminSessions.push(session);
      adminUser.lastLoginAt = now();
      await persist();
      return sendJson(res, 200, { admin: publicAdmin(adminUser) }, { "set-cookie": adminSessionCookie(session.id) });
    }

    if (req.method === "POST" && pathname === "/api/admin/auth/logout") {
      const sessionId = parseCookies(req.headers.cookie).sa_admin_session;
      if (sessionId) db.adminSessions = db.adminSessions.filter((item) => item.id !== sessionId);
      await persist();
      return sendJson(res, 200, { ok: true }, { "set-cookie": clearAdminSessionCookie() });
    }

    if (req.method === "GET" && pathname === "/api/admin/auth/me") {
      if (!requireAdmin(res, admin)) return;
      return sendJson(res, 200, { admin: publicAdmin(admin) });
    }

    if (req.method === "POST" && pathname === "/api/admin/auth/change-password") {
      if (!requireAdmin(res, admin)) return;
      if (admin.role !== "owner") return sendError(res, 403, "只有 Owner 可以修改后台密码。");
      const currentPassword = String(body.currentPassword || "");
      const newPassword = String(body.newPassword || "");
      if (!verifyPassword(currentPassword, admin.passwordHash)) return sendError(res, 403, "当前密码错误。");
      if (newPassword.length < 14) return sendError(res, 400, "后台新密码至少需要 14 位。");
      if (verifyPassword(newPassword, admin.passwordHash)) return sendError(res, 400, "新密码不能与当前密码相同。");
      const changedAt = now();
      admin.passwordHash = hashPassword(newPassword);
      admin.updatedAt = changedAt;
      db.adminSessions.forEach((session) => {
        if (session.adminUserId === admin.id) session.revokedAt = changedAt;
      });
      const session = {
        id: randomUUID(),
        adminUserId: admin.id,
        createdAt: changedAt,
        expiresAt: new Date(Date.now() + sessionMaxAgeMs).toISOString(),
        lastSeenAt: changedAt,
        revokedAt: null
      };
      db.adminSessions.push(session);
      req.currentAdmin = admin;
      logAdminOperation(db, req, "change_admin_password", "admin_user", admin.id, null, { sessionsRotated: true }, "Owner 修改后台密码");
      await persist();
      return sendJson(res, 200, { ok: true, admin: publicAdmin(admin) }, { "set-cookie": adminSessionCookie(session.id) });
    }

    if (req.method === "POST" && pathname === "/api/admin/auth/sessions/revoke-others") {
      if (!requireAdmin(res, admin)) return;
      if (admin.role !== "owner") return sendError(res, 403, "只有 Owner 可以撤销后台会话。");
      const currentSessionId = parseCookies(req.headers.cookie).sa_admin_session;
      let revokedSessions = 0;
      db.adminSessions.forEach((session) => {
        if (session.adminUserId !== admin.id || session.id === currentSessionId || session.revokedAt) return;
        session.revokedAt = now();
        revokedSessions += 1;
      });
      req.currentAdmin = admin;
      logAdminOperation(db, req, "revoke_other_admin_sessions", "admin_user", admin.id, null, { revokedSessions }, "Owner 撤销其他后台会话");
      await persist();
      return sendJson(res, 200, { ok: true, revokedSessions });
    }

    if (pathname.startsWith("/api/admin")) {
      if (!requireAdmin(res, admin)) return;
      req.currentAdmin = admin;
      const guard = (permission) => requirePermission(res, admin, permission);

      if (req.method === "GET" && pathname === "/api/admin/audit-logs") {
        if (!guard("logs:read")) return;
        return sendJson(res, 200, {
          logs: db.operationLogs
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 200)
        });
      }

      if (req.method === "GET" && pathname === "/api/admin/products") {
        if (!guard("products:read")) return;
        const products = db.products
          .slice()
          .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
          .map((item) => productPayload(db, item));
        return sendJson(res, 200, {
          products,
          summary: {
            total: products.length,
            active: products.filter((item) => item.status === "active").length,
            draft: products.filter((item) => item.status === "draft").length,
            lowStock: products.filter((item) => item.availableQuantity > 0 && item.availableQuantity <= 3).length,
            outOfStock: products.filter((item) => item.availableQuantity <= 0).length
          }
        });
      }

      if (req.method === "POST" && rawImageUploadMatch) {
        if (!guard("products:write")) return;
        const product = productByIdOrSlug(db, decodeURIComponent(rawImageUploadMatch[1]));
        if (!product) return sendError(res, 404, "商品不存在。");
        const fileName = decodeHeaderText(req.headers["x-file-name"] || "product-image");
        const contentType = cleanText(req.headers["content-type"]);
        const bytes = await requestBytes(req);
        const uploaded = await productImageStorage.upload({ productId: product.id, fileName, contentType, body: bytes });
        const image = {
          id: randomUUID(), productId: product.id, imageUrl: uploaded.url, alt: decodeHeaderText(req.headers["x-image-alt"] || product.name),
          role: cleanText(req.headers["x-image-role"] || (db.productImages.some((item) => item.productId === product.id) ? "gallery" : "hero")),
          sortOrder: db.productImages.filter((item) => item.productId === product.id).length + 1,
          blobPath: uploaded.pathname, contentType: uploaded.contentType, byteSize: uploaded.size, createdAt: now()
        };
        db.productImages.push(image);
        if (!product.heroImageUrl || image.role === "hero") product.heroImageUrl = image.imageUrl;
        product.updatedAt = now();
        logAdminOperation(db, req, "upload_product_image", "product", product.id, null, image, "上传商品图片");
        await persist();
        return sendJson(res, 201, { image, product: productPayload(db, product) });
      }

      const deleteProductImageMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)\/images\/([^/]+)$/);
      if (req.method === "DELETE" && deleteProductImageMatch) {
        if (!guard("products:write")) return;
        const product = productByIdOrSlug(db, decodeURIComponent(deleteProductImageMatch[1]));
        const image = db.productImages.find((item) => item.id === deleteProductImageMatch[2] && item.productId === product?.id);
        if (!product || !image) return sendError(res, 404, "商品图片不存在。");
        if (image.blobPath) {
          afterCommit(async () => {
            try {
              await productImageStorage.remove({ url: image.imageUrl });
            } catch (error) {
              await errorReporter.capture(error, { operation: "delete_product_blob", productId: product.id, imageId: image.id });
            }
          });
        }
        db.productImages = db.productImages.filter((item) => item.id !== image.id);
        if (product.heroImageUrl === image.imageUrl) {
          product.heroImageUrl = db.productImages.find((item) => item.productId === product.id)?.imageUrl || null;
        }
        product.updatedAt = now();
        logAdminOperation(db, req, "delete_product_image", "product", product.id, image, null, "删除商品图片");
        await persist();
        return sendJson(res, 200, { ok: true, product: productPayload(db, product) });
      }

      if (req.method === "POST" && pathname === "/api/admin/products") {
        if (!guard("products:write")) return;
        const product = {
          id: randomUUID(),
          slug: "",
          name: "",
          brandName: null,
          brandId: null,
          category: null,
          country: null,
          status: "draft",
          description: null,
          volume: null,
          concentration: null,
          stockLabel: null,
          year: null,
          perfumer: null,
          family: null,
          notes: [],
          scenes: [],
          mood: [],
          sweetness: null,
          statusTags: [],
          heroImageUrl: null,
          imageLayout: "grid",
          buyerNote: null,
          bestFor: null,
          caution: null,
          topNotes: null,
          middleNotes: null,
          baseNotes: null,
          sortOrder: Math.trunc(Number(body.sortOrder || db.products.length + 1)),
          createdAt: now(),
          updatedAt: now()
        };
        db.products.push(product);
        applyProductFields(db, product, body, { isCreate: true });
        const variant = updatePrimaryVariant(db, product, body, { isCreate: true });
        if ("images" in body || "imageUrls" in body) replaceProductImages(db, product, body.images ?? body.imageUrls);
        if (variant && ("stockQuantity" in body || "quantityOnHand" in body || "quantity" in body || "quantityDelta" in body)) {
          adjustInventory(db, variant.id, {
            mode: "quantityDelta" in body ? "adjust" : "set",
            quantity: body.stockQuantity ?? body.quantityOnHand ?? body.quantity,
            quantityDelta: body.quantityDelta,
            reason: body.reason || "新增商品初始库存"
          });
        }
        if (product.status === "active") {
          const activationError = productActivationError(db, product);
          if (activationError) throw new Error(activationError);
        }
        logAdminOperation(db, req, "create_product", "product", product.id, null, productPayload(db, product), body.reason || "新增商品");
        await persist();
        return sendJson(res, 201, { product: productPayload(db, product) });
      }

      const productStatusMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)\/(activate|deactivate|archive)$/);
      if (req.method === "POST" && productStatusMatch) {
        if (!guard("products:write")) return;
        const product = productByIdOrSlug(db, decodeURIComponent(productStatusMatch[1]));
        if (!product) return sendError(res, 404, "商品不存在。");
        const before = productPayload(db, product);
        const action = productStatusMatch[2];
        if (action === "activate") {
          const activationError = productActivationError(db, product);
          if (activationError) return sendError(res, 400, activationError);
          product.status = "active";
        } else if (action === "deactivate") {
          product.status = "inactive";
        } else {
          product.status = "archived";
        }
        product.updatedAt = now();
        logAdminOperation(
          db,
          req,
          action === "activate" ? "activate_product" : action === "deactivate" ? "deactivate_product" : "archive_product",
          "product",
          product.id,
          before,
          productPayload(db, product),
          body.reason || (action === "activate" ? "上架商品" : action === "deactivate" ? "下架商品" : "归档商品")
        );
        await persist();
        return sendJson(res, 200, { product: productPayload(db, product) });
      }

      const productInventoryMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)\/variants\/([^/]+)\/inventory$/);
      if (req.method === "POST" && productInventoryMatch) {
        if (!guard("products:write")) return;
        const product = productByIdOrSlug(db, decodeURIComponent(productInventoryMatch[1]));
        if (!product) return sendError(res, 404, "商品不存在。");
        const variantId = decodeURIComponent(productInventoryMatch[2]);
        const variant = db.productVariants.find((item) => item.id === variantId && item.productId === product.id);
        if (!variant) return sendError(res, 404, "商品规格不存在。");
        const before = productPayload(db, product);
        const result = adjustInventory(db, variant.id, body);
        product.stockLabel = body.stockLabel ? cleanText(body.stockLabel) : product.stockLabel;
        product.updatedAt = now();
        logAdminOperation(
          db,
          req,
          "adjust_product_inventory",
          "product",
          product.id,
          before,
          productPayload(db, product),
          body.reason || "后台库存调整"
        );
        await persist();
        return sendJson(res, 200, {
          product: productPayload(db, product),
          inventory: result.inventory,
          movement: result.movement
        });
      }

      const productMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
      if (req.method === "GET" && productMatch) {
        if (!guard("products:read")) return;
        const product = productByIdOrSlug(db, decodeURIComponent(productMatch[1]));
        if (!product) return sendError(res, 404, "商品不存在。");
        return sendJson(res, 200, { product: productPayload(db, product) });
      }

      if (req.method === "PATCH" && productMatch) {
        if (!guard("products:write")) return;
        const product = productByIdOrSlug(db, decodeURIComponent(productMatch[1]));
        if (!product) return sendError(res, 404, "商品不存在。");
        const before = productPayload(db, product);
        applyProductFields(db, product, body);
        const variant = updatePrimaryVariant(db, product, body);
        const removedBlobImages = ("images" in body || "imageUrls" in body)
          ? replaceProductImages(db, product, body.images ?? body.imageUrls)
          : [];
        for (const removedImage of removedBlobImages) {
          afterCommit(async () => {
            try {
              await productImageStorage.remove({ url: removedImage.imageUrl });
            } catch (error) {
              await errorReporter.capture(error, { operation: "cleanup_replaced_product_blob", productId: product.id, imageId: removedImage.id });
            }
          });
        }
        if (variant && ("stockQuantity" in body || "quantityOnHand" in body || "quantity" in body || "quantityDelta" in body)) {
          adjustInventory(db, variant.id, {
            mode: "quantityDelta" in body ? "adjust" : "set",
            quantity: body.stockQuantity ?? body.quantityOnHand ?? body.quantity,
            quantityDelta: body.quantityDelta,
            reason: body.reason || "后台库存调整"
          });
        }
        if (product.status === "active") {
          const activationError = productActivationError(db, product);
          if (activationError) return sendError(res, 400, activationError);
        }
        logAdminOperation(db, req, "update_product", "product", product.id, before, productPayload(db, product), body.reason || "更新商品");
        await persist();
        return sendJson(res, 200, { product: productPayload(db, product) });
      }

      if (req.method === "GET" && pathname === "/api/admin/points") {
        if (!guard("points:read")) return;
        let changed = false;
        db.users.forEach((item) => {
          if (expirePointsForUser(db, item.id)) changed = true;
        });
        if (changed) await persist();
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
        if (!guard("mall:read")) return;
        return sendJson(res, 200, {
          items: db.pointsMallItems
            .slice()
            .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
            .map((item) => mallItemPayload(item, db))
        });
      }

      if (req.method === "POST" && pathname === "/api/admin/points-mall/items") {
        if (!guard("mall:write")) return;
        const productId = body.productId ? String(body.productId).trim() : null;
        const linkedProduct = productId ? catalogItemById(productId, db) : null;
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
        await persist();
        return sendJson(res, 201, { item: mallItemPayload(item, db) });
      }

      const mallAdminActionMatch = pathname.match(/^\/api\/admin\/points-mall\/items\/([^/]+)\/(activate|deactivate)$/);
      if (req.method === "POST" && mallAdminActionMatch) {
        if (!guard("mall:write")) return;
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
        await persist();
        return sendJson(res, 200, { item: mallItemPayload(item, db) });
      }

      const mallAdminItemMatch = pathname.match(/^\/api\/admin\/points-mall\/items\/([^/]+)$/);
      if (req.method === "PATCH" && mallAdminItemMatch) {
        if (!guard("mall:write")) return;
        const item = db.pointsMallItems.find((entry) => entry.id === mallAdminItemMatch[1]);
        if (!item) return sendError(res, 404, "积分商品不存在。");
        const before = snapshot(item);
        if ("productId" in body) {
          const productId = body.productId ? String(body.productId).trim() : null;
          if (productId && !catalogItemById(productId, db)) return sendError(res, 404, "关联商品不存在。");
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
        await persist();
        return sendJson(res, 200, { item: mallItemPayload(item, db) });
      }

      if (req.method === "GET" && pathname === "/api/admin/points-mall/redemptions") {
        if (!guard("redemptions:read")) return;
        return sendJson(res, 200, {
          redemptions: db.pointsRedemptionOrders
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((order) => redemptionPayload(db, order, true))
        });
      }

      const adminRedemptionStatusMatch = pathname.match(/^\/api\/admin\/points-mall\/redemptions\/([^/]+)\/status$/);
      if (req.method === "PATCH" && adminRedemptionStatusMatch) {
        if (!guard("redemptions:write")) return;
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
        await persist();
        return sendJson(res, 200, { redemption: redemptionPayload(db, order, true), result });
      }

      const adminRedemptionCancelMatch = pathname.match(/^\/api\/admin\/points-mall\/redemptions\/([^/]+)\/cancel$/);
      if (req.method === "POST" && adminRedemptionCancelMatch) {
        if (!guard("redemptions:write")) return;
        const order = db.pointsRedemptionOrders.find((item) => item.id === adminRedemptionCancelMatch[1]);
        if (!order) return sendError(res, 404, "兑换订单不存在。");
        const before = redemptionPayload(db, order, true);
        const result = cancelPointsRedemption(db, order, body.reason || "后台取消兑换");
        logAdminOperation(db, req, "cancel_points_redemption", "points_redemption_order", order.id, before, redemptionPayload(db, order, true), body.reason || "后台取消兑换");
        await persist();
        return sendJson(res, 200, { redemption: redemptionPayload(db, order, true), result });
      }

      const adminRedemptionMatch = pathname.match(/^\/api\/admin\/points-mall\/redemptions\/([^/]+)$/);
      if (req.method === "GET" && adminRedemptionMatch) {
        if (!guard("redemptions:read")) return;
        const order = db.pointsRedemptionOrders.find((item) => item.id === adminRedemptionMatch[1]);
        if (!order) return sendError(res, 404, "兑换订单不存在。");
        return sendJson(res, 200, { redemption: redemptionPayload(db, order, true) });
      }

      if (req.method === "GET" && pathname === "/api/admin/members") {
        if (!guard("members:read")) return;
        let changed = false;
        db.users.forEach((item) => {
          if (expirePointsForUser(db, item.id)) changed = true;
        });
        if (changed) await persist();
        return sendJson(res, 200, {
          members: db.users.map((item) => profilePayload(db, item))
        });
      }

      if (req.method === "GET" && pathname === "/api/admin/members/export.csv") {
        if (!guard("admin:export")) return;
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
          `scent-atoll-members-${new Date().toISOString().slice(0, 10)}.csv`,
          rows.map((row) => row.map(csvCell).join(",")).join("\n")
        );
      }

      const memberMatch = pathname.match(/^\/api\/admin\/members\/([^/]+)$/);
      if (req.method === "GET" && memberMatch) {
        if (!guard("members:read")) return;
        const member = db.users.find((item) => item.id === memberMatch[1]);
        if (!member) return sendError(res, 404, "会员不存在。");
        return sendJson(res, 200, profilePayload(db, member));
      }

      const memberTierMatch = pathname.match(/^\/api\/admin\/members\/([^/]+)\/tier$/);
      if (req.method === "PATCH" && memberTierMatch) {
        if (!guard("members:write")) return;
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
        await persist();
        return sendJson(res, 200, profilePayload(db, member));
      }

      const memberPointsMatch = pathname.match(/^\/api\/admin\/members\/([^/]+)\/points$/);
      if (req.method === "POST" && memberPointsMatch) {
        if (!guard("points:write")) return;
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
        await persist();
        return sendJson(res, 200, profilePayload(db, member));
      }

      if (req.method === "GET" && pathname === "/api/admin/orders") {
        if (!guard("orders:read")) return;
        const expired = releaseExpiredReservations(db);
        if (expired) await persist();
        return sendJson(res, 200, {
          orders: db.orders
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((order) => orderPayload(db, order))
        });
      }

      const shipOrderMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/ship$/);
      if (req.method === "POST" && shipOrderMatch) {
        if (!guard("orders:write")) return;
        const order = db.orders.find((item) => item.id === shipOrderMatch[1]);
        if (!order) return sendError(res, 404, "订单不存在。");
        const carrier = cleanText(body.carrier);
        const trackingNo = cleanText(body.trackingNo);
        if (!carrier || !trackingNo) return sendError(res, 400, "物流公司和物流单号必填。");
        const existingShipment = db.shipments.find((item) => item.orderId === order.id);
        if (existingShipment) {
          if (existingShipment.carrier === carrier && existingShipment.trackingNo === trackingNo) {
            return sendJson(res, 200, { order: orderPayload(db, order), shipment: existingShipment, alreadyProcessed: true });
          }
          return sendError(res, 409, "订单已发货，不能通过重复发货修改物流信息。");
        }
        if (!["paid", "processing"].includes(order.status)) return sendError(res, 409, "只有已收款订单可以发货。");
        const shipment = { id: randomUUID(), orderId: order.id, carrier, trackingNo, status: "shipped", shippedAt: now(), deliveredAt: null, createdAt: now(), updatedAt: now() };
        db.shipments.push(shipment);
        const before = orderPayload(db, order);
        order.status = "shipped";
        order.updatedAt = now();
        logAdminOperation(db, req, "ship_order", "order", order.id, before, orderPayload(db, order), body.reason || "订单发货");
        const member = db.users.find((item) => item.id === order.userId);
        if (member?.email) {
          afterCommit(() => sendTrackedEmail({
            kind: "shipment-notification", userId: member.id, recipient: member.email,
            send: () => emailService.sendShipmentNotification({
              to: member.email, name: member.name, orderId: order.id, orderNumber: order.orderNo,
              shipmentId: shipment.id, carrier, trackingNumber: trackingNo
            })
          }));
        }
        await persist();
        return sendJson(res, 200, { order: orderPayload(db, order), shipment });
      }

      const orderStatusMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/status$/);
      if (req.method === "PATCH" && orderStatusMatch) {
        if (!guard("orders:write")) return;
        const order = db.orders.find((item) => item.id === orderStatusMatch[1]);
        if (!order) return sendError(res, 404, "订单不存在。");
        const allowed = ["pending_payment", "paid", "processing", "shipped", "completed", "cancelled", "refunded"];
        if (!allowed.includes(body.status)) return sendError(res, 400, "订单状态不合法。");
        if (body.status === order.status) {
          return sendJson(res, 200, { order: orderPayload(db, order), result: { alreadyProcessed: true } });
        }
        const before = orderPayload(db, order);
        let result = null;
        if (body.status === "cancelled" && order.status === "pending_payment") {
          result = { inventoryReleased: releaseOrderInventory(db, order, "order_cancelled") };
          order.status = "cancelled";
          order.cancelledAt = now();
          order.cancellationReason = cleanText(body.reason || "admin_cancelled");
          order.updatedAt = now();
        } else if (body.status === "processing" && order.status === "paid") {
          order.status = "processing";
          order.updatedAt = now();
        } else {
          return sendError(res, 409, "该状态变更必须使用核款、发货、确认收货、退款或取消的专用操作。");
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
        await persist();
        return sendJson(res, 200, { order: orderPayload(db, order), result });
      }

      if (req.method === "GET" && pathname === "/api/admin/member-tiers") {
        if (!guard("tiers:read")) return;
        return sendJson(res, 200, { tiers: db.memberTiers });
      }

      if (req.method === "POST" && pathname === "/api/admin/member-tiers") {
        if (!guard("tiers:write")) return;
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
        await persist();
        return sendJson(res, 201, { tier });
      }

      const tierMatch = pathname.match(/^\/api\/admin\/member-tiers\/([^/]+)$/);
      if (req.method === "PATCH" && tierMatch) {
        if (!guard("tiers:write")) return;
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
        await persist();
        return sendJson(res, 200, { tier });
      }

      const payMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/pay$/);
      if (req.method === "POST" && payMatch) {
        if (!guard("orders:write")) return;
        const order = db.orders.find((item) => item.id === payMatch[1]);
        if (!order) return sendError(res, 404, "订单不存在。");
        if (order.status !== "pending_payment") {
          const existingPayment = db.payments.find((item) => item.orderId === order.id && item.status === "succeeded");
          if (existingPayment) return sendJson(res, 200, { order: orderPayload(db, order), alreadyProcessed: true });
          return sendError(res, 409, "该订单当前状态不能确认收款。");
        }
        const before = orderPayload(db, order);
        const result = markOrderPaid(db, order, {
          adminId: admin.id,
          reference: body.paymentReference || body.reference,
          paymentAmount: body.paymentAmount ?? order.paidAmount,
          idempotencyKey: idempotencyKey(req, body)
        });
        logAdminOperation(db, req, "confirm_order_paid", "order", order.id, before, orderPayload(db, order), body.reason || "后台确认支付");
        await persist();
        return sendJson(res, 200, {
          order: orderPayload(db, order),
          result,
          member: profilePayload(db, db.users.find((item) => item.id === order.userId))
        });
      }

      const completeMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/complete$/);
      if (req.method === "POST" && completeMatch) {
        if (!guard("orders:write")) return;
        const order = db.orders.find((item) => item.id === completeMatch[1]);
        if (!order) return sendError(res, 404, "订单不存在。");
        const before = orderPayload(db, order);
        const result = settleCompletedOrder(db, order);
        logAdminOperation(db, req, "confirm_order_received", "order", order.id, before, orderPayload(db, order), body.reason || "确认收货结算会员权益");
        await persist();
        return sendJson(res, 200, {
          order: orderPayload(db, order),
          result,
          member: profilePayload(db, db.users.find((item) => item.id === order.userId))
        });
      }

      const refundMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/refund$/);
      if (req.method === "POST" && refundMatch) {
        if (!guard("orders:write")) return;
        const order = db.orders.find((item) => item.id === refundMatch[1]);
        if (!order) return sendError(res, 404, "订单不存在。");
        const before = orderPayload(db, order);
        const result = refundPaidOrder(db, order, {
          reason: body.reason,
          restock: body.restock !== false,
          reference: body.refundReference || body.reference,
          adminId: admin.id
        });
        logAdminOperation(db, req, "refund_order", "order", order.id, before, orderPayload(db, order), body.reason || "后台退款");
        await persist();
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

function bufferedResponse(target) {
  let status = 200;
  let headers = {};
  let body = "";
  return {
    get statusCode() { return status; },
    writeHead(nextStatus, nextHeaders = {}) {
      status = nextStatus;
      headers = { ...headers, ...nextHeaders };
    },
    setHeader(name, value) {
      headers[name] = value;
    },
    end(value = "") {
      body = value;
    },
    flush() {
      target.writeHead(status, headers);
      target.end(body);
    }
  };
}

async function handleApi(req, res, pathname) {
  const startedAt = Date.now();
  const requestId = String(req.headers["x-vercel-id"] || req.headers["x-request-id"] || randomUUID());
  const requestLogger = logger.child({ requestId, method: req.method, pathname });
  const afterCommitTasks = [];
  const afterCommit = (task, options = {}) => afterCommitTasks.push({ task, always: options.always === true });
  const pendingResponse = bufferedResponse(res);
  requestLogger.info("api.start");
  try {
    if (req.method === "GET" && pathname === "/api/health/live") {
      sendJson(pendingResponse, 200, { status: "ok", service: "scent-atoll-api" });
    } else if (activeRepositoryMode === "postgres" && req.method === "GET" && (pathname === "/api/products" || pathname === "/api/sitemap" || /^\/api\/products\/[^/]+$/.test(pathname))) {
      const db = await readProductDb();
      await handleApiWithDb(req, pendingResponse, pathname, db, async () => {}, afterCommit);
    } else if (
      ["POST", "PATCH", "PUT", "DELETE"].includes(req.method)
      || (req.method === "GET" && pathname === "/api/internal/release-expired-reservations")
      || (activeRepositoryMode === "postgres" && new Set([
        "/api/auth/me",
        "/api/member/profile",
        "/api/member/points",
        "/api/member/orders",
        "/api/member/tier-progress",
        "/api/admin/members",
        "/api/admin/orders"
      ]).has(pathname))
    ) {
      try {
        await repository.mutate(async (rawDb) => {
          const db = normalizeDb(rawDb);
          await handleApiWithDb(req, pendingResponse, pathname, db, async () => {}, afterCommit);
          if (pendingResponse.statusCode >= 400) {
            const rollback = new Error("API response requires transaction rollback");
            rollback.pendingResponse = pendingResponse;
            throw rollback;
          }
        });
      } catch (error) {
        if (!error.pendingResponse) throw error;
      }
    } else {
      const db = await readDb();
      await handleApiWithDb(req, pendingResponse, pathname, db, async () => writeDb(db), afterCommit);
    }
    for (const entry of afterCommitTasks) {
      if (pendingResponse.statusCode < 400 || entry.always) await entry.task();
    }
    pendingResponse.flush();
    requestLogger.info("api.done", { durationMs: Date.now() - startedAt });
  } catch (error) {
    await errorReporter.capture(error, { requestId, method: req.method, pathname, durationMs: Date.now() - startedAt });
    if (!res.headersSent) sendError(res, 500, "服务暂时不可用。");
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

export async function handleProductPageRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const slug = cleanText(url.searchParams.get("slug") || url.pathname.split("/").filter(Boolean).at(-1));
    const db = await readProductDb();
    const product = productByIdOrSlug(db, slug);
    if (!product || product.status !== "active") {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex, nofollow" });
      res.end("<!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\"><title>商品不存在 | 馥屿</title><body><h1>商品不存在或已下架</h1><p><a href=\"/shop.html\">返回香水列表</a></p></body></html>");
      return;
    }
    const item = publicProductFromPayload(productPayload(db, product));
    const siteUrl = cleanText(process.env.SITE_URL || process.env.APP_ORIGIN).replace(/\/$/, "");
    const canonical = `${siteUrl}/products/${encodeURIComponent(product.slug)}`;
    const description = item.description || `${item.brand} ${item.name} 商品详情`;
    const template = readFileSync(path.join(publicDir, "product.html"), "utf8");
    const content = `
      <nav class="breadcrumb" aria-label="面包屑"><a href="/index.html">首页</a><span>/</span><a href="/shop.html">香水</a><span>/</span><span>${escapeHtml(item.name)}</span></nav>
      <section class="product-detail">
        <div class="product-gallery"><div class="product-main-image" ${safeImageStyle(item.image)}></div></div>
        <div class="product-purchase"><p class="eyebrow">${escapeHtml(item.brand)} · ${escapeHtml(item.country)}</p><h1>${escapeHtml(item.name)}</h1><p>${escapeHtml(description)}</p>
          <div class="purchase-box"><div><span>价格</span><strong>¥${escapeHtml(item.price)}</strong></div><div><span>容量</span><strong>${escapeHtml(item.volume)}</strong></div><div><span>浓度</span><strong>${escapeHtml(item.concentration)}</strong></div><div><span>库存</span><strong>${escapeHtml(item.stock)}</strong></div></div>
          <p>${escapeHtml(item.buyer)}</p></div>
      </section>`;
    const structuredData = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: item.name,
      description,
      image: item.image ? [item.image] : [],
      brand: { "@type": "Brand", name: item.brand },
      offers: {
        "@type": "Offer", priceCurrency: "CNY", price: String(item.price), url: canonical,
        availability: item.canPurchase ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
      }
    }).replaceAll("<", "\\u003c");
    const html = template
      .replace("<head>", "<head>\n    <base href=\"/\">")
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(item.name)} | 馥屿</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(description)}">`)
      .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapeHtml(canonical)}">`)
      .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeHtml(item.name)} | 馥屿">`)
      .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeHtml(description)}">`)
      .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${escapeHtml(canonical)}">`)
      .replace(/<main id="main"[^>]*>[\s\S]*?<\/main>/, `<main id="main" class="page-shell" data-product-page data-entry-id="${escapeHtml(product.slug)}">${content}</main>`)
      .replace("</head>", `    <script type="application/ld+json">${structuredData}</script>\n  </head>`);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "public, s-maxage=60, stale-while-revalidate=300" });
    res.end(html);
  } catch (error) {
    await errorReporter.capture(error, { operation: "render_product_page" });
    sendError(res, 500, "商品页暂时不可用。");
  }
}

export async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (/^\/products\/[^/]+\/?$/.test(url.pathname)) {
    await handleProductPageRequest(req, res);
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url.pathname);
    return;
  }
  await serveStatic(req, res, url.pathname);
}

const server = createServer(handleRequest);

export { server };

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  server.listen(port, () => {
    console.log(`Scent Atoll server running at http://localhost:${port}`);
    console.log(`Admin login: ${seedAdminEmail}`);
  });
}
