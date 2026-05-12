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
import { apiFetch, moneyText } from "./api-client.js";
import { currentSession, loginMember, logoutMember, registerMember, resetSessionCache } from "./auth-client.js";
import { cartStore } from "./cart-store.js";
import { closeCart, openCart, renderCartPage, renderCartShell } from "./cart-ui.js";
import {
  adminCancelRedemption,
  adminCompleteOrder,
  adminCreateMallItem,
  adminGetAuditLogs,
  adminGetMembers,
  adminGetOrders,
  adminGetPoints,
  adminGetPointsMallItems,
  adminGetPointsRedemptions,
  adminLogin,
  adminLogout,
  adminPayOrder,
  adminRefundOrder,
  adminSetMallItemStatus,
  adminUpdateRedemptionStatus,
  getCurrentAdmin
} from "./admin-client.js";
import { confirmReceiptOrder, getMemberOrders, getMemberProfile, getPointTransactions, getTierProgress } from "./member-client.js";
import {
  getPointsMallItem,
  getPointsMallItems,
  getPointsRedemptions,
  redeemPointsMallItem
} from "./points-mall-client.js";

if (hasCatalogData) {
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

  function discountLabel(rate) {
    return Number(rate) >= 1 ? "无折扣" : `${Math.round(Number(rate) * 100)} 折`;
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

  function setFormMessage(form, message, type = "") {
    const node = $("[data-form-message]", form);
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("is-error", type === "error");
    node.classList.toggle("is-success", type === "success");
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
        .filter((product) => product.status.includes("New") || product.status.includes("买手推荐"))
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

  async function initAuthHeader() {
    const mount = $("[data-auth-actions]");
    if (!mount) return;
    const session = await currentSession();
    if (!session.user) {
      mount.innerHTML = `
        <a class="text-link" href="login.html">登录</a>
        <a class="text-link" href="register.html">注册</a>
      `;
      return;
    }

    mount.innerHTML = `
      <a class="text-link" href="account.html">${session.tier.name}</a>
      <a class="text-link" href="points.html">${session.profile.availablePoints} 积分</a>
      <button class="text-button" type="button" data-logout>退出</button>
    `;
  }

  function memberNav() {
    return `
      <nav class="member-nav" aria-label="会员导航">
        <a class="text-link" href="account.html">会员中心</a>
        <a class="text-link" href="orders.html">订单记录</a>
        <a class="text-link" href="points.html">积分明细</a>
        <a class="text-link" href="points-mall.html">积分商城</a>
        <a class="text-link" href="points-redemptions.html">兑换记录</a>
        <a class="text-link" href="membership.html">会员规则</a>
      </nav>
    `;
  }

  function requireLoginMarkup() {
    return `
      <div class="empty-state">
        <h2>请先登录会员账号</h2>
        <p>登录后可以查看等级、积分、订单和会员折扣。</p>
        <a class="button button-primary" href="login.html">登录</a>
      </div>
    `;
  }

  function renderAuthForms() {
    const loginForm = $("[data-login-form]");
    if (loginForm) {
      loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(loginForm);
        const submitButton = loginForm.querySelector("button[type='submit']");
        setFormMessage(loginForm, "正在登录...");
        if (submitButton) submitButton.disabled = true;
        try {
          await loginMember({
            account: formData.get("account"),
            password: formData.get("password")
          });
          setFormMessage(loginForm, "登录成功，正在进入会员中心。", "success");
          showToast("登录成功。");
          window.location.href = "account.html";
        } catch (error) {
          setFormMessage(loginForm, error.message, "error");
          showToast(error.message);
        } finally {
          if (submitButton) submitButton.disabled = false;
        }
      });
    }

    const registerForm = $("[data-register-form]");
    if (registerForm) {
      registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(registerForm);
        const submitButton = registerForm.querySelector("button[type='submit']");
        setFormMessage(registerForm, "正在创建会员账号...");
        if (submitButton) submitButton.disabled = true;
        try {
          await registerMember({
            name: formData.get("name"),
            email: formData.get("email"),
            phone: formData.get("phone"),
            password: formData.get("password")
          });
          setFormMessage(registerForm, "注册成功，正在进入会员中心。", "success");
          showToast("注册成功。");
          window.location.href = "account.html";
        } catch (error) {
          setFormMessage(registerForm, error.message, "error");
          showToast(error.message);
        } finally {
          if (submitButton) submitButton.disabled = false;
        }
      });
    }
  }

  async function renderAccountPage() {
    const mount = $("[data-account-page]");
    if (!mount) return;
    try {
      const data = await getMemberProfile();
      mount.innerHTML = `
        ${memberNav()}
        <div class="member-dashboard">
          <article>
            <span class="eyebrow">Current tier</span>
            <h2>${data.tier.name}</h2>
            <p>当前折扣：${discountLabel(data.tier.discountRate)} · 积分倍数：${data.tier.pointMultiplier || 1}x</p>
          </article>
          <article>
            <span class="eyebrow">Points</span>
            <h2>${data.profile.availablePoints}</h2>
            <p>可用积分</p>
          </article>
          <article>
            <span class="eyebrow">Lifetime paid</span>
            <h2>${moneyText(data.profile.lifetimePaidAmountYuan)}</h2>
            <p>${data.nextTier ? `距离 ${data.nextTier.name} 还差 ${moneyText(data.amountToNextTierYuan)}` : "已达到最高等级"}</p>
          </article>
        </div>
        <form class="account-form compact-account-form" data-profile-form>
          <label class="field-label">姓名<input name="name" value="${data.user.name || ""}"></label>
          <label class="field-label">生日<input name="birthday" type="date" value="${data.profile.birthday || ""}"></label>
          <button class="button button-secondary" type="submit">保存资料</button>
        </form>
      `;
      const form = $("[data-profile-form]", mount);
      form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        try {
          await import("./member-client.js").then(({ updateMemberProfile }) => updateMemberProfile({
            name: formData.get("name"),
            birthday: formData.get("birthday")
          }));
          resetSessionCache();
          await initAuthHeader();
          showToast("会员资料已保存。");
        } catch (error) {
          showToast(error.message);
        }
      });
    } catch {
      mount.innerHTML = requireLoginMarkup();
    }
  }

  async function renderPointsPage() {
    const mount = $("[data-points-page]");
    if (!mount) return;
    try {
      const [profile, points] = await Promise.all([getMemberProfile(), getPointTransactions()]);
      mount.innerHTML = `
        ${memberNav()}
        <div class="member-summary">
          <strong>${profile.profile.availablePoints}</strong>
          <span>可用积分</span>
        </div>
        <div class="member-table">
          ${points.transactions.length ? points.transactions.map((item) => `
            <article>
              <div>
                <h3>${pointTypeLabel(item.type)}</h3>
                <p>${item.note || ""}${item.expiresAt ? ` · 有效至 ${new Date(item.expiresAt).toLocaleDateString("zh-CN")}` : ""}</p>
              </div>
              <strong>${item.points > 0 ? "+" : ""}${item.points}</strong>
              <span class="status-badge">${new Date(item.createdAt).toLocaleDateString("zh-CN")}</span>
            </article>
          `).join("") : `<div class="empty-state">暂无积分流水。</div>`}
        </div>
      `;
    } catch {
      mount.innerHTML = requireLoginMarkup();
    }
  }

  async function renderPointsMallPage() {
    const mount = $("[data-points-mall-page]");
    if (!mount) return;
    try {
      const [profile, mall] = await Promise.all([getMemberProfile(), getPointsMallItems()]);
      mount.innerHTML = `
        ${memberNav()}
        <div class="member-summary">
          <strong>${profile.profile.availablePoints}</strong>
          <span>可用积分</span>
        </div>
        <div class="mall-grid">
          ${mall.items.length ? mall.items.map((item) => `
            <article class="mall-card">
              <a class="mall-image" href="points-item.html?id=${encodeURIComponent(item.id)}" style="background-image:url('${item.image}')"></a>
              <div>
                <p class="eyebrow">${item.stockQuantity > 0 ? `库存 ${item.stockQuantity}` : "已兑完"}</p>
                <h2>${item.name}</h2>
                <p>${item.description || ""}</p>
              </div>
              <div class="mall-card-footer">
                <strong>${item.pointsPrice} 积分</strong>
                <a class="button button-secondary" href="points-item.html?id=${encodeURIComponent(item.id)}">查看兑换</a>
              </div>
            </article>
          `).join("") : `<div class="empty-state">暂无可兑换商品。</div>`}
        </div>
      `;
    } catch {
      mount.innerHTML = requireLoginMarkup();
    }
  }

  async function renderPointsMallItemPage() {
    const mount = $("[data-points-item-page]");
    if (!mount) return;
    const id = params().get("id");
    if (!id) {
      mount.innerHTML = `<div class="empty-state">积分商品不存在。</div>`;
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
            <p class="eyebrow">${item.stockQuantity > 0 ? `库存 ${item.stockQuantity}` : "已兑完"}</p>
            <h2>${item.name}</h2>
            <p>${item.description || ""}</p>
            <div class="member-summary compact-summary">
              <strong>${item.pointsPrice}</strong>
              <span>兑换积分 · 你有 ${profile.profile.availablePoints} 积分</span>
            </div>
            <form class="account-form compact-account-form" data-redeem-form>
              <label class="field-label">兑换数量<input name="quantity" type="number" min="1" max="${item.stockQuantity}" value="1" required></label>
              <label class="field-label">收件人<input name="recipientName" value="${profile.user.name || ""}"></label>
              <label class="field-label">联系电话<input name="recipientPhone" value="${profile.user.phone || ""}"></label>
              <label class="field-label">收货地址<input name="shippingAddress"></label>
              <button class="button button-primary" type="submit" ${profile.profile.availablePoints < item.pointsPrice || item.stockQuantity <= 0 ? "disabled" : ""}>确认兑换</button>
            </form>
          </div>
        </div>
      `;
      $("[data-redeem-form]", mount)?.addEventListener("submit", async (event) => {
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
          showToast(`兑换成功，订单 ${result.order.orderNo}`);
          setTimeout(() => {
            window.location.href = "points-redemptions.html";
          }, 700);
        } catch (error) {
          form.dataset.submitting = "false";
          if (submitButton) submitButton.disabled = false;
          showToast(error.message);
        }
      });
    } catch {
      mount.innerHTML = requireLoginMarkup();
    }
  }

  async function renderPointsRedemptionsPage() {
    const mount = $("[data-points-redemptions-page]");
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
                <p>${order.items.map((item) => `${item.name} x ${item.quantity}`).join("、")}</p>
                <p>${order.trackingNo ? `物流单号：${order.trackingNo}` : "等待后台处理"}</p>
              </div>
              <strong>${order.totalPoints} 积分</strong>
              <span class="status-badge">${redemptionStatusLabel(order.status)}</span>
            </article>
          `).join("") : `<div class="empty-state">暂无兑换记录。</div>`}
        </div>
      `;
    } catch {
      mount.innerHTML = requireLoginMarkup();
    }
  }

  async function renderOrdersPage() {
    const mount = $("[data-orders-page]");
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
                <p>${order.items.map((item) => `${item.productName} x ${item.quantity}`).join("、")}</p>
                <p>会员折扣：${moneyText(order.memberDiscountAmountYuan)} · ${orderPointsText(order)}</p>
              </div>
              <strong>${moneyText(order.paidAmountYuan)}</strong>
              <span class="status-badge">${orderStatusLabel(order.status)}</span>
              ${["paid", "shipped"].includes(order.status) ? `<button class="button button-secondary" type="button" data-confirm-receipt="${order.id}">确认收货</button>` : ""}
            </article>
          `).join("") : `<div class="empty-state">暂无订单。</div>`}
        </div>
      `;
    } catch {
      mount.innerHTML = requireLoginMarkup();
    }
  }

  async function renderMembershipPage() {
    const mount = $("[data-membership-page]");
    if (!mount) return;
    let current;
    try {
      current = await getTierProgress();
    } catch {
      current = null;
    }
    const tiers = [
      ["普通会员", "¥0", "无", "1.0x", "满 ¥599 包邮"],
      ["银卡会员", "¥1,000", "95 折", "1.1x", "满 ¥499 包邮"],
      ["金卡会员", "¥10,000", "92 折", "1.2x", "满 ¥399 包邮"],
      ["钻卡会员", "¥20,000", "88 折", "1.5x", "顺丰包邮"],
      ["黑卡会员", "¥50,000", "85 折", "2.0x", "顺丰包邮"],
      ["至尊会员", "¥200,000", "8 折", "2.0x", "顺丰包邮"]
    ];
    mount.innerHTML = `
      ${memberNav()}
      ${current ? `<div class="member-summary"><strong>${current.tier.name}</strong><span>${current.nextTier ? `距离 ${current.nextTier.name} 还差 ${moneyText(current.amountToNextTierYuan)}` : "已达到最高等级"}</span></div>` : ""}
      <div class="tier-table">
        <div><strong>等级</strong><strong>累计消费</strong><strong>折扣</strong><strong>积分倍数</strong><strong>免运</strong></div>
        ${tiers.map((tier) => `<div>${tier.map((cell) => `<span>${cell}</span>`).join("")}</div>`).join("")}
      </div>
      <div class="policy-list member-policy-list">
        <article><h2>积分计算</h2><p>积分按实付商品金额和当前等级倍数计算。运费、取消订单和退款金额不计入积分。</p></article>
        <article><h2>升级规则</h2><p>订单由后台确认支付后不会立刻升级。客户确认收货后，系统才会累加有效消费并匹配最高可达等级；退款后重新按累计有效消费计算等级。</p></article>
        <article><h2>积分有效期</h2><p>订单积分自确认收货日起一年有效，未来积分商城兑换会按 FIFO 先消耗最早获得的积分。积分暂不抵现金。</p></article>
        <article><h2>折扣规则</h2><p>会员折扣只作用于商品金额，不作用于运费。特价商品后续可配置为不参与会员折扣。</p></article>
      </div>
    `;
  }

  async function renderAdminPage() {
    const mount = $("[data-admin-page]");
    if (!mount) return;
    let session;
    try {
      session = await getCurrentAdmin();
    } catch {
      mount.innerHTML = `
        <form class="account-form" data-admin-login-form>
          <label class="field-label">后台邮箱<input name="email" type="email" autocomplete="username" required></label>
          <label class="field-label">后台密码<input name="password" type="password" autocomplete="current-password" required></label>
          <button class="button button-primary" type="submit">进入后台</button>
        </form>
      `;
      $("[data-admin-login-form]", mount)?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        try {
          await adminLogin({
            email: formData.get("email"),
            password: formData.get("password")
          });
          showToast("已进入后台。");
          await renderAdminPage();
        } catch (error) {
          showToast(error.message);
        }
      });
      return;
    }
    try {
      const [members, orders, points, logs, mallItems, mallRedemptions] = await Promise.all([
        adminGetMembers(),
        adminGetOrders(),
        adminGetPoints(),
        adminGetAuditLogs(),
        adminGetPointsMallItems(),
        adminGetPointsRedemptions()
      ]);
      mount.innerHTML = `
        <div class="section-heading">
          <p class="eyebrow">Admin</p>
          <h2>会员与订单管理</h2>
          <p>${session.admin.name || session.admin.email} · ${session.admin.role}</p>
          <div class="button-row">
            <button class="button button-secondary" type="button" data-admin-export>导出会员名单</button>
            <button class="button button-secondary" type="button" data-admin-logout>退出后台</button>
          </div>
        </div>
        <div class="admin-grid">
          <section>
            <h2>会员</h2>
            <div class="member-table">
              ${members.members.map((member) => `
                <article>
                  <div>
                    <h3>${member.user.name || member.user.email || member.user.phone}</h3>
                    <p>${member.tier.name} · ${member.profile.availablePoints} 积分 · 累计 ${moneyText(member.profile.lifetimePaidAmountYuan)}</p>
                  </div>
                  <span>${member.user.email || member.user.phone}</span>
                </article>
              `).join("")}
            </div>
          </section>
          <section>
            <h2>订单</h2>
            <div class="member-table">
              ${orders.orders.map((order) => `
                <article>
                  <div>
                    <h3>${order.orderNo}</h3>
                    <p>${order.items.map((item) => `${item.productName} x ${item.quantity}`).join("、")}</p>
                    <p>${orderStatusLabel(order.status)} · ${orderPointsText(order)}</p>
                  </div>
                  <strong>${moneyText(order.paidAmountYuan)}</strong>
                  ${order.status === "pending_payment" ? `<button class="button button-secondary" type="button" data-admin-pay="${order.id}">确认支付</button>` : ""}
                  ${["paid", "shipped"].includes(order.status) ? `<button class="button button-secondary" type="button" data-admin-complete="${order.id}">确认收货</button>` : ""}
                  ${["paid", "shipped", "completed"].includes(order.status) ? `<button class="button button-secondary" type="button" data-admin-refund="${order.id}">退款</button>` : ""}
                </article>
              `).join("")}
            </div>
          </section>
          <section>
            <h2>积分流水</h2>
            <div class="member-table">
              ${points.transactions.slice(0, 10).map((item) => `
                <article>
                  <div>
                    <h3>${pointTypeLabel(item.type)}</h3>
                    <p>${item.user?.name || item.user?.email || item.user?.phone || "未知会员"}${item.orderNo ? ` · ${item.orderNo}` : ""}</p>
                  </div>
                  <strong>${item.points > 0 ? "+" : ""}${item.points}</strong>
                  <span>${new Date(item.createdAt).toLocaleString("zh-CN")}</span>
                </article>
              `).join("") || `<div class="empty-state">暂无积分流水。</div>`}
            </div>
          </section>
          <section>
            <h2>积分商品</h2>
            <form class="account-form compact-account-form" data-admin-mall-item-form>
              <label class="field-label">名称<input name="name" required></label>
              <label class="field-label">关联商品 ID<input name="productId" placeholder="可选，如 tea-sample"></label>
              <label class="field-label">积分价格<input name="pointsPrice" type="number" min="1" required></label>
              <label class="field-label">库存<input name="stockQuantity" type="number" min="0" required></label>
              <button class="button button-secondary" type="submit">新增积分商品</button>
            </form>
            <div class="member-table admin-nested-table">
              ${mallItems.items.map((item) => `
                <article>
                  <div>
                    <h3>${item.name}</h3>
                    <p>${item.pointsPrice} 积分 · 库存 ${item.stockQuantity} · ${mallItemStatusLabel(item.status)}</p>
                  </div>
                  ${item.status === "active" ? `<button class="button button-secondary" type="button" data-admin-mall-deactivate="${item.id}">下架</button>` : ""}
                  ${item.status !== "active" && item.stockQuantity > 0 ? `<button class="button button-secondary" type="button" data-admin-mall-activate="${item.id}">上架</button>` : ""}
                </article>
              `).join("") || `<div class="empty-state">暂无积分商品。</div>`}
            </div>
          </section>
          <section>
            <h2>兑换订单</h2>
            <div class="member-table">
              ${mallRedemptions.redemptions.map((order) => `
                <article>
                  <div>
                    <h3>${order.orderNo}</h3>
                    <p>${order.items.map((item) => `${item.name} x ${item.quantity}`).join("、")}</p>
                    <p>${order.user?.name || order.user?.email || order.user?.phone || "未知会员"} · ${redemptionStatusLabel(order.status)}</p>
                  </div>
                  <strong>${order.totalPoints} 积分</strong>
                  ${order.status === "pending_fulfillment" ? `<button class="button button-secondary" type="button" data-admin-redemption-status="${order.id}" data-status="processing">处理</button>` : ""}
                  ${["pending_fulfillment", "processing"].includes(order.status) ? `<button class="button button-secondary" type="button" data-admin-redemption-status="${order.id}" data-status="shipped">发货</button>` : ""}
                  ${order.status === "shipped" ? `<button class="button button-secondary" type="button" data-admin-redemption-status="${order.id}" data-status="completed">完成</button>` : ""}
                  ${!["cancelled", "completed"].includes(order.status) ? `<button class="button button-secondary" type="button" data-admin-redemption-cancel="${order.id}">取消</button>` : ""}
                </article>
              `).join("") || `<div class="empty-state">暂无兑换订单。</div>`}
            </div>
          </section>
          <section>
            <h2>操作日志</h2>
            <div class="member-table">
              ${logs.logs.slice(0, 10).map((item) => `
                <article>
                  <div>
                    <h3>${adminActionLabel(item.action)}</h3>
                    <p>${item.reason || item.entityType} · ${item.actor}</p>
                  </div>
                  <span>${new Date(item.createdAt).toLocaleString("zh-CN")}</span>
                </article>
              `).join("") || `<div class="empty-state">暂无操作日志。</div>`}
            </div>
          </section>
        </div>
      `;
      $("[data-admin-mall-item-form]", mount)?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        try {
          await adminCreateMallItem({
            name: formData.get("name"),
            productId: formData.get("productId"),
            pointsPrice: Number(formData.get("pointsPrice")),
            stockQuantity: Number(formData.get("stockQuantity")),
            status: "active"
          });
          showToast("积分商品已新增。");
          await renderAdminPage();
        } catch (error) {
          showToast(error.message);
        }
      });
    } catch (error) {
      mount.innerHTML = `<div class="empty-state">${error.message}</div>`;
    }
  }

  function pointTypeLabel(type) {
    return {
      earn_order: "订单积分",
      use_order: "订单抵扣",
      refund_reversal: "退款扣回",
      expire_points: "积分过期",
      redeem_points: "积分兑换",
      redeem_refund: "兑换返还",
      admin_adjust: "人工调整"
    }[type] || type;
  }

  function orderStatusLabel(status) {
    return {
      pending_payment: "待确认支付",
      paid: "已支付",
      processing: "处理中",
      shipped: "已发货",
      completed: "已确认收货",
      cancelled: "已取消",
      refunded: "已退款"
    }[status] || status;
  }

  function redemptionStatusLabel(status) {
    return {
      pending_fulfillment: "待处理",
      processing: "处理中",
      shipped: "已发货",
      completed: "已完成",
      cancelled: "已取消"
    }[status] || status;
  }

  function mallItemStatusLabel(status) {
    return {
      draft: "草稿",
      active: "已上架",
      inactive: "已下架",
      sold_out: "已兑完"
    }[status] || status;
  }

  function orderPointsText(order) {
    if (order.pointsAwarded) return `已发放积分：${order.pointsAwarded}`;
    if (["paid", "processing", "shipped"].includes(order.status)) return "确认收货后发放积分";
    if (order.status === "refunded") return "已退款，不发放积分";
    return "待支付确认";
  }

  function adminActionLabel(action) {
    return {
      adjust_member_tier: "调整会员等级",
      adjust_member_points: "调整积分",
      update_order_status: "修改订单状态",
      confirm_order_paid: "确认支付",
      refund_order: "退款",
      confirm_order_received: "确认收货",
      create_member_tier: "新增会员等级",
      update_member_tier: "更新会员等级",
      create_points_mall_item: "新增积分商品",
      update_points_mall_item: "更新积分商品",
      activate_points_mall_item: "上架积分商品",
      deactivate_points_mall_item: "下架积分商品",
      update_points_redemption_status: "更新兑换订单",
      cancel_points_redemption: "取消兑换订单"
    }[action] || action;
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
    $all(`[data-favorite="${CSS.escape(id)}"]`).forEach((button) => {
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

  function bindGlobalActions() {
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
      const adminRefund = event.target.closest("[data-admin-refund]");
      const adminComplete = event.target.closest("[data-admin-complete]");
      const confirmReceipt = event.target.closest("[data-confirm-receipt]");
      const adminExport = event.target.closest("[data-admin-export]");
      const adminLogoutButton = event.target.closest("[data-admin-logout]");
      const adminMallActivate = event.target.closest("[data-admin-mall-activate]");
      const adminMallDeactivate = event.target.closest("[data-admin-mall-deactivate]");
      const adminRedemptionStatus = event.target.closest("[data-admin-redemption-status]");
      const adminRedemptionCancel = event.target.closest("[data-admin-redemption-cancel]");

      if (add) addToCart(add.dataset.addCart);
      if (fav) toggleFavorite(fav.dataset.favorite);
      if (open) openCart();
      if (close) closeCart();
      if (change) changeCart(change.dataset.cartChange, Number(change.dataset.delta));
      if (service) showToast(service.dataset.serviceAction);
      if (logout) {
        try {
          await logoutMember();
          resetSessionCache();
          showToast("已退出登录。");
          window.location.href = "index.html";
        } catch (error) {
          showToast(error.message);
        }
      }
      if (adminPay) {
        try {
          await adminPayOrder(adminPay.dataset.adminPay);
          resetSessionCache();
          showToast("订单已确认支付，等待客户确认收货后结算积分和等级。");
          await renderOrdersPage();
          await renderAdminPage();
          await initAuthHeader();
        } catch (error) {
          showToast(error.message);
        }
      }
      if (confirmReceipt) {
        try {
          await confirmReceiptOrder(confirmReceipt.dataset.confirmReceipt);
          resetSessionCache();
          showToast("已确认收货，积分和等级已结算。");
          await renderOrdersPage();
          await initAuthHeader();
        } catch (error) {
          showToast(error.message);
        }
      }
      if (adminComplete) {
        try {
          await adminCompleteOrder(adminComplete.dataset.adminComplete);
          resetSessionCache();
          showToast("订单已确认收货，积分和等级已结算。");
          await renderAdminPage();
          await renderOrdersPage();
          await initAuthHeader();
        } catch (error) {
          showToast(error.message);
        }
      }
      if (adminRefund) {
        try {
          await adminRefundOrder(adminRefund.dataset.adminRefund);
          resetSessionCache();
          showToast("订单已退款，积分和累计消费已扣回。");
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
        try {
          await adminSetMallItemStatus(node.dataset.adminMallActivate || node.dataset.adminMallDeactivate, action);
          showToast(action === "activate" ? "积分商品已上架。" : "积分商品已下架。");
          await renderAdminPage();
        } catch (error) {
          showToast(error.message);
        }
      }
      if (adminRedemptionStatus) {
        const trackingNo = adminRedemptionStatus.dataset.status === "shipped"
          ? window.prompt("物流单号，可留空", "")
          : "";
        try {
          await adminUpdateRedemptionStatus(adminRedemptionStatus.dataset.adminRedemptionStatus, {
            status: adminRedemptionStatus.dataset.status,
            trackingNo
          });
          showToast("兑换订单状态已更新。");
          await renderAdminPage();
        } catch (error) {
          showToast(error.message);
        }
      }
      if (adminRedemptionCancel) {
        try {
          await adminCancelRedemption(adminRedemptionCancel.dataset.adminRedemptionCancel);
          resetSessionCache();
          showToast("兑换订单已取消，积分和库存已返还。");
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
            throw new Error(payload.error || "会员名单导出失败。");
          }
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `scent-atoll-members-${new Date().toISOString().slice(0, 10)}.csv`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          showToast("会员名单已导出。");
        } catch (error) {
          showToast(error.message);
        }
      }
      if (adminLogoutButton) {
        try {
          await adminLogout();
          showToast("已退出后台。");
          await renderAdminPage();
        } catch (error) {
          showToast(error.message);
        }
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeCart();
    });
  }
}
