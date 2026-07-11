import { loadProductionEnv } from "./load-env.mjs";

loadProductionEnv();

const requiredEnv = [
  "SITE_URL",
  "CONTACT_EMAIL",
  "CONTACT_WECHAT"
];

const optionalEnv = [
  "BUSINESS_NAME",
  "STUDIO_BOOKING"
];

const commercialRuntimeEnv = [
  "DATABASE_URL",
  "APP_ORIGIN",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "BLOB_READ_WRITE_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "CRON_SECRET"
];

const dataResidencyDecisions = new Set([
  "cross_border_approved",
  "domestic_infrastructure"
]);

const wechatPayEnv = [
  "WECHAT_PAY_MCH_ID",
  "WECHAT_PAY_APP_ID",
  "WECHAT_PAY_MERCHANT_SERIAL_NUMBER",
  "WECHAT_PAY_MERCHANT_PRIVATE_KEY",
  "WECHAT_PAY_API_V3_KEY",
  "WECHAT_PAY_NOTIFY_URL",
  "WECHAT_PAY_PLATFORM_SERIAL_NUMBER",
  "WECHAT_PAY_PLATFORM_PUBLIC_KEY"
];

const failures = [];
const warnings = [];

function value(name) {
  return String(process.env[name] || "").trim();
}

function hasPlaceholder(text) {
  return /example\.com|上线前填写|你的/.test(text);
}

function isHttpsUrl(text) {
  return /^https:\/\/[^/\s]+(?:\/[^\s]*)?$/i.test(text);
}

function siteUrlIssue(text) {
  try {
    const url = new URL(text);
    if (url.protocol !== "https:") return "SITE_URL must use https://.";
    if (url.username || url.password) return "SITE_URL must not include username or password.";
    if (!url.hostname) return "SITE_URL must include a hostname.";
    if (!["", "/"].includes(url.pathname) || url.search || url.hash) {
      return "SITE_URL must be the production origin only, without a path, query string, or hash.";
    }
    return "";
  } catch {
    return "SITE_URL must be a valid production https:// URL.";
  }
}

function isEmail(text) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

function emailAddress(text) {
  return text.match(/<([^<>]+)>$/)?.[1]?.trim() || text;
}

