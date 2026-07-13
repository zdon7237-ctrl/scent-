import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ApiError, apiFetch } from "../src/assets/js/api-client.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const originalFetch = globalThis.fetch;

function source(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const [red, green, blue] = channels.map((value) => value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first, second) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("API errors", () => {
  it("preserves HTTP status and API error codes for actionable checkout messages", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({
      error: "库存不足。",
      code: "OUT_OF_STOCK"
    }), { status: 409, headers: { "content-type": "application/json" } });

    await assert.rejects(
      () => apiFetch("/api/checkout/quote", { method: "POST", body: { items: [] } }),
      (error) => error instanceof ApiError
        && error.status === 409
        && error.code === "OUT_OF_STOCK"
        && error.path === "/api/checkout/quote"
    );
  });

  it("marks network failures separately from authentication and service errors", async () => {
    globalThis.fetch = async () => { throw new TypeError("offline"); };

    await assert.rejects(
      () => apiFetch("/api/products"),
      (error) => error instanceof ApiError
        && error.status === 0
        && error.code === "NETWORK_ERROR"
        && /网络连接失败/.test(error.message)
    );
  });

  it("keeps JSON content type when callers add idempotency headers", async () => {
    let requestOptions;
    globalThis.fetch = async (_path, options) => {
      requestOptions = options;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };

    await apiFetch("/api/checkout/create-order", {
      method: "POST",
      headers: { "idempotency-key": "order-1" },
      body: { items: [] }
    });

    assert.equal(requestOptions.headers["content-type"], "application/json");
    assert.equal(requestOptions.headers["idempotency-key"], "order-1");
  });
});

describe("commercial storefront UI guards", () => {
  it("renders persistent desktop and mobile intent-list controls", () => {
    const header = source("src/_includes/header.njk");
    assert.match(header, /cart-button-mobile[^>]+data-cart-button/);
    assert.match(header, /cart-button-desktop[^>]+data-cart-button/);
    assert.equal((header.match(/data-cart-count/g) || []).length, 2);
  });

  it("keeps the closed drawer inert and manages dialog focus", () => {
    const cartUi = source("src/assets/js/cart-ui.js");
    assert.match(cartUi, /role="dialog" aria-modal="true"[^>]+inert/);
    assert.match(cartUi, /event\.key !== "Tab"/);
    assert.match(cartUi, /cartReturnFocus/);
    assert.match(cartUi, /setAttribute\("inert"/);
    assert.ok(cartUi.indexOf("returnFocus.focus()") < cartUi.indexOf('drawer.setAttribute("aria-hidden", "true")'));
  });

  it("fails closed in the commercial app and renders complete checkout totals", () => {
    const app = source("src/assets/js/app.js");
    const catalog = source("src/assets/js/catalog.js");
    assert.match(app, /replaceCatalogProducts\(payload\.products \|\| \[\], \{ clearBundledSamples: true \}\)/);
    assert.match(app, /replaceCatalogProducts\(\[\], \{ clearBundledSamples: true \}\)/);
    assert.match(app, /if \(!Array\.isArray\(payload\.products\)\) throw new Error/);
    assert.match(catalog, /if \(options\.clearBundledSamples\) catalogData\.sampleSets = \[\]/);
    assert.match(app, /catalogStatus = "unavailable"/);
    assert.doesNotMatch(app, /using bundled catalog/);
    for (const label of ["商品明细", "单价", "小计", "优惠", "运费", "应付总额"]) {
      assert.match(app, new RegExp(label));
    }
    for (const state of ["请先登录", "部分商品暂时无法购买", "网络连接失败", "订单服务暂时不可用"]) {
      assert.match(app, new RegExp(state));
    }
  });

  it("renders samples only from managed products and provides a real empty state", () => {
    const app = source("src/assets/js/app.js");
    const seed = source("server/src/seed.mjs");
    assert.match(app, /data\.products\.filter\(\(product\) => product\.category === "sample"\)/);
    assert.match(app, /试香套装正在整理/);
    assert.doesNotMatch(app, /data\.sampleSets\.map\(sampleCard\)/);
    assert.match(seed, /\.\.\.\(catalog\.products \|\| \[\]\), \.\.\.sampleSets/);
  });

  it("provides owner password and session controls with inline status regions", () => {
    const app = source("src/assets/js/app.js");
    const adminClient = source("src/assets/js/admin-client.js");
    assert.match(adminClient, /\/api\/admin\/auth\/change-password/);
    assert.match(adminClient, /\/api\/admin\/auth\/sessions\/revoke-others/);
    assert.match(app, /data-admin-change-password/);
    assert.match(app, /minlength="14"/);
    assert.match(app, /data-admin-revoke-sessions-form/);
    assert.match(app, /密码已更新，其他设备已退出后台/);
  });

  it("only offers receipt confirmation after shipment and validates redemption delivery fields", () => {
    const app = source("src/assets/js/app.js");
    assert.equal((app.match(/order\.status === "shipped" \? `<button[^`]+data-(?:confirm-receipt|admin-complete)/g) || []).length, 2);
    assert.doesNotMatch(app, /\["paid", "shipped"\]\.includes\(order\.status\).*data-(?:confirm-receipt|admin-complete)/);
    assert.match(app, /name="recipientName"[^>]+required/);
    assert.match(app, /name="recipientPhone"[^>]+pattern="1\[3-9\]\[0-9\]\{9\}"[^>]+required/);
    assert.match(app, /name="shippingAddress" required/);
  });

  it("keeps small gold text and focus outlines above minimum contrast", () => {
    const css = source("src/assets/styles.css");
    const paper = css.match(/--paper:\s*(#[a-f\d]{6})/i)?.[1];
    const gold = css.match(/--gold:\s*(#[a-f\d]{6})/i)?.[1];
    const focus = css.match(/--focus:\s*(#[a-f\d]{6})/i)?.[1];
    assert.ok(paper && gold && focus);
    assert.ok(contrast(paper, gold) >= 4.5, "Gold text must meet WCAG AA contrast");
    assert.ok(contrast(paper, focus) >= 3, "Focus indicator must have at least 3:1 contrast");
    assert.match(css, /\.qty-control button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
  });
});
