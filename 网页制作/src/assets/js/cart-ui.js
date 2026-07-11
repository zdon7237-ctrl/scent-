import { cartStore } from "./cart-store.js";
import { formatPrice } from "./catalog.js";

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeImageStyle(value) {
  const cssString = JSON.stringify(String(value || "")).replaceAll("<", "\\u003c");
  return `style="--image:url(${escapeHtml(cssString)})"`;
}

export function cartMarkup(compact = true) {
  const entries = cartStore.getItems();
  const total = cartStore.getSubtotal();
  const publicFallback = document.body.dataset.publicBuild === "true";

  if (!entries.length) {
    return `
      <div class="cart-empty">
        <h2>意向清单是空的</h2>
        <p>可以先从试香套装降低盲买风险，也可以直接进入香水列表筛选。</p>
        <div class="button-row">
          <a class="button button-primary" href="samples.html">先选试香</a>
          <a class="button button-secondary" href="shop.html">探索香水</a>
        </div>
      </div>
    `;
  }

  return `
    <div class="cart-list">
      ${entries.map(({ item, qty, lineTotal }) => `
        <article class="cart-row">
          <div class="cart-row-image" ${safeImageStyle(item.image)}></div>
          <div>
            <h3>${escapeHtml(item.name)}</h3>
            <p>${escapeHtml(item.brand || "Scent Atoll")} · ${formatPrice(item.price)}</p>
            <div class="qty-control">
              <button type="button" data-cart-change="${escapeHtml(item.id)}" data-delta="-1" aria-label="减少数量">-</button>
              <span>${qty}</span>
              <button type="button" data-cart-change="${escapeHtml(item.id)}" data-delta="1" aria-label="增加数量">+</button>
            </div>
          </div>
          <strong>${formatPrice(lineTotal)}</strong>
        </article>
      `).join("")}
    </div>
    <div class="cart-total">
      <span>意向小计</span>
      <strong>${formatPrice(total)}</strong>
    </div>
    <div class="member-quote" data-member-quote>${publicFallback ? "当前为只读展示模式，请联系客服确认购买。" : "提交订单后，通过客服微信完成人工转账。"}</div>
    <a class="button button-primary full" href="${publicFallback ? "service.html" : "checkout.html"}">${publicFallback ? "预约人工咨询" : "填写收货信息"}</a>
    ${compact ? `<a class="text-link" href="cart.html">查看完整意向清单</a>` : `<p class="service-note">提交前无需支付。顾问会根据清单协助确认试香、库存和后续购买方式。</p>`}
  `;
}

export function renderCartShell() {
  let shell = $("[data-cart-shell]");
  if (!shell) {
    shell = document.createElement("div");
    shell.dataset.cartShell = "";
    document.body.appendChild(shell);
  }

  updateCartCount();

  shell.innerHTML = `
    <aside class="cart-drawer" data-cart-drawer aria-hidden="true" aria-labelledby="cart-title">
      <div class="cart-panel">
        <div class="cart-header">
          <h2 id="cart-title">意向清单</h2>
          <button class="icon-button" type="button" data-close-cart aria-label="关闭意向清单">×</button>
        </div>
        <div class="cart-content">${cartMarkup(true)}</div>
      </div>
    </aside>
  `;
}

export function renderCartPage() {
  const mount = $("[data-cart-page]");
  if (mount) mount.innerHTML = cartMarkup(false);
}

export function updateCartCount() {
  const count = cartStore.getCount();
  $all("[data-cart-count]").forEach((node) => {
    node.textContent = count;
  });
}

export function openCart() {
  const drawer = $("[data-cart-drawer]");
  drawer?.classList.add("open");
  drawer?.setAttribute("aria-hidden", "false");
  document.body.classList.add("locked");
}

export function closeCart() {
  const drawer = $("[data-cart-drawer]");
  drawer?.classList.remove("open");
  drawer?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("locked");
}
