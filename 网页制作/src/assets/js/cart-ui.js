import { cartStore } from "./cart-store.js";
import { formatPrice, imageStyle } from "./catalog.js";

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function cartMarkup(compact = true) {
  const entries = cartStore.getItems();
  const total = cartStore.getSubtotal();

  if (!entries.length) {
    return `
      <div class="cart-empty">
        <h2>购物车是空的</h2>
        <p>可以先从新品、试香套装或选香问卷开始。</p>
        <a class="button button-primary" href="shop.html">探索香水</a>
      </div>
    `;
  }

  return `
    <div class="cart-list">
      ${entries.map(({ item, qty, lineTotal }) => `
        <article class="cart-row">
          <div class="cart-row-image" ${imageStyle(item.image)}></div>
          <div>
            <h3>${item.name}</h3>
            <p>${item.brand || "Scent Archive"} · ${formatPrice(item.price)}</p>
            <div class="qty-control">
              <button type="button" data-cart-change="${item.id}" data-delta="-1" aria-label="减少数量">-</button>
              <span>${qty}</span>
              <button type="button" data-cart-change="${item.id}" data-delta="1" aria-label="增加数量">+</button>
            </div>
          </div>
          <strong>${formatPrice(lineTotal)}</strong>
        </article>
      `).join("")}
    </div>
    <div class="cart-total">
      <span>小计</span>
      <strong>${formatPrice(total)}</strong>
    </div>
    <div class="member-quote" data-member-quote>登录后可查看会员折扣和预计积分。</div>
    <button class="button button-primary full" type="button" data-checkout>提交订单</button>
    ${compact ? `<a class="text-link" href="cart.html">查看完整购物车</a>` : `<p class="service-note">订单提交后由后台确认支付，支付确认后自动发放积分和更新等级。</p>`}
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
          <h2 id="cart-title">购物车</h2>
          <button class="icon-button" type="button" data-close-cart aria-label="关闭购物车">×</button>
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
