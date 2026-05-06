(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/assets/js/api-client.js
  async function apiFetch(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        ...options.headers || {}
      },
      ...options,
      body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "\u8BF7\u6C42\u5931\u8D25\u3002");
    }
    return payload;
  }
  function moneyText(value) {
    return `\xA5${Number(value || 0).toLocaleString("zh-CN", {
      minimumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    })}`;
  }
  var init_api_client = __esm({
    "src/assets/js/api-client.js"() {
    }
  });

  // src/assets/js/member-client.js
  var member_client_exports = {};
  __export(member_client_exports, {
    adminPayOrder: () => adminPayOrder,
    confirmReceiptOrder: () => confirmReceiptOrder,
    getMemberOrders: () => getMemberOrders,
    getMemberProfile: () => getMemberProfile,
    getPointTransactions: () => getPointTransactions,
    getTierProgress: () => getTierProgress,
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
  function confirmReceiptOrder(orderId) {
    return apiFetch(`/api/member/orders/${encodeURIComponent(orderId)}/confirm-receipt`, {
      method: "POST"
    });
  }
  function adminPayOrder(orderId, key) {
    return apiFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/pay`, {
      method: "POST",
      headers: {
        "x-admin-key": key
      }
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
  var allCatalogItems = [
    ...catalogData.products,
    ...catalogData.sampleSets.map((set) => ({
      ...set,
      brand: "Scent Archive",
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
    }))
  ];
  function formatPrice(value) {
    return `\xA5${Number(value).toLocaleString("zh-CN")}`;
  }
  function productById(id) {
    return catalogData.products.find((product) => product.id === id);
  }
  function brandById(id) {
    return catalogData.brands.find((brand) => brand.id === id);
  }
  function articleById(id) {
    return catalogData.articles.find((article) => article.id === id);
  }
  function catalogItemById(id) {
    return allCatalogItems.find((item) => item.id === id);
  }
  function canPurchase(item) {
    return Boolean(item && Number(item.price) > 0 && item.stock !== "\u552E\u7F44");
  }
  function imageStyle(url) {
    return `style="--image: url('${url}')"`;
  }
  function tagList(items = []) {
    return items.slice(0, 4).map((item) => `<span>${item}</span>`).join("");
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
  async function loginMember(payload) {
    const result = await apiFetch("/api/auth/login", {
      method: "POST",
      body: payload
    });
    cachedSession = result;
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
    if (!item) throw new Error("\u5546\u54C1\u4E0D\u5B58\u5728\uFF0C\u65E0\u6CD5\u52A0\u5165\u8D2D\u7269\u8F66\u3002");
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
  function cartMarkup(compact = true) {
    const entries = cartStore.getItems();
    const total = cartStore.getSubtotal();
    if (!entries.length) {
      return `
      <div class="cart-empty">
        <h2>\u8D2D\u7269\u8F66\u662F\u7A7A\u7684</h2>
        <p>\u53EF\u4EE5\u5148\u4ECE\u65B0\u54C1\u3001\u8BD5\u9999\u5957\u88C5\u6216\u9009\u9999\u95EE\u5377\u5F00\u59CB\u3002</p>
        <a class="button button-primary" href="shop.html">\u63A2\u7D22\u9999\u6C34</a>
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
            <p>${item.brand || "Scent Archive"} \xB7 ${formatPrice(item.price)}</p>
            <div class="qty-control">
              <button type="button" data-cart-change="${item.id}" data-delta="-1" aria-label="\u51CF\u5C11\u6570\u91CF">-</button>
              <span>${qty}</span>
              <button type="button" data-cart-change="${item.id}" data-delta="1" aria-label="\u589E\u52A0\u6570\u91CF">+</button>
            </div>
          </div>
          <strong>${formatPrice(lineTotal)}</strong>
        </article>
      `).join("")}
    </div>
    <div class="cart-total">
      <span>\u5C0F\u8BA1</span>
      <strong>${formatPrice(total)}</strong>
    </div>
    <div class="member-quote" data-member-quote>\u767B\u5F55\u540E\u53EF\u67E5\u770B\u4F1A\u5458\u6298\u6263\u548C\u9884\u8BA1\u79EF\u5206\u3002</div>
    <button class="button button-primary full" type="button" data-checkout>\u63D0\u4EA4\u8BA2\u5355</button>
    ${compact ? `<a class="text-link" href="cart.html">\u67E5\u770B\u5B8C\u6574\u8D2D\u7269\u8F66</a>` : `<p class="service-note">\u8BA2\u5355\u63D0\u4EA4\u540E\u7531\u540E\u53F0\u786E\u8BA4\u652F\u4ED8\uFF0C\u5BA2\u6237\u786E\u8BA4\u6536\u8D27\u540E\u81EA\u52A8\u53D1\u653E\u79EF\u5206\u548C\u66F4\u65B0\u7B49\u7EA7\u3002</p>`}
  `;
  }
  function renderCartShell() {
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
          <h2 id="cart-title">\u8D2D\u7269\u8F66</h2>
          <button class="icon-button" type="button" data-close-cart aria-label="\u5173\u95ED\u8D2D\u7269\u8F66">\xD7</button>
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
  }
  function openCart() {
    const drawer = $("[data-cart-drawer]");
    drawer == null ? void 0 : drawer.classList.add("open");
    drawer == null ? void 0 : drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");
  }
  function closeCart() {
    const drawer = $("[data-cart-drawer]");
    drawer == null ? void 0 : drawer.classList.remove("open");
    drawer == null ? void 0 : drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("locked");
  }

  // src/assets/js/checkout-client.js
  init_api_client();
  function normalizeCartItems(cartItems) {
    return cartItems.map((entry) => ({
      productId: entry.item.id,
      quantity: entry.qty
    }));
  }
  function quoteCheckout(cartItems) {
    return apiFetch("/api/checkout/quote", {
      method: "POST",
      body: {
        items: normalizeCartItems(cartItems)
      }
    });
  }
  function createOrder(cartItems) {
    return apiFetch("/api/checkout/create-order", {
      method: "POST",
      body: {
        items: normalizeCartItems(cartItems)
      }
    });
  }
  function startPayment(orderId) {
    return apiFetch("/api/checkout/start-payment", {
      method: "POST",
      body: {
        orderId
      }
    });
  }

  // src/assets/js/checkout.js
  var checkoutAdapter = {
    async startCheckout(cartItems) {
      if (!cartItems.length) {
        return {
          status: "empty",
          message: "\u8D2D\u7269\u8F66\u662F\u7A7A\u7684\uFF0C\u8BF7\u5148\u9009\u62E9\u5546\u54C1\u3002"
        };
      }
      const session = await currentSession();
      if (!session.user) {
        return {
          status: "login_required",
          message: "\u8BF7\u5148\u767B\u5F55\u4F1A\u5458\u8D26\u53F7\uFF0C\u518D\u63D0\u4EA4\u8BA2\u5355\u83B7\u5F97\u79EF\u5206\u548C\u4F1A\u5458\u6298\u6263\u3002",
          redirect: "login.html"
        };
      }
      const { order } = await createOrder(cartItems);
      const payment = await startPayment(order.id);
      return {
        status: payment.status,
        order: payment.order,
        message: payment.message
      };
    }
  };
  function startCheckout(cartItems) {
    return checkoutAdapter.startCheckout(cartItems);
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
      body: payload
    });
  }
  function getPointsRedemptions() {
    return apiFetch("/api/points-mall/redemptions");
  }
  function adminGetPointsMallItems(key) {
    return apiFetch("/api/admin/points-mall/items", {
      headers: {
        "x-admin-key": key
      }
    });
  }
  function adminGetPointsRedemptions(key) {
    return apiFetch("/api/admin/points-mall/redemptions", {
      headers: {
        "x-admin-key": key
      }
    });
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
    }, productCard = function(product, options = {}) {
      const compact = options.compact ? " product-card-compact" : "";
      const favorite = state.favorites.has(product.id);
      return `
      <article class="product-card${compact}">
        <a class="product-card-media" href="product.html?id=${product.id}" ${imageStyle(product.image)} aria-label="\u67E5\u770B ${product.name}"></a>
        <div class="product-card-body">
          <div class="meta-line">
            <span>${product.brand}</span>
            <span>${product.stock}</span>
          </div>
          <h3><a href="product.html?id=${product.id}">${product.name}</a></h3>
          <p>${product.family} \xB7 ${product.concentration}</p>
          <div class="tag-row">${tagList(product.notes)}</div>
          <div class="price-row">
            <strong>${formatPrice(product.price)}</strong>
            <span>${product.volume}</span>
          </div>
          <div class="card-actions">
            <button class="button button-secondary" type="button" data-favorite="${product.id}">
              ${favorite ? "\u5DF2\u6536\u85CF" : "\u6536\u85CF"}
            </button>
            <button class="button button-primary" type="button" data-add-cart="${product.id}">\u52A0\u5165\u8D2D\u7269\u8F66</button>
          </div>
        </div>
      </article>
    `;
    }, brandCard = function(brand, compact = false) {
      const products = catalogData.products.filter((product) => product.brandId === brand.id);
      return `
      <article class="brand-card ${compact ? "compact-card" : ""}">
        <a class="brand-card-media" href="brand.html?id=${brand.id}" ${imageStyle(brand.hero)} aria-label="\u67E5\u770B ${brand.name}"></a>
        <div class="brand-card-body">
          <span class="eyebrow">${brand.country}</span>
          <h3><a href="brand.html?id=${brand.id}">${brand.name}</a></h3>
          <p>${brand.intro}</p>
          <div class="tag-row">${tagList(brand.keywords)}</div>
          <strong>\u5165\u95E8\uFF1A${brand.starter}</strong>
          <a class="text-link" href="brand.html?id=${brand.id}">${products.length} \u4EF6\u4F5C\u54C1</a>
        </div>
      </article>
    `;
    }, articleCard = function(article) {
      return `
      <article class="article-card">
        <a class="article-media" href="article.html?id=${article.id}" ${imageStyle(article.image)} aria-label="\u9605\u8BFB ${article.title}"></a>
        <div class="article-card-body">
          <span class="eyebrow">${article.category} \xB7 ${article.date}</span>
          <h3><a href="article.html?id=${article.id}">${article.title}</a></h3>
          <p>${article.excerpt}</p>
          <a class="text-link" href="article.html?id=${article.id}">\u9605\u8BFB\u5168\u6587</a>
        </div>
      </article>
    `;
    }, sampleCard = function(set) {
      return `
      <article class="sample-card" id="set-${set.id}">
        <a class="sample-media" href="samples.html#set-${set.id}" ${imageStyle(set.image)}></a>
        <div class="sample-card-body">
          <span class="eyebrow">${set.volume}</span>
          <h3>${set.name}</h3>
          <p>${set.intro}</p>
          <div class="tag-row">${tagList(set.notes)}</div>
          <div class="price-row">
            <strong>${formatPrice(set.price)}</strong>
            <span>${set.bestFor}</span>
          </div>
          <button class="button button-primary" type="button" data-add-cart="${set.id}">\u52A0\u5165\u8D2D\u7269\u8F66</button>
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
        });
      }
      if (nav) {
        $all2("a", nav).forEach((link) => {
          if (link.dataset.nav === page) link.classList.add("active");
          link.addEventListener("click", () => {
            header == null ? void 0 : header.classList.remove("nav-open");
            toggle == null ? void 0 : toggle.setAttribute("aria-expanded", "false");
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
        const items = catalogData.products.filter((product) => product.status.includes("New") || product.status.includes("\u4E70\u624B\u63A8\u8350")).slice(0, 4);
        newGrid.innerHTML = items.map((product) => productCard(product, { compact: true })).join("");
      }
      const editGrid = $2("[data-home-edits]");
      if (editGrid) {
        editGrid.innerHTML = catalogData.edits.map((edit) => `
        <a class="edit-card" href="${edit.href}" ${imageStyle(edit.image)}>
          <span>${edit.eyebrow}</span>
          <h3>${edit.title}</h3>
          <p>${edit.intro}</p>
        </a>
      `).join("");
      }
      const brandGrid = $2("[data-home-brands]");
      if (brandGrid) {
        brandGrid.innerHTML = catalogData.brands.slice(0, 4).map((brand) => brandCard(brand, true)).join("");
      }
      const journalGrid = $2("[data-home-articles]");
      if (journalGrid) {
        journalGrid.innerHTML = catalogData.articles.slice(0, 3).map(articleCard).join("");
      }
    }, initShop = function() {
      const grid = $2("[data-shop-grid]");
      if (!grid) return;
      const form = $2("[data-shop-filters]");
      const noteWrap = $2("[data-note-filter]");
      const brandSelect = $2("[data-brand-filter]");
      const result = $2("[data-result-count]");
      if (noteWrap) {
        noteWrap.innerHTML = ["\u5168\u90E8", ...catalogData.notes].map((note) => `
        <label class="chip">
          <input type="radio" name="note" value="${note === "\u5168\u90E8" ? "all" : note}">
          <span>${note}</span>
        </label>
      `).join("");
      }
      if (brandSelect) {
        brandSelect.innerHTML = `<option value="all">\u5168\u90E8\u54C1\u724C</option>${catalogData.brands.map((brand) => `<option value="${brand.id}">${brand.name}</option>`).join("")}`;
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
          return [product.brand, product.name, product.family, product.country, product.description, ...product.notes, ...product.status].join(" ").toLowerCase().includes(q);
        });
        if (result) result.textContent = `${filtered.length} \u4EF6\u4F5C\u54C1`;
        grid.innerHTML = filtered.length ? filtered.map((product) => productCard(product)).join("") : `<div class="empty-state">\u5F53\u524D\u7B5B\u9009\u6CA1\u6709\u5339\u914D\u4F5C\u54C1\u3002\u53EF\u4EE5\u6E05\u9664\u7B5B\u9009\uFF0C\u6216\u5148\u4ECE\u8BD5\u9999\u5957\u88C5\u5F00\u59CB\u3002</div>`;
      }
      render();
    }, renderProductPage = function() {
      const mount = $2("[data-product-page]");
      if (!mount) return;
      const id = params().get("id") || catalogData.products[0].id;
      const product = productById(id) || catalogData.products[0];
      const brand = brandById(product.brandId);
      const related = catalogData.products.filter((item) => item.id !== product.id && (item.brandId === product.brandId || item.notes.some((note) => product.notes.includes(note)))).slice(0, 3);
      document.title = `${product.name} | \u6C14\u5473\u6863\u6848`;
      mount.innerHTML = `
      <nav class="breadcrumb" aria-label="\u9762\u5305\u5C51">
        <a href="index.html">\u9996\u9875</a>
        <span>/</span>
        <a href="shop.html">\u9999\u6C34</a>
        <span>/</span>
        <span>${product.name}</span>
      </nav>
      <section class="product-detail">
        <div class="product-gallery">
          <div class="product-main-image" ${imageStyle(product.image)}></div>
          <div class="gallery-note">\u53EF\u67E5\u770B\u74F6\u8EAB\u3001\u5305\u88C5\u548C\u7EC6\u8282\u56FE\uFF0C\u8D2D\u4E70\u524D\u4E5F\u53EF\u4EE5\u5148\u9009\u62E9\u8BD5\u9999\u5957\u88C5\u3002</div>
        </div>
        <div class="product-purchase">
          <p class="eyebrow">${product.brand} \xB7 ${product.country}</p>
          <h1>${product.name}</h1>
          <p>${product.description}</p>
          <div class="tag-row">${tagList(product.notes)}</div>
          <div class="purchase-box">
            <div><span>\u4EF7\u683C</span><strong>${formatPrice(product.price)}</strong></div>
            <div><span>\u5BB9\u91CF</span><strong>${product.volume}</strong></div>
            <div><span>\u6D53\u5EA6</span><strong>${product.concentration}</strong></div>
            <div><span>\u5E93\u5B58</span><strong>${product.stock}</strong></div>
          </div>
          <div class="purchase-actions">
            <button class="button button-primary" type="button" data-add-cart="${product.id}">\u52A0\u5165\u8D2D\u7269\u8F66</button>
            <button class="button button-secondary" type="button" data-favorite="${product.id}">${state.favorites.has(product.id) ? "\u5DF2\u6536\u85CF" : "\u6536\u85CF"}</button>
          </div>
        </div>
      </section>
      <section class="detail-panels">
        <article>
          <h2>\u9999\u8C03\u7ED3\u6784</h2>
          <dl class="note-list">
            <div><dt>\u524D\u8C03</dt><dd>${product.top}</dd></div>
            <div><dt>\u4E2D\u8C03</dt><dd>${product.middle}</dd></div>
            <div><dt>\u540E\u8C03</dt><dd>${product.base}</dd></div>
            <div><dt>\u9999\u8C03\u5BB6\u65CF</dt><dd>${product.family}</dd></div>
            <div><dt>\u8C03\u9999\u5E08</dt><dd>${product.perfumer}</dd></div>
            <div><dt>\u53D1\u5E03\u5E74\u4EFD</dt><dd>${product.year}</dd></div>
          </dl>
        </article>
        <article>
          <h2>\u4E70\u624B\u70B9\u8BC4</h2>
          <p>${product.buyer}</p>
          <p><strong>\u9002\u5408\uFF1A</strong>${product.bestFor}</p>
          <p><strong>\u63D0\u9192\uFF1A</strong>${product.caution}</p>
        </article>
        <article>
          <h2>\u89C4\u683C\u4E0E\u670D\u52A1</h2>
          <p>\u73B0\u8D27\u5546\u54C1 48 \u5C0F\u65F6\u5185\u53D1\u51FA\uFF0C\u9ED8\u8BA4\u987A\u4E30\u3002\u6B63\u88C5\u672A\u62C6\u5C01\u53EF\u6309\u653F\u7B56\u5904\u7406\uFF0C\u8BD5\u9999\u548C\u5DF2\u62C6\u5C01\u5546\u54C1\u4E0D\u652F\u6301\u65E0\u7406\u7531\u9000\u6362\u3002</p>
          <a class="text-link" href="service.html">\u67E5\u770B\u914D\u9001\u4E0E\u9000\u6362\u653F\u7B56</a>
        </article>
      </section>
      <section class="section-tight">
        <div class="section-heading row-heading">
          <div>
            <p class="eyebrow">Related</p>
            <h2>\u76F8\u5173\u63A8\u8350</h2>
          </div>
          <a class="text-link" href="${brand ? `brand.html?id=${brand.id}` : "brands.html"}">\u67E5\u770B\u54C1\u724C</a>
        </div>
        <div class="product-grid">${related.map((item) => productCard(item, { compact: true })).join("")}</div>
      </section>
    `;
    }, renderBrands = function() {
      const grid = $2("[data-brand-grid]");
      if (grid) grid.innerHTML = catalogData.brands.map((brand2) => brandCard(brand2)).join("");
      const mount = $2("[data-brand-page]");
      if (!mount) return;
      const id = params().get("id") || catalogData.brands[0].id;
      const brand = brandById(id) || catalogData.brands[0];
      const products = catalogData.products.filter((product) => product.brandId === brand.id);
      document.title = `${brand.name} | \u6C14\u5473\u6863\u6848`;
      mount.innerHTML = `
      <section class="split-hero compact-hero">
        <div class="split-copy">
          <nav class="breadcrumb" aria-label="\u9762\u5305\u5C51"><a href="brands.html">\u54C1\u724C</a><span>/</span><span>${brand.name}</span></nav>
          <p class="eyebrow">${brand.country}</p>
          <h1>${brand.name}</h1>
          <p>${brand.intro}</p>
          <div class="tag-row">${tagList(brand.keywords)}</div>
        </div>
        <div class="split-image" ${imageStyle(brand.hero)}></div>
      </section>
      <section class="detail-panels">
        <article>
          <h2>\u54C1\u724C\u6545\u4E8B</h2>
          <p>${brand.story}</p>
        </article>
        <article>
          <h2>\u521B\u4F5C\u4FE1\u606F</h2>
          <p><strong>\u521B\u529E\u4EBA / \u8C03\u9999\uFF1A</strong>${brand.founder}</p>
          <p><strong>\u4E70\u624B\u5165\u95E8\u6B3E\uFF1A</strong>${brand.starter}</p>
        </article>
      </section>
      <section class="section-tight">
        <div class="section-heading row-heading">
          <div>
            <p class="eyebrow">Works</p>
            <h2>${brand.name} \u4F5C\u54C1</h2>
          </div>
          <a class="text-link" href="shop.html?brand=${brand.id}">\u8FDB\u5165\u5546\u54C1\u5217\u8868</a>
        </div>
        <div class="product-grid">${products.map((product) => productCard(product, { compact: true })).join("")}</div>
      </section>
    `;
    }, renderSamples = function() {
      const grid = $2("[data-sample-grid]");
      if (grid) grid.innerHTML = catalogData.sampleSets.map(sampleCard).join("");
    }, renderGuide = function() {
      const noteGrid = $2("[data-guide-notes]");
      if (noteGrid) {
        noteGrid.innerHTML = catalogData.notes.slice(0, 8).map((note) => `<a class="guide-tile" href="shop.html?note=${encodeURIComponent(note)}">${note}</a>`).join("");
      }
      const sceneGrid = $2("[data-guide-scenes]");
      if (sceneGrid) {
        sceneGrid.innerHTML = catalogData.scenes.map((scene) => `<a class="guide-tile" href="shop.html?scene=${scene.id}">${scene.label}</a>`).join("");
      }
      const form = $2("[data-quiz]");
      const result = $2("[data-quiz-result]");
      if (!form || !result) return;
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const mood = formData.get("mood");
        const scene = formData.get("scene");
        const sweet = formData.get("sweet");
        const scored = catalogData.products.filter((product) => product.category === "fragrance").map((product) => {
          let score = 0;
          if (product.mood.includes(mood)) score += 3;
          if (product.scenes.includes(scene)) score += 2;
          if (product.sweetness === sweet) score += 2;
          if (product.status.includes("\u4E70\u624B\u63A8\u8350")) score += 1;
          return { product, score };
        }).sort((a, b) => b.score - a.score).slice(0, 3).map(({ product }) => product);
        result.innerHTML = `
        <h2>\u63A8\u8350\u7ED3\u679C</h2>
        <p>\u5148\u8BD5\u8FD9\u4E09\u6B3E\uFF0C\u518D\u51B3\u5B9A\u662F\u5426\u4E70\u6B63\u88C5\u3002\u4E5F\u53EF\u4EE5\u76F4\u63A5\u9009\u62E9\u65B0\u5BA2\u53D1\u73B0\u8BD5\u9999\u5957\u88C5\u3002</p>
        <div class="product-grid compact-grid">${scored.map((product) => productCard(product, { compact: true })).join("")}</div>
        <a class="button button-secondary" href="samples.html">\u67E5\u770B\u8BD5\u9999\u5957\u88C5</a>
      `;
      });
    }, renderJournal = function() {
      const grid = $2("[data-journal-grid]");
      if (grid) grid.innerHTML = catalogData.articles.map(articleCard).join("");
      const mount = $2("[data-article-page]");
      if (!mount) return;
      const id = params().get("id") || catalogData.articles[0].id;
      const article = articleById(id) || catalogData.articles[0];
      const relatedProducts = article.relatedProducts.map(productById).filter(Boolean);
      document.title = `${article.title} | \u6C14\u5473\u6863\u6848`;
      mount.innerHTML = `
      <article class="article-detail">
        <nav class="breadcrumb" aria-label="\u9762\u5305\u5C51"><a href="journal.html">Journal</a><span>/</span><span>${article.category}</span></nav>
        <p class="eyebrow">${article.category} \xB7 ${article.date}</p>
        <h1>${article.title}</h1>
        <div class="article-hero-image" ${imageStyle(article.image)}></div>
        ${article.body.map((paragraph) => `<p>${paragraph}</p>`).join("")}
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
          try {
            await loginMember({
              account: formData.get("account"),
              password: formData.get("password")
            });
            showToast("\u767B\u5F55\u6210\u529F\u3002");
            window.location.href = "account.html";
          } catch (error) {
            showToast(error.message);
          }
        });
      }
      const registerForm = $2("[data-register-form]");
      if (registerForm) {
        registerForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          const formData = new FormData(registerForm);
          try {
            await registerMember({
              name: formData.get("name"),
              email: formData.get("email"),
              phone: formData.get("phone"),
              password: formData.get("password")
            });
            showToast("\u6CE8\u518C\u6210\u529F\u3002");
            window.location.href = "account.html";
          } catch (error) {
            showToast(error.message);
          }
        });
      }
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
        pending_payment: "\u5F85\u786E\u8BA4\u652F\u4ED8",
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
      if (order.pointsAwarded) return `\u5DF2\u53D1\u653E\u79EF\u5206\uFF1A${order.pointsAwarded}`;
      if (["paid", "processing", "shipped"].includes(order.status)) return "\u786E\u8BA4\u6536\u8D27\u540E\u53D1\u653E\u79EF\u5206";
      if (order.status === "refunded") return "\u5DF2\u9000\u6B3E\uFF0C\u4E0D\u53D1\u653E\u79EF\u5206";
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
        cancel_points_redemption: "\u53D6\u6D88\u5151\u6362\u8BA2\u5355"
      }[action] || action;
    }, addToCart = function(id) {
      try {
        const item = cartStore.addItem(id);
        renderCartShell();
        renderCartPage();
        refreshMemberQuote();
        showToast(`${item.name} \u5DF2\u52A0\u5165\u8D2D\u7269\u8F66`);
      } catch (error) {
        showToast(error.message);
      }
    }, changeCart = function(id, delta) {
      var _a;
      const wasOpen = (_a = $2("[data-cart-drawer]")) == null ? void 0 : _a.classList.contains("open");
      try {
        cartStore.changeQuantity(id, Number(delta));
        renderCartShell();
        renderCartPage();
        refreshMemberQuote();
        if (wasOpen) openCart();
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
        const checkout = event.target.closest("[data-checkout]");
        const service = event.target.closest("[data-service-action]");
        const logout = event.target.closest("[data-logout]");
        const adminPay = event.target.closest("[data-admin-pay]");
        const adminRefund = event.target.closest("[data-admin-refund]");
        const adminComplete = event.target.closest("[data-admin-complete]");
        const confirmReceipt = event.target.closest("[data-confirm-receipt]");
        const adminExport = event.target.closest("[data-admin-export]");
        const adminMallActivate = event.target.closest("[data-admin-mall-activate]");
        const adminMallDeactivate = event.target.closest("[data-admin-mall-deactivate]");
        const adminRedemptionStatus = event.target.closest("[data-admin-redemption-status]");
        const adminRedemptionCancel = event.target.closest("[data-admin-redemption-cancel]");
        if (add) addToCart(add.dataset.addCart);
        if (fav) toggleFavorite(fav.dataset.favorite);
        if (open) openCart();
        if (close) closeCart();
        if (change) changeCart(change.dataset.cartChange, Number(change.dataset.delta));
        if (checkout) {
          try {
            const result = await startCheckout(cartStore.getItems());
            showToast(result.message);
            if (result.redirect) {
              setTimeout(() => {
                window.location.href = result.redirect;
              }, 700);
            }
            if (result.order) {
              cartStore.clear();
              renderCartShell();
              renderCartPage();
              refreshMemberQuote();
            }
          } catch (error) {
            showToast(error.message);
          }
        }
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
          const key = window.prompt("\u8F93\u5165\u540E\u53F0\u786E\u8BA4\u652F\u4ED8\u5BC6\u94A5", "dev-admin");
          if (!key) return;
          try {
            await adminPayOrder(adminPay.dataset.adminPay, key);
            resetSessionCache();
            showToast("\u8BA2\u5355\u5DF2\u786E\u8BA4\u652F\u4ED8\uFF0C\u7B49\u5F85\u5BA2\u6237\u786E\u8BA4\u6536\u8D27\u540E\u7ED3\u7B97\u79EF\u5206\u548C\u7B49\u7EA7\u3002");
            await renderOrdersPage();
            await initAuthHeader();
          } catch (error) {
            showToast(error.message);
          }
        }
        if (confirmReceipt) {
          try {
            await confirmReceiptOrder(confirmReceipt.dataset.confirmReceipt);
            resetSessionCache();
            showToast("\u5DF2\u786E\u8BA4\u6536\u8D27\uFF0C\u79EF\u5206\u548C\u7B49\u7EA7\u5DF2\u7ED3\u7B97\u3002");
            await renderOrdersPage();
            await initAuthHeader();
          } catch (error) {
            showToast(error.message);
          }
        }
        if (adminComplete) {
          const key = window.prompt("\u8F93\u5165\u540E\u53F0\u786E\u8BA4\u6536\u8D27\u5BC6\u94A5", window.localStorage.getItem("sa_admin_key") || "dev-admin");
          if (!key) return;
          try {
            await apiFetch(`/api/admin/orders/${encodeURIComponent(adminComplete.dataset.adminComplete)}/complete`, {
              method: "POST",
              headers: {
                "x-admin-key": key
              }
            });
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
          const key = window.prompt("\u8F93\u5165\u540E\u53F0\u9000\u6B3E\u5BC6\u94A5", window.localStorage.getItem("sa_admin_key") || "dev-admin");
          if (!key) return;
          try {
            await apiFetch(`/api/admin/orders/${encodeURIComponent(adminRefund.dataset.adminRefund)}/refund`, {
              method: "POST",
              headers: {
                "x-admin-key": key
              }
            });
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
          const key = window.localStorage.getItem("sa_admin_key") || window.prompt("\u8F93\u5165\u540E\u53F0\u5BC6\u94A5", "dev-admin");
          if (!key) return;
          const node = adminMallActivate || adminMallDeactivate;
          const action = adminMallActivate ? "activate" : "deactivate";
          try {
            await apiFetch(`/api/admin/points-mall/items/${encodeURIComponent(node.dataset.adminMallActivate || node.dataset.adminMallDeactivate)}/${action}`, {
              method: "POST",
              headers: {
                "x-admin-key": key
              }
            });
            showToast(action === "activate" ? "\u79EF\u5206\u5546\u54C1\u5DF2\u4E0A\u67B6\u3002" : "\u79EF\u5206\u5546\u54C1\u5DF2\u4E0B\u67B6\u3002");
            await renderAdminPage();
          } catch (error) {
            showToast(error.message);
          }
        }
        if (adminRedemptionStatus) {
          const key = window.localStorage.getItem("sa_admin_key") || window.prompt("\u8F93\u5165\u540E\u53F0\u5BC6\u94A5", "dev-admin");
          if (!key) return;
          const trackingNo = adminRedemptionStatus.dataset.status === "shipped" ? window.prompt("\u7269\u6D41\u5355\u53F7\uFF0C\u53EF\u7559\u7A7A", "") : "";
          try {
            await apiFetch(`/api/admin/points-mall/redemptions/${encodeURIComponent(adminRedemptionStatus.dataset.adminRedemptionStatus)}/status`, {
              method: "PATCH",
              headers: {
                "x-admin-key": key
              },
              body: {
                status: adminRedemptionStatus.dataset.status,
                trackingNo
              }
            });
            showToast("\u5151\u6362\u8BA2\u5355\u72B6\u6001\u5DF2\u66F4\u65B0\u3002");
            await renderAdminPage();
          } catch (error) {
            showToast(error.message);
          }
        }
        if (adminRedemptionCancel) {
          const key = window.localStorage.getItem("sa_admin_key") || window.prompt("\u8F93\u5165\u540E\u53F0\u5BC6\u94A5", "dev-admin");
          if (!key) return;
          try {
            await apiFetch(`/api/admin/points-mall/redemptions/${encodeURIComponent(adminRedemptionCancel.dataset.adminRedemptionCancel)}/cancel`, {
              method: "POST",
              headers: {
                "x-admin-key": key
              },
              body: {
                reason: "\u540E\u53F0\u53D6\u6D88\u5151\u6362"
              }
            });
            resetSessionCache();
            showToast("\u5151\u6362\u8BA2\u5355\u5DF2\u53D6\u6D88\uFF0C\u79EF\u5206\u548C\u5E93\u5B58\u5DF2\u8FD4\u8FD8\u3002");
            await renderAdminPage();
          } catch (error) {
            showToast(error.message);
          }
        }
        if (adminExport) {
          const key = window.localStorage.getItem("sa_admin_key") || window.prompt("\u8F93\u5165\u540E\u53F0\u5BFC\u51FA\u5BC6\u94A5", "dev-admin");
          if (!key) return;
          try {
            const response = await fetch("/api/admin/members/export.csv", {
              headers: {
                "x-admin-key": key
              }
            });
            if (!response.ok) {
              const payload = await response.json().catch(() => ({}));
              throw new Error(payload.error || "\u4F1A\u5458\u540D\u5355\u5BFC\u51FA\u5931\u8D25\u3002");
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `scent-archive-members-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            showToast("\u4F1A\u5458\u540D\u5355\u5DF2\u5BFC\u51FA\u3002");
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
      favorites: new Set(readStore("sa_favorites", []))
    };
    initNavigation();
    renderCartShell();
    bindGlobalActions();
    initAuthHeader();
    renderHome();
    initShop();
    renderProductPage();
    renderBrands();
    renderSamples();
    renderGuide();
    renderJournal();
    renderCartPage();
    refreshMemberQuote();
    renderAuthForms();
    renderAccountPage();
    renderPointsPage();
    renderOrdersPage();
    renderMembershipPage();
    renderPointsMallPage();
    renderPointsMallItemPage();
    renderPointsRedemptionsPage();
    renderAdminPage();
    async function initAuthHeader() {
      const mount = $2("[data-auth-actions]");
      if (!mount) return;
      const session = await currentSession();
      if (!session.user) {
        mount.innerHTML = `
        <a class="text-link" href="login.html">\u767B\u5F55</a>
        <a class="text-link" href="register.html">\u6CE8\u518C</a>
      `;
        return;
      }
      mount.innerHTML = `
      <a class="text-link" href="account.html">${session.tier.name}</a>
      <a class="text-link" href="points.html">${session.profile.availablePoints} \u79EF\u5206</a>
      <button class="text-button" type="button" data-logout>\u9000\u51FA</button>
    `;
    }
    async function renderAccountPage() {
      const mount = $2("[data-account-page]");
      if (!mount) return;
      try {
        const data = await getMemberProfile();
        mount.innerHTML = `
        ${memberNav()}
        <div class="member-dashboard">
          <article>
            <span class="eyebrow">Current tier</span>
            <h2>${data.tier.name}</h2>
            <p>\u5F53\u524D\u6298\u6263\uFF1A${discountLabel(data.tier.discountRate)} \xB7 \u79EF\u5206\u500D\u6570\uFF1A${data.tier.pointMultiplier || 1}x</p>
          </article>
          <article>
            <span class="eyebrow">Points</span>
            <h2>${data.profile.availablePoints}</h2>
            <p>\u53EF\u7528\u79EF\u5206</p>
          </article>
          <article>
            <span class="eyebrow">Lifetime paid</span>
            <h2>${moneyText(data.profile.lifetimePaidAmountYuan)}</h2>
            <p>${data.nextTier ? `\u8DDD\u79BB ${data.nextTier.name} \u8FD8\u5DEE ${moneyText(data.amountToNextTierYuan)}` : "\u5DF2\u8FBE\u5230\u6700\u9AD8\u7B49\u7EA7"}</p>
          </article>
        </div>
        <form class="account-form compact-account-form" data-profile-form>
          <label class="field-label">\u59D3\u540D<input name="name" value="${data.user.name || ""}"></label>
          <label class="field-label">\u751F\u65E5<input name="birthday" type="date" value="${data.profile.birthday || ""}"></label>
          <button class="button button-secondary" type="submit">\u4FDD\u5B58\u8D44\u6599</button>
        </form>
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
          <strong>${profile.profile.availablePoints}</strong>
          <span>\u53EF\u7528\u79EF\u5206</span>
        </div>
        <div class="member-table">
          ${points.transactions.length ? points.transactions.map((item) => `
            <article>
              <div>
                <h3>${pointTypeLabel(item.type)}</h3>
                <p>${item.note || ""}${item.expiresAt ? ` \xB7 \u6709\u6548\u81F3 ${new Date(item.expiresAt).toLocaleDateString("zh-CN")}` : ""}</p>
              </div>
              <strong>${item.points > 0 ? "+" : ""}${item.points}</strong>
              <span>${new Date(item.createdAt).toLocaleString("zh-CN")}</span>
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
          <strong>${profile.profile.availablePoints}</strong>
          <span>\u53EF\u7528\u79EF\u5206</span>
        </div>
        <div class="mall-grid">
          ${mall.items.length ? mall.items.map((item) => `
            <article class="mall-card">
              <a class="mall-image" href="points-item.html?id=${encodeURIComponent(item.id)}" style="background-image:url('${item.image}')"></a>
              <div>
                <p class="eyebrow">${item.stockQuantity > 0 ? `\u5E93\u5B58 ${item.stockQuantity}` : "\u5DF2\u5151\u5B8C"}</p>
                <h2>${item.name}</h2>
                <p>${item.description || ""}</p>
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
          <div class="mall-detail-image" style="background-image:url('${item.image}')"></div>
          <div class="mall-detail-panel">
            <p class="eyebrow">${item.stockQuantity > 0 ? `\u5E93\u5B58 ${item.stockQuantity}` : "\u5DF2\u5151\u5B8C"}</p>
            <h2>${item.name}</h2>
            <p>${item.description || ""}</p>
            <div class="member-summary compact-summary">
              <strong>${item.pointsPrice}</strong>
              <span>\u5151\u6362\u79EF\u5206 \xB7 \u4F60\u6709 ${profile.profile.availablePoints} \u79EF\u5206</span>
            </div>
            <form class="account-form compact-account-form" data-redeem-form>
              <label class="field-label">\u5151\u6362\u6570\u91CF<input name="quantity" type="number" min="1" max="${item.stockQuantity}" value="1" required></label>
              <label class="field-label">\u6536\u4EF6\u4EBA<input name="recipientName" value="${profile.user.name || ""}"></label>
              <label class="field-label">\u8054\u7CFB\u7535\u8BDD<input name="recipientPhone" value="${profile.user.phone || ""}"></label>
              <label class="field-label">\u6536\u8D27\u5730\u5740<input name="shippingAddress"></label>
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
          const requestId = form.dataset.requestId || `${item.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          form.dataset.requestId = requestId;
          try {
            const result = await redeemPointsMallItem({
              mallItemId: item.id,
              quantity: Number(formData.get("quantity")),
              recipientName: formData.get("recipientName"),
              recipientPhone: formData.get("recipientPhone"),
              shippingAddress: formData.get("shippingAddress"),
              requestId
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
                <h3>${order.orderNo}</h3>
                <p>${order.items.map((item) => `${item.name} x ${item.quantity}`).join("\u3001")}</p>
                <p>${order.trackingNo ? `\u7269\u6D41\u5355\u53F7\uFF1A${order.trackingNo}` : "\u7B49\u5F85\u540E\u53F0\u5904\u7406"}</p>
              </div>
              <strong>${order.totalPoints} \u79EF\u5206</strong>
              <span>${redemptionStatusLabel(order.status)}</span>
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
                <h3>${order.orderNo}</h3>
                <p>${order.items.map((item) => `${item.productName} x ${item.quantity}`).join("\u3001")}</p>
                <p>\u4F1A\u5458\u6298\u6263\uFF1A${moneyText(order.memberDiscountAmountYuan)} \xB7 ${orderPointsText(order)}</p>
              </div>
              <strong>${moneyText(order.paidAmountYuan)}</strong>
              <span>${orderStatusLabel(order.status)}</span>
              ${order.status === "pending_payment" ? `<button class="button button-secondary" type="button" data-admin-pay="${order.id}">\u5F00\u53D1\u786E\u8BA4\u652F\u4ED8</button>` : ""}
              ${["paid", "shipped"].includes(order.status) ? `<button class="button button-secondary" type="button" data-confirm-receipt="${order.id}">\u786E\u8BA4\u6536\u8D27</button>` : ""}
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
      ${current ? `<div class="member-summary"><strong>${current.tier.name}</strong><span>${current.nextTier ? `\u8DDD\u79BB ${current.nextTier.name} \u8FD8\u5DEE ${moneyText(current.amountToNextTierYuan)}` : "\u5DF2\u8FBE\u5230\u6700\u9AD8\u7B49\u7EA7"}</span></div>` : ""}
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
    async function renderAdminPage() {
      var _a, _b;
      const mount = $2("[data-admin-page]");
      if (!mount) return;
      const key = window.localStorage.getItem("sa_admin_key") || (["localhost", "127.0.0.1"].includes(window.location.hostname) ? "dev-admin" : "");
      if (!key) {
        mount.innerHTML = `
        <form class="account-form" data-admin-key-form>
          <label class="field-label">\u540E\u53F0\u5BC6\u94A5<input name="key" required></label>
          <button class="button button-primary" type="submit">\u8FDB\u5165\u540E\u53F0</button>
        </form>
      `;
        (_a = $2("[data-admin-key-form]", mount)) == null ? void 0 : _a.addEventListener("submit", (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          window.localStorage.setItem("sa_admin_key", formData.get("key"));
          renderAdminPage();
        });
        return;
      }
      window.localStorage.setItem("sa_admin_key", key);
      try {
        const [members, orders, points, logs, mallItems, mallRedemptions] = await Promise.all([
          apiFetch("/api/admin/members", { headers: { "x-admin-key": key } }),
          apiFetch("/api/admin/orders", { headers: { "x-admin-key": key } }),
          apiFetch("/api/admin/points", { headers: { "x-admin-key": key } }),
          apiFetch("/api/admin/audit-logs", { headers: { "x-admin-key": key } }),
          adminGetPointsMallItems(key),
          adminGetPointsRedemptions(key)
        ]);
        mount.innerHTML = `
        <div class="section-heading">
          <p class="eyebrow">Admin</p>
          <h2>\u4F1A\u5458\u4E0E\u8BA2\u5355\u7BA1\u7406</h2>
          <p>\u672C\u9875\u9762\u7528\u4E8E\u672C\u5730\u5F00\u53D1\u786E\u8BA4\u652F\u4ED8\u3001\u786E\u8BA4\u6536\u8D27\u548C\u9000\u6B3E\uFF0C\u4E0A\u7EBF\u524D\u5E94\u66FF\u6362\u4E3A\u6B63\u5F0F\u540E\u53F0\u8BA4\u8BC1\u3002</p>
          <button class="button button-secondary" type="button" data-admin-export>\u5BFC\u51FA\u4F1A\u5458\u540D\u5355</button>
        </div>
        <div class="admin-grid">
          <section>
            <h2>\u4F1A\u5458</h2>
            <div class="member-table">
              ${members.members.map((member) => `
                <article>
                  <div>
                    <h3>${member.user.name || member.user.email || member.user.phone}</h3>
                    <p>${member.tier.name} \xB7 ${member.profile.availablePoints} \u79EF\u5206 \xB7 \u7D2F\u8BA1 ${moneyText(member.profile.lifetimePaidAmountYuan)}</p>
                  </div>
                  <span>${member.user.email || member.user.phone}</span>
                </article>
              `).join("")}
            </div>
          </section>
          <section>
            <h2>\u8BA2\u5355</h2>
            <div class="member-table">
              ${orders.orders.map((order) => `
                <article>
                  <div>
                    <h3>${order.orderNo}</h3>
                    <p>${order.items.map((item) => `${item.productName} x ${item.quantity}`).join("\u3001")}</p>
                    <p>${orderStatusLabel(order.status)} \xB7 ${orderPointsText(order)}</p>
                  </div>
                  <strong>${moneyText(order.paidAmountYuan)}</strong>
                  ${order.status === "pending_payment" ? `<button class="button button-secondary" type="button" data-admin-pay="${order.id}">\u786E\u8BA4\u652F\u4ED8</button>` : ""}
                  ${["paid", "shipped"].includes(order.status) ? `<button class="button button-secondary" type="button" data-admin-complete="${order.id}">\u786E\u8BA4\u6536\u8D27</button>` : ""}
                  ${["paid", "shipped", "completed"].includes(order.status) ? `<button class="button button-secondary" type="button" data-admin-refund="${order.id}">\u9000\u6B3E</button>` : ""}
                </article>
              `).join("")}
            </div>
          </section>
          <section>
            <h2>\u79EF\u5206\u6D41\u6C34</h2>
            <div class="member-table">
              ${points.transactions.slice(0, 10).map((item) => {
          var _a2, _b2, _c;
          return `
                <article>
                  <div>
                    <h3>${pointTypeLabel(item.type)}</h3>
                    <p>${((_a2 = item.user) == null ? void 0 : _a2.name) || ((_b2 = item.user) == null ? void 0 : _b2.email) || ((_c = item.user) == null ? void 0 : _c.phone) || "\u672A\u77E5\u4F1A\u5458"}${item.orderNo ? ` \xB7 ${item.orderNo}` : ""}</p>
                  </div>
                  <strong>${item.points > 0 ? "+" : ""}${item.points}</strong>
                  <span>${new Date(item.createdAt).toLocaleString("zh-CN")}</span>
                </article>
              `;
        }).join("") || `<div class="empty-state">\u6682\u65E0\u79EF\u5206\u6D41\u6C34\u3002</div>`}
            </div>
          </section>
          <section>
            <h2>\u79EF\u5206\u5546\u54C1</h2>
            <form class="account-form compact-account-form" data-admin-mall-item-form>
              <label class="field-label">\u540D\u79F0<input name="name" required></label>
              <label class="field-label">\u5173\u8054\u5546\u54C1 ID<input name="productId" placeholder="\u53EF\u9009\uFF0C\u5982 tea-sample"></label>
              <label class="field-label">\u79EF\u5206\u4EF7\u683C<input name="pointsPrice" type="number" min="1" required></label>
              <label class="field-label">\u5E93\u5B58<input name="stockQuantity" type="number" min="0" required></label>
              <button class="button button-secondary" type="submit">\u65B0\u589E\u79EF\u5206\u5546\u54C1</button>
            </form>
            <div class="member-table admin-nested-table">
              ${mallItems.items.map((item) => `
                <article>
                  <div>
                    <h3>${item.name}</h3>
                    <p>${item.pointsPrice} \u79EF\u5206 \xB7 \u5E93\u5B58 ${item.stockQuantity} \xB7 ${mallItemStatusLabel(item.status)}</p>
                  </div>
                  ${item.status === "active" ? `<button class="button button-secondary" type="button" data-admin-mall-deactivate="${item.id}">\u4E0B\u67B6</button>` : ""}
                  ${item.status !== "active" && item.stockQuantity > 0 ? `<button class="button button-secondary" type="button" data-admin-mall-activate="${item.id}">\u4E0A\u67B6</button>` : ""}
                </article>
              `).join("") || `<div class="empty-state">\u6682\u65E0\u79EF\u5206\u5546\u54C1\u3002</div>`}
            </div>
          </section>
          <section>
            <h2>\u5151\u6362\u8BA2\u5355</h2>
            <div class="member-table">
              ${mallRedemptions.redemptions.map((order) => {
          var _a2, _b2, _c;
          return `
                <article>
                  <div>
                    <h3>${order.orderNo}</h3>
                    <p>${order.items.map((item) => `${item.name} x ${item.quantity}`).join("\u3001")}</p>
                    <p>${((_a2 = order.user) == null ? void 0 : _a2.name) || ((_b2 = order.user) == null ? void 0 : _b2.email) || ((_c = order.user) == null ? void 0 : _c.phone) || "\u672A\u77E5\u4F1A\u5458"} \xB7 ${redemptionStatusLabel(order.status)}</p>
                  </div>
                  <strong>${order.totalPoints} \u79EF\u5206</strong>
                  ${order.status === "pending_fulfillment" ? `<button class="button button-secondary" type="button" data-admin-redemption-status="${order.id}" data-status="processing">\u5904\u7406</button>` : ""}
                  ${["pending_fulfillment", "processing"].includes(order.status) ? `<button class="button button-secondary" type="button" data-admin-redemption-status="${order.id}" data-status="shipped">\u53D1\u8D27</button>` : ""}
                  ${order.status === "shipped" ? `<button class="button button-secondary" type="button" data-admin-redemption-status="${order.id}" data-status="completed">\u5B8C\u6210</button>` : ""}
                  ${!["cancelled", "completed"].includes(order.status) ? `<button class="button button-secondary" type="button" data-admin-redemption-cancel="${order.id}">\u53D6\u6D88</button>` : ""}
                </article>
              `;
        }).join("") || `<div class="empty-state">\u6682\u65E0\u5151\u6362\u8BA2\u5355\u3002</div>`}
            </div>
          </section>
          <section>
            <h2>\u64CD\u4F5C\u65E5\u5FD7</h2>
            <div class="member-table">
              ${logs.logs.slice(0, 10).map((item) => `
                <article>
                  <div>
                    <h3>${adminActionLabel(item.action)}</h3>
                    <p>${item.reason || item.entityType} \xB7 ${item.actor}</p>
                  </div>
                  <span>${new Date(item.createdAt).toLocaleString("zh-CN")}</span>
                </article>
              `).join("") || `<div class="empty-state">\u6682\u65E0\u64CD\u4F5C\u65E5\u5FD7\u3002</div>`}
            </div>
          </section>
        </div>
      `;
        (_b = $2("[data-admin-mall-item-form]", mount)) == null ? void 0 : _b.addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const formData = new FormData(form);
          try {
            await apiFetch("/api/admin/points-mall/items", {
              method: "POST",
              headers: {
                "x-admin-key": key
              },
              body: {
                name: formData.get("name"),
                productId: formData.get("productId"),
                pointsPrice: Number(formData.get("pointsPrice")),
                stockQuantity: Number(formData.get("stockQuantity")),
                status: "active"
              }
            });
            showToast("\u79EF\u5206\u5546\u54C1\u5DF2\u65B0\u589E\u3002");
            await renderAdminPage();
          } catch (error) {
            showToast(error.message);
          }
        });
      } catch (error) {
        mount.innerHTML = `<div class="empty-state">${error.message}</div>`;
      }
    }
    async function refreshMemberQuote() {
      const entries = cartStore.getItems();
      const mounts = $all2("[data-member-quote]");
      if (!mounts.length || !entries.length) return;
      try {
        const quote = await quoteCheckout(entries);
        mounts.forEach((mount) => {
          mount.innerHTML = `
          <strong>${quote.tier.name}</strong>
          <span>\u4F1A\u5458\u6298\u6263 ${moneyText(quote.memberDiscountAmountYuan)} \xB7 \u8FD0\u8D39 ${moneyText(quote.shippingAmountYuan)} \xB7 \u5E94\u4ED8 ${moneyText(quote.paidAmountYuan)} \xB7 \u786E\u8BA4\u6536\u8D27\u540E\u9884\u8BA1\u83B7\u5F97 ${quote.pointsToEarn} \u79EF\u5206</span>
        `;
        });
      } catch (e) {
        mounts.forEach((mount) => {
          mount.textContent = "\u767B\u5F55\u4F1A\u5458\u540E\u53EF\u67E5\u770B\u4F1A\u5458\u6298\u6263\u548C\u9884\u8BA1\u79EF\u5206\u3002";
        });
      }
    }
    let toastTimer;
  }
})();
