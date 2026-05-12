import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = "https://www.scent-atoll.test";

const validLaunchEnv = {
  SITE_URL: baseUrl,
  CONTACT_EMAIL: "hello@scent-atoll.test",
  CONTACT_WECHAT: "ScentAtoll",
  BUSINESS_NAME: "Scent Atoll Studio Ltd",
  STUDIO_BOOKING: "Wechat appointment"
};

const liveFetchMock = `
const baseUrl = "${baseUrl}";
const publicHtmlPaths = new Set([
  "/", "/shop.html", "/product.html", "/brands.html", "/brand.html", "/samples.html",
  "/journal.html", "/article.html", "/about.html", "/service.html", "/payment.html",
  "/privacy.html", "/terms.html", "/cart.html", "/404.html"
]);
const sitemapPaths = [
  "/", "/shop.html", "/brands.html", "/samples.html", "/journal.html",
  "/about.html", "/service.html", "/payment.html", "/privacy.html", "/terms.html"
];
const privatePaths = new Set([
  "/admin.html", "/account.html", "/login.html", "/register.html", "/member.html",
  "/membership.html", "/checkout.html", "/orders.html", "/points.html", "/points-mall.html",
  "/points-item.html", "/points-redemptions.html"
]);
const headerEntries = [
  ["x-frame-options", "DENY"],
  ["x-content-type-options", "nosniff"],
  ["strict-transport-security", "max-age=31536000"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  ["permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()"],
  ["content-security-policy", "default-src 'self'; script-src 'self'"],
];
const defaultRenderedValues = {
  BUSINESS_NAME: "馥屿 Scent Atoll",
  STUDIO_BOOKING: "通过客服微信预约",
  CUSTOMER_HOURS: "12:00 - 20:00"
};
function rendered(name) {
  return process.env["RENDERED_" + name] || process.env[name] || defaultRenderedValues[name] || "";
}
function html(pathname) {
  const noindex = ["/product.html", "/brand.html", "/article.html", "/cart.html", "/404.html"].includes(pathname)
    ? '<meta name="robots" content="noindex,nofollow">'
    : '<meta name="robots" content="index,follow">';
  const ogImage = process.env.RENDERED_ALTERNATE_SHARE_IMAGE && pathname === "/shop.html"
    ? process.env.RENDERED_ALTERNATE_SHARE_IMAGE
    : process.env.RENDERED_OG_IMAGE || baseUrl + "/og-image.png";
  const twitterImage = process.env.RENDERED_TWITTER_IMAGE || ogImage;
  return \`<!doctype html><html><head>
    <title>馥屿</title>
    <meta name="description" content="Scent Atoll">
    \${noindex}
    <link rel="canonical" href="\${baseUrl}\${pathname}">
    <meta property="og:title" content="馥屿">
    <meta property="og:description" content="Scent Atoll">
    <meta property="og:url" content="\${baseUrl}\${pathname}">
    <meta property="og:image" content="\${ogImage}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:type" content="image/png">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="馥屿">
    <meta name="twitter:description" content="Scent Atoll">
    <meta name="twitter:image" content="\${twitterImage}">
  </head><body>
    \${rendered("CONTACT_EMAIL")}
    \${rendered("CONTACT_WECHAT")}
    \${rendered("CUSTOMER_HOURS")}
    \${rendered("BUSINESS_NAME")}
    \${rendered("STUDIO_BOOKING")}
  </body></html>\`;
}
globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  const pathname = url.pathname;
  const headers = new Headers(headerEntries);
  if (pathname === "/cart.html" || pathname === "/404.html") {
    headers.set("x-robots-tag", "noindex, nofollow");
  }
  if (pathname === "/data.js") {
    return new Response("window.SA_DATA = { products: [], brands: [], articles: [] };", { status: 200 });
  }
  if (pathname === "/robots.txt") {
    return new Response("User-agent: *\\nAllow: /\\nSitemap: " + baseUrl + "/sitemap.xml\\n", { status: 200 });
  }
  if (pathname === "/sitemap.xml") {
    return new Response("<urlset>" + sitemapPaths.map((path) => "<url><loc>" + baseUrl + path + "</loc></url>").join("") + "</urlset>", { status: 200 });
  }
  if (pathname === "/og-image.png") {
    return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { "content-type": "image/png" } });
  }
  if (privatePaths.has(pathname)) return new Response("Not found", { status: 404 });
  if (publicHtmlPaths.has(pathname)) return new Response(html(pathname), { status: 200, headers });
  if (process.env.UNKNOWN_PATH_STATUS === "200") return new Response(html(pathname), { status: 200, headers });
  return new Response("Not found", { status: 404 });
};
`;

