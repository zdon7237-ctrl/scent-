import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { loadProductionEnv } from "./load-env.mjs";
import { projectRoot } from "./paths.mjs";

loadProductionEnv();
const outputDir = process.env.PUBLIC_OUTPUT_DIR || "dist-public";
const outputPath = path.resolve(projectRoot, outputDir);
const requireLaunchInfo = process.env.REQUIRE_LAUNCH_INFO === "1" || process.argv.includes("--strict");
let expectedSiteUrl = trimTrailingSlash(String(process.env.SITE_URL || "").trim());

const requiredFiles = [
  "index.html",
  "shop.html",
  "product.html",
  "brands.html",
  "brand.html",
  "samples.html",
  "journal.html",
  "article.html",
  "about.html",
  "service.html",
  "payment.html",
  "privacy.html",
  "terms.html",
  "cart.html",
  "404.html",
  "robots.txt",
  "sitemap.xml",
  "og-image.png",
  "styles.css",
  "script.js",
  "data.js",
  "_headers",
  "_redirects"
];

const forbiddenFiles = [
  "admin.html",
  "account.html",
  "login.html",
  "register.html",
  "member.html",
  "membership.html",
  "checkout.html",
  "verify-email.html",
  "reset-password.html",
  "orders.html",
  "points.html",
  "points-mall.html",
  "points-item.html",
  "points-redemptions.html",
  "assets/js/admin-client.js",
  "assets/js/auth-client.js",
  "assets/js/member-client.js",
  "assets/js/points-mall-client.js"
];

const forbiddenPathPatterns = [
  /^(?:admin|account|login|register|member|membership|checkout|verify-email|reset-password|orders|points)(?:[-.]|$)/,
  /^assets\/js\//
];

const privateHtmlFiles = [
  "admin.html",
  "account.html",
  "login.html",
  "register.html",
  "member.html",
  "membership.html",
  "checkout.html",
  "verify-email.html",
  "reset-password.html",
  "orders.html",
  "points.html",
  "points-mall.html",
  "points-item.html",
  "points-redemptions.html"
];

const noindexHtmlFiles = new Set([
  "404.html",
  "cart.html",
  "product.html",
  "brand.html",
  "article.html"
]);

const sitemapPublicFiles = [
  "",
  "shop.html",
  "brands.html",
  "samples.html",
  "journal.html",
  "about.html",
  "service.html",
  "payment.html",
  "privacy.html",
  "terms.html"
];

const forbiddenPatterns = [
  /\/api\/checkout\b/,
  /\/api\/admin\b/,
  /\/api\/orders\b/,
  /x-admin/i,
  /dev-admin/i,
  /startCheckout/,
  /quoteCheckout/,
  /前往结账/,
  /加入购物车/
];

const warningPatterns = [
  /scent-atoll\.example\.com/,
  /上线前填写/,
  /hello@scent-atoll\.example\.com/,
  /你的(?:正式域名|客服邮箱|客服微信|经营主体名称|预约方式)/
];

const requiredLaunchEnv = [
  "SITE_URL",
  "CONTACT_EMAIL",
  "CONTACT_WECHAT"
];

const defaultRenderedLaunchValues = {
  BUSINESS_NAME: "馥屿 Scent Atoll",
  STUDIO_BOOKING: "通过客服微信预约"
};

const expectedHeaderRules = [
  "X-Frame-Options: DENY",
  "X-Content-Type-Options: nosniff",
  "Strict-Transport-Security: max-age=31536000",
  "Referrer-Policy: strict-origin-when-cross-origin",
  "Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy: default-src 'self'"
];

const expectedNoindexHeaderRules = [
  "/cart.html",
  "/404.html",
  "X-Robots-Tag: noindex, nofollow"
];

const expectedRedirectRules = [
  "/product-*.html /products/:splat 301!",
  "/products/* /product.html?id=:splat 200",
  ...privateHtmlFiles.map((file) => `/${file} /404.html 404`),
  "/* /404.html 404"
];

const failures = [];
const warnings = [];
let publicFiles = [];
let catalogPublicFiles = [];
let searchablePublicText = "";

