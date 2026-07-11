const rawBaseUrl = process.argv[2] || process.env.DEPLOYMENT_URL || "";
const baseUrl = normalizeBaseUrl(rawBaseUrl);
const bypassSecret = String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "").trim();
const failures = [];

function normalizeBaseUrl(input) {
  return String(input || "").trim().replace(/\/+$/, "");
}

function validateBaseUrl(input) {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:") return "Deployment URL must use https://.";
    if (url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) {
      return "Deployment URL must be an origin without credentials, path, query string, or hash.";
    }
    return "";
  } catch {
    return "Deployment URL must be a valid https:// origin.";
  }
}

async function request(pathname) {
  const headers = bypassSecret
    ? { "x-vercel-protection-bypass": bypassSecret, "x-vercel-set-bypass-cookie": "true" }
    : {};
  try {
    return await fetch(`${baseUrl}${pathname}`, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000)
    });
  } catch (error) {
    failures.push(`Request failed for ${pathname}: ${error.message}`);
    return null;
  }
}

function checkSecurityHeaders(response) {
  const expected = [
    ["x-frame-options", /deny/i],
    ["x-content-type-options", /nosniff/i],
    ["strict-transport-security", /max-age=/i],
    ["content-security-policy", /default-src/i]
  ];
  for (const [name, pattern] of expected) {
    if (!pattern.test(response.headers.get(name) || "")) failures.push(`Missing or weak ${name} header on /.`);
  }
}

const urlIssue = validateBaseUrl(baseUrl);
if (urlIssue) failures.push(urlIssue);

if (failures.length) {
  console.error("Commercial deployment check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const pathname of ["/", "/login.html", "/admin.html"]) {
  const response = await request(pathname);
  if (!response) continue;
  if (response.status !== 200) failures.push(`Expected ${pathname} to return 200, got ${response.status}.`);
  if (pathname === "/") checkSecurityHeaders(response);
  await response.body?.cancel?.();
}

for (const pathname of ["/api/health/live", "/api/health/ready"]) {
  const response = await request(pathname);
  if (!response) continue;
  if (response.status !== 200) {
    failures.push(`Expected ${pathname} to return 200, got ${response.status}.`);
    await response.body?.cancel?.();
    continue;
  }
  try {
    const payload = await response.json();
    const expectedStatus = pathname.endsWith("/live") ? "ok" : "ready";
    if (payload.status !== expectedStatus) failures.push(`${pathname} must report status ${expectedStatus}.`);
  } catch {
    failures.push(`${pathname} did not return valid JSON.`);
  }
}

let firstProductSlug = "";
const products = await request("/api/products");
if (products) {
  if (products.status !== 200) {
    failures.push(`Expected /api/products to return 200, got ${products.status}.`);
  } else {
    try {
      const payload = await products.json();
      if (!Array.isArray(payload.products)) {
        failures.push("/api/products response must contain a products array.");
      } else if (!payload.products[0]) {
        failures.push("/api/products must contain at least one active commercial product.");
      } else {
        firstProductSlug = payload.products[0].slug || payload.products[0].id;
        const productPage = await request(`/products/${encodeURIComponent(firstProductSlug)}`);
        if (productPage) {
          const html = await productPage.text();
          if (productPage.status !== 200) failures.push(`Expected dynamic product page to return 200, got ${productPage.status}.`);
          if (!/<link rel="canonical"[^>]+\/products\//i.test(html)) failures.push("Dynamic product page is missing its stable canonical URL.");
          if (!/<script type="application\/ld\+json">/i.test(html)) failures.push("Dynamic product page is missing Product structured data.");
        }
      }
    } catch {
      failures.push("/api/products did not return valid JSON.");
    }
  }
}

const sitemap = await request("/sitemap.xml");
if (sitemap) {
  if (sitemap.status !== 200) {
    failures.push(`Expected /sitemap.xml to return 200, got ${sitemap.status}.`);
    await sitemap.body?.cancel?.();
  } else {
    const xml = await sitemap.text();
    if (!/<urlset[\s>]/i.test(xml)) failures.push("Dynamic sitemap did not return a valid URL set.");
    if (firstProductSlug && !xml.includes(`/products/${encodeURIComponent(firstProductSlug)}`)) {
      failures.push("Dynamic sitemap is missing the first active database product slug.");
    }
  }
}

const memberSession = await request("/api/auth/me");
if (memberSession) {
  if (memberSession.status !== 200) {
    failures.push(`Expected /api/auth/me to return 200 for an anonymous session, got ${memberSession.status}.`);
  } else {
    try {
      const payload = await memberSession.json();
      if (payload.user !== null) failures.push("Anonymous /api/auth/me must return user: null.");
    } catch {
      failures.push("/api/auth/me did not return valid JSON.");
    }
  }
}

const adminSession = await request("/api/admin/auth/me");
if (adminSession) {
  if (![401, 403].includes(adminSession.status)) {
    failures.push(`Anonymous /api/admin/auth/me must return 401 or 403, got ${adminSession.status}.`);
  }
  await adminSession.body?.cancel?.();
}

for (const pathname of ["/api/member/addresses", "/api/admin/orders"]) {
  const response = await request(pathname);
  if (!response) continue;
  if (![401, 403].includes(response.status)) {
    failures.push(`Anonymous ${pathname} must return 401 or 403, got ${response.status}.`);
  }
  await response.body?.cancel?.();
}

if (failures.length) {
  console.error("Commercial deployment check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Commercial deployment check passed for ${baseUrl}`);
