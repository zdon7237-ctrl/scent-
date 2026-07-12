(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/assets/js/api-client.js
  async function apiFetch(path, options = {}) {
    const headers = Object.fromEntries(
      Object.entries({
        "content-type": "application/json",
        ...options.headers || {}
      }).filter(([, value]) => value !== void 0 && value !== null && value !== "")
    );
    let response;
    try {
      response = await fetch(path, {
        credentials: "same-origin",
        ...options,
        headers,
        body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
      });
    } catch (cause) {
      throw new ApiError("\u7F51\u7EDC\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5\u3002", {
        cause,
        code: "NETWORK_ERROR",
        path
      });
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(payload.error || "\u8BF7\u6C42\u5931\u8D25\u3002", {
        status: response.status,
        code: payload.code || "API_ERROR",
        path
      });
    }
    return payload;
  }
  function moneyText(value) {
    return `\xA5${Number(value || 0).toLocaleString("zh-CN", {
      minimumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    })}`;
  }
  var ApiError;
  var init_api_client = __esm({
    "src/assets/js/api-client.js"() {
      ApiError = class extends Error {
        constructor(message, options = {}) {
          super(message, { cause: options.cause });
          this.name = "ApiError";
          this.status = Number(options.status || 0);
          this.code = options.code || "API_ERROR";
          this.path = options.path || "";
        }
      };
    }
  });

  // src/assets/js/member-client.js
  var member_client_exports = {};
  __export(member_client_exports, {
    cancelOrder: () => cancelOrder,
    confirmReceiptOrder: () => confirmReceiptOrder,
    createAddress: () => createAddress,
    createOrder: () => createOrder,
    deleteAddress: () => deleteAddress,
    getAddresses: () => getAddresses,
    getMemberOrders: () => getMemberOrders,
    getMemberProfile: () => getMemberProfile,
    getPointTransactions: () => getPointTransactions,
    getTierProgress: () => getTierProgress,
    quoteOrder: () => quoteOrder,
    startPayment: () => startPayment,
    updateAddress: () => updateAddress,
    updateMemberProfile: () => updateMemberProfile
  });
  function getMemberProfile() {
    return apiFetch("/api/member/profile");
  }
  function updateMemberProfile(payload) {
    return apiFetch("/api/member/profile", {
      method: "PATCH",
      body: payload
    });
  }
  function getPointTransactions() {
    return apiFetch("/api/member/points");
  }
  function getMemberOrders() {
    return apiFetch("/api/member/orders");
  }
  function getTierProgress() {
    return apiFetch("/api/member/tier-progress");
  }
  function confirmReceiptOrder(orderId, idempotencyKey) {
    return apiFetch(`/api/member/orders/${encodeURIComponent(orderId)}/confirm-receipt`, {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: { idempotencyKey }
    });
  }
  function getAddresses() {
    return apiFetch("/api/member/addresses");
  }
  function createAddress(payload) {
    return apiFetch("/api/member/addresses", { method: "POST", body: payload });
  }
  function updateAddress(addressId, payload) {
    return apiFetch(`/api/member/addresses/${encodeURIComponent(addressId)}`, { method: "PATCH", body: payload });
  }
  function deleteAddress(addressId) {
    return apiFetch(`/api/member/addresses/${encodeURIComponent(addressId)}`, { method: "DELETE" });
  }
  function quoteOrder(items) {
    return apiFetch("/api/checkout/quote", { method: "POST", body: { items } });
  }
  function createOrder(payload, requestId) {
    return apiFetch("/api/checkout/create-order", {
      method: "POST",
      headers: { "idempotency-key": requestId },
      body: { ...payload, requestId }
    });
  }
  function startPayment(orderId, options = {}) {
    return apiFetch("/api/checkout/start-payment", {
      method: "POST",
      headers: { "idempotency-key": options.idempotencyKey },
      body: { orderId, ...options }
    });
  }
  function cancelOrder(orderId, reason = "member_cancelled", idempotencyKey) {
    return apiFetch(`/api/member/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: { reason, idempotencyKey }
    });
  }
  var init_member_client = __esm({
    "src/assets/js/member-client.js"() {
      init_api_client();
    }
  });

  // src/assets/js/catalog.js
  var catalogData = window.SA_DATA || {
    notes: [],
    scenes: [],
    products: [],
    brands: [],
    sampleSets: [],
    edits: [],
    articles: []
  };
  var hasCatalogData = Boolean(window.SA_DATA);
  function sampleSetItems() {
    return catalogData.sampleSets.map((set) => ({
      ...set,
      brand: "Scent Atoll",
      category: "sample",
      country: "Curated",
      stock: "\u73B0\u8D27",
      concentration: "Sample Set",
      family: "\u8BD5\u9999\u5957\u88C5",
      status: ["Sample"],
      description: set.intro,
      scenes: ["daily", "gift"],
      mood: ["clean"],
      sweetness: "medium"
    }));
  }
  function allCatalogItems() {
    return [
      ...catalogData.products,
      ...sampleSetItems()
    ];
  }
  function replaceCatalogProducts(products = [], options = {}) {
    if (!Array.isArray(products)) return false;
    catalogData.products = products;
    if (options.clearBundledSamples) catalogData.sampleSets = [];
    const notes = new Set(catalogData.notes || []);
    products.forEach((product) => (product.notes || []).forEach((note) => notes.add(note)));
    catalogData.notes = Array.from(notes);
    return true;
  }
  function formatPrice(value) {
    return `\xA5${Number(value).toLocaleString("zh-CN")}`;
  }
  function productById(id) {
    return catalogData.products.find((product) => product.id === id || product.productId === id);
  }
  function brandById(id) {
    return catalogData.brands.find((brand) => brand.id === id);
  }
  function articleById(id) {
    return catalogData.articles.find((article) => article.id === id);
  }
  function catalogItemById(id) {
    return allCatalogItems().find((item) => item.id === id || item.productId === id);
  }
  function canPurchase(item) {
    return Boolean(item && Number(item.price) > 0 && item.stock !== "\u552E\u7F44" && item.canPurchase !== false);
  }

  // src/assets/js/app.js
  init_api_client();

  // src/assets/js/auth-client.js
  init_api_client();
  var cachedSession;
  async function currentSession() {
    if (cachedSession) return cachedSession;
    try {
      cachedSession = await apiFetch("/api/auth/me");
    } catch (e) {
      cachedSession = { user: null };
    }
    return cachedSession;
  }
  function resetSessionCache() {
    cachedSession = null;
  }
  async function registerMember(payload) {
    const result = await apiFetch("/api/auth/register", {
      method: "POST",
      body: payload
    });
    cachedSession = result;
    return result;
  }
  function verifyEmail(token) {
    return apiFetch("/api/auth/verify-email", { method: "POST", body: { token } });
  }
  function requestPasswordReset(email) {
    return apiFetch("/api/auth/request-password-reset", { method: "POST", body: { email } });
  }
  function resetPassword(token, password) {
    return apiFetch("/api/auth/reset-password", { method: "POST", body: { token, password } });
  }
  function revokeOtherSessions() {
    return apiFetch("/api/auth/sessions/revoke-others", { method: "POST" });
  }
  function deleteMemberAccount(password) {
    return apiFetch("/api/member/account", { method: "DELETE", body: { password } });
  }
  async function loginMember(payload) {
    const result = await apiFetch("/api/auth/login", {
      method: "POST",
      body: payload
    });
    cachedSession = result.accountType === "member" ? result : { user: null };
    return result;
  }
  async function logoutMember() {
    const result = await apiFetch("/api/auth/logout", { method: "POST" });
    cachedSession = { user: null };
    return result;
  }

  // src/assets/js/cart-store.js
  var STORAGE_KEY = "sa_cart";
  function readCart() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value ? JSON.parse(value) : {};
    } catch (e) {
      return {};
    }
  }
  function writeCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }
  function cleanQuantity(value) {
    const quantity = Number(value);
    if (!Number.isFinite(quantity)) return 0;
    return Math.max(0, Math.floor(quantity));
  }
  function validatedItem(id) {
    const item = catalogItemById(id);
    if (!item) throw new Error("\u5546\u54C1\u4E0D\u5B58\u5728\uFF0C\u65E0\u6CD5\u52A0\u5165\u610F\u5411\u6E05\u5355\u3002");
    if (!canPurchase(item)) throw new Error("\u5F53\u524D\u5546\u54C1\u6682\u4E0D\u53EF\u8D2D\u4E70\u3002");
    return item;
  }
  var cartStore = {
    getItems() {
      return Object.entries(readCart()).map(([id, qty]) => {
        const item = catalogItemById(id);
        const quantity = cleanQuantity(qty);
        if (!item || quantity <= 0) return null;
        return {
          id,
          item,
          qty: quantity,
          lineTotal: item.price * quantity
        };
      }).filter(Boolean);
    },
    addItem(id, quantity = 1) {
      const item = validatedItem(id);
      const cart = readCart();
      const nextQuantity = cleanQuantity(quantity);
      if (nextQuantity <= 0) return item;
      cart[id] = cleanQuantity(cart[id]) + nextQuantity;
      writeCart(cart);
      return item;
    },
    updateQuantity(id, quantity) {
      const cart = readCart();
      const nextQuantity = cleanQuantity(quantity);
      if (nextQuantity <= 0) {
        delete cart[id];
        writeCart(cart);
        return null;
      }
      validatedItem(id);
      cart[id] = nextQuantity;
      writeCart(cart);
      return catalogItemById(id);
    },
    changeQuantity(id, delta) {
      const cart = readCart();
      const currentQuantity = cleanQuantity(cart[id]);
      return this.updateQuantity(id, currentQuantity + Number(delta));
    },
    removeItem(id) {
      const cart = readCart();
      delete cart[id];
      writeCart(cart);
    },
    clear() {
      writeCart({});
    },
    getCount() {
      return this.getItems().reduce((sum, entry) => sum + entry.qty, 0);
    },
    getSubtotal() {
      return this.getItems().reduce((sum, entry) => sum + entry.lineTotal, 0);
    }
  };

  // src/assets/js/cart-ui.js
  function $(selector, root = document) {
    return root.querySelector(selector);
  }
  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }
  function escapeHtml(value = "") {
    return String(value != null ? value : "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }
  function safeImageStyle(value) {
    const cssString = JSON.stringify(String(value || "")).replaceAll("<", "\\u003c");
    return `style="--image:url(${escapeHtml(cssString)})"`;
  }
  var cartReturnFocus = null;
  var accessibilityBound = false;
  function focusableElements(root) {
    return $all(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      root
    ).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
  }
  function scheduleFocus(element) {
    const focus = () => {
      if (element == null ? void 0 : element.isConnected) element.focus();
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
      if (!(drawer == null ? void 0 : drawer.classList.contains("open"))) return;
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
  function cartMarkup(compact = true) {
    const publicFallback = document.body.dataset.publicBuild === "true";
    const catalogUnavailable = !publicFallback && document.body.dataset.catalogStatus === "unavailable";
    if (catalogUnavailable) {
      return `
      <div class="cart-empty" role="status">
        <h2>\u5546\u54C1\u4FE1\u606F\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6</h2>
        <p>\u4E3A\u907F\u514D\u663E\u793A\u8FC7\u671F\u4EF7\u683C\u6216\u5E93\u5B58\uFF0C\u610F\u5411\u6E05\u5355\u5DF2\u6682\u505C\u3002\u91CD\u65B0\u8FDE\u63A5\u540E\u518D\u7EE7\u7EED\u3002</p>
        <div class="button-row">
          <button class="button button-primary" type="button" data-retry-catalog>\u91CD\u65B0\u52A0\u8F7D</button>
          <a class="button button-secondary" href="service.html">\u8054\u7CFB\u5BA2\u670D</a>
        </div>
      </div>
    `;
    }
    const entries = cartStore.getItems();
    const total = cartStore.getSubtotal();
    if (!entries.length) {
      return `
      <div class="cart-empty">
        <h2>\u610F\u5411\u6E05\u5355\u662F\u7A7A\u7684</h2>
        <p>\u53EF\u4EE5\u5148\u4ECE\u8BD5\u9999\u5957\u88C5\u964D\u4F4E\u76F2\u4E70\u98CE\u9669\uFF0C\u4E5F\u53EF\u4EE5\u76F4\u63A5\u8FDB\u5165\u9999\u6C34\u5217\u8868\u7B5B\u9009\u3002</p>
        <div class="button-row">
          <a class="button button-primary" href="samples.html">\u5148\u9009\u8BD5\u9999</a>
          <a class="button button-secondary" href="shop.html">\u63A2\u7D22\u9999\u6C34</a>
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
            <p>${escapeHtml(item.brand || "Scent Atoll")} \xB7 ${formatPrice(item.price)}</p>
            <div class="qty-control">
              <button type="button" data-cart-change="${escapeHtml(item.id)}" data-delta="-1" aria-label="\u51CF\u5C11\u6570\u91CF">-</button>
              <span>${qty}</span>
              <button type="button" data-cart-change="${escapeHtml(item.id)}" data-delta="1" aria-label="\u589E\u52A0\u6570\u91CF">+</button>
            </div>
          </div>
          <strong>${formatPrice(lineTotal)}</strong>
        </article>
      `).join("")}
    </div>
    <div class="cart-total">
      <span>\u610F\u5411\u5C0F\u8BA1</span>
      <strong>${formatPrice(total)}</strong>
    </div>
    <div class="member-quote" data-member-quote>${publicFallback ? "\u5F53\u524D\u4E3A\u53EA\u8BFB\u5C55\u793A\u6A21\u5F0F\uFF0C\u8BF7\u8054\u7CFB\u5BA2\u670D\u786E\u8BA4\u8D2D\u4E70\u3002" : "\u63D0\u4EA4\u8BA2\u5355\u540E\uFF0C\u901A\u8FC7\u5BA2\u670D\u5FAE\u4FE1\u5B8C\u6210\u4EBA\u5DE5\u8F6C\u8D26\u3002"}</div>
    <a class="button button-primary full" href="${publicFallback ? "service.html" : "checkout.html"}">${publicFallback ? "\u9884\u7EA6\u4EBA\u5DE5\u54A8\u8BE2" : "\u586B\u5199\u6536\u8D27\u4FE1\u606F"}</a>
    ${compact ? `<a class="text-link" href="cart.html">\u67E5\u770B\u5B8C\u6574\u610F\u5411\u6E05\u5355</a>` : `<p class="service-note">\u63D0\u4EA4\u524D\u65E0\u9700\u652F\u4ED8\u3002\u987E\u95EE\u4F1A\u6839\u636E\u6E05\u5355\u534F\u52A9\u786E\u8BA4\u8BD5\u9999\u3001\u5E93\u5B58\u548C\u540E\u7EED\u8D2D\u4E70\u65B9\u5F0F\u3002</p>`}
  `;
  }
  function renderCartShell() {
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
          <h2 id="cart-title">\u610F\u5411\u6E05\u5355</h2>
          <button class="icon-button" type="button" data-close-cart aria-label="\u5173\u95ED\u610F\u5411\u6E05\u5355">\xD7</button>
        </div>
        <div class="cart-content">${cartMarkup(true)}</div>
      </div>
    </aside>
  `;
  }
  function renderCartPage() {
    const mount = $("[data-cart-page]");
    if (mount) mount.innerHTML = cartMarkup(false);
  }
  function updateCartCount() {
    const count = cartStore.getCount();
    $all("[data-cart-count]").forEach((node) => {
      node.textContent = count;
    });
    $all("[data-cart-button]").forEach((button) => {
      button.setAttribute("aria-label", `\u6253\u5F00\u610F\u5411\u6E05\u5355\uFF0C\u5F53\u524D ${count} \u4EF6`);
    });
  }
  function openCart(trigger = null, focusSelector = "[data-close-cart]") {
    const drawer = $("[data-cart-drawer]");
    if (!drawer) return;
    const focusCandidate = trigger || document.activeElement;
    if (!cartReturnFocus && (focusCandidate == null ? void 0 : focusCandidate.isConnected) && !drawer.contains(focusCandidate)) {
      cartReturnFocus = focusCandidate;
    }
    drawer.removeAttribute("inert");
    drawer == null ? void 0 : drawer.classList.add("open");
    drawer == null ? void 0 : drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");
    scheduleFocus($(focusSelector, drawer) || $("[data-close-cart]", drawer));
  }
  function closeCart() {
    const drawer = $("[data-cart-drawer]");
    if (!(drawer == null ? void 0 : drawer.classList.contains("open"))) return;
    const returnFocus = cartReturnFocus;
    cartReturnFocus = null;
    if (returnFocus == null ? void 0 : returnFocus.isConnected) returnFocus.focus();
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    drawer.setAttribute("inert", "");
    document.body.classList.remove("locked");
  }

  // src/assets/js/admin-client.js
  init_api_client();
  function adminLogout() {
    return apiFetch("/api/admin/auth/logout", {
      method: "POST"
    });
  }
  function getCurrentAdmin() {
    return apiFetch("/api/admin/auth/me");
  }
  function adminChangePassword(payload) {
    return apiFetch("/api/admin/auth/change-password", {
      method: "POST",
      body: payload
    });
  }
  function adminRevokeOtherSessions() {
    return apiFetch("/api/admin/auth/sessions/revoke-others", {
      method: "POST"
    });
  }
  function adminGetMembers() {
    return apiFetch("/api/admin/members");
  }
  function adminGetOrders() {
    return apiFetch("/api/admin/orders");
  }
  function adminGetPoints() {
    return apiFetch("/api/admin/points");
  }
  function adminGetAuditLogs() {
    return apiFetch("/api/admin/audit-logs");
  }
  function adminGetPointsMallItems() {
    return apiFetch("/api/admin/points-mall/items");
  }
  function adminGetProducts() {
    return apiFetch("/api/admin/products");
  }
  function adminCreateProduct(payload) {
    return apiFetch("/api/admin/products", {
      method: "POST",
      headers: { "idempotency-key": payload.idempotencyKey },
      body: payload
    });
  }
  function adminUpdateProduct(productId, payload) {
    return apiFetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
      method: "PATCH",
      headers: { "idempotency-key": payload.idempotencyKey },
      body: payload
    });
  }
  function adminSetProductStatus(productId, action, idempotencyKey) {
    return apiFetch(`/api/admin/products/${encodeURIComponent(productId)}/${action}`, {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: {
        idempotencyKey,
        reason: action === "activate" ? "\u540E\u53F0\u4E0A\u67B6\u5546\u54C1" : action === "deactivate" ? "\u540E\u53F0\u4E0B\u67B6\u5546\u54C1" : "\u540E\u53F0\u5F52\u6863\u5546\u54C1"
      }
    });
  }
  function adminAdjustProductInventory(productId, variantId, payload) {
    return apiFetch(`/api/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/inventory`, {
      method: "POST",
      headers: { "idempotency-key": payload.idempotencyKey },
      body: payload
    });
  }
  function adminAdjustMemberPoints(memberId, payload) {
    return apiFetch(`/api/admin/members/${encodeURIComponent(memberId)}/points`, {
      method: "POST",
      headers: { "idempotency-key": payload.idempotencyKey },
      body: payload
    });
  }
  function adminGetPointsRedemptions() {
    return apiFetch("/api/admin/points-mall/redemptions");
  }
  function adminPayOrder(orderId, payload) {
    return apiFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/pay`, {
      method: "POST",
      headers: { "idempotency-key": payload.idempotencyKey },
      body: payload
    });
  }
  function adminShipOrder(orderId, payload) {
    return apiFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/ship`, {
      method: "POST",
      headers: { "idempotency-key": payload.idempotencyKey },
      body: payload
    });
  }
  async function adminUploadProductImage(productId, file, options = {}) {
    const response = await fetch(`/api/admin/products/${encodeURIComponent(productId)}/images/upload`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": file.type,
        "x-file-name": file.name,
        "x-image-alt": options.alt || "",
        "x-image-role": options.role || "gallery"
      },
      body: file
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "\u56FE\u7247\u4E0A\u4F20\u5931\u8D25\u3002");
    return payload;
  }
  function adminDeleteProductImage(productId, imageId) {
    return apiFetch(`/api/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`, { method: "DELETE" });
  }
  function adminCompleteOrder(orderId, idempotencyKey) {
    return apiFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/complete`, {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: { idempotencyKey }
    });
  }
  function adminRefundOrder(orderId, payload) {
    return apiFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/refund`, {
      method: "POST",
      headers: { "idempotency-key": payload.idempotencyKey },
      body: payload
    });
  }
  function adminSetMallItemStatus(itemId, action, idempotencyKey) {
    return apiFetch(`/api/admin/points-mall/items/${encodeURIComponent(itemId)}/${action}`, {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: { idempotencyKey }
    });
  }
  function adminCreateMallItem(payload) {
    return apiFetch("/api/admin/points-mall/items", {
      method: "POST",
      headers: { "idempotency-key": payload.idempotencyKey },
      body: payload
    });
  }
  function adminUpdateRedemptionStatus(redemptionId, payload) {
    return apiFetch(`/api/admin/points-mall/redemptions/${encodeURIComponent(redemptionId)}/status`, {
      method: "PATCH",
      headers: { "idempotency-key": payload.idempotencyKey },
      body: payload
    });
  }
  function adminCancelRedemption(redemptionId, idempotencyKey) {
    return apiFetch(`/api/admin/points-mall/redemptions/${encodeURIComponent(redemptionId)}/cancel`, {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: {
        idempotencyKey,
        reason: "\u540E\u53F0\u53D6\u6D88\u5151\u6362"
      }
    });
  }

  // src/assets/js/app.js
  init_member_client();

  // src/assets/js/points-mall-client.js
  init_api_client();
  function getPointsMallItems() {
    return apiFetch("/api/points-mall/items");
  }
  function getPointsMallItem(id) {
    return apiFetch(`/api/points-mall/items/${encodeURIComponent(id)}`);
  }
  function redeemPointsMallItem(payload) {
    return apiFetch("/api/points-mall/redeem", {
      method: "POST",
      headers: { "idempotency-key": payload.idempotencyKey || payload.requestId },
      body: payload
    });
  }
  function getPointsRedemptions() {
    return apiFetch("/api/points-mall/redemptions");
  }

  // src/assets/js/app.js
  if (hasCatalogData) {
    let readStore = function(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
      } catch (e) {
        return fallback;
      }
    }, writeStore = function(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    }, $2 = function(selector, root = document) {
      return root.querySelector(selector);
    }, $all2 = function(selector, root = document) {
      return Array.from(root.querySelectorAll(selector));
    }, params = function() {
      return new URLSearchParams(window.location.search);
    }, discountLabel = function(rate) {
      return Number(rate) >= 1 ? "\u65E0\u6298\u6263" : `${Math.round(Number(rate) * 100)} \u6298`;
    }, sceneLabels = function(ids = []) {
      return ids.map((id) => {
        var _a;
        return (_a = catalogData.scenes.find((scene) => scene.id === id)) == null ? void 0 : _a.label;
      }).filter(Boolean);
    }, sweetnessLabel = function(value) {
      const labels = {
        low: "\u4F4E\u751C",
        medium: "\u5FAE\u751C",
        high: "\u660E\u663E\u751C"
      };
      return labels[value] || "\u9700\u8BD5\u9999";
    }, buyingCue = function(product) {
      var _a;
      const status = product.status || [];
      const scenes = product.scenes || [];
      if (((_a = product.caution) == null ? void 0 : _a.includes("\u5148\u8BD5")) || status.includes("Limited") || status.includes("\u6536\u85CF")) {
        return "\u5EFA\u8BAE\u5148\u8BD5\u9999";
      }
      if (scenes.includes("daily") || status.includes("\u901A\u52E4")) {
        return "\u65E5\u5E38\u4F4E\u98CE\u9669";
      }
      if (scenes.includes("gift")) {
        return "\u9002\u5408\u9001\u793C";
      }
      return "\u8BFB\u5B8C\u63D0\u9192\u518D\u4E70";
    }, statusFlags = function(product) {
      return (product.status || []).slice(0, 2).map((item) => `<span>${escapeHtml2(item)}</span>`).join("");
    }, shortText = function(text = "", max = 58) {
      return text.length > max ? `${text.slice(0, max)}...` : text;
    }, entryUrl = function(prefix, id) {
      return `${prefix}-${encodeURIComponent(id)}.html`;
    }, productUrl = function(id) {
      return `/products/${encodeURIComponent(id)}`;
    }, brandUrl = function(id) {
      return entryUrl("brand", id);
    }, articleUrl = function(id) {
      return entryUrl("article", id);
    }, setFormMessage = function(form, message, type = "") {
      const node = $2("[data-form-message]", form);
      if (!node) return;
      node.textContent = message;
      node.classList.toggle("is-error", type === "error");
      node.classList.toggle("is-success", type === "success");
    }, catalogUnavailableMarkup = function() {
      return `
      <div class="empty-state commerce-unavailable" role="alert">
        <h2>\u5546\u54C1\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528</h2>
        <p>\u4E3A\u907F\u514D\u663E\u793A\u8FC7\u671F\u4EF7\u683C\u6216\u5E93\u5B58\uFF0C\u5F53\u524D\u5DF2\u6682\u505C\u5546\u54C1\u6D4F\u89C8\u548C\u4E0B\u5355\u3002\u8BF7\u91CD\u65B0\u52A0\u8F7D\u540E\u518D\u8BD5\u3002</p>
        <div class="button-row">
          <button class="button button-primary" type="button" data-retry-catalog>\u91CD\u65B0\u52A0\u8F7D</button>
          <a class="button button-secondary" href="service.html">\u8054\u7CFB\u5BA2\u670D</a>
        </div>
      </div>
    `;
    }, actionIdempotencyKey = function(element, prefix, payload = {}) {
      const signature = JSON.stringify(payload);
      if (!element.dataset.idempotencyKey || element.dataset.idempotencySignature !== signature) {
        const randomPart = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, "0")).join("");
        element.dataset.idempotencyKey = `${prefix}-${randomPart}`;
        element.dataset.idempotencySignature = signature;
      }
      return element.dataset.idempotencyKey;
    }, escapeHtml2 = function(value = "") {
      return String(value != null ? value : "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
    }, safeImageStyle2 = function(value, property = "--image") {
      const cssString = JSON.stringify(String(value || "")).replaceAll("<", "\\u003c");
      return `style="${property}:url(${escapeHtml2(cssString)})"`;
    }, safeTagList = function(items = []) {
      return items.slice(0, 4).map((item) => `<span>${escapeHtml2(item)}</span>`).join("");
    }, productStatusLabel = function(status) {
      return {
        draft: "\u8349\u7A3F",
        active: "\u5DF2\u4E0A\u67B6",
        inactive: "\u5DF2\u4E0B\u67B6",
        archived: "\u5DF2\u5F52\u6863"
      }[status] || status || "\u8349\u7A3F";
    }, orderedProductImages = function(product = {}) {
      return (product.images || []).slice().sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    }, imageSizeText = function(byteSize) {
      const bytes = Number(byteSize || 0);
      if (!bytes) return "";
      return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }, imageUpdatePayload = function(image, index, primaryImageUrl) {
      return {
        ...image,
        role: image.imageUrl === primaryImageUrl ? "hero" : "gallery",
        sortOrder: index + 1
      };
    }, adminImageFileError = function(file) {
      if (!file || !file.name || !Number(file.size)) return "\u8BF7\u9009\u62E9\u8981\u4E0A\u4F20\u7684\u56FE\u7247\u3002";
      if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
        return "\u4EC5\u652F\u6301 JPEG\u3001PNG\u3001WebP \u6216 AVIF \u56FE\u7247\u3002";
      }
      if (file.size > 5 * 1024 * 1024) return "\u56FE\u7247\u4E0D\u80FD\u8D85\u8FC7 5 MB\u3002";
      return "";
    }, adminProductImages = function(product) {
      const images = orderedProductImages(product);
      const headingId = `product-images-${product.id}`;
      return `
      <section aria-labelledby="${escapeHtml2(headingId)}">
        <div class="admin-product-summary">
          <div>
            <h3 id="${escapeHtml2(headingId)}">\u5546\u54C1\u56FE\u7247</h3>
            <p>\u4E3B\u56FE\u4F18\u5148\u5C55\u793A\uFF0C\u5176\u4ED6\u56FE\u7247\u6309\u5F53\u524D\u987A\u5E8F\u6392\u5217\u3002\u53EF\u8C03\u6574\u987A\u5E8F\u6216\u4E0A\u4F20\u66FF\u6362\u3002</p>
          </div>
          <span>${images.length} \u5F20</span>
        </div>
        <div class="member-table admin-nested-table">
          ${images.map((image, index) => {
        const isPrimary = product.heroImageUrl === image.imageUrl || !product.heroImageUrl && index === 0;
        const cannotDelete = product.status === "active" && images.length === 1;
        const metadata = [image.contentType, imageSizeText(image.byteSize)].filter(Boolean).join(" \xB7 ");
        return `
              <article>
                <img src="${escapeHtml2(image.imageUrl)}" alt="${escapeHtml2(image.alt || product.name)}" width="88" height="88" loading="lazy" style="object-fit:cover;border-radius:8px">
                <div>
                  <h3>${isPrimary ? "\u4E3B\u56FE" : `\u56FE\u7247 ${index + 1}`}</h3>
                  <p>${escapeHtml2(image.alt || product.name)}${metadata ? ` \xB7 ${escapeHtml2(metadata)}` : ""}</p>
                  <div class="button-row">
                    <button class="button button-secondary" type="button" data-admin-image-primary="${escapeHtml2(image.id)}" data-product-id="${escapeHtml2(product.id)}" ${isPrimary ? "disabled" : ""}>\u8BBE\u4E3A\u4E3B\u56FE</button>
                    <button class="button button-secondary" type="button" data-admin-image-move="${escapeHtml2(image.id)}" data-product-id="${escapeHtml2(product.id)}" data-direction="-1" ${index === 0 ? "disabled" : ""} aria-label="\u4E0A\u79FB ${escapeHtml2(image.alt || product.name)}">\u4E0A\u79FB</button>
                    <button class="button button-secondary" type="button" data-admin-image-move="${escapeHtml2(image.id)}" data-product-id="${escapeHtml2(product.id)}" data-direction="1" ${index === images.length - 1 ? "disabled" : ""} aria-label="\u4E0B\u79FB ${escapeHtml2(image.alt || product.name)}">\u4E0B\u79FB</button>
                    <button class="button button-secondary" type="button" data-admin-image-delete="${escapeHtml2(image.id)}" data-product-id="${escapeHtml2(product.id)}" ${cannotDelete ? 'disabled title="\u8BF7\u5148\u4E0A\u4F20\u66FF\u4EE3\u56FE\u7247\u6216\u4E0B\u67B6\u5546\u54C1"' : ""}>\u5220\u9664</button>
                  </div>
                </div>
                <form class="admin-inventory-form" data-admin-image-replace="${escapeHtml2(image.id)}" data-product-id="${escapeHtml2(product.id)}">
                  <label class="field-label">\u66FF\u6362\u56FE\u7247<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required></label>
                  <button class="button button-secondary" type="submit">\u4E0A\u4F20\u66FF\u6362</button>
                  <p class="form-message" data-form-message aria-live="polite"></p>
                </form>
              </article>
            `;
      }).join("") || `<div class="empty-state">\u8FD8\u6CA1\u6709\u5546\u54C1\u56FE\u3002\u4E0A\u4F20\u7B2C\u4E00\u5F20\u56FE\u7247\u540E\uFF0C\u7CFB\u7EDF\u4F1A\u81EA\u52A8\u5C06\u5B83\u8BBE\u4E3A\u4E3B\u56FE\u3002</div>`}
        </div>
        <form class="admin-inventory-form" data-admin-image-upload="${escapeHtml2(product.id)}">
          <label class="field-label">\u9009\u62E9\u56FE\u7247<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required></label>
          <label class="field-label">\u56FE\u7247\u8BF4\u660E<input name="alt" value="${escapeHtml2(product.name)}" required></label>
          <label class="checkbox-row"><input name="isHero" type="checkbox" ${images.length ? "" : "checked"}><span>\u8BBE\u4E3A\u4E3B\u56FE</span></label>
          <button class="button button-secondary" type="submit">\u4E0A\u4F20\u56FE\u7247</button>
          <p class="form-message" data-form-message aria-live="polite">\u652F\u6301 JPEG\u3001PNG\u3001WebP\u3001AVIF\uFF0C\u5355\u5F20\u4E0D\u8D85\u8FC7 5 MB\u3002</p>
        </form>
      </section>
    `;
    }, adminProductPayload = function(form) {
      const formData = new FormData(form);
      const payload = {
        name: formData.get("name"),
        slug: formData.get("slug"),
        brandName: formData.get("brandName"),
        category: formData.get("category"),
        country: formData.get("country"),
        family: formData.get("family"),
        volume: formData.get("volume"),
        concentration: formData.get("concentration"),
        sweetness: formData.get("sweetness"),
        status: formData.get("status"),
        statusTags: formData.get("statusTags"),
        notes: formData.get("notes"),
        scenes: formData.get("scenes"),
        imageLayout: formData.get("imageLayout"),
        description: formData.get("description"),
        buyerNote: formData.get("buyerNote"),
        bestFor: formData.get("bestFor"),
        caution: formData.get("caution"),
        topNotes: formData.get("topNotes"),
        middleNotes: formData.get("middleNotes"),
        baseNotes: formData.get("baseNotes"),
        sku: formData.get("sku"),
        variantName: formData.get("variantName") || "\u9ED8\u8BA4\u89C4\u683C",
        priceAmountYuan: Number(formData.get("priceAmountYuan") || 0),
        stockQuantity: Number(formData.get("stockQuantity") || 0),
        reason: formData.get("reason") || "\u540E\u53F0\u4FDD\u5B58\u5546\u54C1"
      };
      const variantId = formData.get("variantId");
      if (variantId) payload.variantId = variantId;
      return payload;
    }, adminProductForm = function(product = null) {
      var _a;
      const variant = (product == null ? void 0 : product.primaryVariant) || {};
      const inventory = variant.inventory || {};
      const isCreate = !product;
      const id = (product == null ? void 0 : product.id) || "";
      return `
      <form class="admin-product-form ${isCreate ? "" : "admin-product-edit"}" ${isCreate ? "data-admin-product-create" : `data-admin-product-edit="${escapeHtml2(id)}"`}>
        ${!isCreate ? `<input type="hidden" name="variantId" value="${escapeHtml2(variant.id || "")}">` : ""}
        <div class="admin-form-grid">
          <label class="field-label">\u5546\u54C1\u540D<input name="name" value="${escapeHtml2((product == null ? void 0 : product.name) || "")}" required></label>
          <label class="field-label">Slug<input name="slug" value="${escapeHtml2((product == null ? void 0 : product.slug) || "")}" placeholder="ruby-tea" required></label>
          <label class="field-label">\u54C1\u724C<input name="brandName" value="${escapeHtml2((product == null ? void 0 : product.brandName) || "")}"></label>
          <label class="field-label">\u72B6\u6001
            <select name="status">
              ${["draft", "active", "inactive", "archived"].map((status) => `<option value="${status}" ${(product == null ? void 0 : product.status) === status || !product && status === "draft" ? "selected" : ""}>${productStatusLabel(status)}</option>`).join("")}
            </select>
          </label>
          <label class="field-label">\u4EF7\u683C<input name="priceAmountYuan" type="number" min="0" step="0.01" value="${escapeHtml2(variant.priceAmountYuan || "")}"></label>
          <label class="field-label">\u5E93\u5B58<input name="stockQuantity" type="number" min="0" step="1" value="${escapeHtml2((_a = inventory.quantityOnHand) != null ? _a : "")}"></label>
          <label class="field-label">SKU<input name="sku" value="${escapeHtml2(variant.sku || "")}"></label>
          <label class="field-label">\u89C4\u683C<input name="variantName" value="${escapeHtml2(variant.name || "\u9ED8\u8BA4\u89C4\u683C")}"></label>
          <label class="field-label">\u5BB9\u91CF<input name="volume" value="${escapeHtml2((product == null ? void 0 : product.volume) || "")}" placeholder="50ml"></label>
          <label class="field-label">\u6D53\u5EA6<input name="concentration" value="${escapeHtml2((product == null ? void 0 : product.concentration) || "")}" placeholder="EDP"></label>
          <label class="field-label">\u9999\u8C03\u5BB6\u65CF<input name="family" value="${escapeHtml2((product == null ? void 0 : product.family) || "")}"></label>
          <label class="field-label">\u56FE\u7247\u6392\u7248
            <select name="imageLayout">
              ${["grid", "editorial", "detail", "minimal"].map((layout) => `<option value="${layout}" ${((product == null ? void 0 : product.imageLayout) || "grid") === layout ? "selected" : ""}>${layout}</option>`).join("")}
            </select>
          </label>
          <label class="field-label">\u5206\u7C7B<input name="category" value="${escapeHtml2((product == null ? void 0 : product.category) || "fragrance")}"></label>
          <label class="field-label">\u56FD\u5BB6<input name="country" value="${escapeHtml2((product == null ? void 0 : product.country) || "")}"></label>
          <label class="field-label">\u751C\u5EA6<input name="sweetness" value="${escapeHtml2((product == null ? void 0 : product.sweetness) || "")}" placeholder="low / medium / high"></label>
          <label class="field-label">\u6807\u7B7E<input name="statusTags" value="${escapeHtml2(((product == null ? void 0 : product.statusTags) || []).join("\u3001"))}" placeholder="New\u3001\u4E70\u624B\u63A8\u8350"></label>
          <label class="field-label admin-wide-field">\u9999\u8C03<input name="notes" value="${escapeHtml2(((product == null ? void 0 : product.notes) || []).join("\u3001"))}" placeholder="\u8336\u9999\u3001\u6728\u8D28\u3001\u9E9D\u9999"></label>
          <label class="field-label admin-wide-field">\u573A\u666F<input name="scenes" value="${escapeHtml2(((product == null ? void 0 : product.scenes) || []).join("\u3001"))}" placeholder="daily\u3001gift"></label>
          ${isCreate ? `<p class="form-message admin-wide-field">\u5148\u521B\u5EFA\u8349\u7A3F\uFF0C\u518D\u5728\u5546\u54C1\u56FE\u7247\u533A\u4E0A\u4F20\u56FE\u7247\u3002</p>` : ""}
          <label class="field-label admin-wide-field">\u63CF\u8FF0<textarea name="description" rows="3">${escapeHtml2((product == null ? void 0 : product.description) || "")}</textarea></label>
          <label class="field-label admin-wide-field">\u4E70\u624B\u70B9\u8BC4<textarea name="buyerNote" rows="3">${escapeHtml2((product == null ? void 0 : product.buyerNote) || "")}</textarea></label>
          <label class="field-label">\u9002\u5408\u573A\u666F<input name="bestFor" value="${escapeHtml2((product == null ? void 0 : product.bestFor) || "")}"></label>
          <label class="field-label">\u76F2\u4E70\u63D0\u9192<input name="caution" value="${escapeHtml2((product == null ? void 0 : product.caution) || "")}"></label>
          <label class="field-label">\u524D\u8C03<input name="topNotes" value="${escapeHtml2((product == null ? void 0 : product.topNotes) || "")}"></label>
          <label class="field-label">\u4E2D\u8C03<input name="middleNotes" value="${escapeHtml2((product == null ? void 0 : product.middleNotes) || "")}"></label>
          <label class="field-label">\u540E\u8C03<input name="baseNotes" value="${escapeHtml2((product == null ? void 0 : product.baseNotes) || "")}"></label>
          <label class="field-label">\u5907\u6CE8<input name="reason" value="${isCreate ? "\u540E\u53F0\u65B0\u589E\u5546\u54C1" : "\u540E\u53F0\u66F4\u65B0\u5546\u54C1"}"></label>
        </div>
        <div class="button-row">
          <button class="button button-primary" type="submit">${isCreate ? "\u65B0\u589E\u5546\u54C1" : "\u4FDD\u5B58\u5546\u54C1"}</button>
          ${!isCreate && product.status !== "active" ? `<button class="button button-secondary" type="button" data-admin-product-activate="${escapeHtml2(id)}">\u4E0A\u67B6</button>` : ""}
          ${!isCreate && product.status === "active" ? `<button class="button button-secondary" type="button" data-admin-product-deactivate="${escapeHtml2(id)}">\u4E0B\u67B6</button>` : ""}
          ${!isCreate && product.status !== "archived" ? `<button class="button button-secondary" type="button" data-admin-product-archive="${escapeHtml2(id)}">\u5F52\u6863</button>` : ""}
        </div>
      </form>
    `;
    }, adminProductsMarkup = function(productsPayload, options = {}) {
      const allProducts = productsPayload.products || [];
      const products = options.stock === "low" ? allProducts.filter((product) => product.availableQuantity > 0 && product.availableQuantity <= 3) : allProducts;
      const summary = productsPayload.summary || {};
      return `
      <section class="admin-products-panel">
        <div class="admin-panel-head">
          <div>
            <h2>\u5546\u54C1\u4E0A\u67B6\u4E0E\u5E93\u5B58</h2>
            <p>\u7EF4\u62A4\u9999\u6C34\u8D44\u6599\u3001\u56FE\u7247\u6392\u7248\u3001\u4E0A\u4E0B\u67B6\u72B6\u6001\u548C\u53EF\u552E\u5E93\u5B58\u3002</p>
          </div>
          <div class="admin-stat-row">
            <span><strong>${summary.total || 0}</strong>\u5168\u90E8</span>
            <span><strong>${summary.active || 0}</strong>\u4E0A\u67B6</span>
            <span><strong>${summary.lowStock || 0}</strong>\u4F4E\u5E93\u5B58</span>
            <span><strong>${summary.outOfStock || 0}</strong>\u552E\u7F44</span>
          </div>
        </div>
        <div class="admin-toolbar">
          <label class="admin-search"><span>\u641C\u7D22\u5546\u54C1</span><input type="search" data-admin-list-search placeholder="\u5546\u54C1\u3001\u54C1\u724C\u3001Slug \u6216 SKU"></label>
          ${options.stock === "low" ? `<a class="button button-secondary" href="#products">\u67E5\u770B\u5168\u90E8\u5546\u54C1</a>` : ""}
        </div>
        <details class="admin-create-product" ${allProducts.length ? "" : "open"}>
          <summary>\u65B0\u589E\u5546\u54C1</summary>
          ${adminProductForm()}
        </details>
        <div class="admin-product-list" data-admin-record-list>
          ${products.map((product) => {
        var _a;
        return `
            <details class="admin-product-item" data-admin-search-value="${escapeHtml2([product.name, product.slug, product.brandName, (_a = product.primaryVariant) == null ? void 0 : _a.sku].filter(Boolean).join(" ").toLowerCase())}">
              <summary class="admin-product-summary">
                <div>
                  <h3>${escapeHtml2(product.name)}</h3>
                  <p>${escapeHtml2(product.slug)} \xB7 ${escapeHtml2(product.brandName || "\u672A\u586B\u54C1\u724C")} \xB7 ${moneyText(product.priceAmountYuan)} \xB7 \u5E93\u5B58 ${product.availableQuantity}</p>
                </div>
                <span class="status-badge">${escapeHtml2(productStatusLabel(product.status))}</span>
                <span>${(product.images || []).length} \u5F20\u56FE</span>
              </summary>
              <div class="admin-product-body">
                ${adminProductForm(product)}
                ${adminProductImages(product)}
                ${product.primaryVariant ? `
                  <form class="admin-inventory-form" data-admin-inventory-form="${escapeHtml2(product.id)}" data-variant-id="${escapeHtml2(product.primaryVariant.id)}">
                    <label class="field-label">\u5E93\u5B58\u53D8\u52A8<input name="quantityDelta" type="number" step="1" placeholder="+5 \u6216 -2" required></label>
                    <label class="field-label">\u539F\u56E0<input name="reason" value="\u540E\u53F0\u5E93\u5B58\u8C03\u6574"></label>
                    <button class="button button-secondary" type="submit">\u68C0\u67E5\u5E76\u8C03\u6574</button>
                  </form>
                ` : ""}
              </div>
            </details>
          `;
      }).join("") || adminEmptyMarkup(options.stock === "low" ? "\u5F53\u524D\u6CA1\u6709\u4F4E\u5E93\u5B58\u5546\u54C1" : "\u8FD8\u6CA1\u6709\u5546\u54C1", options.stock === "low" ? "\u5E93\u5B58\u5145\u8DB3\uFF0C\u65E0\u9700\u7ACB\u5373\u8865\u8D27\u3002" : "\u5148\u65B0\u589E\u4E00\u4EF6\u5546\u54C1\uFF0C\u518D\u8865\u5145\u56FE\u7247\u548C\u5E93\u5B58\u3002")}
        </div>
      </section>
    `;
    }, productCard = function(product, options = {}) {
      const compact = options.compact ? " product-card-compact" : "";
      const favorite = state.favorites.has(product.id);
      const scenes = sceneLabels(product.scenes).slice(0, 2).join(" / ");
      const href = productUrl(product.slug || product.id);
      if (options.compact) {
        return `
        <article class="product-card${compact} product-card-minimal">
          <a class="product-card-media" href="${escapeHtml2(href)}" ${safeImageStyle2(product.image)} aria-label="\u67E5\u770B ${escapeHtml2(product.name)}"></a>
          <div class="product-card-body">
            <span class="product-kicker">${escapeHtml2(product.brand)}</span>
            <h3><a href="${escapeHtml2(href)}">${escapeHtml2(product.name)}</a></h3>
            <p>${escapeHtml2(product.family)}</p>
            <div class="price-row">
              <strong>${formatPrice(product.price)}</strong>
              <span>${escapeHtml2(product.volume)}</span>
            </div>
          </div>
        </article>
      `;
      }
      return `
      <article class="product-card${compact}">
        <a class="product-card-media" href="${escapeHtml2(href)}" ${safeImageStyle2(product.image)} aria-label="\u67E5\u770B ${escapeHtml2(product.name)}"></a>
        <div class="product-card-body">
          <div class="product-card-topline">
            <div class="meta-line">
              <span>${escapeHtml2(product.brand)}</span>
              <span>${escapeHtml2(product.stock)}</span>
            </div>
            <div class="card-flags">${statusFlags(product)}</div>
          </div>
          <h3><a href="${escapeHtml2(href)}">${escapeHtml2(product.name)}</a></h3>
          <p>${escapeHtml2(product.family)} \xB7 ${escapeHtml2(product.concentration)}</p>
          <div class="scent-brief" aria-label="\u6C14\u5473\u5224\u65AD">
            <div><span>\u573A\u666F</span><strong>${escapeHtml2(scenes || product.bestFor)}</strong></div>
            <div><span>\u751C\u5EA6</span><strong>${sweetnessLabel(product.sweetness)}</strong></div>
          </div>
          <p class="card-note">${escapeHtml2(shortText(product.buyer || product.description))}</p>
          <p class="risk-line"><span>\u8D2D\u4E70\u524D</span>${buyingCue(product)}</p>
          <div class="tag-row">${safeTagList(product.notes)}</div>
          <div class="price-row">
            <strong>${formatPrice(product.price)}</strong>
            <span>${escapeHtml2(product.volume)}</span>
          </div>
          <div class="card-actions">
            <button class="button button-secondary" type="button" data-favorite="${escapeHtml2(product.id)}" aria-pressed="${favorite}">
              ${favorite ? "\u5DF2\u6536\u85CF" : "\u6536\u85CF"}
            </button>
            <button class="button button-primary" type="button" data-add-cart="${escapeHtml2(product.id)}" ${product.canPurchase === false ? "disabled" : ""}>${product.canPurchase === false ? "\u6682\u4E0D\u53EF\u8D2D\u4E70" : "\u52A0\u5165\u610F\u5411\u6E05\u5355"}</button>
          </div>
        </div>
      </article>
    `;
    }, brandCard = function(brand, compact = false) {
      const products = catalogData.products.filter((product) => product.brandId === brand.id);
      const href = brandUrl(brand.id);
      return `
      <article class="brand-card ${compact ? "compact-card" : ""}">
        <a class="brand-card-media" href="${escapeHtml2(href)}" ${safeImageStyle2(brand.hero)} aria-label="\u67E5\u770B ${escapeHtml2(brand.name)}"></a>
        <div class="brand-card-body">
          <span class="eyebrow">${escapeHtml2(brand.country)}</span>
          <h3><a href="${escapeHtml2(href)}">${escapeHtml2(brand.name)}</a></h3>
          <p>${escapeHtml2(brand.intro)}</p>
          <div class="tag-row">${safeTagList(brand.keywords)}</div>
          <strong>\u5165\u95E8\uFF1A${escapeHtml2(brand.starter)}</strong>
          <a class="text-link" href="${escapeHtml2(href)}">${products.length} \u4EF6\u4F5C\u54C1</a>
        </div>
      </article>
    `;
    }, articleCard = function(article) {
      const href = articleUrl(article.id);
      return `
      <article class="article-card">
        <a class="article-media" href="${escapeHtml2(href)}" ${safeImageStyle2(article.image)} aria-label="\u9605\u8BFB ${escapeHtml2(article.title)}"></a>
        <div class="article-card-body">
          <span class="eyebrow">${escapeHtml2(article.category)} \xB7 ${escapeHtml2(article.date)}</span>
          <h3><a href="${escapeHtml2(href)}">${escapeHtml2(article.title)}</a></h3>
          <p>${escapeHtml2(article.excerpt)}</p>
          <a class="text-link" href="${escapeHtml2(href)}">\u9605\u8BFB\u5168\u6587</a>
        </div>
      </article>
    `;
    }, sampleCard = function(set) {
      return `
      <article class="sample-card" id="set-${escapeHtml2(set.id)}">
        <a class="sample-media" href="samples.html#set-${encodeURIComponent(set.id)}" ${safeImageStyle2(set.image)}></a>
        <div class="sample-card-body">
          <span class="eyebrow">${escapeHtml2(set.volume)}</span>
          <h3>${escapeHtml2(set.name)}</h3>
          <p>${escapeHtml2(set.intro || set.description)}</p>
          <div class="tag-row">${safeTagList(set.notes)}</div>
          <div class="price-row">
            <strong>${formatPrice(set.price)}</strong>
            <span>${escapeHtml2(set.bestFor)}</span>
          </div>
          <button class="button button-primary" type="button" data-add-cart="${escapeHtml2(set.id)}" ${set.canPurchase === false ? "disabled" : ""}>${set.canPurchase === false ? "\u6682\u4E0D\u53EF\u8D2D\u4E70" : "\u52A0\u5165\u610F\u5411\u6E05\u5355"}</button>
        </div>
      </article>
    `;
    }, initNavigation = function() {
      const header = $2("[data-header]");
      const toggle = $2("[data-nav-toggle]");
      const nav = $2("[data-nav]");
      const page = document.body.dataset.page;
      if (toggle && header) {
        toggle.addEventListener("click", () => {
          const open = header.classList.toggle("nav-open");
          toggle.setAttribute("aria-expanded", String(open));
          toggle.setAttribute("aria-label", open ? "\u5173\u95ED\u4E3B\u5BFC\u822A" : "\u6253\u5F00\u4E3B\u5BFC\u822A");
        });
      }
      if (nav) {
        $all2("a", nav).forEach((link) => {
          if (link.dataset.nav === page) link.classList.add("active");
          link.addEventListener("click", () => {
            header == null ? void 0 : header.classList.remove("nav-open");
            toggle == null ? void 0 : toggle.setAttribute("aria-expanded", "false");
            toggle == null ? void 0 : toggle.setAttribute("aria-label", "\u6253\u5F00\u4E3B\u5BFC\u822A");
          });
        });
      }
      const searchForm = $2("[data-site-search]");
      if (searchForm) {
        searchForm.addEventListener("submit", (event) => {
          event.preventDefault();
          const input = $2("[data-site-search-input]", searchForm);
          const q = input == null ? void 0 : input.value.trim();
          if (q) window.location.href = `shop.html?q=${encodeURIComponent(q)}`;
        });
      }
    }, renderHome = function() {
      const newGrid = $2("[data-home-new]");
      if (newGrid) {
        if (!state.catalogAvailable) {
          newGrid.innerHTML = catalogUnavailableMarkup();
          return;
        }
        const items = catalogData.products.filter((product) => product.status.includes("New") || product.status.includes("\u4E70\u624B\u63A8\u8350")).slice(0, 4);
        newGrid.innerHTML = items.map((product) => productCard(product, { compact: true })).join("");
      }
    }, initShop = function() {
      const grid = $2("[data-shop-grid]");
      if (!grid) return;
      const form = $2("[data-shop-filters]");
      const noteWrap = $2("[data-note-filter]");
      const brandSelect = $2("[data-brand-filter]");
      const result = $2("[data-result-count]");
      if (!state.catalogAvailable) {
        if (form) form.setAttribute("inert", "");
        if (result) result.textContent = "\u5546\u54C1\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528";
        grid.innerHTML = catalogUnavailableMarkup();
        return;
      }
      if (noteWrap) {
        noteWrap.innerHTML = ["\u5168\u90E8", ...catalogData.notes].map((note) => `
        <label class="chip">
          <input type="radio" name="note" value="${escapeHtml2(note === "\u5168\u90E8" ? "all" : note)}">
          <span>${escapeHtml2(note)}</span>
        </label>
      `).join("");
      }
      if (brandSelect) {
        brandSelect.innerHTML = `<option value="all">\u5168\u90E8\u54C1\u724C</option>${catalogData.brands.map((brand) => `<option value="${escapeHtml2(brand.id)}">${escapeHtml2(brand.name)}</option>`).join("")}`;
      }
      const urlParams = params();
      const initialNote = urlParams.get("note") || "all";
      const initialBrand = urlParams.get("brand") || "all";
      const initialScene = urlParams.get("scene") || "all";
      const initialCategory = urlParams.get("category") || "fragrance";
      const initialPrice = urlParams.get("price") || "all";
      const initialQuery = urlParams.get("q") || "";
      if (form) {
        const noteInput = $2(`input[name="note"][value="${CSS.escape(initialNote)}"]`, form) || $2("input[name='note'][value='all']", form);
        if (noteInput) noteInput.checked = true;
        const brand = $2("[name='brand']", form);
        const scene = $2("[name='scene']", form);
        const category = $2("[name='category']", form);
        const price = $2("[name='price']", form);
        const q = $2("[name='q']", form);
        if (brand) brand.value = initialBrand;
        if (scene) scene.value = initialScene;
        if (category) category.value = initialCategory;
        if (price) price.value = initialPrice;
        if (q) q.value = initialQuery;
        form.addEventListener("input", render);
        form.addEventListener("change", render);
        form.addEventListener("reset", () => setTimeout(render, 0));
      }
      function render() {
        const formData = new FormData(form);
        const note = formData.get("note") || "all";
        const brand = formData.get("brand") || "all";
        const scene = formData.get("scene") || "all";
        const price = formData.get("price") || "all";
        const category = formData.get("category") || "fragrance";
        const q = String(formData.get("q") || "").trim().toLowerCase();
        const filtered = catalogData.products.filter((product) => category === "all" || product.category === category).filter((product) => note === "all" || product.notes.includes(note)).filter((product) => brand === "all" || product.brandId === brand).filter((product) => scene === "all" || product.scenes.includes(scene)).filter((product) => {
          if (price === "under600") return product.price < 600;
          if (price === "600to900") return product.price >= 600 && product.price <= 900;
          if (price === "over900") return product.price > 900;
          return true;
        }).filter((product) => {
          if (!q) return true;
          return [product.brand, product.name, product.family, product.country, product.description, ...product.notes || [], ...product.status || []].join(" ").toLowerCase().includes(q);
        });
        if (result) result.textContent = `${filtered.length} \u4EF6\u4F5C\u54C1`;
        grid.innerHTML = filtered.length ? filtered.map((product) => productCard(product)).join("") : `
          <div class="empty-state">
            <h2>\u5F53\u524D\u7B5B\u9009\u6CA1\u6709\u5339\u914D\u4F5C\u54C1</h2>
            <p>\u53EF\u4EE5\u6E05\u9664\u7B5B\u9009\uFF0C\u6216\u5148\u4ECE\u8BD5\u9999\u5957\u88C5\u5F00\u59CB\uFF0C\u964D\u4F4E\u7B2C\u4E00\u6B21\u9009\u62E9\u7684\u98CE\u9669\u3002</p>
            <div class="button-row">
              <button class="button button-secondary" type="reset" form="${(form == null ? void 0 : form.id) || ""}">\u6E05\u9664\u7B5B\u9009</button>
              <a class="button button-primary" href="samples.html">\u67E5\u770B\u8BD5\u9999\u5957\u88C5</a>
            </div>
          </div>
        `;
      }
      render();
    }, renderProductPage = function() {
      const mount = $2("[data-product-page]");
      if (!mount) return;
      if (!state.catalogAvailable) {
        mount.innerHTML = catalogUnavailableMarkup();
        return;
      }
      if (!catalogData.products.length) {
        mount.innerHTML = `
        <div class="empty-state">
          <h2>\u6682\u65E0\u5DF2\u4E0A\u67B6\u5546\u54C1</h2>
          <p>\u5546\u54C1\u4E0A\u67B6\u540E\uFF0C\u8FD9\u91CC\u4F1A\u81EA\u52A8\u663E\u793A\u8BE6\u60C5\u3002</p>
          <a class="button button-primary" href="shop.html">\u8FD4\u56DE\u9999\u6C34\u5217\u8868</a>
        </div>
      `;
        return;
      }
      const requestedId = params().get("id") || mount.dataset.entryId || catalogData.products[0].id;
      const product = productById(requestedId);
      if (!product) {
        mount.innerHTML = `
        <div class="empty-state">
          <h2>\u5546\u54C1\u6682\u672A\u4E0A\u67B6</h2>
          <p>\u8FD9\u652F\u9999\u6C34\u53EF\u80FD\u5DF2\u7ECF\u4E0B\u67B6\uFF0C\u6216\u540E\u53F0\u8FD8\u6CA1\u6709\u53D1\u5E03\u3002</p>
          <a class="button button-primary" href="shop.html">\u8FD4\u56DE\u9999\u6C34\u5217\u8868</a>
        </div>
      `;
        return;
      }
      const brand = brandById(product.brandId);
      const related = catalogData.products.filter((item) => item.id !== product.id && (item.brandId === product.brandId || item.notes.some((note) => product.notes.includes(note)))).slice(0, 3);
      document.title = `${product.name} | \u99A5\u5C7F`;
      mount.innerHTML = `
      <nav class="breadcrumb" aria-label="\u9762\u5305\u5C51">
        <a href="index.html">\u9996\u9875</a>
        <span>/</span>
        <a href="shop.html">\u9999\u6C34</a>
        <span>/</span>
        <span>${escapeHtml2(product.name)}</span>
      </nav>
      <section class="product-detail">
        <div class="product-gallery">
          <div class="product-main-image" ${safeImageStyle2(product.image)}></div>
          <div class="gallery-note">\u53EF\u67E5\u770B\u74F6\u8EAB\u3001\u5305\u88C5\u548C\u7EC6\u8282\u56FE\uFF0C\u8D2D\u4E70\u524D\u4E5F\u53EF\u4EE5\u5148\u9009\u62E9\u8BD5\u9999\u5957\u88C5\u3002</div>
        </div>
        <div class="product-purchase">
          <p class="eyebrow">${escapeHtml2(product.brand)} \xB7 ${escapeHtml2(product.country)}</p>
          <h1>${escapeHtml2(product.name)}</h1>
          <p>${escapeHtml2(product.description)}</p>
          <div class="tag-row">${safeTagList(product.notes)}</div>
          <div class="purchase-guidance" aria-label="\u8D2D\u4E70\u524D\u5224\u65AD">
            <div>
              <span>\u4E70\u624B\u5224\u65AD</span>
              <p>${escapeHtml2(product.buyer)}</p>
            </div>
            <div>
              <span>\u9002\u5408\u573A\u666F</span>
              <strong>${escapeHtml2(product.bestFor)}</strong>
            </div>
            <div>
              <span>\u76F2\u4E70\u63D0\u9192</span>
              <p>${escapeHtml2(product.caution)}</p>
            </div>
          </div>
          <div class="purchase-box">
            <div><span>\u4EF7\u683C</span><strong>${formatPrice(product.price)}</strong></div>
            <div><span>\u5BB9\u91CF</span><strong>${escapeHtml2(product.volume)}</strong></div>
            <div><span>\u6D53\u5EA6</span><strong>${escapeHtml2(product.concentration)}</strong></div>
            <div><span>\u5E93\u5B58</span><strong>${escapeHtml2(product.stock)}</strong></div>
          </div>
          <div class="scent-brief product-detail-brief" aria-label="\u9999\u6C34\u6458\u8981">
            <div><span>\u9999\u8C03\u5BB6\u65CF</span><strong>${escapeHtml2(product.family)}</strong></div>
            <div><span>\u751C\u5EA6</span><strong>${sweetnessLabel(product.sweetness)}</strong></div>
            <div><span>\u8D2D\u4E70\u5EFA\u8BAE</span><strong>${buyingCue(product)}</strong></div>
          </div>
          <div class="purchase-actions">
            <button class="button button-primary" type="button" data-add-cart="${escapeHtml2(product.id)}" ${product.canPurchase === false ? "disabled" : ""}>${product.canPurchase === false ? "\u6682\u4E0D\u53EF\u8D2D\u4E70" : "\u54A8\u8BE2\u8FD9\u652F\u9999"}</button>
            <a class="button button-secondary" href="samples.html">\u4E0D\u786E\u5B9A\uFF0C\u5148\u8BD5\u9999</a>
            <button class="button button-secondary" type="button" data-favorite="${escapeHtml2(product.id)}" aria-pressed="${state.favorites.has(product.id)}">${state.favorites.has(product.id) ? "\u5DF2\u6536\u85CF" : "\u6536\u85CF"}</button>
          </div>
        </div>
      </section>
      <section class="detail-panels">
        <article>
          <h2>\u9999\u8C03\u7ED3\u6784</h2>
          <dl class="note-list">
            <div><dt>\u524D\u8C03</dt><dd>${escapeHtml2(product.top)}</dd></div>
            <div><dt>\u4E2D\u8C03</dt><dd>${escapeHtml2(product.middle)}</dd></div>
            <div><dt>\u540E\u8C03</dt><dd>${escapeHtml2(product.base)}</dd></div>
            <div><dt>\u9999\u8C03\u5BB6\u65CF</dt><dd>${escapeHtml2(product.family)}</dd></div>
            <div><dt>\u8C03\u9999\u5E08</dt><dd>${escapeHtml2(product.perfumer)}</dd></div>
            <div><dt>\u53D1\u5E03\u5E74\u4EFD</dt><dd>${escapeHtml2(product.year)}</dd></div>
          </dl>
        </article>
        <article>
          <h2>\u4E70\u624B\u70B9\u8BC4</h2>
          <p>${escapeHtml2(product.buyer)}</p>
          <p><strong>\u9002\u5408\uFF1A</strong>${escapeHtml2(product.bestFor)}</p>
          <p><strong>\u63D0\u9192\uFF1A</strong>${escapeHtml2(product.caution)}</p>
          <div class="detail-cta">
            <span class="status-badge">Sample first</span>
            <a class="text-link" href="samples.html">\u62C5\u5FC3\u76F2\u4E70\uFF1F\u5148\u4ECE\u8BD5\u9999\u5957\u88C5\u5F00\u59CB</a>
          </div>
        </article>
        <article>
          <h2>\u89C4\u683C\u4E0E\u670D\u52A1</h2>
          <p>\u5E93\u5B58\u3001\u9884\u8BA1\u53D1\u51FA\u65F6\u95F4\u3001\u914D\u9001\u65B9\u5F0F\u548C\u9000\u6362\u6761\u4EF6\u4F1A\u5728\u8D2D\u4E70\u524D\u7531\u5BA2\u670D\u786E\u8BA4\u3002\u8BD5\u9999\u3001\u62C6\u5C01\u5546\u54C1\u548C\u7279\u6B8A\u7EC4\u5408\u7684\u552E\u540E\u89C4\u5219\u4EE5\u5BA2\u670D\u8BF4\u660E\u4E3A\u51C6\u3002</p>
          <a class="text-link" href="service.html">\u67E5\u770B\u5BA2\u670D\u3001\u914D\u9001\u4E0E\u9000\u6362\u8BF4\u660E</a>
        </article>
      </section>
      <section class="section-tight">
        <div class="section-heading row-heading">
          <div>
            <p class="eyebrow">Related</p>
            <h2>\u76F8\u5173\u63A8\u8350</h2>
          </div>
          <a class="text-link" href="${brand ? brandUrl(brand.id) : "brands.html"}">\u67E5\u770B\u54C1\u724C</a>
        </div>
        <div class="product-grid">${related.map((item) => productCard(item, { compact: true })).join("")}</div>
      </section>
    `;
    }, renderBrands = function() {
      const grid = $2("[data-brand-grid]");
      if (grid) grid.innerHTML = catalogData.brands.map((brand2) => brandCard(brand2)).join("");
      const mount = $2("[data-brand-page]");
      if (!mount) return;
      const id = mount.dataset.entryId || params().get("id") || catalogData.brands[0].id;
      const brand = brandById(id) || catalogData.brands[0];
      const products = catalogData.products.filter((product) => product.brandId === brand.id);
      document.title = `${brand.name} | \u99A5\u5C7F`;
      mount.innerHTML = `
      <section class="split-hero compact-hero">
        <div class="split-copy">
          <nav class="breadcrumb" aria-label="\u9762\u5305\u5C51"><a href="brands.html">\u54C1\u724C</a><span>/</span><span>${escapeHtml2(brand.name)}</span></nav>
          <p class="eyebrow">${escapeHtml2(brand.country)}</p>
          <h1>${escapeHtml2(brand.name)}</h1>
          <p>${escapeHtml2(brand.intro)}</p>
          <div class="tag-row">${safeTagList(brand.keywords)}</div>
        </div>
        <div class="split-image" ${safeImageStyle2(brand.hero)}></div>
      </section>
      <section class="detail-panels">
        <article>
          <h2>\u54C1\u724C\u6545\u4E8B</h2>
          <p>${escapeHtml2(brand.story)}</p>
        </article>
        <article>
          <h2>\u521B\u4F5C\u4FE1\u606F</h2>
          <p><strong>\u521B\u529E\u4EBA / \u8C03\u9999\uFF1A</strong>${escapeHtml2(brand.founder)}</p>
          <p><strong>\u4E70\u624B\u5165\u95E8\u6B3E\uFF1A</strong>${escapeHtml2(brand.starter)}</p>
        </article>
        <article>
          <h2>\u5165\u95E8\u8DEF\u7EBF</h2>
          <p>\u7B2C\u4E00\u6B21\u63A5\u89E6 ${escapeHtml2(brand.name)}\uFF0C\u5EFA\u8BAE\u5148\u770B\u5173\u952E\u8BCD\u662F\u5426\u8D34\u5408\u4F60\u7684\u573A\u666F\uFF0C\u518D\u4ECE\u5165\u95E8\u6B3E\u6216\u540C\u54C1\u724C\u8BD5\u9999\u5F00\u59CB\u3002</p>
          <a class="text-link" href="shop.html?brand=${encodeURIComponent(brand.id)}">\u67E5\u770B\u53EF\u8D2D\u4E70\u4F5C\u54C1</a>
        </article>
      </section>
      <section class="section-tight">
        <div class="section-heading row-heading">
          <div>
            <p class="eyebrow">Works</p>
            <h2>${escapeHtml2(brand.name)} \u4F5C\u54C1</h2>
          </div>
          <a class="text-link" href="shop.html?brand=${encodeURIComponent(brand.id)}">\u8FDB\u5165\u5546\u54C1\u5217\u8868</a>
        </div>
        <div class="product-grid">${products.map((product) => productCard(product, { compact: true })).join("")}</div>
      </section>
    `;
    }, renderSamples = function() {
      const grid = $2("[data-sample-grid]");
      if (!grid) return;
      if (!state.catalogAvailable) {
        grid.innerHTML = catalogUnavailableMarkup();
        return;
      }
      const sampleProducts = catalogData.products.filter((product) => product.category === "sample");
      grid.innerHTML = sampleProducts.length ? sampleProducts.map(sampleCard).join("") : `<div class="empty-state"><h2>\u8BD5\u9999\u5957\u88C5\u6B63\u5728\u6574\u7406</h2><p>\u5F53\u524D\u6CA1\u6709\u5DF2\u4E0A\u67B6\u7684\u8BD5\u9999\u7EC4\u5408\uFF0C\u53EF\u5148\u8054\u7CFB\u5BA2\u670D\u8BF4\u660E\u9999\u8C03\u504F\u597D\u3002</p><a class="button button-secondary" href="service.html">\u8054\u7CFB\u5BA2\u670D</a></div>`;
    }, renderJournal = function() {
      const grid = $2("[data-journal-grid]");
      if (grid) grid.innerHTML = catalogData.articles.map(articleCard).join("");
      const mount = $2("[data-article-page]");
      if (!mount) return;
      const id = mount.dataset.entryId || params().get("id") || catalogData.articles[0].id;
      const article = articleById(id) || catalogData.articles[0];
      const relatedProducts = article.relatedProducts.map(productById).filter(Boolean);
      document.title = `${article.title} | \u99A5\u5C7F`;
      mount.innerHTML = `
      <article class="article-detail">
        <nav class="breadcrumb" aria-label="\u9762\u5305\u5C51"><a href="journal.html">Journal</a><span>/</span><span>${escapeHtml2(article.category)}</span></nav>
        <p class="eyebrow">${escapeHtml2(article.category)} \xB7 ${escapeHtml2(article.date)}</p>
        <h1>${escapeHtml2(article.title)}</h1>
        <div class="article-hero-image" ${safeImageStyle2(article.image)}></div>
        ${article.body.map((paragraph) => `<p>${escapeHtml2(paragraph)}</p>`).join("")}
        <div class="article-shop-note">
          <span class="status-badge">Shop the story</span>
          <p>\u8BFB\u5B8C\u540E\u5148\u770B\u6587\u4E2D\u63A8\u8350\uFF0C\u518D\u6309\u201C\u9002\u5408\u573A\u666F\u201D\u548C\u201C\u76F2\u4E70\u63D0\u9192\u201D\u51B3\u5B9A\u662F\u5426\u8FDB\u5165\u8BD5\u9999\u6216\u6B63\u88C5\u54A8\u8BE2\u3002</p>
        </div>
      </article>
      <section class="section-tight">
        <div class="section-heading">
          <p class="eyebrow">Shop the story</p>
          <h2>\u6587\u4E2D\u63A8\u8350</h2>
        </div>
        <div class="product-grid">${relatedProducts.map((product) => productCard(product, { compact: true })).join("")}</div>
      </section>
    `;
    }, memberNav = function() {
      return `
      <nav class="member-nav" aria-label="\u4F1A\u5458\u5BFC\u822A">
        <a class="text-link" href="account.html">\u4F1A\u5458\u4E2D\u5FC3</a>
        <a class="text-link" href="orders.html">\u8BA2\u5355\u8BB0\u5F55</a>
        <a class="text-link" href="points.html">\u79EF\u5206\u660E\u7EC6</a>
        <a class="text-link" href="points-mall.html">\u79EF\u5206\u5546\u57CE</a>
        <a class="text-link" href="points-redemptions.html">\u5151\u6362\u8BB0\u5F55</a>
        <a class="text-link" href="membership.html">\u4F1A\u5458\u89C4\u5219</a>
      </nav>
    `;
    }, requireLoginMarkup = function() {
      return `
      <div class="empty-state">
        <h2>\u8BF7\u5148\u767B\u5F55\u4F1A\u5458\u8D26\u53F7</h2>
        <p>\u767B\u5F55\u540E\u53EF\u4EE5\u67E5\u770B\u7B49\u7EA7\u3001\u79EF\u5206\u3001\u8BA2\u5355\u548C\u4F1A\u5458\u6298\u6263\u3002</p>
        <a class="button button-primary" href="login.html">\u767B\u5F55</a>
      </div>
    `;
    }, renderAuthForms = function() {
      const loginForm = $2("[data-login-form]");
      if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          const formData = new FormData(loginForm);
          const submitButton = loginForm.querySelector("button[type='submit']");
          setFormMessage(loginForm, "\u6B63\u5728\u767B\u5F55...");
          if (submitButton) submitButton.disabled = true;
          try {
            const result = await loginMember({
              account: formData.get("account"),
              password: formData.get("password")
            });
            const isAdmin = result.accountType === "admin";
            setFormMessage(loginForm, isAdmin ? "\u8EAB\u4EFD\u5DF2\u786E\u8BA4\uFF0C\u6B63\u5728\u8FDB\u5165\u8FD0\u8425\u540E\u53F0\u3002" : "\u767B\u5F55\u6210\u529F\uFF0C\u6B63\u5728\u8FDB\u5165\u4F1A\u5458\u4E2D\u5FC3\u3002", "success");
            showToast("\u767B\u5F55\u6210\u529F\u3002");
            window.location.href = result.destination || (isAdmin ? "admin.html#overview" : "account.html");
          } catch (error) {
            setFormMessage(loginForm, error.message, "error");
            showToast(error.message);
          } finally {
            if (submitButton) submitButton.disabled = false;
          }
        });
      }
      const registerForm = $2("[data-register-form]");
      if (registerForm) {
        registerForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          const formData = new FormData(registerForm);
          const submitButton = registerForm.querySelector("button[type='submit']");
          setFormMessage(registerForm, "\u6B63\u5728\u521B\u5EFA\u4F1A\u5458\u8D26\u53F7...");
          if (submitButton) submitButton.disabled = true;
          try {
            const result = await registerMember({
              name: formData.get("name"),
              email: formData.get("email"),
              phone: formData.get("phone"),
              password: formData.get("password"),
              acceptTerms: formData.has("acceptTerms"),
              acceptPrivacy: formData.has("acceptPrivacy")
            });
            if (result.verificationRequired) {
              setFormMessage(registerForm, "\u6CE8\u518C\u6210\u529F\u3002\u8BF7\u67E5\u6536\u90AE\u4EF6\u5B8C\u6210\u9A8C\u8BC1\u540E\u518D\u767B\u5F55\u3002", "success");
              showToast("\u9A8C\u8BC1\u90AE\u4EF6\u5DF2\u53D1\u9001\u3002");
            } else {
              setFormMessage(registerForm, "\u6CE8\u518C\u6210\u529F\uFF0C\u6B63\u5728\u8FDB\u5165\u4F1A\u5458\u4E2D\u5FC3\u3002", "success");
              window.location.href = "account.html";
            }
          } catch (error) {
            setFormMessage(registerForm, error.message, "error");
            showToast(error.message);
          } finally {
            if (submitButton) submitButton.disabled = false;
          }
        });
      }
    }, renderPasswordResetPage = function() {
      var _a, _b;
      const mount = $2("[data-reset-password-page]");
      if (!mount) return;
      const token = params().get("token");
      mount.innerHTML = token ? `<form class="account-form" data-new-password-form><label class="field-label">\u65B0\u5BC6\u7801<input name="password" type="password" minlength="10" autocomplete="new-password" required></label><p class="form-message" data-form-message></p><button class="button button-primary" type="submit">\u66F4\u65B0\u5BC6\u7801</button></form>` : `<form class="account-form" data-password-reset-request><label class="field-label">\u6CE8\u518C\u90AE\u7BB1<input name="email" type="email" autocomplete="email" required></label><p class="form-message" data-form-message></p><button class="button button-primary" type="submit">\u53D1\u9001\u91CD\u7F6E\u90AE\u4EF6</button></form>`;
      (_a = $2("[data-password-reset-request]", mount)) == null ? void 0 : _a.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
          await requestPasswordReset(new FormData(form).get("email"));
          setFormMessage(form, "\u5982\u679C\u8BE5\u90AE\u7BB1\u5DF2\u6CE8\u518C\uFF0C\u5C06\u6536\u5230\u91CD\u7F6E\u90AE\u4EF6\u3002", "success");
        } catch (error) {
          setFormMessage(form, error.message, "error");
        }
      });
      (_b = $2("[data-new-password-form]", mount)) == null ? void 0 : _b.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
          await resetPassword(token, new FormData(form).get("password"));
          setFormMessage(form, "\u5BC6\u7801\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55\u3002", "success");
          setTimeout(() => {
            window.location.href = "login.html";
          }, 700);
        } catch (error) {
          setFormMessage(form, error.message, "error");
        }
      });
    }, checkoutErrorDetails = function(error) {
      const status = Number((error == null ? void 0 : error.status) || 0);
      const message = String((error == null ? void 0 : error.message) || "\u8BF7\u6C42\u5931\u8D25\u3002");
      if (status === 401) {
        return { kind: "auth", title: "\u8BF7\u5148\u767B\u5F55", message: "\u767B\u5F55\u540E\u624D\u80FD\u8BFB\u53D6\u6536\u8D27\u5730\u5740\u5E76\u63D0\u4EA4\u8BA2\u5355\u3002" };
      }
      if (status === 409 || /库存|暂不可购买|已下架|售罄/.test(message)) {
        return { kind: "stock", title: "\u90E8\u5206\u5546\u54C1\u6682\u65F6\u65E0\u6CD5\u8D2D\u4E70", message };
      }
      if (status === 0) {
        return { kind: "network", title: "\u7F51\u7EDC\u8FDE\u63A5\u5931\u8D25", message: "\u6CA1\u6709\u6210\u529F\u8FDE\u63A5\u5230\u8BA2\u5355\u670D\u52A1\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5\u3002" };
      }
      if (status >= 500) {
        return { kind: "service", title: "\u8BA2\u5355\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528", message: "\u670D\u52A1\u5668\u6682\u65F6\u65E0\u6CD5\u786E\u8BA4\u4EF7\u683C\u548C\u5E93\u5B58\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002" };
      }
      return { kind: "request", title: "\u6682\u65F6\u65E0\u6CD5\u786E\u8BA4\u8BA2\u5355", message };
    }, checkoutErrorMarkup = function(error) {
      const details = checkoutErrorDetails(error);
      if (details.kind === "auth") return requireLoginMarkup();
      return `
      <div class="empty-state checkout-error" role="alert">
        <h2>${escapeHtml2(details.title)}</h2>
        <p>${escapeHtml2(details.message)}</p>
        <div class="button-row">
          <button class="button button-primary" type="button" data-checkout-retry>\u91CD\u65B0\u68C0\u67E5\u8BA2\u5355</button>
          <a class="button button-secondary" href="cart.html">\u8FD4\u56DE\u610F\u5411\u6E05\u5355</a>
        </div>
      </div>
    `;
    }, checkoutReviewMarkup = function(quote) {
      var _a;
      const discountKeys = [
        "productDiscountAmountYuan",
        "memberDiscountAmountYuan",
        "couponDiscountAmountYuan",
        "pointsDiscountAmountYuan"
      ];
      const totalDiscount = discountKeys.reduce((sum, key) => sum + Number(quote[key] || 0), 0);
      return `
      <section class="checkout-review" aria-labelledby="checkout-review-title">
        <div class="checkout-section-heading">
          <div>
            <p class="eyebrow">Order review</p>
            <h2 id="checkout-review-title">\u5546\u54C1\u660E\u7EC6</h2>
          </div>
          <a class="text-link" href="cart.html">\u4FEE\u6539\u6E05\u5355</a>
        </div>
        <div class="checkout-lines">
          ${(quote.lines || []).map((line) => `
            <article class="checkout-line">
              <div>
                <h3>${escapeHtml2(line.productName)}</h3>
                <p>${escapeHtml2(line.brandName || "Scent Atoll")} \xB7 \u6570\u91CF ${escapeHtml2(line.quantity)}</p>
                ${line.memberDiscountExcluded ? `<span>\u6B64\u5546\u54C1\u4E0D\u53C2\u4E0E\u4F1A\u5458\u6298\u6263</span>` : ""}
              </div>
              <dl>
                <div><dt>\u5355\u4EF7</dt><dd>${moneyText(line.unitPriceYuan)}</dd></div>
                <div><dt>\u5C0F\u8BA1</dt><dd>${moneyText(line.subtotalAmountYuan)}</dd></div>
              </dl>
            </article>
          `).join("")}
        </div>
        <dl class="checkout-totals" aria-label="\u8BA2\u5355\u91D1\u989D">
          <div><dt>\u5546\u54C1\u5C0F\u8BA1</dt><dd>${moneyText(quote.subtotalAmountYuan)}</dd></div>
          <div><dt>\u4F18\u60E0</dt><dd class="checkout-discount">${totalDiscount > 0 ? `-${moneyText(totalDiscount)}` : moneyText(0)}</dd></div>
          <div><dt>\u8FD0\u8D39</dt><dd>${moneyText(quote.shippingAmountYuan)}${Number(quote.shippingAmountYuan || 0) === 0 ? "\uFF08\u514D\u8FD0\u8D39\uFF09" : ""}</dd></div>
          <div class="checkout-total-row"><dt>\u5E94\u4ED8\u603B\u989D</dt><dd>${moneyText(quote.paidAmountYuan)}</dd></div>
        </dl>
        ${((_a = quote.tier) == null ? void 0 : _a.name) ? `<p class="checkout-tier-note">\u5F53\u524D\u6309 ${escapeHtml2(quote.tier.name)} \u4F1A\u5458\u6743\u76CA\u8BA1\u4EF7\uFF0C\u786E\u8BA4\u6536\u8D27\u540E\u9884\u8BA1\u83B7\u5F97 ${escapeHtml2(quote.pointsToEarn || 0)} \u79EF\u5206\u3002</p>` : ""}
      </section>
    `;
    }, adminLocationState = function() {
      const raw = window.location.hash.replace(/^#/, "") || "overview";
      const [requestedView, query = ""] = raw.split("?");
      return {
        view: adminViews[requestedView] ? requestedView : "overview",
        params: new URLSearchParams(query)
      };
    }, adminHref = function(view, values = {}) {
      const query = new URLSearchParams(Object.entries(values).filter(([, value]) => value)).toString();
      return `#${view}${query ? `?${query}` : ""}`;
    }, adminNavLink = function(view, label, activeView) {
      return `<a href="#${view}" class="admin-nav-link ${activeView === view ? "is-active" : ""}" ${activeView === view ? 'aria-current="page"' : ""}>${escapeHtml2(label)}</a>`;
    }, adminRoleLabel = function(role) {
      return { owner: "Owner", manager: "Manager", support: "\u5BA2\u670D", fulfillment: "\u4ED3\u5E93" }[role] || role;
    }, adminShellMarkup = function(session, activeView) {
      const pointsOpen = activeView.startsWith("points-");
      return `
      <div class="admin-app">
        <header class="admin-mobile-bar">
          <a class="admin-mobile-brand" href="#overview"><span class="brand-mark">SA</span><strong>\u99A5\u5C7F\u8FD0\u8425</strong></a>
          <button class="admin-menu-button" type="button" data-admin-nav-toggle aria-expanded="false" aria-controls="admin-sidebar">\u83DC\u5355</button>
        </header>
        <aside class="admin-sidebar" id="admin-sidebar" data-admin-sidebar>
          <div class="admin-brand">
            <a href="#overview" aria-label="\u8FD4\u56DE\u8FD0\u8425\u6982\u89C8"><span class="brand-mark">SA</span><span><strong>\u99A5\u5C7F</strong><small>Operations</small></span></a>
          </div>
          <nav class="admin-nav" data-admin-nav aria-label="\u540E\u53F0\u4E3B\u5BFC\u822A">
            ${adminNavLink("overview", "\u6982\u89C8", activeView)}
            ${adminNavLink("orders", "\u8BA2\u5355", activeView)}
            ${adminNavLink("products", "\u5546\u54C1", activeView)}
            ${adminNavLink("members", "\u4F1A\u5458", activeView)}
            <details class="admin-nav-group" ${pointsOpen ? "open" : ""}>
              <summary class="${pointsOpen ? "is-active" : ""}">\u79EF\u5206\u5546\u57CE</summary>
              <div>
                ${adminNavLink("points-items", "\u79EF\u5206\u5546\u54C1", activeView)}
                ${adminNavLink("points-redemptions", "\u5151\u6362\u8BA2\u5355", activeView)}
                ${adminNavLink("points-ledger", "\u79EF\u5206\u6D41\u6C34", activeView)}
              </div>
            </details>
            ${adminNavLink("more", "\u66F4\u591A", activeView)}
          </nav>
          <div class="admin-sidebar-footer">
            <a class="admin-store-link" href="index.html">\u67E5\u770B\u5E97\u94FA</a>
            <div><strong>${escapeHtml2(session.admin.name || "Owner")}</strong><span>${escapeHtml2(session.admin.email)}</span></div>
            <button class="text-button" type="button" data-admin-logout>\u9000\u51FA\u540E\u53F0</button>
          </div>
        </aside>
        <div class="admin-sidebar-scrim" data-admin-sidebar-scrim></div>
        <div class="admin-workspace" id="admin-workspace">
          <header class="admin-page-header">
            <div>
              <p class="admin-kicker">\u8FD0\u8425\u540E\u53F0</p>
              <h1 data-admin-view-title></h1>
              <p data-admin-view-description></p>
            </div>
            <span class="admin-role-badge">${escapeHtml2(adminRoleLabel(session.admin.role))}</span>
          </header>
          <section class="admin-view" data-admin-view aria-live="polite"></section>
        </div>
        <dialog class="admin-dialog" data-admin-dialog></dialog>
      </div>
    `;
    }, adminLoadingMarkup = function() {
      return `<div class="admin-skeleton" aria-label="\u6B63\u5728\u8BFB\u53D6\u6570\u636E"><span></span><span></span><span></span></div>`;
    }, adminEmptyMarkup = function(title, detail) {
      return `<div class="admin-empty"><h2>${escapeHtml2(title)}</h2><p>${escapeHtml2(detail)}</p></div>`;
    }, adminOrderActions = function(order) {
      return `
      <div class="admin-record-actions">
        ${order.status === "pending_payment" ? `<button class="button button-primary" type="button" data-admin-pay="${escapeHtml2(order.id)}" data-payment-amount="${escapeHtml2(order.paidAmountYuan)}" data-order-no="${escapeHtml2(order.orderNo)}">\u786E\u8BA4\u6536\u6B3E</button>` : ""}
        ${["paid", "processing"].includes(order.status) ? `<button class="button button-secondary" type="button" data-admin-ship="${escapeHtml2(order.id)}" data-order-no="${escapeHtml2(order.orderNo)}">\u767B\u8BB0\u53D1\u8D27</button>` : ""}
        ${order.status === "shipped" ? `<button class="button button-secondary" type="button" data-admin-complete="${escapeHtml2(order.id)}" data-order-no="${escapeHtml2(order.orderNo)}">\u4EE3\u5BA2\u786E\u8BA4\u6536\u8D27</button>` : ""}
        ${["paid", "shipped", "completed"].includes(order.status) ? `<button class="button button-danger" type="button" data-admin-refund="${escapeHtml2(order.id)}" data-order-no="${escapeHtml2(order.orderNo)}">\u767B\u8BB0\u9000\u6B3E</button>` : ""}
      </div>
    `;
    }, adminOrdersMarkup = function(payload, status = "") {
      const orders = payload.orders || [];
      const matchesStatus = (order, value) => value === "fulfillment" ? ["paid", "processing"].includes(order.status) : !value || order.status === value;
      const filtered = orders.filter((order) => matchesStatus(order, status));
      const filters = [
        ["", "\u5168\u90E8"],
        ["pending_payment", "\u5F85\u6838\u6B3E"],
        ["fulfillment", "\u5F85\u53D1\u8D27"],
        ["shipped", "\u5DF2\u53D1\u8D27"],
        ["completed", "\u5DF2\u5B8C\u6210"],
        ["refunded", "\u5DF2\u9000\u6B3E"]
      ];
      return `
      <div class="admin-toolbar">
        <label class="admin-search"><span>\u641C\u7D22\u8BA2\u5355</span><input type="search" data-admin-list-search placeholder="\u8BA2\u5355\u53F7\u3001\u5546\u54C1\u6216\u5BA2\u6237"></label>
        <nav class="admin-filter-row" aria-label="\u8BA2\u5355\u72B6\u6001\u7B5B\u9009">
          ${filters.map(([value, label]) => `<a href="${adminHref("orders", { status: value })}" class="${status === value ? "is-active" : ""}">${label}<span>${orders.filter((order) => matchesStatus(order, value)).length}</span></a>`).join("")}
        </nav>
      </div>
      <div class="admin-record-list" data-admin-record-list>
        ${filtered.map((order) => {
        var _a, _b, _c;
        const customer = ((_a = order.shippingAddress) == null ? void 0 : _a.recipientName) || ((_b = order.user) == null ? void 0 : _b.name) || ((_c = order.user) == null ? void 0 : _c.email) || "\u4F1A\u5458";
        const search = [order.orderNo, customer, ...order.items.map((item) => item.productName)].join(" ").toLowerCase();
        return `
            <details class="admin-record" data-admin-search-value="${escapeHtml2(search)}">
              <summary>
                <span><strong>${escapeHtml2(order.orderNo)}</strong><small>${escapeHtml2(customer)} \xB7 ${order.items.length} \u4EF6\u5546\u54C1</small></span>
                <span class="status-badge status-${escapeHtml2(order.status)}">${escapeHtml2(orderStatusLabel(order.status))}</span>
                <strong class="admin-record-amount">${moneyText(order.paidAmountYuan)}</strong>
              </summary>
              <div class="admin-record-detail">
                <div class="admin-detail-grid">
                  <div><span>\u5546\u54C1</span><strong>${order.items.map((item) => `${escapeHtml2(item.productName)} x ${escapeHtml2(item.quantity)}`).join("\u3001")}</strong></div>
                  <div><span>\u79EF\u5206\u72B6\u6001</span><strong>${escapeHtml2(orderPointsText(order))}</strong></div>
                  <div><span>\u6536\u8D27\u5730\u5740</span><strong>${order.shippingAddress ? escapeHtml2(`${order.shippingAddress.province}${order.shippingAddress.city}${order.shippingAddress.district || ""}${order.shippingAddress.addressLine}`) : "\u672A\u8BB0\u5F55"}</strong></div>
                  <div><span>\u7269\u6D41</span><strong>${order.shipment ? escapeHtml2(`${order.shipment.carrier} ${order.shipment.trackingNo}`) : "\u672A\u53D1\u8D27"}</strong></div>
                </div>
                ${adminOrderActions(order)}
              </div>
            </details>
          `;
      }).join("") || adminEmptyMarkup("\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u8BA2\u5355", "\u8C03\u6574\u7B5B\u9009\u6761\u4EF6\u6216\u641C\u7D22\u5176\u4ED6\u8BA2\u5355\u3002")}
      </div>
    `;
    }, adminMembersMarkup = function(payload) {
      const members = payload.members || [];
      return `
      <div class="admin-toolbar">
        <label class="admin-search"><span>\u641C\u7D22\u4F1A\u5458</span><input type="search" data-admin-list-search placeholder="\u59D3\u540D\u3001\u90AE\u7BB1\u6216\u624B\u673A"></label>
      </div>
      <div class="admin-record-list" data-admin-record-list>
        ${members.map((member) => {
        const name = member.user.name || member.user.email || member.user.phone;
        const search = [name, member.user.email, member.user.phone].filter(Boolean).join(" ").toLowerCase();
        return `
            <details class="admin-record" data-admin-search-value="${escapeHtml2(search)}">
              <summary>
                <span><strong>${escapeHtml2(name)}</strong><small>${escapeHtml2(member.user.email || member.user.phone)}</small></span>
                <span>${escapeHtml2(member.tier.name)}</span>
                <strong class="admin-record-amount">${escapeHtml2(member.profile.availablePoints)} \u79EF\u5206</strong>
              </summary>
              <div class="admin-record-detail">
                <div class="admin-detail-grid">
                  <div><span>\u7D2F\u8BA1\u6709\u6548\u6D88\u8D39</span><strong>${moneyText(member.profile.lifetimePaidAmountYuan)}</strong></div>
                  <div><span>\u52A0\u5165\u65F6\u95F4</span><strong>${new Date(member.user.createdAt).toLocaleDateString("zh-CN")}</strong></div>
                </div>
                <form class="admin-inline-form" data-admin-points-form="${escapeHtml2(member.user.id)}">
                  <label class="field-label">\u79EF\u5206\u53D8\u52A8<input name="points" type="number" step="1" placeholder="+100 \u6216 -50" required></label>
                  <label class="field-label">\u8C03\u6574\u539F\u56E0<input name="reason" value="\u540E\u53F0\u79EF\u5206\u8C03\u6574" required></label>
                  <button class="button button-secondary" type="submit">\u68C0\u67E5\u5E76\u8C03\u6574</button>
                </form>
              </div>
            </details>
          `;
      }).join("") || adminEmptyMarkup("\u8FD8\u6CA1\u6709\u4F1A\u5458", "\u65B0\u4F1A\u5458\u6CE8\u518C\u540E\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002")}
      </div>
    `;
    }, adminMallItemsMarkup = function(payload) {
      const items = payload.items || [];
      return `
      <details class="admin-create-panel" ${items.length ? "" : "open"}>
        <summary>\u65B0\u589E\u79EF\u5206\u5546\u54C1</summary>
        <form class="admin-inline-form admin-create-form" data-admin-mall-item-form>
          <label class="field-label">\u540D\u79F0<input name="name" required></label>
          <label class="field-label">\u5173\u8054\u5546\u54C1 ID<input name="productId" placeholder="\u53EF\u9009"></label>
          <label class="field-label">\u79EF\u5206\u4EF7\u683C<input name="pointsPrice" type="number" min="1" required></label>
          <label class="field-label">\u5E93\u5B58<input name="stockQuantity" type="number" min="0" required></label>
          <button class="button button-primary" type="submit">\u521B\u5EFA\u79EF\u5206\u5546\u54C1</button>
        </form>
      </details>
      <div class="admin-record-list">
        ${items.map((item) => `
          <article class="admin-simple-record">
            <span><strong>${escapeHtml2(item.name)}</strong><small>${escapeHtml2(mallItemStatusLabel(item.status))}</small></span>
            <span>${escapeHtml2(item.pointsPrice)} \u79EF\u5206</span>
            <span>\u5E93\u5B58 ${escapeHtml2(item.stockQuantity)}</span>
            <div class="admin-record-actions">
              ${item.status === "active" ? `<button class="button button-secondary" type="button" data-admin-mall-deactivate="${escapeHtml2(item.id)}">\u4E0B\u67B6</button>` : ""}
              ${item.status !== "active" && item.stockQuantity > 0 ? `<button class="button button-secondary" type="button" data-admin-mall-activate="${escapeHtml2(item.id)}">\u4E0A\u67B6</button>` : ""}
            </div>
          </article>
        `).join("") || adminEmptyMarkup("\u8FD8\u6CA1\u6709\u79EF\u5206\u5546\u54C1", "\u521B\u5EFA\u7B2C\u4E00\u4EF6\u79EF\u5206\u5546\u54C1\u540E\u5373\u53EF\u5F00\u59CB\u5151\u6362\u3002")}
      </div>
    `;
    }, adminRedemptionsMarkup = function(payload, status = "") {
      const all = payload.redemptions || [];
      const redemptions = status ? all.filter((item) => item.status === status) : all;
      return `
      <nav class="admin-filter-row" aria-label="\u5151\u6362\u8BA2\u5355\u72B6\u6001\u7B5B\u9009">
        ${[["", "\u5168\u90E8"], ["pending_fulfillment", "\u5F85\u5904\u7406"], ["processing", "\u5904\u7406\u4E2D"], ["shipped", "\u5DF2\u53D1\u8D27"], ["completed", "\u5DF2\u5B8C\u6210"]].map(([value, label]) => `<a href="${adminHref("points-redemptions", { status: value })}" class="${status === value ? "is-active" : ""}">${label}<span>${value ? all.filter((item) => item.status === value).length : all.length}</span></a>`).join("")}
      </nav>
      <div class="admin-record-list">
        ${redemptions.map((order) => {
        var _a, _b, _c;
        return `
          <details class="admin-record">
            <summary>
              <span><strong>${escapeHtml2(order.orderNo)}</strong><small>${escapeHtml2(((_a = order.user) == null ? void 0 : _a.name) || ((_b = order.user) == null ? void 0 : _b.email) || ((_c = order.user) == null ? void 0 : _c.phone) || "\u672A\u77E5\u4F1A\u5458")}</small></span>
              <span class="status-badge">${escapeHtml2(redemptionStatusLabel(order.status))}</span>
              <strong class="admin-record-amount">${order.totalPoints} \u79EF\u5206</strong>
            </summary>
            <div class="admin-record-detail">
              <p>${order.items.map((item) => `${escapeHtml2(item.name)} x ${escapeHtml2(item.quantity)}`).join("\u3001")}</p>
              <div class="admin-record-actions">
                ${order.status === "pending_fulfillment" ? `<button class="button button-secondary" type="button" data-admin-redemption-status="${escapeHtml2(order.id)}" data-status="processing">\u5F00\u59CB\u5904\u7406</button>` : ""}
                ${["pending_fulfillment", "processing"].includes(order.status) ? `<button class="button button-primary" type="button" data-admin-redemption-status="${escapeHtml2(order.id)}" data-status="shipped">\u767B\u8BB0\u53D1\u8D27</button>` : ""}
                ${order.status === "shipped" ? `<button class="button button-secondary" type="button" data-admin-redemption-status="${escapeHtml2(order.id)}" data-status="completed">\u6807\u8BB0\u5B8C\u6210</button>` : ""}
                ${!["cancelled", "completed"].includes(order.status) ? `<button class="button button-danger" type="button" data-admin-redemption-cancel="${escapeHtml2(order.id)}" data-order-no="${escapeHtml2(order.orderNo)}">\u53D6\u6D88\u5151\u6362</button>` : ""}
              </div>
            </div>
          </details>
        `;
      }).join("") || adminEmptyMarkup("\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u5151\u6362\u8BA2\u5355", "\u65B0\u7684\u79EF\u5206\u5151\u6362\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002")}
      </div>
    `;
    }, adminPointsMarkup = function(payload) {
      const transactions = payload.transactions || [];
      return `<div class="admin-record-list">
      ${transactions.map((item) => {
        var _a, _b, _c;
        return `
        <article class="admin-simple-record admin-ledger-row">
          <span><strong>${escapeHtml2(pointTypeLabel(item.type))}</strong><small>${escapeHtml2(((_a = item.user) == null ? void 0 : _a.name) || ((_b = item.user) == null ? void 0 : _b.email) || ((_c = item.user) == null ? void 0 : _c.phone) || "\u672A\u77E5\u4F1A\u5458")}${item.orderNo ? ` \xB7 ${escapeHtml2(item.orderNo)}` : ""}</small></span>
          <strong class="${item.points < 0 ? "is-negative" : "is-positive"}">${item.points > 0 ? "+" : ""}${item.points}</strong>
          <span>${new Date(item.createdAt).toLocaleString("zh-CN")}</span>
        </article>
      `;
      }).join("") || adminEmptyMarkup("\u6682\u65E0\u79EF\u5206\u6D41\u6C34", "\u8BA2\u5355\u7ED3\u7B97\u6216\u4EBA\u5DE5\u8C03\u6574\u540E\u4F1A\u663E\u793A\u8BB0\u5F55\u3002")}
    </div>`;
    }, adminMoreMarkup = function(payload, session) {
      const logs = payload.logs || [];
      const securityMarkup = session.admin.role === "owner" ? `
      <section class="admin-security-section" aria-labelledby="admin-security-title">
        <div class="admin-section-heading">
          <div><h2 id="admin-security-title">\u8D26\u53F7\u5B89\u5168</h2><p>\u4FEE\u6539\u5BC6\u7801\u4F1A\u81EA\u52A8\u9000\u51FA\u6B64 Owner \u5728\u5176\u4ED6\u8BBE\u5907\u4E0A\u7684\u540E\u53F0\u4F1A\u8BDD\u3002</p></div>
        </div>
        <div class="admin-security-grid">
          <form class="admin-security-form" data-admin-change-password>
            <h3>\u4FEE\u6539\u540E\u53F0\u5BC6\u7801</h3>
            <label class="field-label">\u5F53\u524D\u5BC6\u7801<input name="currentPassword" type="password" autocomplete="current-password" required></label>
            <label class="field-label">\u65B0\u5BC6\u7801<input name="newPassword" type="password" minlength="14" autocomplete="new-password" aria-describedby="admin-password-hint" required></label>
            <p id="admin-password-hint">\u81F3\u5C11 14 \u4F4D\uFF0C\u4E14\u4E0D\u80FD\u4E0E\u5F53\u524D\u5BC6\u7801\u76F8\u540C\u3002</p>
            <label class="field-label">\u518D\u6B21\u8F93\u5165\u65B0\u5BC6\u7801<input name="confirmPassword" type="password" minlength="14" autocomplete="new-password" required></label>
            <p class="form-message" data-form-message aria-live="polite"></p>
            <button class="button button-primary" type="submit">\u66F4\u65B0\u5BC6\u7801</button>
          </form>
          <form class="admin-security-form" data-admin-revoke-sessions-form>
            <h3>\u767B\u5F55\u8BBE\u5907</h3>
            <p>\u53D1\u73B0\u964C\u751F\u767B\u5F55\u6216\u4F7F\u7528\u8FC7\u516C\u7528\u7535\u8111\u65F6\uFF0C\u53EF\u9000\u51FA\u9664\u5F53\u524D\u6D4F\u89C8\u5668\u5916\u7684\u6240\u6709\u540E\u53F0\u4F1A\u8BDD\u3002</p>
            <p class="form-message" data-form-message aria-live="polite"></p>
            <button class="button button-secondary" type="submit">\u9000\u51FA\u5176\u4ED6\u8BBE\u5907</button>
          </form>
        </div>
      </section>
    ` : `
      <section class="admin-security-section" aria-labelledby="admin-security-title">
        <div class="admin-section-heading"><div><h2 id="admin-security-title">\u8D26\u53F7\u5B89\u5168</h2><p>\u540E\u53F0\u5BC6\u7801\u548C\u4F1A\u8BDD\u7531 Owner \u7EDF\u4E00\u7BA1\u7406\u3002</p></div></div>
      </section>
    `;
      return `
      ${securityMarkup}
      <section class="admin-more-actions" aria-labelledby="admin-data-title">
        <div><h2 id="admin-data-title">\u6570\u636E\u4E0E\u9000\u51FA</h2><p>\u4F4E\u9891\u64CD\u4F5C\u96C6\u4E2D\u5728\u8FD9\u91CC\uFF0C\u907F\u514D\u6253\u65AD\u65E5\u5E38\u8BA2\u5355\u5904\u7406\u3002</p></div>
        <div class="button-row"><button class="button button-secondary" type="button" data-admin-export>\u5BFC\u51FA\u4F1A\u5458\u540D\u5355</button><button class="button button-secondary" type="button" data-admin-logout>\u9000\u51FA\u540E\u53F0</button></div>
      </section>
      <section class="admin-log-section">
        <div class="admin-section-heading"><h2>\u64CD\u4F5C\u65E5\u5FD7</h2><span>\u6700\u8FD1 ${Math.min(logs.length, 50)} \u6761</span></div>
        <div class="admin-record-list">
          ${logs.slice(0, 50).map((item) => `<article class="admin-simple-record"><span><strong>${escapeHtml2(adminActionLabel(item.action))}</strong><small>${escapeHtml2(item.reason || item.entityType)} \xB7 ${escapeHtml2(item.actor)}</small></span><span>${new Date(item.createdAt).toLocaleString("zh-CN")}</span></article>`).join("") || adminEmptyMarkup("\u6682\u65E0\u64CD\u4F5C\u65E5\u5FD7", "\u654F\u611F\u64CD\u4F5C\u5B8C\u6210\u540E\u4F1A\u8BB0\u5F55\u5728\u8FD9\u91CC\u3002")}
        </div>
      </section>
    `;
    }, adminOverviewMarkup = function(ordersPayload, redemptionsPayload, productsPayload, logsPayload) {
      const orders = ordersPayload.orders || [];
      const redemptions = redemptionsPayload.redemptions || [];
      const products = productsPayload.products || [];
      const tasks = [
        { label: "\u5F85\u6838\u6B3E", count: orders.filter((item) => item.status === "pending_payment").length, detail: "\u6838\u5BF9\u5FAE\u4FE1\u8F6C\u8D26", href: adminHref("orders", { status: "pending_payment" }) },
        { label: "\u5F85\u53D1\u8D27", count: orders.filter((item) => ["paid", "processing"].includes(item.status)).length, detail: "\u586B\u5199\u7269\u6D41\u4FE1\u606F", href: adminHref("orders", { status: "fulfillment" }) },
        { label: "\u5F85\u5904\u7406\u5151\u6362", count: redemptions.filter((item) => item.status === "pending_fulfillment").length, detail: "\u79EF\u5206\u5546\u54C1\u51FA\u5E93", href: adminHref("points-redemptions", { status: "pending_fulfillment" }) },
        { label: "\u4F4E\u5E93\u5B58", count: products.filter((item) => item.availableQuantity > 0 && item.availableQuantity <= 3).length, detail: "\u8865\u8D27\u6216\u8C03\u6574\u72B6\u6001", href: adminHref("products", { stock: "low" }) }
      ];
      const recentOrders = orders.slice(0, 6);
      const logs = (logsPayload.logs || []).slice(0, 6);
      return `
      <section class="admin-task-section" aria-labelledby="admin-task-title">
        <div class="admin-section-heading"><h2 id="admin-task-title">\u4ECA\u65E5\u5F85\u529E</h2><span>${tasks.reduce((sum, item) => sum + item.count, 0)} \u9879\u5F85\u5904\u7406</span></div>
        <div class="admin-task-list">
          ${tasks.map((item) => `<a href="${item.href}"><span><strong>${item.label}</strong><small>${item.detail}</small></span><b>${item.count}</b><span aria-hidden="true">\u2192</span></a>`).join("")}
        </div>
      </section>
      <div class="admin-overview-columns">
        <section>
          <div class="admin-section-heading"><h2>\u8FD1\u671F\u8BA2\u5355</h2><a href="#orders">\u67E5\u770B\u5168\u90E8</a></div>
          <div class="admin-compact-list">${recentOrders.map((order) => `<a href="${adminHref("orders", { status: order.status })}"><span><strong>${escapeHtml2(order.orderNo)}</strong><small>${escapeHtml2(orderStatusLabel(order.status))}</small></span><b>${moneyText(order.paidAmountYuan)}</b></a>`).join("") || adminEmptyMarkup("\u6682\u65E0\u8BA2\u5355", "\u65B0\u8BA2\u5355\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002")}</div>
        </section>
        <section>
          <div class="admin-section-heading"><h2>\u6700\u8FD1\u64CD\u4F5C</h2><a href="#more">\u67E5\u770B\u65E5\u5FD7</a></div>
          <div class="admin-compact-list">${logs.map((item) => `<div><span><strong>${escapeHtml2(adminActionLabel(item.action))}</strong><small>${escapeHtml2(item.actor)}</small></span><time>${new Date(item.createdAt).toLocaleDateString("zh-CN")}</time></div>`).join("") || adminEmptyMarkup("\u6682\u65E0\u64CD\u4F5C", "\u64CD\u4F5C\u8BB0\u5F55\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002")}</div>
        </section>
      </div>
    `;
    }, bindAdminListSearch = function(root) {
      const input = $2("[data-admin-list-search]", root);
      if (!input) return;
      input.addEventListener("input", () => {
        const query = input.value.trim().toLowerCase();
        $all2("[data-admin-search-value]", root).forEach((item) => {
          item.hidden = Boolean(query) && !item.dataset.adminSearchValue.includes(query);
        });
      });
    }, pointTypeLabel = function(type) {
      return {
        earn_order: "\u8BA2\u5355\u79EF\u5206",
        use_order: "\u8BA2\u5355\u62B5\u6263",
        refund_reversal: "\u9000\u6B3E\u6263\u56DE",
        expire_points: "\u79EF\u5206\u8FC7\u671F",
        redeem_points: "\u79EF\u5206\u5151\u6362",
        redeem_refund: "\u5151\u6362\u8FD4\u8FD8",
        admin_adjust: "\u4EBA\u5DE5\u8C03\u6574"
      }[type] || type;
    }, orderStatusLabel = function(status) {
      return {
        pending_payment: "\u5F85\u6838\u6B3E",
        paid: "\u5DF2\u652F\u4ED8",
        processing: "\u5904\u7406\u4E2D",
        shipped: "\u5DF2\u53D1\u8D27",
        completed: "\u5DF2\u786E\u8BA4\u6536\u8D27",
        cancelled: "\u5DF2\u53D6\u6D88",
        refunded: "\u5DF2\u9000\u6B3E"
      }[status] || status;
    }, redemptionStatusLabel = function(status) {
      return {
        pending_fulfillment: "\u5F85\u5904\u7406",
        processing: "\u5904\u7406\u4E2D",
        shipped: "\u5DF2\u53D1\u8D27",
        completed: "\u5DF2\u5B8C\u6210",
        cancelled: "\u5DF2\u53D6\u6D88"
      }[status] || status;
    }, mallItemStatusLabel = function(status) {
      return {
        draft: "\u8349\u7A3F",
        active: "\u5DF2\u4E0A\u67B6",
        inactive: "\u5DF2\u4E0B\u67B6",
        sold_out: "\u5DF2\u5151\u5B8C"
      }[status] || status;
    }, orderPointsText = function(order) {
      if (order.status === "refunded") return order.pointsAwarded ? "\u5DF2\u9000\u6B3E\uFF0C\u79EF\u5206\u5DF2\u64A4\u56DE" : "\u5DF2\u9000\u6B3E\uFF0C\u4E0D\u53D1\u653E\u79EF\u5206";
      if (order.pointsAwarded) return `\u5DF2\u53D1\u653E\u79EF\u5206\uFF1A${order.pointsAwarded}`;
      if (["paid", "processing", "shipped"].includes(order.status)) return "\u786E\u8BA4\u6536\u8D27\u540E\u53D1\u653E\u79EF\u5206";
      return "\u5F85\u652F\u4ED8\u786E\u8BA4";
    }, adminActionLabel = function(action) {
      return {
        adjust_member_tier: "\u8C03\u6574\u4F1A\u5458\u7B49\u7EA7",
        adjust_member_points: "\u8C03\u6574\u79EF\u5206",
        update_order_status: "\u4FEE\u6539\u8BA2\u5355\u72B6\u6001",
        confirm_order_paid: "\u786E\u8BA4\u652F\u4ED8",
        refund_order: "\u9000\u6B3E",
        confirm_order_received: "\u786E\u8BA4\u6536\u8D27",
        create_member_tier: "\u65B0\u589E\u4F1A\u5458\u7B49\u7EA7",
        update_member_tier: "\u66F4\u65B0\u4F1A\u5458\u7B49\u7EA7",
        create_points_mall_item: "\u65B0\u589E\u79EF\u5206\u5546\u54C1",
        update_points_mall_item: "\u66F4\u65B0\u79EF\u5206\u5546\u54C1",
        activate_points_mall_item: "\u4E0A\u67B6\u79EF\u5206\u5546\u54C1",
        deactivate_points_mall_item: "\u4E0B\u67B6\u79EF\u5206\u5546\u54C1",
        update_points_redemption_status: "\u66F4\u65B0\u5151\u6362\u8BA2\u5355",
        cancel_points_redemption: "\u53D6\u6D88\u5151\u6362\u8BA2\u5355",
        create_product: "\u65B0\u589E\u5546\u54C1",
        update_product: "\u66F4\u65B0\u5546\u54C1",
        activate_product: "\u4E0A\u67B6\u5546\u54C1",
        deactivate_product: "\u4E0B\u67B6\u5546\u54C1",
        archive_product: "\u5F52\u6863\u5546\u54C1",
        adjust_product_inventory: "\u8C03\u6574\u5546\u54C1\u5E93\u5B58",
        upload_product_image: "\u4E0A\u4F20\u5546\u54C1\u56FE\u7247",
        delete_product_image: "\u5220\u9664\u5546\u54C1\u56FE\u7247",
        ship_order: "\u767B\u8BB0\u8BA2\u5355\u53D1\u8D27",
        release_expired_reservations: "\u91CA\u653E\u8D85\u65F6\u5E93\u5B58"
      }[action] || action;
    }, refreshMemberQuote = function() {
      const mounts = $all2("[data-member-quote]");
      if (!mounts.length) return;
      mounts.forEach((mount) => {
        mount.textContent = "\u8BD5\u8FD0\u8425\u671F\u95F4\u91C7\u7528\u5FAE\u4FE1\u4EBA\u5DE5\u8F6C\u8D26\u3002\u767B\u5F55\u540E\u53EF\u63D0\u4EA4\u8BA2\u5355\uFF0C\u5E93\u5B58\u4F1A\u77ED\u65F6\u9884\u7559\uFF0C\u5F85\u540E\u53F0\u6838\u5BF9\u8F6C\u8D26\u540E\u786E\u8BA4\u6536\u6B3E\u3002";
      });
    }, addToCart = function(id, trigger) {
      if (!state.catalogAvailable) {
        showToast("\u5546\u54C1\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u91CD\u65B0\u52A0\u8F7D\u540E\u518D\u8BD5\u3002");
        return;
      }
      try {
        const item = cartStore.addItem(id);
        renderCartShell();
        renderCartPage();
        refreshMemberQuote();
        openCart(trigger);
        showToast(`${item.name} \u5DF2\u52A0\u5165\u610F\u5411\u6E05\u5355`);
      } catch (error) {
        showToast(error.message);
      }
    }, changeCart = function(id, delta, control) {
      var _a;
      const wasOpen = (_a = $2("[data-cart-drawer]")) == null ? void 0 : _a.classList.contains("open");
      try {
        cartStore.changeQuantity(id, Number(delta));
        renderCartShell();
        renderCartPage();
        refreshMemberQuote();
        if (wasOpen) {
          const selector = `[data-cart-change="${CSS.escape(id)}"][data-delta="${Number(delta)}"]`;
          openCart(control, selector);
        }
      } catch (error) {
        showToast(error.message);
      }
    }, toggleFavorite = function(id) {
      const item = catalogData.products.find((product) => product.id === id) || catalogData.sampleSets.find((set) => set.id === id);
      if (!item) return;
      if (state.favorites.has(id)) {
        state.favorites.delete(id);
        showToast(`${item.name} \u5DF2\u53D6\u6D88\u6536\u85CF`);
      } else {
        state.favorites.add(id);
        showToast(`${item.name} \u5DF2\u6536\u85CF`);
      }
      writeStore("sa_favorites", Array.from(state.favorites));
      $all2(`[data-favorite="${CSS.escape(id)}"]`).forEach((button) => {
        button.textContent = state.favorites.has(id) ? "\u5DF2\u6536\u85CF" : "\u6536\u85CF";
        button.setAttribute("aria-pressed", String(state.favorites.has(id)));
      });
    }, showToast = function(message) {
      let toast = $2(".toast");
      if (!toast) {
        toast = document.createElement("div");
        toast.className = "toast";
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
    }, bindGlobalActions = function() {
      document.addEventListener("click", async (event) => {
        if (!(event.target instanceof Element)) return;
        const add = event.target.closest("[data-add-cart]");
        const fav = event.target.closest("[data-favorite]");
        const open = event.target.closest("[data-open-cart]");
        const close = event.target.closest("[data-close-cart]");
        const change = event.target.closest("[data-cart-change]");
        const service = event.target.closest("[data-service-action]");
        const logout = event.target.closest("[data-logout]");
        const adminPay = event.target.closest("[data-admin-pay]");
        const adminShip = event.target.closest("[data-admin-ship]");
        const adminRefund = event.target.closest("[data-admin-refund]");
        const adminComplete = event.target.closest("[data-admin-complete]");
        const confirmReceipt = event.target.closest("[data-confirm-receipt]");
        const cancelMemberOrder = event.target.closest("[data-cancel-order]");
        const adminExport = event.target.closest("[data-admin-export]");
        const adminLogoutButton = event.target.closest("[data-admin-logout]");
        const adminMallActivate = event.target.closest("[data-admin-mall-activate]");
        const adminMallDeactivate = event.target.closest("[data-admin-mall-deactivate]");
        const adminProductActivate = event.target.closest("[data-admin-product-activate]");
        const adminProductDeactivate = event.target.closest("[data-admin-product-deactivate]");
        const adminProductArchive = event.target.closest("[data-admin-product-archive]");
        const adminRedemptionStatus = event.target.closest("[data-admin-redemption-status]");
        const adminRedemptionCancel = event.target.closest("[data-admin-redemption-cancel]");
        const retryCatalog = event.target.closest("[data-retry-catalog]");
        if (add) addToCart(add.dataset.addCart, add);
        if (fav) toggleFavorite(fav.dataset.favorite);
        if (open) openCart(open);
        if (close) closeCart();
        if (change) changeCart(change.dataset.cartChange, Number(change.dataset.delta), change);
        if (retryCatalog) window.location.reload();
        if (service) showToast(service.dataset.serviceAction);
        if (logout) {
          try {
            await logoutMember();
            resetSessionCache();
            showToast("\u5DF2\u9000\u51FA\u767B\u5F55\u3002");
            window.location.href = "index.html";
          } catch (error) {
            showToast(error.message);
          }
        }
        if (adminPay) {
          const confirmed = await requestAdminAction({
            title: `\u786E\u8BA4\u8BA2\u5355 ${adminPay.dataset.orderNo || ""} \u5DF2\u6536\u6B3E`,
            description: `\u8BF7\u5148\u5728\u5FAE\u4FE1\u4E2D\u6838\u5BF9\u5230\u8D26\u91D1\u989D\u3002\u8BA2\u5355\u5E94\u6536 ${moneyText(adminPay.dataset.paymentAmount || 0)}\uFF0C\u786E\u8BA4\u540E\u5C06\u6263\u51CF\u5E93\u5B58\u5E76\u8BB0\u5F55\u64CD\u4F5C\u4EBA\u3002`,
            confirmLabel: "\u786E\u8BA4\u5DF2\u7ECF\u6536\u6B3E",
            fields: [
              { name: "paymentAmount", label: "\u5B9E\u9645\u5230\u8D26\u91D1\u989D", type: "number", step: "0.01", value: adminPay.dataset.paymentAmount },
              { name: "paymentReference", label: "\u5FAE\u4FE1\u8F6C\u8D26\u5355\u53F7\u6216\u5BF9\u8D26\u53C2\u8003\u53F7" }
            ]
          });
          if (!confirmed) return;
          const paymentReference = confirmed.paymentReference;
          const idempotencyKey = actionIdempotencyKey(adminPay, "order-pay", { paymentReference });
          try {
            await adminPayOrder(adminPay.dataset.adminPay, {
              paymentReference,
              paymentAmount: Number(confirmed.paymentAmount),
              idempotencyKey
            });
            resetSessionCache();
            showToast("\u8BA2\u5355\u5DF2\u786E\u8BA4\u652F\u4ED8\uFF0C\u7B49\u5F85\u5BA2\u6237\u786E\u8BA4\u6536\u8D27\u540E\u7ED3\u7B97\u79EF\u5206\u548C\u7B49\u7EA7\u3002");
            await renderOrdersPage();
            await renderAdminPage();
            await initAuthHeader();
          } catch (error) {
            showToast(error.message);
          }
        }
        if (adminShip) {
          const confirmed = await requestAdminAction({
            title: `\u767B\u8BB0\u8BA2\u5355 ${adminShip.dataset.orderNo || ""} \u53D1\u8D27`,
            description: "\u7269\u6D41\u4FE1\u606F\u4F1A\u53D1\u9001\u7ED9\u5BA2\u6237\u3002\u63D0\u4EA4\u524D\u8BF7\u68C0\u67E5\u516C\u53F8\u540D\u79F0\u548C\u5355\u53F7\u3002",
            confirmLabel: "\u786E\u8BA4\u767B\u8BB0\u53D1\u8D27",
            fields: [
              { name: "carrier", label: "\u7269\u6D41\u516C\u53F8" },
              { name: "trackingNo", label: "\u7269\u6D41\u5355\u53F7" }
            ]
          });
          if (!confirmed) return;
          const { carrier, trackingNo } = confirmed;
          const shipmentPayload = { carrier, trackingNo };
          shipmentPayload.idempotencyKey = actionIdempotencyKey(adminShip, "order-ship", shipmentPayload);
          try {
            await adminShipOrder(adminShip.dataset.adminShip, shipmentPayload);
            showToast("\u53D1\u8D27\u4FE1\u606F\u5DF2\u4FDD\u5B58\u3002");
            await renderAdminPage();
          } catch (error) {
            showToast(error.message);
          }
        }
        if (cancelMemberOrder) {
          if (!window.confirm("\u786E\u5B9A\u53D6\u6D88\u8FD9\u4E2A\u8BA2\u5355\uFF1F")) return;
          const idempotencyKey = actionIdempotencyKey(cancelMemberOrder, "order-cancel");
          try {
            await cancelOrder(cancelMemberOrder.dataset.cancelOrder, "member_cancelled", idempotencyKey);
            showToast("\u8BA2\u5355\u5DF2\u53D6\u6D88\u3002");
            await renderOrdersPage();
          } catch (error) {
            showToast(error.message);
          }
        }
        if (confirmReceipt) {
          if (!window.confirm("\u786E\u8BA4\u5DF2\u7ECF\u6536\u5230\u5546\u54C1\uFF1F\u786E\u8BA4\u540E\u5C06\u7ED3\u7B97\u79EF\u5206\u548C\u4F1A\u5458\u7B49\u7EA7\u3002")) return;
          const idempotencyKey = actionIdempotencyKey(confirmReceipt, "order-receive");
          try {
            await confirmReceiptOrder(confirmReceipt.dataset.confirmReceipt, idempotencyKey);
            resetSessionCache();
            showToast("\u5DF2\u786E\u8BA4\u6536\u8D27\uFF0C\u79EF\u5206\u548C\u7B49\u7EA7\u5DF2\u7ED3\u7B97\u3002");
            await renderOrdersPage();
            await initAuthHeader();
          } catch (error) {
            showToast(error.message);
          }
        }
        if (adminComplete) {
          const confirmed = await requestAdminAction({
            title: `\u4EE3\u5BA2\u786E\u8BA4\u8BA2\u5355 ${adminComplete.dataset.orderNo || ""} \u5DF2\u6536\u8D27`,
            description: "\u786E\u8BA4\u540E\u5C06\u7ED3\u7B97\u4F1A\u5458\u79EF\u5206\u548C\u7B49\u7EA7\u3002\u53EA\u6709\u5DF2\u7ECF\u6838\u5B9E\u5BA2\u6237\u6536\u8D27\u65F6\u624D\u80FD\u7EE7\u7EED\u3002",
            confirmLabel: "\u786E\u8BA4\u5BA2\u6237\u5DF2\u7ECF\u6536\u8D27"
          });
          if (!confirmed) return;
          const idempotencyKey = actionIdempotencyKey(adminComplete, "admin-complete");
          try {
            await adminCompleteOrder(adminComplete.dataset.adminComplete, idempotencyKey);
            resetSessionCache();
            showToast("\u8BA2\u5355\u5DF2\u786E\u8BA4\u6536\u8D27\uFF0C\u79EF\u5206\u548C\u7B49\u7EA7\u5DF2\u7ED3\u7B97\u3002");
            await renderAdminPage();
            await renderOrdersPage();
            await initAuthHeader();
          } catch (error) {
            showToast(error.message);
          }
        }
        if (adminRefund) {
          const confirmed = await requestAdminAction({
            title: `\u767B\u8BB0\u8BA2\u5355 ${adminRefund.dataset.orderNo || ""} \u9000\u6B3E`,
            description: "\u786E\u8BA4\u540E\u5C06\u6062\u590D\u5E93\u5B58\uFF0C\u5E76\u64A4\u56DE\u76F8\u5173\u79EF\u5206\u548C\u7D2F\u8BA1\u6D88\u8D39\u3002\u8BF7\u5148\u5B8C\u6210\u5B9E\u9645\u9000\u6B3E\u8F6C\u8D26\u3002",
            confirmLabel: "\u786E\u8BA4\u5DF2\u7ECF\u9000\u6B3E",
            danger: true,
            fields: [
              { name: "refundReference", label: "\u9000\u6B3E\u8F6C\u8D26\u53C2\u8003\u53F7" },
              { name: "reason", label: "\u9000\u6B3E\u539F\u56E0", value: "\u540E\u53F0\u4EBA\u5DE5\u9000\u6B3E" }
            ]
          });
          if (!confirmed) return;
          const refundPayload = { refundReference: confirmed.refundReference, reason: confirmed.reason };
          refundPayload.idempotencyKey = actionIdempotencyKey(adminRefund, "admin-refund", refundPayload);
          try {
            await adminRefundOrder(adminRefund.dataset.adminRefund, refundPayload);
            resetSessionCache();
            showToast("\u8BA2\u5355\u5DF2\u9000\u6B3E\uFF0C\u79EF\u5206\u548C\u7D2F\u8BA1\u6D88\u8D39\u5DF2\u6263\u56DE\u3002");
            await renderAdminPage();
            await renderOrdersPage();
            await initAuthHeader();
          } catch (error) {
            showToast(error.message);
          }
        }
        if (adminMallActivate || adminMallDeactivate) {
          const node = adminMallActivate || adminMallDeactivate;
          const action = adminMallActivate ? "activate" : "deactivate";
          const idempotencyKey = actionIdempotencyKey(node, `mall-${action}`);
          try {
            await adminSetMallItemStatus(node.dataset.adminMallActivate || node.dataset.adminMallDeactivate, action, idempotencyKey);
            showToast(action === "activate" ? "\u79EF\u5206\u5546\u54C1\u5DF2\u4E0A\u67B6\u3002" : "\u79EF\u5206\u5546\u54C1\u5DF2\u4E0B\u67B6\u3002");
            await renderAdminPage();
          } catch (error) {
            showToast(error.message);
          }
        }
        if (adminProductActivate || adminProductDeactivate || adminProductArchive) {
          const node = adminProductActivate || adminProductDeactivate || adminProductArchive;
          const action = adminProductActivate ? "activate" : adminProductDeactivate ? "deactivate" : "archive";
          if (action === "archive") {
            const confirmed = await requestAdminAction({
              title: "\u5F52\u6863\u5546\u54C1",
              description: "\u5F52\u6863\u540E\u5546\u54C1\u4E0D\u4F1A\u51FA\u73B0\u5728\u5E97\u94FA\u4E2D\u3002\u5386\u53F2\u8BA2\u5355\u4ECD\u4F1A\u4FDD\u7559\u5546\u54C1\u5FEB\u7167\u3002",
              confirmLabel: "\u786E\u8BA4\u5F52\u6863\u5546\u54C1",
              danger: true
            });
            if (!confirmed) return;
          }
          const idempotencyKey = actionIdempotencyKey(node, `product-${action}`);
          try {
            await adminSetProductStatus(
              node.dataset.adminProductActivate || node.dataset.adminProductDeactivate || node.dataset.adminProductArchive,
              action,
              idempotencyKey
            );
            showToast(action === "activate" ? "\u5546\u54C1\u5DF2\u4E0A\u67B6\u3002" : action === "deactivate" ? "\u5546\u54C1\u5DF2\u4E0B\u67B6\u3002" : "\u5546\u54C1\u5DF2\u5F52\u6863\u3002");
            await renderAdminPage();
          } catch (error) {
            showToast(error.message);
          }
        }
        if (adminRedemptionStatus) {
          const isShipping = adminRedemptionStatus.dataset.status === "shipped";
          const confirmed = isShipping ? await requestAdminAction({ title: "\u767B\u8BB0\u5151\u6362\u8BA2\u5355\u53D1\u8D27", description: "\u63D0\u4EA4\u540E\u4F1A\u5458\u53EF\u4EE5\u770B\u5230\u5151\u6362\u8BA2\u5355\u5DF2\u53D1\u8D27\u3002", confirmLabel: "\u786E\u8BA4\u767B\u8BB0\u53D1\u8D27", fields: [{ name: "trackingNo", label: "\u7269\u6D41\u5355\u53F7", required: false }] }) : { trackingNo: "" };
          if (!confirmed) return;
          const trackingNo = confirmed.trackingNo || "";
          const redemptionPayload = {
            status: adminRedemptionStatus.dataset.status,
            trackingNo
          };
          redemptionPayload.idempotencyKey = actionIdempotencyKey(adminRedemptionStatus, "redeem-status", redemptionPayload);
          try {
            await adminUpdateRedemptionStatus(adminRedemptionStatus.dataset.adminRedemptionStatus, redemptionPayload);
            showToast("\u5151\u6362\u8BA2\u5355\u72B6\u6001\u5DF2\u66F4\u65B0\u3002");
            await renderAdminPage();
          } catch (error) {
            showToast(error.message);
          }
        }
        if (adminRedemptionCancel) {
          const confirmed = await requestAdminAction({
            title: `\u53D6\u6D88\u5151\u6362 ${adminRedemptionCancel.dataset.orderNo || ""}`,
            description: "\u5151\u6362\u8BA2\u5355\u4F1A\u53D6\u6D88\uFF0C\u5DF2\u7ECF\u6263\u9664\u7684\u79EF\u5206\u548C\u5546\u54C1\u5E93\u5B58\u5C06\u8FD4\u8FD8\u3002",
            confirmLabel: "\u53D6\u6D88\u5151\u6362\u5E76\u8FD4\u8FD8",
            danger: true
          });
          if (!confirmed) return;
          const idempotencyKey = actionIdempotencyKey(adminRedemptionCancel, "redeem-cancel");
          try {
            await adminCancelRedemption(adminRedemptionCancel.dataset.adminRedemptionCancel, idempotencyKey);
            resetSessionCache();
            showToast("\u5151\u6362\u8BA2\u5355\u5DF2\u53D6\u6D88\uFF0C\u79EF\u5206\u548C\u5E93\u5B58\u5DF2\u8FD4\u8FD8\u3002");
            await renderAdminPage();
          } catch (error) {
            showToast(error.message);
          }
        }
        if (adminExport) {
          try {
            const response = await fetch("/api/admin/members/export.csv");
            if (!response.ok) {
              const payload = await response.json().catch(() => ({}));
              throw new Error(payload.error || "\u4F1A\u5458\u540D\u5355\u5BFC\u51FA\u5931\u8D25\u3002");
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `scent-atoll-members-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            showToast("\u4F1A\u5458\u540D\u5355\u5DF2\u5BFC\u51FA\u3002");
          } catch (error) {
            showToast(error.message);
          }
        }
        if (adminLogoutButton) {
          try {
            await adminLogout();
            showToast("\u5DF2\u9000\u51FA\u540E\u53F0\u3002");
            await renderAdminPage();
          } catch (error) {
            showToast(error.message);
          }
        }
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeCart();
      });
    };
    const state = {
      favorites: new Set(readStore("sa_favorites", [])),
      catalogAvailable: true
    };
    initializeApp();
    async function initializeApp() {
      initNavigation();
      bindGlobalActions();
      await loadManagedProducts();
      renderCartShell();
      initAuthHeader();
      renderHome();
      initShop();
      renderProductPage();
      renderBrands();
      renderSamples();
      renderJournal();
      renderCartPage();
      renderCheckoutPage();
      refreshMemberQuote();
      renderAuthForms();
      renderEmailVerificationPage();
      renderPasswordResetPage();
      renderAccountPage();
      renderPointsPage();
      renderOrdersPage();
      renderMembershipPage();
      renderPointsMallPage();
      renderPointsMallItemPage();
      renderPointsRedemptionsPage();
      renderAdminPage();
    }
    async function loadManagedProducts() {
      try {
        const payload = await apiFetch("/api/products");
        if (!Array.isArray(payload.products)) throw new Error("\u5546\u54C1\u6570\u636E\u683C\u5F0F\u65E0\u6548\u3002");
        replaceCatalogProducts(payload.products || [], { clearBundledSamples: true });
        document.body.dataset.catalogStatus = "ready";
      } catch (error) {
        state.catalogAvailable = false;
        replaceCatalogProducts([], { clearBundledSamples: true });
        document.body.dataset.catalogStatus = "unavailable";
        console.error("Managed products unavailable; commerce has been paused.", error);
      }
    }
    async function saveProductImageOrder(product, images, reason, primaryImageUrl = product.heroImageUrl || ((_a) => (_a = images[0]) == null ? void 0 : _a.imageUrl)() || "") {
      const ordered = images.map((image, index) => imageUpdatePayload(image, index, primaryImageUrl));
      return adminUpdateProduct(product.id, {
        images: ordered,
        heroImageUrl: primaryImageUrl,
        reason
      });
    }
    async function initAuthHeader() {
      const mount = $2("[data-auth-actions]");
      if (!mount) return;
      const session = await currentSession();
      if (!session.user) {
        try {
          const adminSession = await getCurrentAdmin();
          if (adminSession.admin) {
            mount.innerHTML = `<a class="account-link" href="admin.html">\u7BA1\u7406\u540E\u53F0</a>`;
            return;
          }
        } catch (e) {
        }
        mount.innerHTML = `
        <a class="account-link" href="login.html">\u767B\u5F55</a>
        <a class="text-link" href="register.html">\u6CE8\u518C</a>
      `;
        return;
      }
      mount.innerHTML = `
      <a class="account-link" href="account.html">\u6211\u7684\u8D26\u6237</a>
      <a class="text-link" href="points.html">${escapeHtml2(session.profile.availablePoints)} \u79EF\u5206</a>
      <button class="text-button" type="button" data-logout>\u9000\u51FA</button>
    `;
    }
    async function renderEmailVerificationPage() {
      const mount = $2("[data-verify-email-page]");
      if (!mount) return;
      const token = params().get("token");
      if (!token) {
        mount.innerHTML = `<div class="empty-state"><h2>\u9A8C\u8BC1\u94FE\u63A5\u4E0D\u5B8C\u6574</h2><p>\u8BF7\u4ECE\u90AE\u4EF6\u4E2D\u91CD\u65B0\u6253\u5F00\u9A8C\u8BC1\u94FE\u63A5\u3002</p></div>`;
        return;
      }
      try {
        await verifyEmail(token);
        resetSessionCache();
        mount.innerHTML = `<div class="empty-state"><h2>\u90AE\u7BB1\u5DF2\u9A8C\u8BC1</h2><p>\u8D26\u53F7\u5DF2\u53EF\u4EE5\u6B63\u5E38\u4F7F\u7528\u3002</p><a class="button button-primary" href="account.html">\u8FDB\u5165\u4F1A\u5458\u4E2D\u5FC3</a></div>`;
      } catch (error) {
        mount.innerHTML = `<div class="empty-state"><h2>\u9A8C\u8BC1\u5931\u8D25</h2><p>${escapeHtml2(error.message)}</p></div>`;
      }
    }
    async function renderCheckoutPage() {
      var _a, _b;
      const mount = $2("[data-checkout-page]");
      if (!mount) return;
      if (!state.catalogAvailable) {
        mount.innerHTML = catalogUnavailableMarkup();
        return;
      }
      const items = cartStore.getItems().map((entry) => ({ productId: entry.id, quantity: entry.qty }));
      if (!items.length) {
        mount.innerHTML = `<div class="empty-state"><h2>\u8D2D\u7269\u6E05\u5355\u662F\u7A7A\u7684</h2><a class="button button-primary" href="shop.html">\u8FD4\u56DE\u9999\u6C34\u5217\u8868</a></div>`;
        return;
      }
      try {
        const [quote, addressPayload] = await Promise.all([quoteOrder(items), getAddresses()]);
        const addresses = addressPayload.addresses || [];
        mount.innerHTML = `
        <div class="checkout-layout">
          ${checkoutReviewMarkup(quote)}
          <form class="account-form checkout-form" data-checkout-form>
          <div class="checkout-section-heading"><div><p class="eyebrow">Delivery</p><h2>\u914D\u9001\u4FE1\u606F</h2></div></div>
          ${addresses.length ? `<label class="field-label">\u6536\u8D27\u5730\u5740<select name="addressId" required>${addresses.map((address) => `<option value="${escapeHtml2(address.id)}">${escapeHtml2(`${address.recipientName} ${address.recipientPhone} ${address.province}${address.city}${address.district || ""}${address.addressLine}`)}</option>`).join("")}</select></label>` : `
            <label class="field-label">\u6536\u4EF6\u4EBA<input name="recipientName" required></label>
            <label class="field-label">\u624B\u673A\u53F7<input name="recipientPhone" inputmode="tel" required></label>
            <label class="field-label">\u7701\u4EFD<input name="province" required></label>
            <label class="field-label">\u57CE\u5E02<input name="city" required></label>
            <label class="field-label">\u533A\u53BF<input name="district"></label>
            <label class="field-label">\u8BE6\u7EC6\u5730\u5740<input name="addressLine" required></label>`}
          <label class="checkbox-row"><input name="acceptPrivacy" type="checkbox" required><span>\u6211\u5DF2\u9605\u8BFB\u5E76\u540C\u610F<a class="text-link" href="privacy.html" target="_blank" rel="noopener">\u9690\u79C1\u653F\u7B56</a></span></label>
          <label class="checkbox-row"><input name="acceptTerms" type="checkbox" required><span>\u6211\u5DF2\u9605\u8BFB\u5E76\u540C\u610F<a class="text-link" href="terms.html" target="_blank" rel="noopener">\u670D\u52A1\u6761\u6B3E</a></span></label>
          <p class="form-message" data-form-message aria-live="polite"></p>
          <button class="button button-primary" type="submit">\u63D0\u4EA4\u8BA2\u5355\u5E76\u83B7\u53D6\u8F6C\u8D26\u6307\u5F15</button>
          </form>
        </div>`;
        (_a = $2("[data-checkout-form]", mount)) == null ? void 0 : _a.addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          if (form.dataset.submitting === "true") return;
          const formData = new FormData(form);
          const shippingAddress = addresses.length ? void 0 : {
            recipientName: formData.get("recipientName"),
            recipientPhone: formData.get("recipientPhone"),
            province: formData.get("province"),
            city: formData.get("city"),
            district: formData.get("district"),
            addressLine: formData.get("addressLine")
          };
          const orderPayload = {
            items,
            addressId: formData.get("addressId"),
            shippingAddress,
            saveAddress: !addresses.length,
            acceptTerms: formData.has("acceptTerms"),
            acceptPrivacy: formData.has("acceptPrivacy")
          };
          const requestId = actionIdempotencyKey(form, "order", orderPayload);
          const submitButton = $2("button[type='submit']", form);
          form.dataset.submitting = "true";
          if (submitButton) submitButton.disabled = true;
          try {
            const result = await createOrder(orderPayload, requestId);
            const paymentIdempotencyKey = actionIdempotencyKey(form, "payment", { orderId: result.order.id });
            const payment = await startPayment(result.order.id, { idempotencyKey: paymentIdempotencyKey });
            cartStore.clear();
            renderCartShell();
            mount.innerHTML = `<div class="empty-state"><h2>\u8BA2\u5355 ${escapeHtml2(result.order.orderNo)} \u5DF2\u521B\u5EFA</h2><p>${escapeHtml2(payment.message)}</p><p>\u5BA2\u670D\u5FAE\u4FE1\uFF1A<strong>${escapeHtml2(payment.contactWechat || "\u8BF7\u67E5\u770B\u9875\u811A\u8054\u7CFB\u65B9\u5F0F")}</strong></p><a class="button button-primary" href="orders.html">\u67E5\u770B\u8BA2\u5355</a></div>`;
          } catch (error) {
            setFormMessage(form, checkoutErrorDetails(error).message, "error");
          } finally {
            form.dataset.submitting = "false";
            if (submitButton == null ? void 0 : submitButton.isConnected) submitButton.disabled = false;
          }
        });
      } catch (error) {
        mount.innerHTML = checkoutErrorMarkup(error);
        (_b = $2("[data-checkout-retry]", mount)) == null ? void 0 : _b.addEventListener("click", async () => {
          mount.innerHTML = `<div class="empty-state" role="status">\u6B63\u5728\u91CD\u65B0\u786E\u8BA4\u4EF7\u683C\u548C\u5E93\u5B58\u3002</div>`;
          await renderCheckoutPage();
        });
      }
    }
    async function renderAccountPage() {
      var _a, _b, _c;
      const mount = $2("[data-account-page]");
      if (!mount) return;
      try {
        const [data, addressPayload] = await Promise.all([getMemberProfile(), getAddresses()]);
        const addresses = addressPayload.addresses || [];
        mount.innerHTML = `
        ${memberNav()}
        <div class="member-dashboard">
          <article>
            <span class="eyebrow">Current tier</span>
            <h2>${escapeHtml2(data.tier.name)}</h2>
            <p>\u5F53\u524D\u6298\u6263\uFF1A${discountLabel(data.tier.discountRate)} \xB7 \u79EF\u5206\u500D\u6570\uFF1A${escapeHtml2(data.tier.pointMultiplier || 1)}x</p>
          </article>
          <article>
            <span class="eyebrow">Points</span>
            <h2>${escapeHtml2(data.profile.availablePoints)}</h2>
            <p>\u53EF\u7528\u79EF\u5206</p>
          </article>
          <article>
            <span class="eyebrow">Lifetime paid</span>
            <h2>${moneyText(data.profile.lifetimePaidAmountYuan)}</h2>
            <p>${data.nextTier ? `\u8DDD\u79BB ${escapeHtml2(data.nextTier.name)} \u8FD8\u5DEE ${moneyText(data.amountToNextTierYuan)}` : "\u5DF2\u8FBE\u5230\u6700\u9AD8\u7B49\u7EA7"}</p>
          </article>
        </div>
        <form class="account-form compact-account-form" data-profile-form>
          <label class="field-label">\u59D3\u540D<input name="name" value="${escapeHtml2(data.user.name || "")}"></label>
          <label class="field-label">\u751F\u65E5<input name="birthday" type="date" value="${escapeHtml2(data.profile.birthday || "")}"></label>
          <button class="button button-secondary" type="submit">\u4FDD\u5B58\u8D44\u6599</button>
        </form>
        <section class="account-form">
          <h2>\u6536\u8D27\u5730\u5740</h2>
          <div class="member-table">${addresses.length ? addresses.map((address) => `<article><div><h3>${escapeHtml2(address.recipientName)} ${address.isDefault ? "\xB7 \u9ED8\u8BA4" : ""}</h3><p>${escapeHtml2(`${address.recipientPhone} ${address.province}${address.city}${address.district || ""}${address.addressLine}`)}</p></div><button class="button button-secondary" type="button" data-delete-address="${escapeHtml2(address.id)}">\u5220\u9664</button></article>`).join("") : `<div class="empty-state">\u8FD8\u6CA1\u6709\u6536\u8D27\u5730\u5740\u3002</div>`}</div>
          <form class="compact-account-form" data-address-form>
            <label class="field-label">\u6536\u4EF6\u4EBA<input name="recipientName" required></label><label class="field-label">\u624B\u673A\u53F7<input name="recipientPhone" required></label>
            <label class="field-label">\u7701\u4EFD<input name="province" required></label><label class="field-label">\u57CE\u5E02<input name="city" required></label>
            <label class="field-label">\u533A\u53BF<input name="district"></label><label class="field-label">\u8BE6\u7EC6\u5730\u5740<input name="addressLine" required></label>
            <label class="checkbox-row"><input name="isDefault" type="checkbox"><span>\u8BBE\u4E3A\u9ED8\u8BA4\u5730\u5740</span></label>
            <button class="button button-secondary" type="submit">\u65B0\u589E\u5730\u5740</button>
          </form>
        </section>
        <section class="account-form"><h2>\u8D26\u53F7\u5B89\u5168</h2><button class="button button-secondary" type="button" data-revoke-sessions>\u9000\u51FA\u5176\u4ED6\u8BBE\u5907</button>
          <form class="compact-account-form" data-delete-account-form><label class="field-label">\u8F93\u5165\u5BC6\u7801\u6CE8\u9500\u8D26\u53F7<input name="password" type="password" autocomplete="current-password" required></label><button class="button button-secondary" type="submit">\u6CE8\u9500\u8D26\u53F7</button></form>
        </section>
      `;
        const form = $2("[data-profile-form]", mount);
        form == null ? void 0 : form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const formData = new FormData(form);
          try {
            await Promise.resolve().then(() => (init_member_client(), member_client_exports)).then(({ updateMemberProfile: updateMemberProfile2 }) => updateMemberProfile2({
              name: formData.get("name"),
              birthday: formData.get("birthday")
            }));
            resetSessionCache();
            await initAuthHeader();
            showToast("\u4F1A\u5458\u8D44\u6599\u5DF2\u4FDD\u5B58\u3002");
          } catch (error) {
            showToast(error.message);
          }
        });
        (_a = $2("[data-address-form]", mount)) == null ? void 0 : _a.addEventListener("submit", async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          try {
            await createAddress({ ...Object.fromEntries(formData.entries()), isDefault: formData.has("isDefault") });
            showToast("\u6536\u8D27\u5730\u5740\u5DF2\u4FDD\u5B58\u3002");
            await renderAccountPage();
          } catch (error) {
            showToast(error.message);
          }
        });
        $all2("[data-delete-address]", mount).forEach((button) => button.addEventListener("click", async () => {
          if (!window.confirm("\u786E\u5B9A\u5220\u9664\u8FD9\u4E2A\u6536\u8D27\u5730\u5740\uFF1F")) return;
          try {
            await deleteAddress(button.dataset.deleteAddress);
            await renderAccountPage();
          } catch (error) {
            showToast(error.message);
          }
        }));
        (_b = $2("[data-revoke-sessions]", mount)) == null ? void 0 : _b.addEventListener("click", async () => {
          try {
            await revokeOtherSessions();
            showToast("\u5176\u4ED6\u8BBE\u5907\u5DF2\u9000\u51FA\u3002");
          } catch (error) {
            showToast(error.message);
          }
        });
        (_c = $2("[data-delete-account-form]", mount)) == null ? void 0 : _c.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (!window.confirm("\u8D26\u53F7\u6CE8\u9500\u540E\u65E0\u6CD5\u6062\u590D\uFF0C\u662F\u5426\u7EE7\u7EED\uFF1F")) return;
          try {
            await deleteMemberAccount(new FormData(event.currentTarget).get("password"));
            window.location.href = "index.html";
          } catch (error) {
            showToast(error.message);
          }
        });
      } catch (e) {
        mount.innerHTML = requireLoginMarkup();
      }
    }
    async function renderPointsPage() {
      const mount = $2("[data-points-page]");
      if (!mount) return;
      try {
        const [profile, points] = await Promise.all([getMemberProfile(), getPointTransactions()]);
        mount.innerHTML = `
        ${memberNav()}
        <div class="member-summary">
          <strong>${escapeHtml2(profile.profile.availablePoints)}</strong>
          <span>\u53EF\u7528\u79EF\u5206</span>
        </div>
        <div class="member-table">
          ${points.transactions.length ? points.transactions.map((item) => `
            <article>
              <div>
                <h3>${escapeHtml2(pointTypeLabel(item.type))}</h3>
                <p>${escapeHtml2(item.note || "")}${item.expiresAt ? ` \xB7 \u6709\u6548\u81F3 ${new Date(item.expiresAt).toLocaleDateString("zh-CN")}` : ""}</p>
              </div>
              <strong>${item.points > 0 ? "+" : ""}${item.points}</strong>
              <span class="status-badge">${new Date(item.createdAt).toLocaleDateString("zh-CN")}</span>
            </article>
          `).join("") : `<div class="empty-state">\u6682\u65E0\u79EF\u5206\u6D41\u6C34\u3002</div>`}
        </div>
      `;
      } catch (e) {
        mount.innerHTML = requireLoginMarkup();
      }
    }
    async function renderPointsMallPage() {
      const mount = $2("[data-points-mall-page]");
      if (!mount) return;
      try {
        const [profile, mall] = await Promise.all([getMemberProfile(), getPointsMallItems()]);
        mount.innerHTML = `
        ${memberNav()}
        <div class="member-summary">
          <strong>${escapeHtml2(profile.profile.availablePoints)}</strong>
          <span>\u53EF\u7528\u79EF\u5206</span>
        </div>
        <div class="mall-grid">
          ${mall.items.length ? mall.items.map((item) => `
            <article class="mall-card">
              <a class="mall-image" href="points-item.html?id=${encodeURIComponent(item.id)}" ${safeImageStyle2(item.image, "background-image")}></a>
              <div>
                <p class="eyebrow">${item.stockQuantity > 0 ? `\u5E93\u5B58 ${item.stockQuantity}` : "\u5DF2\u5151\u5B8C"}</p>
                <h2>${escapeHtml2(item.name)}</h2>
                <p>${escapeHtml2(item.description || "")}</p>
              </div>
              <div class="mall-card-footer">
                <strong>${item.pointsPrice} \u79EF\u5206</strong>
                <a class="button button-secondary" href="points-item.html?id=${encodeURIComponent(item.id)}">\u67E5\u770B\u5151\u6362</a>
              </div>
            </article>
          `).join("") : `<div class="empty-state">\u6682\u65E0\u53EF\u5151\u6362\u5546\u54C1\u3002</div>`}
        </div>
      `;
      } catch (e) {
        mount.innerHTML = requireLoginMarkup();
      }
    }
    async function renderPointsMallItemPage() {
      var _a;
      const mount = $2("[data-points-item-page]");
      if (!mount) return;
      const id = params().get("id");
      if (!id) {
        mount.innerHTML = `<div class="empty-state">\u79EF\u5206\u5546\u54C1\u4E0D\u5B58\u5728\u3002</div>`;
        return;
      }
      try {
        const [profile, payload] = await Promise.all([getMemberProfile(), getPointsMallItem(id)]);
        const item = payload.item;
        mount.innerHTML = `
        ${memberNav()}
        <div class="mall-detail">
          <div class="mall-detail-image" ${safeImageStyle2(item.image, "background-image")}></div>
          <div class="mall-detail-panel">
            <p class="eyebrow">${item.stockQuantity > 0 ? `\u5E93\u5B58 ${item.stockQuantity}` : "\u5DF2\u5151\u5B8C"}</p>
            <h2>${escapeHtml2(item.name)}</h2>
            <p>${escapeHtml2(item.description || "")}</p>
            <div class="member-summary compact-summary">
              <strong>${item.pointsPrice}</strong>
              <span>\u5151\u6362\u79EF\u5206 \xB7 \u4F60\u6709 ${escapeHtml2(profile.profile.availablePoints)} \u79EF\u5206</span>
            </div>
            <form class="account-form compact-account-form" data-redeem-form>
              <label class="field-label">\u5151\u6362\u6570\u91CF<input name="quantity" type="number" min="1" max="${item.stockQuantity}" value="1" required></label>
              <label class="field-label">\u6536\u4EF6\u4EBA<input name="recipientName" value="${escapeHtml2(profile.user.name || "")}" required></label>
              <label class="field-label">\u8054\u7CFB\u7535\u8BDD<input name="recipientPhone" type="tel" inputmode="tel" pattern="1[3-9][0-9]{9}" value="${escapeHtml2(profile.user.phone || "")}" required></label>
              <label class="field-label">\u6536\u8D27\u5730\u5740<input name="shippingAddress" required></label>
              <button class="button button-primary" type="submit" ${profile.profile.availablePoints < item.pointsPrice || item.stockQuantity <= 0 ? "disabled" : ""}>\u786E\u8BA4\u5151\u6362</button>
            </form>
          </div>
        </div>
      `;
        (_a = $2("[data-redeem-form]", mount)) == null ? void 0 : _a.addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          if (form.dataset.submitting === "true") return;
          form.dataset.submitting = "true";
          const submitButton = form.querySelector("button[type='submit']");
          if (submitButton) submitButton.disabled = true;
          const formData = new FormData(form);
          const redemptionPayload = {
            mallItemId: item.id,
            quantity: Number(formData.get("quantity")),
            recipientName: formData.get("recipientName"),
            recipientPhone: formData.get("recipientPhone"),
            shippingAddress: formData.get("shippingAddress")
          };
          const requestId = actionIdempotencyKey(form, "redeem", redemptionPayload);
          try {
            const result = await redeemPointsMallItem({
              ...redemptionPayload,
              requestId,
              idempotencyKey: requestId
            });
            resetSessionCache();
            showToast(`\u5151\u6362\u6210\u529F\uFF0C\u8BA2\u5355 ${result.order.orderNo}`);
            setTimeout(() => {
              window.location.href = "points-redemptions.html";
            }, 700);
          } catch (error) {
            form.dataset.submitting = "false";
            if (submitButton) submitButton.disabled = false;
            showToast(error.message);
          }
        });
      } catch (e) {
        mount.innerHTML = requireLoginMarkup();
      }
    }
    async function renderPointsRedemptionsPage() {
      const mount = $2("[data-points-redemptions-page]");
      if (!mount) return;
      try {
        const { redemptions } = await getPointsRedemptions();
        mount.innerHTML = `
        ${memberNav()}
        <div class="member-table">
          ${redemptions.length ? redemptions.map((order) => `
            <article>
              <div>
                <h3>${escapeHtml2(order.orderNo)}</h3>
                <p>${order.items.map((item) => `${escapeHtml2(item.name)} x ${escapeHtml2(item.quantity)}`).join("\u3001")}</p>
                <p>${order.trackingNo ? `\u7269\u6D41\u5355\u53F7\uFF1A${escapeHtml2(order.trackingNo)}` : "\u7B49\u5F85\u540E\u53F0\u5904\u7406"}</p>
              </div>
              <strong>${order.totalPoints} \u79EF\u5206</strong>
              <span class="status-badge">${escapeHtml2(redemptionStatusLabel(order.status))}</span>
            </article>
          `).join("") : `<div class="empty-state">\u6682\u65E0\u5151\u6362\u8BB0\u5F55\u3002</div>`}
        </div>
      `;
      } catch (e) {
        mount.innerHTML = requireLoginMarkup();
      }
    }
    async function renderOrdersPage() {
      const mount = $2("[data-orders-page]");
      if (!mount) return;
      try {
        const { orders } = await getMemberOrders();
        mount.innerHTML = `
        ${memberNav()}
        <div class="member-table">
          ${orders.length ? orders.map((order) => `
            <article>
              <div>
                <h3>${escapeHtml2(order.orderNo)}</h3>
                <p>${order.items.map((item) => `${escapeHtml2(item.productName)} x ${escapeHtml2(item.quantity)}`).join("\u3001")}</p>
                <p>\u4F1A\u5458\u6298\u6263\uFF1A${moneyText(order.memberDiscountAmountYuan)} \xB7 ${orderPointsText(order)}</p>
                ${order.shipment ? `<p>${escapeHtml2(order.shipment.carrier)} \xB7 ${escapeHtml2(order.shipment.trackingNo)}</p>` : ""}
              </div>
              <strong>${moneyText(order.paidAmountYuan)}</strong>
              <span class="status-badge">${escapeHtml2(orderStatusLabel(order.status))}</span>
              ${order.status === "shipped" ? `<button class="button button-secondary" type="button" data-confirm-receipt="${escapeHtml2(order.id)}">\u786E\u8BA4\u6536\u8D27</button>` : ""}
              ${order.status === "pending_payment" ? `<button class="button button-secondary" type="button" data-cancel-order="${escapeHtml2(order.id)}">\u53D6\u6D88\u8BA2\u5355</button>` : ""}
            </article>
          `).join("") : `<div class="empty-state">\u6682\u65E0\u8BA2\u5355\u3002</div>`}
        </div>
      `;
      } catch (e) {
        mount.innerHTML = requireLoginMarkup();
      }
    }
    async function renderMembershipPage() {
      const mount = $2("[data-membership-page]");
      if (!mount) return;
      let current;
      try {
        current = await getTierProgress();
      } catch (e) {
        current = null;
      }
      const tiers = [
        ["\u666E\u901A\u4F1A\u5458", "\xA50", "\u65E0", "1.0x", "\u6EE1 \xA5599 \u5305\u90AE"],
        ["\u94F6\u5361\u4F1A\u5458", "\xA51,000", "95 \u6298", "1.1x", "\u6EE1 \xA5499 \u5305\u90AE"],
        ["\u91D1\u5361\u4F1A\u5458", "\xA510,000", "92 \u6298", "1.2x", "\u6EE1 \xA5399 \u5305\u90AE"],
        ["\u94BB\u5361\u4F1A\u5458", "\xA520,000", "88 \u6298", "1.5x", "\u987A\u4E30\u5305\u90AE"],
        ["\u9ED1\u5361\u4F1A\u5458", "\xA550,000", "85 \u6298", "2.0x", "\u987A\u4E30\u5305\u90AE"],
        ["\u81F3\u5C0A\u4F1A\u5458", "\xA5200,000", "8 \u6298", "2.0x", "\u987A\u4E30\u5305\u90AE"]
      ];
      mount.innerHTML = `
      ${memberNav()}
      ${current ? `<div class="member-summary"><strong>${escapeHtml2(current.tier.name)}</strong><span>${current.nextTier ? `\u8DDD\u79BB ${escapeHtml2(current.nextTier.name)} \u8FD8\u5DEE ${moneyText(current.amountToNextTierYuan)}` : "\u5DF2\u8FBE\u5230\u6700\u9AD8\u7B49\u7EA7"}</span></div>` : ""}
      <div class="tier-table">
        <div><strong>\u7B49\u7EA7</strong><strong>\u7D2F\u8BA1\u6D88\u8D39</strong><strong>\u6298\u6263</strong><strong>\u79EF\u5206\u500D\u6570</strong><strong>\u514D\u8FD0</strong></div>
        ${tiers.map((tier) => `<div>${tier.map((cell) => `<span>${cell}</span>`).join("")}</div>`).join("")}
      </div>
      <div class="policy-list member-policy-list">
        <article><h2>\u79EF\u5206\u8BA1\u7B97</h2><p>\u79EF\u5206\u6309\u5B9E\u4ED8\u5546\u54C1\u91D1\u989D\u548C\u5F53\u524D\u7B49\u7EA7\u500D\u6570\u8BA1\u7B97\u3002\u8FD0\u8D39\u3001\u53D6\u6D88\u8BA2\u5355\u548C\u9000\u6B3E\u91D1\u989D\u4E0D\u8BA1\u5165\u79EF\u5206\u3002</p></article>
        <article><h2>\u5347\u7EA7\u89C4\u5219</h2><p>\u8BA2\u5355\u7531\u540E\u53F0\u786E\u8BA4\u652F\u4ED8\u540E\u4E0D\u4F1A\u7ACB\u523B\u5347\u7EA7\u3002\u5BA2\u6237\u786E\u8BA4\u6536\u8D27\u540E\uFF0C\u7CFB\u7EDF\u624D\u4F1A\u7D2F\u52A0\u6709\u6548\u6D88\u8D39\u5E76\u5339\u914D\u6700\u9AD8\u53EF\u8FBE\u7B49\u7EA7\uFF1B\u9000\u6B3E\u540E\u91CD\u65B0\u6309\u7D2F\u8BA1\u6709\u6548\u6D88\u8D39\u8BA1\u7B97\u7B49\u7EA7\u3002</p></article>
        <article><h2>\u79EF\u5206\u6709\u6548\u671F</h2><p>\u8BA2\u5355\u79EF\u5206\u81EA\u786E\u8BA4\u6536\u8D27\u65E5\u8D77\u4E00\u5E74\u6709\u6548\uFF0C\u672A\u6765\u79EF\u5206\u5546\u57CE\u5151\u6362\u4F1A\u6309 FIFO \u5148\u6D88\u8017\u6700\u65E9\u83B7\u5F97\u7684\u79EF\u5206\u3002\u79EF\u5206\u6682\u4E0D\u62B5\u73B0\u91D1\u3002</p></article>
        <article><h2>\u6298\u6263\u89C4\u5219</h2><p>\u4F1A\u5458\u6298\u6263\u53EA\u4F5C\u7528\u4E8E\u5546\u54C1\u91D1\u989D\uFF0C\u4E0D\u4F5C\u7528\u4E8E\u8FD0\u8D39\u3002\u7279\u4EF7\u5546\u54C1\u540E\u7EED\u53EF\u914D\u7F6E\u4E3A\u4E0D\u53C2\u4E0E\u4F1A\u5458\u6298\u6263\u3002</p></article>
      </div>
    `;
    }
    const adminViews = {
      overview: { label: "\u6982\u89C8", title: "\u4ECA\u5929\u9700\u8981\u5904\u7406\u7684\u4E8B", description: "\u5148\u5904\u7406\u4F1A\u5F71\u54CD\u5BA2\u6237\u548C\u5E93\u5B58\u7684\u4E8B\u9879\u3002" },
      orders: { label: "\u8BA2\u5355", title: "\u8BA2\u5355\u4E0E\u5C65\u7EA6", description: "\u6838\u5BF9\u6536\u6B3E\u3001\u5B89\u6392\u53D1\u8D27\u5E76\u5904\u7406\u9000\u6B3E\u3002" },
      products: { label: "\u5546\u54C1", title: "\u5546\u54C1\u4E0E\u5E93\u5B58", description: "\u7EF4\u62A4\u5546\u54C1\u8D44\u6599\u3001\u56FE\u7247\u3001\u72B6\u6001\u548C\u53EF\u552E\u5E93\u5B58\u3002" },
      members: { label: "\u4F1A\u5458", title: "\u4F1A\u5458", description: "\u67E5\u770B\u4F1A\u5458\u72B6\u6001\u3001\u8BA2\u5355\u4EF7\u503C\u548C\u79EF\u5206\u4F59\u989D\u3002" },
      "points-items": { label: "\u79EF\u5206\u5546\u54C1", title: "\u79EF\u5206\u5546\u54C1", description: "\u8BBE\u7F6E\u79EF\u5206\u4EF7\u683C\u3001\u5E93\u5B58\u548C\u4E0A\u4E0B\u67B6\u72B6\u6001\u3002" },
      "points-redemptions": { label: "\u5151\u6362\u8BA2\u5355", title: "\u5151\u6362\u8BA2\u5355", description: "\u5904\u7406\u79EF\u5206\u5151\u6362\u3001\u53D1\u8D27\u548C\u53D6\u6D88\u8FD4\u8FD8\u3002" },
      "points-ledger": { label: "\u79EF\u5206\u6D41\u6C34", title: "\u79EF\u5206\u6D41\u6C34", description: "\u8FFD\u8E2A\u79EF\u5206\u83B7\u5F97\u3001\u6D88\u8017\u3001\u8FC7\u671F\u548C\u4EBA\u5DE5\u8C03\u6574\u3002" },
      more: { label: "\u66F4\u591A", title: "\u66F4\u591A\u7BA1\u7406", description: "\u67E5\u770B\u64CD\u4F5C\u65E5\u5FD7\u3001\u5BFC\u51FA\u6570\u636E\u548C\u7BA1\u7406\u8D26\u53F7\u5B89\u5168\u3002" }
    };
    let adminHashListenerBound = false;
    async function requestAdminAction({ title, description, confirmLabel, danger = false, fields = [] }) {
      const dialog = $2("[data-admin-dialog]");
      if (!dialog) return null;
      dialog.innerHTML = `
      <form method="dialog" class="admin-dialog-form">
        <header><p class="admin-kicker">\u654F\u611F\u64CD\u4F5C</p><h2>${escapeHtml2(title)}</h2><p>${escapeHtml2(description)}</p></header>
        <div class="admin-dialog-fields">${fields.map((field) => `<label class="field-label">${escapeHtml2(field.label)}<input name="${escapeHtml2(field.name)}" type="${escapeHtml2(field.type || "text")}" value="${escapeHtml2(field.value || "")}" ${field.required === false ? "" : "required"} ${field.step ? `step="${escapeHtml2(field.step)}"` : ""}></label>`).join("")}</div>
        <div class="admin-dialog-actions"><button class="button button-secondary" value="cancel" formnovalidate>\u8FD4\u56DE\u68C0\u67E5</button><button class="button ${danger ? "button-danger" : "button-primary"}" value="confirm">${escapeHtml2(confirmLabel)}</button></div>
      </form>
    `;
      const form = $2("form", dialog);
      return new Promise((resolve) => {
        var _a;
        dialog.addEventListener("close", () => {
          resolve(dialog.returnValue === "confirm" ? Object.fromEntries(new FormData(form)) : null);
        }, { once: true });
        dialog.showModal();
        (_a = $2("input", dialog)) == null ? void 0 : _a.focus();
      });
    }
    async function bindAdminViewForms(view, data) {
      var _a, _b, _c, _d;
      const mount = $2("[data-admin-page]");
      if (!mount) return;
      const products = (data == null ? void 0 : data.products) || [];
      const productsById = new Map(products.map((product) => [product.id, product]));
      (_a = $2("[data-admin-change-password]", mount)) == null ? void 0 : _a.addEventListener("submit", async (event) => {
        var _a2;
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        const currentPassword = String(formData.get("currentPassword") || "");
        const newPassword = String(formData.get("newPassword") || "");
        const confirmPassword = String(formData.get("confirmPassword") || "");
        if (newPassword !== confirmPassword) {
          setFormMessage(form, "\u4E24\u6B21\u8F93\u5165\u7684\u65B0\u5BC6\u7801\u4E0D\u4E00\u81F4\u3002", "error");
          (_a2 = $2("[name='confirmPassword']", form)) == null ? void 0 : _a2.focus();
          return;
        }
        const submitButton = $2("button[type='submit']", form);
        if (submitButton) submitButton.disabled = true;
        setFormMessage(form, "\u6B63\u5728\u66F4\u65B0\u5BC6\u7801...");
        try {
          await adminChangePassword({ currentPassword, newPassword });
          form.reset();
          setFormMessage(form, "\u5BC6\u7801\u5DF2\u66F4\u65B0\uFF0C\u5176\u4ED6\u8BBE\u5907\u5DF2\u9000\u51FA\u540E\u53F0\u3002", "success");
        } catch (error) {
          setFormMessage(form, error.message, "error");
        } finally {
          if (submitButton) submitButton.disabled = false;
        }
      });
      (_b = $2("[data-admin-revoke-sessions-form]", mount)) == null ? void 0 : _b.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const submitButton = $2("button[type='submit']", form);
        if (submitButton) submitButton.disabled = true;
        setFormMessage(form, "\u6B63\u5728\u9000\u51FA\u5176\u4ED6\u8BBE\u5907...");
        try {
          const result = await adminRevokeOtherSessions();
          setFormMessage(form, `\u5DF2\u9000\u51FA ${Number(result.revokedSessions || 0)} \u4E2A\u5176\u4ED6\u540E\u53F0\u4F1A\u8BDD\u3002`, "success");
        } catch (error) {
          setFormMessage(form, error.message, "error");
        } finally {
          if (submitButton) submitButton.disabled = false;
        }
      });
      (_c = $2("[data-admin-mall-item-form]", mount)) == null ? void 0 : _c.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        const payload = { name: formData.get("name"), productId: formData.get("productId"), pointsPrice: Number(formData.get("pointsPrice")), stockQuantity: Number(formData.get("stockQuantity")), status: "active" };
        payload.idempotencyKey = actionIdempotencyKey(form, "mall-create", payload);
        try {
          await adminCreateMallItem(payload);
          showToast("\u79EF\u5206\u5546\u54C1\u5DF2\u521B\u5EFA\u3002");
          await renderAdminPage();
        } catch (error) {
          showToast(error.message);
        }
      });
      (_d = $2("[data-admin-product-create]", mount)) == null ? void 0 : _d.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const payload = adminProductPayload(form);
        payload.idempotencyKey = actionIdempotencyKey(form, "product-create", payload);
        try {
          await adminCreateProduct(payload);
          showToast("\u5546\u54C1\u8349\u7A3F\u5DF2\u521B\u5EFA\u3002");
          await renderAdminPage();
        } catch (error) {
          showToast(error.message);
        }
      });
      $all2("[data-admin-product-edit]", mount).forEach((form) => form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const payload = adminProductPayload(form);
        payload.idempotencyKey = actionIdempotencyKey(form, "product-update", payload);
        try {
          await adminUpdateProduct(form.dataset.adminProductEdit, payload);
          showToast("\u5546\u54C1\u5DF2\u4FDD\u5B58\u3002");
          await renderAdminPage();
        } catch (error) {
          showToast(error.message);
        }
      }));
      $all2("[data-admin-points-form]", mount).forEach((form) => form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = { points: Number(formData.get("points")), reason: formData.get("reason") || "\u540E\u53F0\u79EF\u5206\u8C03\u6574" };
        const confirmed = await requestAdminAction({ title: "\u786E\u8BA4\u8C03\u6574\u4F1A\u5458\u79EF\u5206", description: `\u4F1A\u5458\u79EF\u5206\u5C06\u53D8\u52A8 ${payload.points > 0 ? "+" : ""}${payload.points}\uFF0C\u64CD\u4F5C\u4F1A\u5199\u5165\u5BA1\u8BA1\u65E5\u5FD7\u3002`, confirmLabel: "\u786E\u8BA4\u8C03\u6574\u79EF\u5206", danger: payload.points < 0 });
        if (!confirmed) return;
        payload.idempotencyKey = actionIdempotencyKey(form, "points", payload);
        try {
          await adminAdjustMemberPoints(form.dataset.adminPointsForm, payload);
          showToast("\u4F1A\u5458\u79EF\u5206\u5DF2\u8C03\u6574\u3002");
          await renderAdminPage();
        } catch (error) {
          showToast(error.message);
        }
      }));
      $all2("[data-admin-image-upload]", mount).forEach((form) => form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const file = formData.get("image");
        const fileError = adminImageFileError(file);
        if (fileError) return setFormMessage(form, fileError, "error");
        const product = productsById.get(form.dataset.adminImageUpload);
        if (!product) return setFormMessage(form, "\u5546\u54C1\u6570\u636E\u5DF2\u53D8\u5316\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002", "error");
        const submitButton = $2("button[type='submit']", form);
        setFormMessage(form, "\u6B63\u5728\u4E0A\u4F20\u56FE\u7247...");
        if (submitButton) submitButton.disabled = true;
        try {
          await adminUploadProductImage(product.id, file, { alt: formData.get("alt") || product.name, role: formData.has("isHero") || !(product.images || []).length ? "hero" : "gallery" });
          showToast("\u5546\u54C1\u56FE\u7247\u5DF2\u4E0A\u4F20\u3002");
          await renderAdminPage();
        } catch (error) {
          setFormMessage(form, error.message, "error");
        } finally {
          if (submitButton == null ? void 0 : submitButton.isConnected) submitButton.disabled = false;
        }
      }));
      $all2("[data-admin-image-replace]", mount).forEach((form) => form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const file = formData.get("image");
        const fileError = adminImageFileError(file);
        if (fileError) return setFormMessage(form, fileError, "error");
        const product = productsById.get(form.dataset.productId);
        const images = orderedProductImages(product);
        const imageIndex = images.findIndex((image) => image.id === form.dataset.adminImageReplace);
        const previous = images[imageIndex];
        if (!previous) return setFormMessage(form, "\u539F\u56FE\u7247\u5DF2\u53D8\u5316\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002", "error");
        const submitButton = $2("button[type='submit']", form);
        setFormMessage(form, "\u6B63\u5728\u4E0A\u4F20\u66FF\u6362\u56FE\u7247...");
        if (submitButton) submitButton.disabled = true;
        try {
          const uploaded = await adminUploadProductImage(product.id, file, { alt: previous.alt || product.name, role: product.heroImageUrl === previous.imageUrl ? "hero" : "gallery" });
          await adminDeleteProductImage(product.id, previous.id);
          const nextImages = images.slice();
          nextImages[imageIndex] = uploaded.image;
          await saveProductImageOrder(product, nextImages, "\u540E\u53F0\u66FF\u6362\u5546\u54C1\u56FE\u7247", product.heroImageUrl === previous.imageUrl ? uploaded.image.imageUrl : product.heroImageUrl);
          showToast("\u5546\u54C1\u56FE\u7247\u5DF2\u66FF\u6362\u3002");
          await renderAdminPage();
        } catch (error) {
          setFormMessage(form, `${error.message} \u8BF7\u5237\u65B0\u540E\u6838\u5BF9\u56FE\u7247\u5217\u8868\u3002`, "error");
        } finally {
          if (submitButton == null ? void 0 : submitButton.isConnected) submitButton.disabled = false;
        }
      }));
      $all2("[data-admin-image-move]", mount).forEach((button) => button.addEventListener("click", async () => {
        const product = productsById.get(button.dataset.productId);
        const images = orderedProductImages(product);
        const currentIndex = images.findIndex((image) => image.id === button.dataset.adminImageMove);
        const targetIndex = currentIndex + Number(button.dataset.direction);
        if (!product || currentIndex < 0 || targetIndex < 0 || targetIndex >= images.length) return;
        [images[currentIndex], images[targetIndex]] = [images[targetIndex], images[currentIndex]];
        button.disabled = true;
        try {
          await saveProductImageOrder(product, images, "\u540E\u53F0\u8C03\u6574\u5546\u54C1\u56FE\u7247\u987A\u5E8F");
          showToast("\u56FE\u7247\u987A\u5E8F\u5DF2\u66F4\u65B0\u3002");
          await renderAdminPage();
        } catch (error) {
          button.disabled = false;
          showToast(error.message);
        }
      }));
      $all2("[data-admin-image-primary]", mount).forEach((button) => button.addEventListener("click", async () => {
        const product = productsById.get(button.dataset.productId);
        const images = orderedProductImages(product);
        const image = images.find((item) => item.id === button.dataset.adminImagePrimary);
        if (!product || !image) return;
        button.disabled = true;
        try {
          await saveProductImageOrder(product, images, "\u540E\u53F0\u8BBE\u7F6E\u5546\u54C1\u4E3B\u56FE", image.imageUrl);
          showToast("\u5546\u54C1\u4E3B\u56FE\u5DF2\u66F4\u65B0\u3002");
          await renderAdminPage();
        } catch (error) {
          button.disabled = false;
          showToast(error.message);
        }
      }));
      $all2("[data-admin-image-delete]", mount).forEach((button) => button.addEventListener("click", async () => {
        const product = productsById.get(button.dataset.productId);
        const images = orderedProductImages(product);
        if (!product || product.status === "active" && images.length === 1) return;
        const confirmed = await requestAdminAction({ title: "\u5220\u9664\u5546\u54C1\u56FE\u7247", description: "\u56FE\u7247\u8BB0\u5F55\u548C\u5BF9\u5E94\u7684 Vercel Blob \u6587\u4EF6\u90FD\u4F1A\u88AB\u5220\u9664\uFF0C\u6B64\u64CD\u4F5C\u4E0D\u80FD\u64A4\u9500\u3002", confirmLabel: "\u5220\u9664\u56FE\u7247", danger: true });
        if (!confirmed) return;
        button.disabled = true;
        try {
          await adminDeleteProductImage(product.id, button.dataset.adminImageDelete);
          showToast("\u5546\u54C1\u56FE\u7247\u5DF2\u5220\u9664\u3002");
          await renderAdminPage();
        } catch (error) {
          button.disabled = false;
          showToast(error.message);
        }
      }));
      $all2("[data-admin-inventory-form]", mount).forEach((form) => form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = { mode: "adjust", quantityDelta: Number(formData.get("quantityDelta")), reason: formData.get("reason") || "\u540E\u53F0\u5E93\u5B58\u8C03\u6574" };
        const confirmed = await requestAdminAction({ title: "\u786E\u8BA4\u8C03\u6574\u5E93\u5B58", description: `\u53EF\u552E\u5E93\u5B58\u5C06\u53D8\u52A8 ${payload.quantityDelta > 0 ? "+" : ""}${payload.quantityDelta}\uFF0C\u8BF7\u786E\u8BA4\u5B9E\u7269\u5E93\u5B58\u5DF2\u7ECF\u6838\u5BF9\u3002`, confirmLabel: "\u786E\u8BA4\u8C03\u6574\u5E93\u5B58", danger: payload.quantityDelta < 0 });
        if (!confirmed) return;
        payload.idempotencyKey = actionIdempotencyKey(form, "inventory", payload);
        try {
          await adminAdjustProductInventory(form.dataset.adminInventoryForm, form.dataset.variantId, payload);
          showToast("\u5E93\u5B58\u5DF2\u8C03\u6574\u3002");
          await renderAdminPage();
        } catch (error) {
          showToast(error.message);
        }
      }));
    }
    async function renderAdminView(session) {
      var _a, _b;
      const { view, params: viewParams } = adminLocationState();
      const meta = adminViews[view];
      const root = $2("[data-admin-page]");
      const content = $2("[data-admin-view]", root);
      if (!content) return;
      $2("[data-admin-view-title]", root).textContent = meta.title;
      $2("[data-admin-view-description]", root).textContent = meta.description;
      $all2(".admin-nav-link", root).forEach((link) => {
        const active = link.getAttribute("href") === `#${view}`;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
      content.innerHTML = adminLoadingMarkup();
      try {
        let data = null;
        if (view === "overview") {
          const [orders, redemptions, products, logs] = await Promise.all([adminGetOrders(), adminGetPointsRedemptions(), adminGetProducts(), adminGetAuditLogs()]);
          content.innerHTML = adminOverviewMarkup(orders, redemptions, products, logs);
        } else if (view === "orders") {
          data = await adminGetOrders();
          content.innerHTML = adminOrdersMarkup(data, viewParams.get("status") || "");
        } else if (view === "products") {
          data = await adminGetProducts();
          content.innerHTML = adminProductsMarkup(data, { stock: viewParams.get("stock") || "" });
        } else if (view === "members") {
          data = await adminGetMembers();
          content.innerHTML = adminMembersMarkup(data);
        } else if (view === "points-items") {
          data = await adminGetPointsMallItems();
          content.innerHTML = adminMallItemsMarkup(data);
        } else if (view === "points-redemptions") {
          data = await adminGetPointsRedemptions();
          content.innerHTML = adminRedemptionsMarkup(data, viewParams.get("status") || "");
        } else if (view === "points-ledger") {
          data = await adminGetPoints();
          content.innerHTML = adminPointsMarkup(data);
        } else {
          data = await adminGetAuditLogs();
          content.innerHTML = adminMoreMarkup(data, session);
        }
        bindAdminListSearch(content);
        await bindAdminViewForms(view, data);
        const sidebar = $2("[data-admin-sidebar]", root);
        sidebar == null ? void 0 : sidebar.classList.remove("is-open");
        (_a = $2("[data-admin-nav-toggle]", root)) == null ? void 0 : _a.setAttribute("aria-expanded", "false");
      } catch (error) {
        content.innerHTML = `<div class="admin-error" role="alert"><h2>\u540E\u53F0\u6570\u636E\u6CA1\u6709\u8BFB\u53D6\u6210\u529F</h2><p>${escapeHtml2(error.message)}</p><button class="button button-secondary" type="button" data-admin-retry>\u91CD\u65B0\u8BFB\u53D6</button></div>`;
        (_b = $2("[data-admin-retry]", content)) == null ? void 0 : _b.addEventListener("click", () => renderAdminView(session));
      }
    }
    async function renderAdminPage() {
      var _a;
      const mount = $2("[data-admin-page]");
      if (!mount) return;
      let session;
      try {
        session = await getCurrentAdmin();
      } catch (e) {
        mount.innerHTML = `<div class="admin-access-state"><span class="brand-mark">SA</span><h1>\u8BF7\u767B\u5F55\u8FD0\u8425\u8D26\u6237</h1><p>\u4F7F\u7528\u7EDF\u4E00\u767B\u5F55\u5165\u53E3\u9A8C\u8BC1\u8EAB\u4EFD\u540E\uFF0C\u7CFB\u7EDF\u4F1A\u81EA\u52A8\u8FDB\u5165\u5BF9\u5E94\u8D26\u6237\u3002</p><a class="button button-primary" href="login.html">\u524D\u5F80\u8D26\u6237\u767B\u5F55</a></div>`;
        return;
      }
      const { view } = adminLocationState();
      mount.innerHTML = adminShellMarkup(session, view);
      const sidebar = $2("[data-admin-sidebar]", mount);
      const toggle = $2("[data-admin-nav-toggle]", mount);
      const closeSidebar = () => {
        sidebar == null ? void 0 : sidebar.classList.remove("is-open");
        toggle == null ? void 0 : toggle.setAttribute("aria-expanded", "false");
      };
      toggle == null ? void 0 : toggle.addEventListener("click", () => {
        const open = !(sidebar == null ? void 0 : sidebar.classList.contains("is-open"));
        sidebar == null ? void 0 : sidebar.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", String(open));
      });
      (_a = $2("[data-admin-sidebar-scrim]", mount)) == null ? void 0 : _a.addEventListener("click", closeSidebar);
      $all2("a", sidebar).forEach((link) => link.addEventListener("click", closeSidebar));
      if (!adminHashListenerBound) {
        window.addEventListener("hashchange", () => renderAdminPage());
        adminHashListenerBound = true;
      }
      await renderAdminView(session);
    }
    let toastTimer;
  }
})();