function isImageUrl(text) {
  return /\.(?:png|jpe?g|webp)(?:[?#].*)?$/i.test(text);
}

for (const name of requiredEnv) {
  const current = value(name);
  if (!current) {
    failures.push(`${name} is required.`);
    continue;
  }
  if (hasPlaceholder(current)) failures.push(`${name} still contains placeholder text.`);
}

for (const name of optionalEnv) {
  const current = value(name);
  if (current && hasPlaceholder(current)) failures.push(`${name} still contains placeholder text.`);
}

const siteUrl = value("SITE_URL");
const siteIssue = siteUrl ? siteUrlIssue(siteUrl) : "";
if (siteIssue) failures.push(siteIssue);
if (siteUrl.endsWith("/")) warnings.push("SITE_URL should omit the trailing slash; the build will trim it automatically.");

const contactEmail = value("CONTACT_EMAIL");
if (contactEmail && !isEmail(contactEmail)) failures.push("CONTACT_EMAIL must be a valid email address.");

const ogImage = value("OG_IMAGE");
if (ogImage) {
  if (hasPlaceholder(ogImage)) failures.push("OG_IMAGE still contains placeholder text.");
  if (!isHttpsUrl(ogImage) || !isImageUrl(ogImage)) {
    failures.push("OG_IMAGE must be a production https:// PNG, JPG, or WebP image URL.");
  }
}

const customerHours = value("CUSTOMER_HOURS");
if (customerHours && hasPlaceholder(customerHours)) failures.push("CUSTOMER_HOURS still contains placeholder text.");

const vercelEnvironment = value("VERCEL_ENV");
const deploymentEnvironment = value("DEPLOYMENT_ENV");
const commercialEnvironment = vercelEnvironment || deploymentEnvironment;

if (vercelEnvironment && !["production", "preview", "development"].includes(vercelEnvironment)) {
  failures.push("VERCEL_ENV must be production, preview, or development when set.");
}

if (deploymentEnvironment && !["production", "preview", "development"].includes(deploymentEnvironment)) {
  failures.push("DEPLOYMENT_ENV must be production, preview, or development when set.");
}

if (vercelEnvironment && deploymentEnvironment && vercelEnvironment !== deploymentEnvironment) {
  failures.push(`DEPLOYMENT_ENV must match VERCEL_ENV (${vercelEnvironment}).`);
}

if (["production", "preview"].includes(commercialEnvironment)) {
  if (!deploymentEnvironment) {
    failures.push("DEPLOYMENT_ENV is required for production and preview deployments.");
  }

  for (const name of commercialRuntimeEnv) {
    const current = value(name);
    if (!current) {
      failures.push(`${name} is required for ${commercialEnvironment} deployments.`);
    } else if (hasPlaceholder(current)) {
      failures.push(`${name} still contains placeholder text.`);
    }
  }

  const databaseUrl = value("DATABASE_URL");
  if (databaseUrl && !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    failures.push("DATABASE_URL must be a PostgreSQL connection URL.");
  }

  const appOrigin = value("APP_ORIGIN");
  const appOriginIssue = appOrigin ? siteUrlIssue(appOrigin).replaceAll("SITE_URL", "APP_ORIGIN") : "";
  if (appOriginIssue) failures.push(appOriginIssue);
  if (commercialEnvironment === "production" && appOrigin && siteUrl && appOrigin.replace(/\/$/, "") !== siteUrl.replace(/\/$/, "")) {
    failures.push("APP_ORIGIN must equal SITE_URL in production.");
  }

  const redisUrl = value("UPSTASH_REDIS_REST_URL");
  if (redisUrl && !isHttpsUrl(redisUrl)) {
    failures.push("UPSTASH_REDIS_REST_URL must be an https:// URL.");
  }

  const cronSecret = value("CRON_SECRET");
  if (cronSecret && cronSecret.length < 32) {
    failures.push("CRON_SECRET must contain at least 32 characters.");
  }

  const fromAddress = emailAddress(value("EMAIL_FROM"));
  if (fromAddress && !isEmail(fromAddress)) failures.push("EMAIL_FROM must contain a valid email address.");

  if (commercialEnvironment === "production" && !value("BUSINESS_NAME")) {
    failures.push("BUSINESS_NAME is required for production commerce and must identify the real operating entity.");
  }
  if (commercialEnvironment === "production" && !dataResidencyDecisions.has(value("DATA_RESIDENCY_DECISION"))) {
    failures.push("DATA_RESIDENCY_DECISION must be cross_border_approved or domestic_infrastructure for production commerce.");
  }

  if (commercialEnvironment === "production" && (value("SEED_ADMIN_EMAIL") || value("SEED_ADMIN_PASSWORD"))) {
    failures.push("Production must not define SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD; create the initial owner with the one-time bootstrap flow.");
  }
  if (value("PAYMENT_WEBHOOK_SECRET")) {
    failures.push("Production and Preview must not define PAYMENT_WEBHOOK_SECRET; the development payment webhook is disabled on Vercel.");
  }
}

const errorWebhookUrl = value("ERROR_WEBHOOK_URL");
const errorWebhookToken = value("ERROR_WEBHOOK_TOKEN");
if (Boolean(errorWebhookUrl) !== Boolean(errorWebhookToken)) {
  failures.push("ERROR_WEBHOOK_URL and ERROR_WEBHOOK_TOKEN must either both be set or both be omitted.");
}
if (errorWebhookUrl && !isHttpsUrl(errorWebhookUrl)) failures.push("ERROR_WEBHOOK_URL must be an https:// URL.");

const wechatPayEnabled = value("WECHAT_PAY_ENABLED").toLowerCase();
if (wechatPayEnabled && !["true", "false"].includes(wechatPayEnabled)) {
  failures.push("WECHAT_PAY_ENABLED must be true or false when set.");
}
if (wechatPayEnabled === "true") {
  for (const name of wechatPayEnv) {
    const current = value(name);
    if (!current) failures.push(`${name} is required when WECHAT_PAY_ENABLED=true.`);
    else if (hasPlaceholder(current)) failures.push(`${name} still contains placeholder text.`);
  }
  const notifyUrl = value("WECHAT_PAY_NOTIFY_URL");
  if (notifyUrl && !isHttpsUrl(notifyUrl)) failures.push("WECHAT_PAY_NOTIFY_URL must be an https:// URL.");
}

if (warnings.length) {
  console.warn("Launch environment warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (failures.length) {
  console.error("Launch environment check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Launch environment check passed.");