async function exists(relativePath) {
  try {
    await stat(path.join(outputPath, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(prefix, entry.name);
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath, relativePath));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

function isExternalReference(reference) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(reference);
}

function localTarget(reference) {
  if (!reference || isExternalReference(reference)) return "";
  const cleanReference = reference.split("#")[0].split("?")[0];
  if (!cleanReference) return "";
  return cleanReference.replace(/^\/+/, "");
}

function tagContent(text, pattern) {
  return text.match(pattern)?.[1]?.trim() || "";
}

function envValue(name) {
  return String(process.env[name] || "").trim();
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function pagePathForFile(file) {
  return file === "index.html" ? "/" : `/${file}`;
}

function siteUrlFromCanonical(canonical) {
  try {
    const url = new URL(canonical);
    return url.origin;
  } catch {
    return "";
  }
}

function hasRobotsDirective(text, directive) {
  const robots = tagContent(text, /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  return robots.toLowerCase().split(",").map((item) => item.trim()).includes(directive);
}

function isHttpsUrl(value) {
  return /^https:\/\/[^/\s]+(?:\/[^\s]*)?$/i.test(String(value || "").trim());
}

function siteUrlIssue(value) {
  try {
    const url = new URL(String(value || "").trim());
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

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isImageUrl(value) {
  return /\.(?:png|jpe?g|webp)(?:[?#].*)?$/i.test(String(value || "").trim());
}

function htmlEscaped(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function outputIncludes(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return searchablePublicText.includes(text) || searchablePublicText.includes(htmlEscaped(text));
}

async function catalogSitemapFiles() {
  if (!await exists("data.js")) return [];
  const source = await readFile(path.join(outputPath, "data.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: path.join(outputPath, "data.js") });
  const data = sandbox.window.SA_DATA || {};
  return [
    ...(data.products || []).filter((item) => item.id).map((item) => `product-${encodeURIComponent(item.id)}.html`),
    ...(data.brands || []).filter((item) => item.id).map((item) => `brand-${encodeURIComponent(item.id)}.html`),
    ...(data.articles || []).filter((item) => item.id).map((item) => `article-${encodeURIComponent(item.id)}.html`)
  ];
}

function flatHeaderBlock(text, source) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === source);
  if (start === -1) return "";
  const block = [lines[start]];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\S/.test(line) && line.trim().startsWith("/")) break;
    block.push(line);
  }
  return block.join("\n");
}

async function pngSize(relativePath) {
  const png = await readFile(path.join(outputPath, relativePath));
  const signature = "89504e470d0a1a0a";
  if (png.subarray(0, 8).toString("hex") !== signature) return null;
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20)
  };
}

if (!await exists(".")) {
  failures.push(`${outputDir}/ does not exist. Run npm run build:public first.`);
} else {
  for (const file of requiredFiles) {
    if (!await exists(file)) failures.push(`Missing required public file: ${file}`);
  }

  for (const file of forbiddenFiles) {
    if (await exists(file)) failures.push(`Forbidden private file in public build: ${file}`);
  }

  publicFiles = await listFiles(outputPath);
  const publicFileSet = new Set(publicFiles);
  catalogPublicFiles = await catalogSitemapFiles();
  for (const file of catalogPublicFiles) {
    if (!publicFileSet.has(file)) failures.push(`Missing catalog detail page in public build: ${file}`);
  }
  for (const file of publicFiles) {
    const normalizedFile = file.split(path.sep).join("/");
    for (const pattern of forbiddenPathPatterns) {
      if (pattern.test(normalizedFile)) failures.push(`Forbidden private path in public build: ${normalizedFile}`);
    }
  }
  const scanFiles = publicFiles.filter((file) => /\.(html|js|txt|xml|json|css|svg)$/.test(file) || file === "_headers" || file === "_redirects");

  if (!expectedSiteUrl && publicFileSet.has("index.html")) {
    const homeText = await readFile(path.join(outputPath, "index.html"), "utf8");
    expectedSiteUrl = siteUrlFromCanonical(tagContent(homeText, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i));
  }

  if (publicFileSet.has("og-image.png")) {
    const size = await pngSize("og-image.png");
    if (!size || size.width !== 1200 || size.height !== 630) {
      failures.push("og-image.png must be a 1200x630 PNG image.");
    }
  }

  for (const file of scanFiles) {
    const text = await readFile(path.join(outputPath, file), "utf8");
    searchablePublicText += `\n${text}`;
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(text)) failures.push(`Forbidden launch pattern ${pattern} found in ${file}`);
    }
    for (const pattern of warningPatterns) {
      if (pattern.test(text)) warnings.push(`Launch info placeholder ${pattern} found in ${file}`);
    }

    if (file.endsWith(".html")) {
      const title = tagContent(text, /<title>([^<]+)<\/title>/i);
      const description = tagContent(text, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
      const canonical = tagContent(text, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
      const ogTitle = tagContent(text, /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
      const ogDescription = tagContent(text, /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
      const ogUrl = tagContent(text, /<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i);
      const ogImage = tagContent(text, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      const ogImageWidth = tagContent(text, /<meta\s+property=["']og:image:width["']\s+content=["']([^"']+)["']/i);
      const ogImageHeight = tagContent(text, /<meta\s+property=["']og:image:height["']\s+content=["']([^"']+)["']/i);
      const ogImageType = tagContent(text, /<meta\s+property=["']og:image:type["']\s+content=["']([^"']+)["']/i);
      const twitterCard = tagContent(text, /<meta\s+name=["']twitter:card["']\s+content=["']([^"']+)["']/i);
      const twitterTitle = tagContent(text, /<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i);
      const twitterDescription = tagContent(text, /<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i);
      const twitterImage = tagContent(text, /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);

      if (!title) failures.push(`Missing title in ${file}`);
      if (!description) failures.push(`Missing meta description in ${file}`);
      if (!canonical || !/^https?:\/\//.test(canonical)) failures.push(`Missing absolute canonical URL in ${file}`);
      if (canonical && canonical !== `${expectedSiteUrl}${pagePathForFile(file)}`) {
        failures.push(`Canonical URL mismatch in ${file}: expected ${expectedSiteUrl}${pagePathForFile(file)}, got ${canonical}`);
      }
      if (!ogTitle || !ogDescription || !ogUrl || !ogImage) failures.push(`Missing Open Graph metadata in ${file}`);
      if (ogUrl && ogUrl !== `${expectedSiteUrl}${pagePathForFile(file)}`) {
        failures.push(`Open Graph URL mismatch in ${file}: expected ${expectedSiteUrl}${pagePathForFile(file)}, got ${ogUrl}`);
      }
      if (ogImageWidth !== "1200" || ogImageHeight !== "630" || !/^image\/(?:png|jpeg|webp)$/.test(ogImageType)) {
        failures.push(`Missing 1200x630 Open Graph image metadata in ${file}`);
      }
      if (!twitterCard || !twitterTitle || !twitterDescription || !twitterImage) failures.push(`Missing Twitter card metadata in ${file}`);
      if (twitterCard !== "summary_large_image") failures.push(`Twitter card should be summary_large_image in ${file}`);
      if (noindexHtmlFiles.has(file) && !hasRobotsDirective(text, "noindex")) failures.push(`Missing noindex robots directive in ${file}`);

      const references = text.matchAll(/<(?:a|link|script|img|source)\b[^>]*\s(?:href|src)=["']([^"']+)["']/gi);
      for (const match of references) {
        const target = localTarget(match[1]);
        if (!target) continue;
        const normalizedTarget = target.endsWith("/") ? `${target}index.html` : target;
        if (!publicFileSet.has(normalizedTarget)) {
          failures.push(`Broken local reference from ${file} to ${match[1]}`);
        }
      }
    }

    if (file.endsWith(".css")) {
      const references = text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi);
      for (const match of references) {
        const target = localTarget(match[1]);
        if (!target) continue;
        const normalizedTarget = target.endsWith("/") ? `${target}index.html` : target;
        if (!publicFileSet.has(normalizedTarget)) {
          failures.push(`Broken local CSS reference from ${file} to ${match[1]}`);
        }
      }
    }
  }

  if (publicFileSet.has("sitemap.xml")) {
    const sitemapText = await readFile(path.join(outputPath, "sitemap.xml"), "utf8");
    for (const file of [...sitemapPublicFiles, ...catalogPublicFiles]) {
      const productMatch = file.match(/^product-(.+)\.html$/);
      const expectedPath = productMatch ? `/products/${productMatch[1]}` : (file ? `/${file}` : "/");
      if (!sitemapText.includes(expectedPath)) failures.push(`Missing ${expectedPath} from sitemap.xml`);
    }
    if (/\/product-[^<]+\.html/.test(sitemapText)) failures.push("Legacy product detail URL found in sitemap.xml");
    for (const file of privateHtmlFiles) {
      if (sitemapText.includes(`/${file}`)) failures.push(`Private page ${file} found in sitemap.xml`);
    }
  }

  if (publicFileSet.has("_headers")) {
    const headersText = await readFile(path.join(outputPath, "_headers"), "utf8");
    for (const rule of expectedHeaderRules) {
      if (!headersText.includes(rule)) failures.push(`Missing security header rule in _headers: ${rule}`);
    }
    for (const rule of expectedNoindexHeaderRules) {
      if (!headersText.includes(rule)) failures.push(`Missing noindex header rule in _headers: ${rule}`);
    }
    for (const source of ["/cart.html", "/404.html"]) {
      const block = flatHeaderBlock(headersText, source);
      if (!block) {
        failures.push(`Missing ${source} header block in _headers`);
        continue;
      }
      for (const rule of expectedHeaderRules) {
        if (!block.includes(rule)) failures.push(`Missing security header rule in _headers ${source}: ${rule}`);
      }
      if (!block.includes("X-Robots-Tag: noindex, nofollow")) {
        failures.push(`Missing noindex header rule in _headers ${source}: X-Robots-Tag: noindex, nofollow`);
      }
    }
  }

  if (publicFileSet.has("_redirects")) {
    const redirectsText = await readFile(path.join(outputPath, "_redirects"), "utf8");
    for (const rule of expectedRedirectRules) {
      if (!redirectsText.includes(rule)) failures.push(`Missing redirect rule in _redirects: ${rule}`);
    }
  }
}

if (warnings.length) {
  console.warn("Public build warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

for (const name of [...requiredLaunchEnv, ...Object.keys(defaultRenderedLaunchValues)]) {
  const value = envValue(name);
  if (value && /example\.com|上线前填写|你的/.test(value)) failures.push(`${name} still contains placeholder text.`);
}
const providedSiteUrl = envValue("SITE_URL");
const siteIssue = providedSiteUrl ? siteUrlIssue(providedSiteUrl) : "";
if (siteIssue) {
  failures.push(siteIssue);
}
const providedOgImage = envValue("OG_IMAGE");
if (providedOgImage) {
  if (/example\.com|上线前填写|你的/.test(providedOgImage)) failures.push("OG_IMAGE still contains placeholder text.");
  if (!isHttpsUrl(providedOgImage) || !isImageUrl(providedOgImage)) {
    failures.push("OG_IMAGE must be a production https:// PNG, JPG, or WebP image URL.");
  }
}
const providedContactEmail = envValue("CONTACT_EMAIL");
if (providedContactEmail && !isEmail(providedContactEmail)) {
  failures.push("CONTACT_EMAIL must be a valid email address.");
}

if (requireLaunchInfo) {
  const missingEnv = requiredLaunchEnv.filter((name) => !envValue(name));
  if (missingEnv.length) {
    failures.push(`Missing required launch environment variables: ${missingEnv.join(", ")}`);
  }
  const renderedLaunchValues = {
    CONTACT_EMAIL: envValue("CONTACT_EMAIL"),
    CONTACT_WECHAT: envValue("CONTACT_WECHAT"),
    BUSINESS_NAME: envValue("BUSINESS_NAME") || defaultRenderedLaunchValues.BUSINESS_NAME,
    STUDIO_BOOKING: envValue("STUDIO_BOOKING") || defaultRenderedLaunchValues.STUDIO_BOOKING
  };
  for (const [name, current] of Object.entries(renderedLaunchValues)) {
    if (current && !outputIncludes(current)) {
      failures.push(`${name} is set but was not rendered into the public build.`);
    }
  }
  const customerHours = envValue("CUSTOMER_HOURS");
  if (customerHours && !outputIncludes(customerHours)) {
    failures.push("CUSTOMER_HOURS is set but was not rendered into the public build.");
  }
  if (warnings.length) {
    failures.push("Launch info placeholders remain while strict launch mode is enabled.");
  }
}

if (failures.length) {
  console.error("Public build check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Public build check passed for ${outputDir}/`);
