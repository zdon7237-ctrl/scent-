import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const fetchMock = `
const securityHeaders = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "strict-transport-security": "max-age=31536000",
  "content-security-policy": "default-src 'self'"
};
globalThis.fetch = async (input) => {
  const pathname = new URL(String(input)).pathname;
  if (["/", "/login.html", "/admin.html"].includes(pathname)) {
    return new Response("<!doctype html><title>Scent Atoll</title>", { status: 200, headers: securityHeaders });
  }
  if (pathname === "/api/health/live") {
    return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (pathname === "/api/health/ready") {
    return new Response(JSON.stringify({ status: process.env.MOCK_READY_STATUS || "ready" }), { status: Number(process.env.MOCK_READY_HTTP || 200), headers: { "content-type": "application/json" } });
  }
  if (pathname === "/api/products") {
    const status = Number(process.env.MOCK_PRODUCTS_STATUS || 200);
    return new Response(JSON.stringify({ products: [{ id: "vespree", slug: "vespree" }] }), { status, headers: { "content-type": "application/json" } });
  }
  if (pathname === "/products/vespree") {
    return new Response('<link rel="canonical" href="https://candidate.scent-atoll.test/products/vespree"><script type="application/ld+json">{}</script>', { status: 200, headers: { "content-type": "text/html" } });
  }
  if (pathname === "/sitemap.xml") {
    const productPath = process.env.MOCK_SITEMAP_MISSING_PRODUCT ? "" : "<url><loc>https://candidate.scent-atoll.test/products/vespree</loc></url>";
    return new Response("<urlset>" + productPath + "</urlset>", { status: Number(process.env.MOCK_SITEMAP_STATUS || 200), headers: { "content-type": "application/xml" } });
  }
  if (pathname === "/api/auth/me") {
    return new Response(JSON.stringify({ user: null }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (pathname === "/api/admin/auth/me") {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: Number(process.env.MOCK_ADMIN_STATUS || 401) });
  }
  if (["/api/member/addresses", "/api/admin/orders"].includes(pathname)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  }
  return new Response("not found", { status: 404 });
};
`;

function runCheck(overrides = {}) {
  return spawnSync(
    process.execPath,
    ["--import", `data:text/javascript,${encodeURIComponent(fetchMock)}`, "scripts/check-commercial-deployment.mjs", "https://candidate.scent-atoll.test"],
    {
      cwd: projectRoot,
      env: { ...process.env, ...overrides },
      encoding: "utf8"
    }
  );
}

describe("commercial deployment check", () => {
  it("accepts a healthy full application candidate", () => {
    const result = runCheck();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Commercial deployment check passed/);
  });

  it("rejects a candidate whose product API cannot read its database", () => {
    const result = runCheck({ MOCK_PRODUCTS_STATUS: "503" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Expected \/api\/products to return 200, got 503/);
  });

  it("rejects a candidate whose readiness check fails", () => {
    const result = runCheck({ MOCK_READY_HTTP: "503", MOCK_READY_STATUS: "not_ready" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Expected \/api\/health\/ready to return 200, got 503/);
  });

  it("rejects a candidate that exposes an anonymous admin session", () => {
    const result = runCheck({ MOCK_ADMIN_STATUS: "200" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Anonymous \/api\/admin\/auth\/me must return 401 or 403/);
  });

  it("rejects a sitemap that drifts from database product slugs", () => {
    const result = runCheck({ MOCK_SITEMAP_MISSING_PRODUCT: "true" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Dynamic sitemap is missing the first active database product slug/);
  });
});
