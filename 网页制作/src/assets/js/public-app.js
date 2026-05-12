import {
  articleById,
  brandById,
  catalogData as data,
  formatPrice,
  hasCatalogData,
  imageStyle,
  productById,
  tagList
} from "./catalog.js";
import { cartStore } from "./cart-store.js";
import { closeCart, openCart, renderCartPage, renderCartShell } from "./cart-ui.js";

if (hasCatalogData) {
  const escapeSelector = window.CSS?.escape || ((value) => String(value).replace(/["\\]/g, "\\$&"));
  const state = {
    favorites: new Set(readStore("sa_favorites", []))
  };

  initNavigation();
  renderCartShell();
  bindPublicActions();
  renderHome();
  initShop();
  renderProductPage();
  renderBrands();
  renderSamples();
  renderJournal();
  renderCartPage();
  refreshMemberQuote();

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

  function sceneLabels(ids = []) {
    return ids
      .map((id) => data.scenes.find((scene) => scene.id === id)?.label)
      .filter(Boolean);
  }

  function sweetnessLabel(value) {
    const labels = {
      low: "低甜",
      medium: "微甜",
      high: "明显甜"
    };
    return labels[value] || "需试香";
  }

  function buyingCue(product) {
    const status = product.status || [];
    const scenes = product.scenes || [];
    if (product.caution?.includes("先试") || status.includes("Limited") || status.includes("收藏")) {
      return "建议先试香";
    }
    if (scenes.includes("daily") || status.includes("通勤")) {
      return "日常低风险";
    }
    if (scenes.includes("gift")) {
      return "适合送礼";
    }
    return "读完提醒再买";
  }

  function statusFlags(product) {
    return (product.status || []).slice(0, 2).map((item) => `<span>${item}</span>`).join("");
  }

  function shortText(text = "", max = 58) {
    return text.length > max ? `${text.slice(0, max)}...` : text;
  }

  function entryUrl(prefix, id) {
    return `${prefix}-${encodeURIComponent(id)}.html`;
  }

  function productUrl(id) {
    return entryUrl("product", id);
  }

  function brandUrl(id) {
    return entryUrl("brand", id);
  }

  function articleUrl(id) {
    return entryUrl("article", id);
  }

  function productCard(product, options = {}) {
    const compact = options.compact ? " product-card-compact" : "";
    const favorite = state.favorites.has(product.id);
    const scenes = sceneLabels(product.scenes).slice(0, 2).join(" / ");
    const href = productUrl(product.id);

    if (options.compact) {
      return `
        <article class="product-card${compact} product-card-minimal">
          <a class="product-card-media" href="${href}" ${imageStyle(product.image)} aria-label="查看 ${product.name}"></a>
          <div class="product-card-body">
            <span class="product-kicker">${product.brand}</span>
            <h3><a href="${href}">${product.name}</a></h3>
            <p>${product.family}</p>
            <div class="price-row">
              <strong>${formatPrice(product.price)}</strong>
              <span>${product.volume}</span>
            </div>
          </div>
        </article>
      `;
    }

    return `
      <article class="product-card${compact}">
        <a class="product-card-media" href="${href}" ${imageStyle(product.image)} aria-label="查看 ${product.name}"></a>
        <div class="product-card-body">
          <div class="product-card-topline">
            <div class="meta-line">
              <span>${product.brand}</span>
              <span>${product.stock}</span>
            </div>
            <div class="card-flags">${statusFlags(product)}</div>
          </div>
          <h3><a href="${href}">${product.name}</a></h3>
          <p>${product.family} · ${product.concentration}</p>
          <div class="scent-brief" aria-label="气味判断">
            <div><span>场景</span><strong>${scenes || product.bestFor}</strong></div>
            <div><span>甜度</span><strong>${sweetnessLabel(product.sweetness)}</strong></div>
          </div>
          <p class="card-note">${shortText(product.buyer || product.description)}</p>
          <p class="risk-line"><span>购买前</span>${buyingCue(product)}</p>
          <div class="tag-row">${tagList(product.notes)}</div>
          <div class="price-row">
            <strong>${formatPrice(product.price)}</strong>
            <span>${product.volume}</span>
          </div>
          <div class="card-actions">
            <button class="button button-secondary" type="button" data-favorite="${product.id}" aria-pressed="${favorite}">
              ${favorite ? "已收藏" : "收藏"}
            </button>
            <button class="button button-primary" type="button" data-add-cart="${product.id}">加入意向清单</button>
          </div>
        </div>
      </article>
    `;
  }

  function brandCard(brand, compact = false) {
    const products = data.products.filter((product) => product.brandId === brand.id);
    const href = brandUrl(brand.id);
    return `
      <article class="brand-card ${compact ? "compact-card" : ""}">
        <a class="brand-card-media" href="${href}" ${imageStyle(brand.hero)} aria-label="查看 ${brand.name}"></a>
        <div class="brand-card-body">
          <span class="eyebrow">${brand.country}</span>
          <h3><a href="${href}">${brand.name}</a></h3>
          <p>${brand.intro}</p>
          <div class="tag-row">${tagList(brand.keywords)}</div>
          <strong>入门：${brand.starter}</strong>
          <a class="text-link" href="${href}">${products.length} 件作品</a>
        </div>
      </article>
    `;
  }

  function articleCard(article) {
    const href = articleUrl(article.id);
    return `
      <article class="article-card">
        <a class="article-media" href="${href}" ${imageStyle(article.image)} aria-label="阅读 ${article.title}"></a>
        <div class="article-card-body">
          <span class="eyebrow">${article.category} · ${article.date}</span>
          <h3><a href="${href}">${article.title}</a></h3>
          <p>${article.excerpt}</p>
          <a class="text-link" href="${href}">阅读全文</a>
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
          <button class="button button-primary" type="button" data-add-cart="${set.id}">加入意向清单</button>
        </div>
      </article>
    `;
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
        toggle.setAttribute("aria-label", open ? "关闭主导航" : "打开主导航");
      });
    }

    if (nav) {
      $all("a", nav).forEach((link) => {
        if (link.dataset.nav === page) link.classList.add("active");
        link.addEventListener("click", () => {
          header?.classList.remove("nav-open");
          toggle?.setAttribute("aria-expanded", "false");
          toggle?.setAttribute("aria-label", "打开主导航");
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

  function renderHome() {
    const newGrid = $("[data-home-new]");
    if (newGrid) {
      const items = data.products
        .filter((product) => (product.status || []).includes("New") || (product.status || []).includes("买手推荐"))
        .slice(0, 4);
      newGrid.innerHTML = items.map((product) => productCard(product, { compact: true })).join("");
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
      const noteInput = $(`input[name="note"][value="${escapeSelector(initialNote)}"]`, form) || $("input[name='note'][value='all']", form);
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
          return [
            product.brand,
            product.name,
            product.family,
            product.country,
            product.description,
            ...product.notes,
            ...product.status
          ].join(" ").toLowerCase().includes(q);
        });

      if (result) result.textContent = `${filtered.length} 件作品`;
      grid.innerHTML = filtered.length
        ? filtered.map((product) => productCard(product)).join("")
        : `
          <div class="empty-state">
            <h2>当前筛选没有匹配作品</h2>
            <p>可以清除筛选，或先从试香套装开始，降低第一次选择的风险。</p>
            <div class="button-row">
              <button class="button button-secondary" type="reset" form="${form?.id || ""}">清除筛选</button>
              <a class="button button-primary" href="samples.html">查看试香套装</a>
            </div>
          </div>
        `;
    }

    render();
  }

  function renderProductPage() {
    const mount = $("[data-product-page]");
    if (!mount) return;

    const id = mount.dataset.entryId || params().get("id") || data.products[0].id;
    const product = productById(id) || data.products[0];
    const brand = brandById(product.brandId);
    const related = data.products
      .filter((item) => item.id !== product.id && (item.brandId === product.brandId || item.notes.some((note) => product.notes.includes(note))))
      .slice(0, 3);

    document.title = `${product.name} | 馥屿`;
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
          <div class="purchase-guidance" aria-label="购买前判断">
            <div>
              <span>买手判断</span>
              <p>${product.buyer}</p>
            </div>
            <div>
              <span>适合场景</span>
              <strong>${product.bestFor}</strong>
            </div>
            <div>
              <span>盲买提醒</span>
              <p>${product.caution}</p>
            </div>
          </div>
          <div class="purchase-box">
            <div><span>价格</span><strong>${formatPrice(product.price)}</strong></div>
            <div><span>容量</span><strong>${product.volume}</strong></div>
            <div><span>浓度</span><strong>${product.concentration}</strong></div>
            <div><span>库存</span><strong>${product.stock}</strong></div>
          </div>
          <div class="scent-brief product-detail-brief" aria-label="香水摘要">
            <div><span>香调家族</span><strong>${product.family}</strong></div>
            <div><span>甜度</span><strong>${sweetnessLabel(product.sweetness)}</strong></div>
            <div><span>购买建议</span><strong>${buyingCue(product)}</strong></div>
          </div>
          <div class="purchase-actions">
            <button class="button button-primary" type="button" data-add-cart="${product.id}">咨询这支香</button>
            <a class="button button-secondary" href="samples.html">不确定，先试香</a>
            <button class="button button-secondary" type="button" data-favorite="${product.id}" aria-pressed="${state.favorites.has(product.id)}">${state.favorites.has(product.id) ? "已收藏" : "收藏"}</button>
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
          <div class="detail-cta">
            <span class="status-badge">Sample first</span>
            <a class="text-link" href="samples.html">担心盲买？先从试香套装开始</a>
          </div>
        </article>
        <article>
          <h2>规格与服务</h2>
          <p>库存、预计发出时间、配送方式和退换条件会在购买前由客服确认。试香、拆封商品和特殊组合的售后规则以客服说明为准。</p>
          <a class="text-link" href="service.html">查看客服、配送与退换说明</a>
        </article>
      </section>
      <section class="section-tight">
        <div class="section-heading row-heading">
          <div>
            <p class="eyebrow">Related</p>
            <h2>相关推荐</h2>
          </div>
          <a class="text-link" href="${brand ? brandUrl(brand.id) : "brands.html"}">查看品牌</a>
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

    const id = mount.dataset.entryId || params().get("id") || data.brands[0].id;
    const brand = brandById(id) || data.brands[0];
    const products = data.products.filter((product) => product.brandId === brand.id);

    document.title = `${brand.name} | 馥屿`;
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
        <article>
          <h2>入门路线</h2>
          <p>第一次接触 ${brand.name}，建议先看关键词是否贴合你的场景，再从入门款或同品牌试香开始。</p>
          <a class="text-link" href="shop.html?brand=${brand.id}">查看可购买作品</a>
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

  function renderJournal() {
    const grid = $("[data-journal-grid]");
    if (grid) grid.innerHTML = data.articles.map(articleCard).join("");

    const mount = $("[data-article-page]");
    if (!mount) return;

    const id = mount.dataset.entryId || params().get("id") || data.articles[0].id;
    const article = articleById(id) || data.articles[0];
    const relatedProducts = article.relatedProducts.map(productById).filter(Boolean);
    document.title = `${article.title} | 馥屿`;

    mount.innerHTML = `
      <article class="article-detail">
        <nav class="breadcrumb" aria-label="面包屑"><a href="journal.html">Journal</a><span>/</span><span>${article.category}</span></nav>
        <p class="eyebrow">${article.category} · ${article.date}</p>
        <h1>${article.title}</h1>
        <div class="article-hero-image" ${imageStyle(article.image)}></div>
        ${article.body.map((paragraph) => `<p>${paragraph}</p>`).join("")}
        <div class="article-shop-note">
          <span class="status-badge">Shop the story</span>
          <p>读完后先看文中推荐，再按“适合场景”和“盲买提醒”决定是否进入试香或正装咨询。</p>
        </div>
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

  function refreshMemberQuote() {
    const mounts = $all("[data-member-quote]");
    if (!mounts.length) return;
    mounts.forEach((mount) => {
      mount.textContent = "试运营期间暂不开放在线支付，清单仅用于人工咨询与预约试香。";
    });
  }

  function addToCart(id) {
    try {
      const item = cartStore.addItem(id);
      renderCartShell();
      renderCartPage();
      refreshMemberQuote();
      openCart();
      showToast(`${item.name} 已加入意向清单`);
    } catch (error) {
      showToast(error.message);
    }
  }

  function changeCart(id, delta) {
    const wasOpen = $("[data-cart-drawer]")?.classList.contains("open");
    try {
      cartStore.changeQuantity(id, Number(delta));
      renderCartShell();
      renderCartPage();
      refreshMemberQuote();
      if (wasOpen) openCart();
    } catch (error) {
      showToast(error.message);
    }
  }

  function toggleFavorite(id) {
    const item = data.products.find((product) => product.id === id) || data.sampleSets.find((set) => set.id === id);
    if (!item) return;
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
      showToast(`${item.name} 已取消收藏`);
    } else {
      state.favorites.add(id);
      showToast(`${item.name} 已收藏`);
    }
    writeStore("sa_favorites", Array.from(state.favorites));
    $all(`[data-favorite="${escapeSelector(id)}"]`).forEach((button) => {
      button.textContent = state.favorites.has(id) ? "已收藏" : "收藏";
      button.setAttribute("aria-pressed", String(state.favorites.has(id)));
    });
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

  function bindPublicActions() {
    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;

      const add = event.target.closest("[data-add-cart]");
      const fav = event.target.closest("[data-favorite]");
      const open = event.target.closest("[data-open-cart]");
      const close = event.target.closest("[data-close-cart]");
      const change = event.target.closest("[data-cart-change]");
      const service = event.target.closest("[data-service-action]");

      if (add) addToCart(add.dataset.addCart);
      if (fav) toggleFavorite(fav.dataset.favorite);
      if (open) openCart();
      if (close) closeCart();
      if (change) changeCart(change.dataset.cartChange, Number(change.dataset.delta));
      if (service) showToast(service.dataset.serviceAction);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeCart();
    });
  }
}