function runLiveCheck(overrides = {}) {
  return spawnSync(
    process.execPath,
    ["--import", `data:text/javascript,${encodeURIComponent(liveFetchMock)}`, "scripts/check-live.mjs"],
    {
      cwd: projectRoot,
      env: { ...process.env, ...validLaunchEnv, ...overrides },
      encoding: "utf8"
    }
  );
}

describe("live launch check", () => {
  it("passes when live pages render the configured launch contact values", () => {
    const result = runLiveCheck();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Live launch check passed/);
  });

  it("fails when a configured launch contact value is not rendered live", () => {
    const result = runLiveCheck({
      STUDIO_BOOKING: "Unrendered booking marker",
      RENDERED_STUDIO_BOOKING: "Wechat appointment"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /STUDIO_BOOKING is set but was not found on the live public pages/);
  });

  it("fails when configured customer hours are not rendered live", () => {
    const result = runLiveCheck({
      CUSTOMER_HOURS: "09:00 - 10:00",
      RENDERED_CUSTOMER_HOURS: "12:00 - 20:00"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CUSTOMER_HOURS is set but was not found on the live public pages/);
  });

  it("checks default business, booking, and customer hours when optional env is omitted", () => {
    const result = runLiveCheck({
      BUSINESS_NAME: "",
      STUDIO_BOOKING: "",
      CUSTOMER_HOURS: ""
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Live launch check passed/);
  });

  it("fails when a default launch value is not rendered live", () => {
    const result = runLiveCheck({
      BUSINESS_NAME: "",
      STUDIO_BOOKING: "",
      CUSTOMER_HOURS: "",
      RENDERED_STUDIO_BOOKING: "Missing default booking"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /STUDIO_BOOKING is set but was not found on the live public pages/);
  });

  it("rejects invalid live launch contact values", () => {
    const result = runLiveCheck({ CONTACT_EMAIL: "not-an-email" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CONTACT_EMAIL must be a valid email address/);
  });

  it("requires live contact values so rendered values can be verified", () => {
    const result = runLiveCheck({ CONTACT_EMAIL: "", CONTACT_WECHAT: "" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CONTACT_EMAIL is required for live launch checks/);
    assert.match(result.stderr, /CONTACT_WECHAT is required for live launch checks/);
  });

  it("fails when unknown paths do not return 404", () => {
    const result = runLiveCheck({ UNKNOWN_PATH_STATUS: "200" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Expected unknown path \/__scent-atoll-missing-page-check\.html to return 404, got 200/);
  });

  it("fails when an expected OG_IMAGE is not used live", () => {
    const result = runLiveCheck({ OG_IMAGE: "https://www.scent-atoll.test/share.jpg" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /OG_IMAGE is set but was not used by the live Open Graph or Twitter metadata/);
  });

  it("fails when only some live share metadata uses the expected OG_IMAGE", () => {
    const result = runLiveCheck({
      OG_IMAGE: "https://www.scent-atoll.test/share.jpg",
      RENDERED_OG_IMAGE: "https://www.scent-atoll.test/share.jpg",
      RENDERED_TWITTER_IMAGE: "https://www.scent-atoll.test/share.jpg",
      RENDERED_ALTERNATE_SHARE_IMAGE: "https://www.scent-atoll.test/og-image.png"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Live share metadata uses https:\/\/www\.scent-atoll\.test\/og-image\.png, but OG_IMAGE is set/);
  });

  it("fails when Open Graph and Twitter image URLs differ live", () => {
    const result = runLiveCheck({
      RENDERED_OG_IMAGE: "https://www.scent-atoll.test/og-image.png",
      RENDERED_TWITTER_IMAGE: "https://www.scent-atoll.test/twitter-image.png"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Open Graph and Twitter image URLs differ/);
  });
});
