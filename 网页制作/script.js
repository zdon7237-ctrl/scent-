(() => {
  const data = window.SA_DATA;
  if (!data) return;

  const allCatalogItems = [...data.products, ...data.sampleSets.map((set) => ({
    ...set,
    brand: "Scent Archive",
    category: "sample",
    country: "Curated",
    stock: "现货",
    concentration: "Sample Set",
    family: "试香套装",
    status: ["Sample"],
    description: set.intro,
    scenes: ["daily", "gift"],
    mood: ["clean"],
    sweetness: "medium"
  }))];

  const state = {
    cart: readStore("sa_cart", {}),
    favorites: new Set(readStore("sa_favorites", []))
  };

  function readStore(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStore(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function formatPrice(value) {
    return `¥${Number(value).toLocaleString("zh-CN")}`;
  }

  function productById(id) {
    return data.products.find((product) => product.id === id);
  }

  function brandById(id) {
    return data.brands.find((brand) => brand.id === id);
  }

  function articleById(id) {
    return data.articles.find((article) => article.id === id);
  }

  function catalogItemById(id) {
    return allCatalogItems.find((item) => item.id === id);
  }

  function imageStyle(url) {
    return `style="--image: url('${url}')"`;
  }

  function tagList(items = []) {
    return items.slice(0, 4).map((item) => `<span>${item}</span>`).join("");
  }

  function initNavigation() {
    const header = $("[data-header]");
    const toggle = $("[data-nav-toggle]");
    const nav = $("[data-nav]");
    const page = document.body.dataset.page;

    if (toggle && header) {
      toggle.addEventListener("click", () => {
        const open = header.classList.toggle("nav-open");
        toggle.setAttribute("aria-expanded", String(open));
      });
    }

    if (nav) {
      $all("a", nav).forEach((link) => {
        if (link.dataset.nav === page) link.classList.add("active");
        link.addEventListener("click", () => {
          header?.classList.remove("nav-open");
          toggle?.setAttribute("aria-expanded", "false");
        });
      });
    }

    const searchForm = $("[data-site-search]");
    if (searchForm) {
      searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const input = $("[data-site-search-input]", searchForm);
        const q = input?.value.trim();
        if (q) window.location.href = `shop.html?q=${encodeURIComponent(q)}`;
      });
    }
  }

  function productCard(product, options = {}) {
    const compact = options.compact ? " product-card-compact" : "";
    const favorite = state.favorites.has(product.id);
    return `
      <article class="product-card${compact}">
        <a class="product-card-media" href="product.html?id=${product.id}" ${imageStyle(product.image)} aria-label="查看 ${product.name}"></a>
        <div class="product-card-body">
          <div class="meta-line">
            <span>${product.brand}</span>
            <span>${product.stock}</span>
          </div>
          <h3><a href="product.html?id=${product.id}">${product.name}</a></h3>
          <p>${product.family} · ${product.concentration}</p>
          <div class="tag-row">${tagList(product.notes)}</div>
          <div class="price-row">
            <strong>${formatPrice(product.price)}</strong>
            <span>${product.volume}</span>
          </div>
          <div class="card-actions">
            <button class="button button-secondary" type="button" data-favorite="${product.id}">
              ${favorite ? "已收藏" : "收藏"}
            </button>
            <button class="button button-primary" type="button" data-add-cart="${product.id}">加入购物车</button>
          </div>
        </div>
      </article>
    `;
  }

  function brandCard(brand, compact = false) {
    const products = data.products.filter((product) => product.brandId === brand.id);
    return `
      <article class="brand-card ${compact ? "compact-card" : ""}">
        <a class="brand-card-media" href="brand.html?id=${brand.id}" ${imageStyle(brand.hero)} aria-label="查看 ${brand.name}"></a>
        <div class="brand-card-body">
          <span class="eyebrow">${brand.country}</span>
          <h3><a href="brand.html?id=${brand.id}">${brand.name}</a></h3>
          <p>${brand.intro}</p>
          <div class="tag-row">${tagList(brand.keywords)}</div>
          <strong>入门：${brand.starter}</strong>
          <a class="text-link" href="brand.html?id=${brand.id}">${products.length} 件作品</a>
        </div>
      </article>
    `;
  }

  function articleCard(article) {
    return `
      <article class="article-card">
        <a class="article-media" href="article.html?id=${article.id}" ${imageStyle(article.image)} aria-label="阅读 ${article.title}"></a>
        <div class="article-card-body">
          <span class="eyebrow">${article.category} · ${article.date}</span>
          <h3><a href="article.html?id=${article.id}">${article.title}</a></h3>
          <p>${article.excerpt}</p>
          <a class="text-link" href="article.html?id=${article.id}">阅读全文</a>
        </div>
      </article>
    `;
  }

  function sampleCard(set) {
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
          <button class="button button-primary" type="button" data-add-cart="${set.id}">加入购物车</button>
        </div>
      </article>
    `;
  }

  function renderHome() {
    const newGrid = $("[data-home-new]");
    if (newGrid) {
      const items = data.products.filter((product) => product.status.includes("New") || product.status.includes("买手推荐")).slice(0, 4);
      newGrid.innerHTML = items.map((product) => productCard(product, { compact: true })).join("");
    }

    const editGrid = $("[data-home-edits]");
    if (editGrid) {
      editGrid.innerHTML = data.edits.map((edit) => `
        <a class="edit-card" href="${edit.href}" ${imageStyle(edit.image)}>
          <span>${edit.eyebrow}</span>
          <h3>${edit.title}</h3>
          <p>${edit.intro}</p>
        </a>
      `).join("");
    }

    const brandGrid = $("[data-home-brands]");
    if (brandGrid) {
      brandGrid.innerHTML = data.brands.slice(0, 4).map((brand) => brandCard(brand, true)).join("");
    }

    const journalGrid = $("[data-home-articles]");
    if (journalGrid) {
      journalGrid.innerHTML = data.articles.slice(0, 3).map(articleCard).join("");
    }
  }

  function initShop() {
    const grid = $("[data-shop-grid]");
    if (!grid) return;

    const form = $("[data-shop-filters]");
    const noteWrap = $("[data-note-filter]");
    const brandSelect = $("[data-brand-filter]");
    const result = $("[data-result-count]");

    if (noteWrap) {
      noteWrap.innerHTML = ["全部", ...data.notes].map((note) => `
        <label class="chip">
          <input type="radio" name="note" value="${note === "全部" ? "all" : note}">
          <span>${note}</span>
        </label>
      `).join("");
    }

    if (brandSelect) {
      brandSelect.innerHTML = `<option value="all">全部品牌</option>${data.brands.map((brand) => `<option value="${brand.id}">${brand.name}</option>`).join("")}`;
    }

    const urlParams = params();
    const initialNote = urlParams.get("note") || "all";
    const initialBrand = urlParams.get("brand") || "all";
    const initialScene = urlParams.get("scene") || "all";
    const initialCategory = urlParams.get("category") || "fragrance";
    const initialPrice = urlParams.get("price") || "all";
    const initialQuery = urlParams.get("q") || "";

    if (form) {
      const noteInput = $(`input[name="note"][value="${CSS.escape(initialNote)}"]`, form) || $("input[name='note'][value='all']", form);
      if (noteInput) noteInput.checked = true;
      const brand = $("[name='brand']", form);
      const scene = $("[name='scene']", form);
      const category = $("[name='category']", form);
      const price = $("[name='price']", form);
      const q = $("[name='q']", form);
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

      const filtered = data.products
        .filter((product) => category === "all" || product.category === category)
        .filter((product) => note === "all" || product.notes.includes(note))
        .filter((product) => brand === "all" || product.brandId === brand)
        .filter((product) => scene === "all" || product.scenes.includes(scene))
        .filter((product) => {
          if (price === "under600") return product.price < 600;
          if (price === "600to900") return product.price >= 600 && product.price <= 900;
          if (price === "over900") return product.price > 900;
          return true;
        })
        .filter((product) => {
          if (!q) return true;
          return [product.brand, product.name, product.family, product.country, product.description, ...product.notes, ...product.status].join(" ").toLowerCase().includes(q);
        });

      result.textContent = `${filtered.length} 件作品`;
      grid.innerHTML = filtered.length
        ? filtered.map((product) => productCard(product)).join("")
        : `<div class="empty-state">当前筛选没有匹配作品。可以清除筛选，或先从试香套装开始。</div>`;
    }

    render();
  }

  function renderProductPage() {
    const mount = $("[data-product-page]");
    if (!mount) return;

    const id = params().get("id") || data.products[0].id;
    const product = productById(id) || data.products[0];
    const brand = brandById(product.brandId);
    const related = data.products
      .filter((item) => item.id !== product.id && (item.brandId === product.brandId || item.notes.some((note) => product.notes.includes(note))))
      .slice(0, 3);

    document.title = `${product.name} | 气味档案`;
    mount.innerHTML = `
      <nav class="breadcrumb" aria-label="面包屑">
        <a href="index.html">首页</a>
        <span>/</span>
        <a href="shop.html">香水</a>
        <span>/</span>
        <span>${product.name}</span>
      </nav>
      <section class="product-detail">
        <div class="product-gallery">
          <div class="product-main-image" ${imageStyle(product.image)}></div>
          <div class="gallery-note">可查看瓶身、包装和细节图，购买前也可以先选择试香套装。</div>
        </div>
        <div class="product-purchase">
          <p class="eyebrow">${product.brand} · ${product.country}</p>
          <h1>${product.name}</h1>
          <p>${product.description}</p>
          <div class="tag-row">${tagList(product.notes)}</div>
          <div class="purchase-box">
            <div><span>价格</span><strong>${formatPrice(product.price)}</strong></div>
            <div><span>容量</span><strong>${product.volume}</strong></div>
            <div><span>浓度</span><strong>${product.concentration}</strong></div>
            <div><span>库存</span><strong>${product.stock}</strong></div>
          </div>
          <div class="purchase-actions">
            <button class="button button-primary" type="button" data-add-cart="${product.id}">加入购物车</button>
            <button class="button button-secondary" type="button" data-favorite="${product.id}">${state.favorites.has(product.id) ? "已收藏" : "收藏"}</button>
          </div>
        </div>
      </section>
      <section class="detail-panels">
        <article>
          <h2>香调结构</h2>
          <dl class="note-list">
            <div><dt>前调</dt><dd>${product.top}</dd></div>
            <div><dt>中调</dt><dd>${product.middle}</dd></div>
            <div><dt>后调</dt><dd>${product.base}</dd></div>
            <div><dt>香调家族</dt><dd>${product.family}</dd></div>
            <div><dt>调香师</dt><dd>${product.perfumer}</dd></div>
            <div><dt>发布年份</dt><dd>${product.year}</dd></div>
          </dl>
        </article>
        <article>
          <h2>买手点评</h2>
          <p>${product.buyer}</p>
          <p><strong>适合：</strong>${product.bestFor}</p>
          <p><strong>提醒：</strong>${product.caution}</p>
        </article>
        <article>
          <h2>规格与服务</h2>
          <p>现货商品 48 小时内发出，默认顺丰。正装未拆封可按政策处理，试香和已拆封商品不支持无理由退换。</p>
          <a class="text-link" href="service.html">查看配送与退换政策</a>
        </article>
      </section>
      <section class="section-tight">
        <div class="section-heading row-heading">
          <div>
            <p class="eyebrow">Related</p>
            <h2>相关推荐</h2>
          </div>
          <a class="text-link" href="${brand ? `brand.html?id=${brand.id}` : "brands.html"}">查看品牌</a>
        </div>
        <div class="product-grid">${related.map((item) => productCard(item, { compact: true })).join("")}</div>
      </section>
    `;
  }

  function renderBrands() {
    const grid = $("[data-brand-grid]");
    if (grid) grid.innerHTML = data.brands.map((brand) => brandCard(brand)).join("");

    const mount = $("[data-brand-page]");
    if (!mount) return;

    const id = params().get("id") || data.brands[0].id;
    const brand = brandById(id) || data.brands[0];
    const products = data.products.filter((product) => product.brandId === brand.id);

    document.title = `${brand.name} | 气味档案`;
    mount.innerHTML = `
      <section class="split-hero compact-hero">
        <div class="split-copy">
          <nav class="breadcrumb" aria-label="面包屑"><a href="brands.html">品牌</a><span>/</span><span>${brand.name}</span></nav>
          <p class="eyebrow">${brand.country}</p>
          <h1>${brand.name}</h1>
          <p>${brand.intro}</p>
          <div class="tag-row">${tagList(brand.keywords)}</div>
        </div>
        <div class="split-image" ${imageStyle(brand.hero)}></div>
      </section>
      <section class="detail-panels">
        <article>
          <h2>品牌故事</h2>
          <p>${brand.story}</p>
        </article>
        <article>
          <h2>创作信息</h2>
          <p><strong>创办人 / 调香：</strong>${brand.founder}</p>
          <p><strong>买手入门款：</strong>${brand.starter}</p>
        </article>
      </section>
      <section class="section-tight">
        <div class="section-heading row-heading">
          <div>
            <p class="eyebrow">Works</p>
            <h2>${brand.name} 作品</h2>
          </div>
          <a class="text-link" href="shop.html?brand=${brand.id}">进入商品列表</a>
        </div>
        <div class="product-grid">${products.map((product) => productCard(product, { compact: true })).join("")}</div>
      </section>
    `;
  }

  function renderSamples() {
    const grid = $("[data-sample-grid]");
    if (grid) grid.innerHTML = data.sampleSets.map(sampleCard).join("");
  }

  function renderGuide() {
    const noteGrid = $("[data-guide-notes]");
    if (noteGrid) {
      noteGrid.innerHTML = data.notes.slice(0, 8).map((note) => `<a class="guide-tile" href="shop.html?note=${encodeURIComponent(note)}">${note}</a>`).join("");
    }

    const sceneGrid = $("[data-guide-scenes]");
    if (sceneGrid) {
      sceneGrid.innerHTML = data.scenes.map((scene) => `<a class="guide-tile" href="shop.html?scene=${scene.id}">${scene.label}</a>`).join("");
    }

    const form = $("[data-quiz]");
    const result = $("[data-quiz-result]");
    if (!form || !result) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const mood = formData.get("mood");
      const scene = formData.get("scene");
      const sweet = formData.get("sweet");

      const scored = data.products
        .filter((product) => product.category === "fragrance")
        .map((product) => {
          let score = 0;
          if (product.mood.includes(mood)) score += 3;
          if (product.scenes.includes(scene)) score += 2;
          if (product.sweetness === sweet) score += 2;
          if (product.status.includes("买手推荐")) score += 1;
          return { product, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(({ product }) => product);

      result.innerHTML = `
        <h2>推荐结果</h2>
        <p>先试这三款，再决定是否买正装。也可以直接选择新客发现试香套装。</p>
        <div class="product-grid compact-grid">${scored.map((product) => productCard(product, { compact: true })).join("")}</div>
        <a class="button button-secondary" href="samples.html">查看试香套装</a>
      `;
    });
  }

  function renderJournal() {
    const grid = $("[data-journal-grid]");
    if (grid) grid.innerHTML = data.articles.map(articleCard).join("");

    const mount = $("[data-article-page]");
    if (!mount) return;

    const id = params().get("id") || data.articles[0].id;
    const article = articleById(id) || data.articles[0];
    const relatedProducts = article.relatedProducts.map(productById).filter(Boolean);
    document.title = `${article.title} | 气味档案`;

    mount.innerHTML = `
      <article class="article-detail">
        <nav class="breadcrumb" aria-label="面包屑"><a href="journal.html">Journal</a><span>/</span><span>${article.category}</span></nav>
        <p class="eyebrow">${article.category} · ${article.date}</p>
        <h1>${article.title}</h1>
        <div class="article-hero-image" ${imageStyle(article.image)}></div>
        ${article.body.map((paragraph) => `<p>${paragraph}</p>`).join("")}
      </article>
      <section class="section-tight">
        <div class="section-heading">
          <p class="eyebrow">Shop the story</p>
          <h2>文中推荐</h2>
        </div>
        <div class="product-grid">${relatedProducts.map((product) => productCard(product, { compact: true })).join("")}</div>
      </section>
    `;
  }

  function renderCartPage() {
    const mount = $("[data-cart-page]");
    if (!mount) return;
    mount.innerHTML = cartMarkup(false);
  }

  function addToCart(id) {
    const item = catalogItemById(id);
    if (!item) return;
    state.cart[id] = (state.cart[id] || 0) + 1;
    writeStore("sa_cart", state.cart);
    renderCartShell();
    showToast(`${item.name} 已加入购物车`);
  }

  function changeCart(id, delta) {
    if (!state.cart[id]) return;
    const wasOpen = $("[data-cart-drawer]")?.classList.contains("open");
    state.cart[id] += delta;
    if (state.cart[id] <= 0) delete state.cart[id];
    writeStore("sa_cart", state.cart);
    renderCartShell();
    if (wasOpen) openCart();
    renderCartPage();
  }

  function toggleFavorite(id) {
    const item = catalogItemById(id);
    if (!item) return;
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
      showToast(`${item.name} 已取消收藏`);
    } else {
      state.favorites.add(id);
      showToast(`${item.name} 已收藏`);
    }
    writeStore("sa_favorites", Array.from(state.favorites));
    $all(`[data-favorite="${CSS.escape(id)}"]`).forEach((button) => {
      button.textContent = state.favorites.has(id) ? "已收藏" : "收藏";
    });
  }

  function cartEntries() {
    return Object.entries(state.cart)
      .map(([id, qty]) => ({ item: catalogItemById(id), qty }))
      .filter((entry) => entry.item);
  }

  function cartMarkup(compact = true) {
    const entries = cartEntries();
    const total = entries.reduce((sum, entry) => sum + entry.item.price * entry.qty, 0);
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
        ${entries.map(({ item, qty }) => `
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
            <strong>${formatPrice(item.price * qty)}</strong>
          </article>
        `).join("")}
      </div>
      <div class="cart-total">
        <span>小计</span>
        <strong>${formatPrice(total)}</strong>
      </div>
      <button class="button button-primary full" type="button" data-checkout>模拟结账</button>
      ${compact ? `<a class="text-link" href="cart.html">查看完整购物车</a>` : `<p class="service-note">结账流程可继续接入 Shopify、WooCommerce 或自定义支付。</p>`}
    `;
  }

  function renderCartShell() {
    let shell = $("[data-cart-shell]");
    if (!shell) {
      shell = document.createElement("div");
      shell.dataset.cartShell = "";
      document.body.appendChild(shell);
    }

    const count = Object.values(state.cart).reduce((sum, qty) => sum + qty, 0);
    $all("[data-cart-count]").forEach((node) => {
      node.textContent = count;
    });

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

  function openCart() {
    const drawer = $("[data-cart-drawer]");
    drawer?.classList.add("open");
    drawer?.setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");
  }

  function closeCart() {
    const drawer = $("[data-cart-drawer]");
    drawer?.classList.remove("open");
    drawer?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("locked");
  }

  let toastTimer;
  function showToast(message) {
    let toast = $(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function bindGlobalActions() {
    document.addEventListener("click", (event) => {
      const add = event.target.closest("[data-add-cart]");
      const fav = event.target.closest("[data-favorite]");
      const open = event.target.closest("[data-open-cart]");
      const close = event.target.closest("[data-close-cart]");
      const change = event.target.closest("[data-cart-change]");
      const checkout = event.target.closest("[data-checkout]");
      const service = event.target.closest("[data-service-action]");

      if (add) addToCart(add.dataset.addCart);
      if (fav) toggleFavorite(fav.dataset.favorite);
      if (open) openCart();
      if (close) closeCart();
      if (change) changeCart(change.dataset.cartChange, Number(change.dataset.delta));
      if (checkout) showToast("请确认购物车商品后继续结账。");
      if (service) showToast(service.dataset.serviceAction);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeCart();
    });
  }

  initNavigation();
  renderCartShell();
  bindGlobalActions();
  renderHome();
  initShop();
  renderProductPage();
  renderBrands();
  renderSamples();
  renderGuide();
  renderJournal();
  renderCartPage();
})();
