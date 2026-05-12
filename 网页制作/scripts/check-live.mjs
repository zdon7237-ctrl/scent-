import { loadProductionEnv } from "./load-env.mjs";
import vm from "node:vm";

loadProductionEnv();

const rawBaseUrl = process.argv[2] || process.env.SITE_URL || "";
const baseUrl = normalizeBaseUrl(rawBaseUrl);

const publicHtmlPaths = [
  "/",
  "/shop.html",
  "/product.html",
  "/brands.html",
  "/brand.html",
  "/samples.html",
  "/journal.html",
  "/article.html",
  "/about.html",
  "/service.html",
  "/payment.html",
  "/privacy.html",
  "/terms.html",
  "/cart.html",
  "/404.html"
];

const privatePaths = [
  "/admin.html",
  "/account.html",
  "/login.html",
  "/register.html",
  "/member.html",
  "/membership.html",
  "/checkout.html",
  "/orders.html",
  "/points.html",
  "/points-mall.html",
  "/points-item.html",
  "/points-redemptions.html"
];

const unknownPaths = [
  "/__scent-atoll-missing-page-check.html"
];

const noindexHtmlPaths = new Set([
  "/product.html",
  "/brand.html",
  "/article.html",
  "/cart.html",
  "/404.html"
]);

const publicSitemapPaths = [
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

const forbiddenLaunchText = [
  /scent-atoll\.example\.com/,
  /hello@scent-atoll\.example\.com/,
  /上线前填写/,
  /你的(?:正式域名|客服邮箱|客服微信|经营主体名称|预约方式)/,
  /\/api\/checkout\b/,
  /\/api\/admin\b/,
  /dev-admin/i,
  /x-admin/i
];

const expectedHeaders = [
  ["x-frame-options", /deny/i],
  ["x-content-type-options", /nosniff/i],
  ["strict-transport-security", /max-age=31536000/i],
  ["referrer-policy", /strict-origin-when-cross-origin/i],
  ["permissions-policy", /camera=\(\).*microphone=\(\).*geolocation=\(\).*payment=\(\)/i],
  ["content-security-policy", /default-src 'self'/i]
];

const defaultRenderedLaunchValues = {
  BUSINESS_NAME: "馥屿 Scent Atoll",
  STUDIO_BOOKING: "通过客服微信预约",
  CUSTOMER_HOURS: "12:00 - 20:00"
};

const requiredLiveEnv = [
  "CONTACT_EMAIL",
  "CONTACT_WECHAT"
];

const failures = [];
const shareImageUrls = new Set();
let livePublicHtml = "";

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function baseUrlIssue(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:") return "SITE_URL should use https:// for the production live check.";
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

function pageUrl(path) {
  return `${baseUrl}${path}`;
}

async function request(path) {
  try {
    return await fetch(pageUrl(path), { redirect: "manual" });
  } catch (error) {
    failures.push(`Request failed for ${path}: ${error.message}`);
    return null;
  }
}

function metaContent(html, pattern) {
  return html.match(pattern)?.[1]?.trim() || "";
}

function envValue(name) {
  return String(process.env[name] || "").trim();
}

function hasPlaceholder(text) {
  return /example\.com|上线前填写|你的/.test(String(text || ""));
}

function isEmail(text) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(text || "").trim());
}

function isHttpsUrl(text) {
  return /^https:\/\/[^/\s]+(?:\/[^\s]*)?$/i.test(String(text || "").trim());
}

