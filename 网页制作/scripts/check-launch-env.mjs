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
