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

let cartReturnFocus = null;
let accessibilityBound = false;

function focusableElements(root) {
  return $all(
    "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    root
  ).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
}

function scheduleFocus(element) {
  const focus = () => {
    if (element?.isConnected) element.focus();
  };
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(focus);
  } else {
    setTimeout(focus, 0);
  }
}

function bindCartAccessibility() {
  if (accessibilityBound) return;
  accessibilityBound = true;
  document.addEventListener("keydown", (event) => {
    const drawer = $("[data-cart-drawer]");
    if (!drawer?.classList.contains("open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeCart();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = focusableElements(drawer);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

export function cartMarkup(compact = true) {
  const publicFallback = document.body.dataset.publicBuild === "true";
  const catalogUnavailable = !publicFallback && document.body.dataset.catalogStatus === "unavailable";

  if (catalogUnavailable) {
    return `
      <div class="cart-empty" role="status">
        <h2>商品信息暂时无法读取</h2>
        <p>为避免显示过期价格或库存，意向清单已暂停。重新连接后再继续。</p>
        <div class="button-row">
          <button class="button button-primary" type="button" data-retry-catalog>重新加载</button>
          <a class="button button-secondary" href="service.html">联系客服</a>
        </div>
      </div>
    `;
  }

  const entries = cartStore.getItems();
  const total = cartStore.getSubtotal();

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

  bindCartAccessibility();
  updateCartCount();

  shell.innerHTML = `
    <aside class="cart-drawer" data-cart-drawer role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="cart-title" inert>
      <div class="cart-panel" role="document">
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
  $all("[data-cart-button]").forEach((button) => {
    button.setAttribute("aria-label", `打开意向清单，当前 ${count} 件`);
  });
}

export function openCart(trigger = null, focusSelector = "[data-close-cart]") {
  const drawer = $("[data-cart-drawer]");
  if (!drawer) return;
  const focusCandidate = trigger || document.activeElement;
  if (!cartReturnFocus && focusCandidate?.isConnected && !drawer.contains(focusCandidate)) {
    cartReturnFocus = focusCandidate;
  }
  drawer.removeAttribute("inert");
  drawer?.classList.add("open");
  drawer?.setAttribute("aria-hidden", "false");
  document.body.classList.add("locked");
  scheduleFocus($(focusSelector, drawer) || $("[data-close-cart]", drawer));
}

export function closeCart() {
  const drawer = $("[data-cart-drawer]");
  if (!drawer?.classList.contains("open")) return;
  const returnFocus = cartReturnFocus;
  cartReturnFocus = null;
  if (returnFocus?.isConnected) returnFocus.focus();
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  drawer.setAttribute("inert", "");
  document.body.classList.remove("locked");
}