function isImageUrl(text) {
  return /\.(?:png|jpe?g|webp)(?:[?#].*)?$/i.test(String(text || "").trim());
}

function htmlEscaped(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function liveHtmlIncludes(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return livePublicHtml.includes(text) || livePublicHtml.includes(htmlEscaped(text));
}

function requiredMeta(html, path) {
  const checks = [
    [/<title>[^<]+<\/title>/i, "title"],
    [/<meta\s+name=["']description["']\s+content=["'][^"']+["']/i, "meta description"],
    [/<link\s+rel=["']canonical["']\s+href=["']https?:\/\/[^"']+["']/i, "canonical"],
    [/<meta\s+property=["']og:title["']\s+content=["'][^"']+["']/i, "og:title"],
    [/<meta\s+property=["']og:description["']\s+content=["'][^"']+["']/i, "og:description"],
    [/<meta\s+property=["']og:url["']\s+content=["']https?:\/\/[^"']+["']/i, "og:url"],
    [/<meta\s+property=["']og:image["']\s+content=["']https?:\/\/[^"']+["']/i, "og:image"],
    [/<meta\s+property=["']og:image:width["']\s+content=["']1200["']/i, "og:image:width"],
    [/<meta\s+property=["']og:image:height["']\s+content=["']630["']/i, "og:image:height"],
    [/<meta\s+property=["']og:image:type["']\s+content=["']image\/(?:png|jpeg|webp)["']/i, "og:image:type"],
    [/<meta\s+name=["']twitter:card["']\s+content=["']summary_large_image["']/i, "twitter:card"],
    [/<meta\s+name=["']twitter:title["']\s+content=["'][^"']+["']/i, "twitter:title"],
    [/<meta\s+name=["']twitter:description["']\s+content=["'][^"']+["']/i, "twitter:description"],
    [/<meta\s+name=["']twitter:image["']\s+content=["']https?:\/\/[^"']+["']/i, "twitter:image"]
  ];

  for (const [pattern, label] of checks) {
    if (!pattern.test(html)) failures.push(`Missing ${label} on ${path}`);
  }

  const expectedUrl = `${baseUrl}${path}`;
  const canonical = metaContent(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  const ogUrl = metaContent(html, /<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i);
  if (canonical && canonical !== expectedUrl) {
    failures.push(`Canonical URL mismatch on ${path}: expected ${expectedUrl}, got ${canonical}`);
  }
  if (ogUrl && ogUrl !== expectedUrl) {
    failures.push(`Open Graph URL mismatch on ${path}: expected ${expectedUrl}, got ${ogUrl}`);
  }

  const ogImage = metaContent(html, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  const twitterImage = metaContent(html, /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
  if (ogImage && twitterImage && ogImage !== twitterImage) {
    failures.push(`Open Graph and Twitter image URLs differ on ${path}: ${ogImage} vs ${twitterImage}`);
  }
  for (const imageUrl of [ogImage, twitterImage]) {
    if (imageUrl && /^https:\/\//i.test(imageUrl)) shareImageUrls.add(imageUrl);
  }
}

function checkSecurityHeaders(response) {
  for (const [name, pattern] of expectedHeaders) {
    const value = response.headers.get(name) || "";
    if (!pattern.test(value)) failures.push(`Missing or weak security header ${name}`);
  }
}

function checkNoindexHeader(response, path) {
  const value = response.headers.get("x-robots-tag") || "";
  if (!/noindex/i.test(value) || !/nofollow/i.test(value)) {
    failures.push(`Missing X-Robots-Tag noindex,nofollow header on ${path}`);
  }
}

async function checkShareImage(imageUrl) {
  try {
    const response = await fetch(imageUrl, { redirect: "follow" });
    if (!response.ok) {
      failures.push(`Share image ${imageUrl} returned ${response.status}`);
      return;
    }
    const contentType = response.headers.get("content-type") || "";
    if (!/^image\//i.test(contentType)) {
      failures.push(`Share image ${imageUrl} returned non-image content-type: ${contentType || "missing"}`);
    }
    await response.body?.cancel?.();
  } catch (error) {
    failures.push(`Share image request failed for ${imageUrl}: ${error.message}`);
  }
}

async function liveCatalogSitemapPaths() {
  const response = await request("/data.js");
  if (!response) return [];
  if (response.status !== 200) {
    failures.push(`Expected /data.js to return 200, got ${response.status}`);
    return [];
  }
  try {
    const source = await response.text();
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: "data.js" });
    const data = sandbox.window.SA_DATA || {};
    return [
      ...(data.products || []).filter((item) => item.id).map((item) => `/product-${encodeURIComponent(item.id)}.html`),
      ...(data.brands || []).filter((item) => item.id).map((item) => `/brand-${encodeURIComponent(item.id)}.html`),
      ...(data.articles || []).filter((item) => item.id).map((item) => `/article-${encodeURIComponent(item.id)}.html`)
    ];
  } catch (error) {
    failures.push(`Unable to parse /data.js for live sitemap checks: ${error.message}`);
    return [];
  }
}

if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
  console.error("Usage: SITE_URL=https://your-domain.example CONTACT_EMAIL=hello@example.com CONTACT_WECHAT=wechat-id npm run check:live");
  console.error("Or: CONTACT_EMAIL=hello@example.com CONTACT_WECHAT=wechat-id npm run check:live -- https://your-domain.example");
  process.exit(1);
}

if (baseUrl.includes("example.com")) {
  failures.push("SITE_URL still uses example.com; run live checks against the production domain.");
}

if (/你的|上线前填写/.test(baseUrl)) {
  failures.push("SITE_URL still contains placeholder text; run live checks against the production domain.");
}

const originIssue = baseUrlIssue(rawBaseUrl);
if (originIssue) failures.push(originIssue);

for (const name of requiredLiveEnv) {
  if (!envValue(name)) failures.push(`${name} is required for live launch checks.`);
}

for (const name of ["CONTACT_EMAIL", "CONTACT_WECHAT", "BUSINESS_NAME", "STUDIO_BOOKING", "CUSTOMER_HOURS"]) {
  const current = envValue(name);
  if (current && hasPlaceholder(current)) failures.push(`${name} still contains placeholder text.`);
}

const contactEmail = envValue("CONTACT_EMAIL");
if (contactEmail && !isEmail(contactEmail)) failures.push("CONTACT_EMAIL must be a valid email address.");

const expectedOgImage = envValue("OG_IMAGE");
if (expectedOgImage) {
  if (hasPlaceholder(expectedOgImage)) failures.push("OG_IMAGE still contains placeholder text.");
  if (!isHttpsUrl(expectedOgImage) || !isImageUrl(expectedOgImage)) {
    failures.push("OG_IMAGE must be a production https:// PNG, JPG, or WebP image URL.");
  }
}

if (failures.length) {
  console.error("Live launch check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const home = await request("/");
if (home) {
  if (home.status !== 200) failures.push(`Expected / to return 200, got ${home.status}`);
  checkSecurityHeaders(home);
}

const liveCatalogPaths = await liveCatalogSitemapPaths();

for (const path of [...publicHtmlPaths, ...liveCatalogPaths]) {
  const response = await request(path);
  if (!response) continue;
  if (path === "/404.html") {
    if (![200, 404].includes(response.status)) failures.push(`Expected ${path} to return 200 or 404, got ${response.status}`);
  } else if (response.status !== 200) {
    failures.push(`Expected ${path} to return 200, got ${response.status}`);
  }

  const html = await response.text();
  livePublicHtml += `\n${html}`;
  requiredMeta(html, path);
  for (const pattern of forbiddenLaunchText) {
    if (pattern.test(html)) failures.push(`Forbidden launch text ${pattern} found on ${path}`);
  }
  if (noindexHtmlPaths.has(path) && !/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) {
    failures.push(`Missing noindex on ${path}`);
  }
  if (path === "/404.html" || path === "/cart.html") {
    checkNoindexHeader(response, path);
  }
}

for (const path of privatePaths) {
  const response = await request(path);
  if (!response) continue;
  if (response.status !== 404) failures.push(`Expected private path ${path} to return 404, got ${response.status}`);
}

for (const path of unknownPaths) {
  const response = await request(path);
  if (!response) continue;
  if (response.status !== 404) failures.push(`Expected unknown path ${path} to return 404, got ${response.status}`);
}

const robots = await request("/robots.txt");
if (robots) {
  if (robots.status !== 200) failures.push(`Expected /robots.txt to return 200, got ${robots.status}`);
  const text = await robots.text();
  if (!text.includes(`Sitemap: ${baseUrl}/sitemap.xml`)) failures.push("robots.txt does not point to the production sitemap URL.");
}

const sitemap = await request("/sitemap.xml");
if (sitemap) {
  if (sitemap.status !== 200) failures.push(`Expected /sitemap.xml to return 200, got ${sitemap.status}`);
  const text = await sitemap.text();
  for (const path of [...publicSitemapPaths, ...liveCatalogPaths]) {
    if (!text.includes(`${baseUrl}${path}`)) failures.push(`Missing ${path} from sitemap.xml`);
  }
  for (const path of privatePaths) {
    if (text.includes(path)) failures.push(`Private path ${path} found in sitemap.xml`);
  }
}

for (const imageUrl of shareImageUrls) {
  await checkShareImage(imageUrl);
}

if (expectedOgImage && !shareImageUrls.has(expectedOgImage)) {
  failures.push("OG_IMAGE is set but was not used by the live Open Graph or Twitter metadata.");
}
if (expectedOgImage) {
  for (const imageUrl of shareImageUrls) {
    if (imageUrl !== expectedOgImage) {
      failures.push(`Live share metadata uses ${imageUrl}, but OG_IMAGE is set to ${expectedOgImage}.`);
    }
  }
}

const renderedLaunchValues = {
  CONTACT_EMAIL: envValue("CONTACT_EMAIL"),
  CONTACT_WECHAT: envValue("CONTACT_WECHAT"),
  BUSINESS_NAME: envValue("BUSINESS_NAME") || defaultRenderedLaunchValues.BUSINESS_NAME,
  STUDIO_BOOKING: envValue("STUDIO_BOOKING") || defaultRenderedLaunchValues.STUDIO_BOOKING,
  CUSTOMER_HOURS: envValue("CUSTOMER_HOURS") || defaultRenderedLaunchValues.CUSTOMER_HOURS
};

for (const [name, current] of Object.entries(renderedLaunchValues)) {
  if (current && !liveHtmlIncludes(current)) {
    failures.push(`${name} is set but was not found on the live public pages.`);
  }
}

if (failures.length) {
  console.error("Live launch check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Live launch check passed for ${baseUrl}`);
