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
import { quoteCheckout } from "./checkout-client.js";
import { startCheckout } from "./checkout.js";
import { adminPayOrder, getMemberOrders, getMemberProfile, getPointTransactions, getTierProgress } from "./member-client.js";

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
  renderGuide();
  renderJournal();
  renderCartPage();
  refreshMemberQuote();
  renderAuthForms();
  renderAccountPage();
  renderPointsPage();
  renderOrdersPage();
  renderMembershipPage();
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

  function renderHome() {
    const newGrid = $("[data-home-new]");
    if (newGrid) {
      const items = data.products
        .filter((product) => product.status.includes("New") || product.status.includes("买手推荐"))
        .slice(0, 4);
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

      if (result) result.textContent = `${filtered.length} 件作品`;
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
        try {
          await loginMember({
            account: formData.get("account"),
            password: formData.get("password")
          });
          showToast("登录成功。");
          window.location.href = "account.html";
        } catch (error) {
          showToast(error.message);
        }
      });
    }

    const registerForm = $("[data-register-form]");
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
          showToast("注册成功。");
          window.location.href = "account.html";
        } catch (error) {
          showToast(error.message);
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
            <p>当前折扣：${discountLabel(data.tier.discountRate)} · 积分：实付 ¥1 = 1 积分</p>
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
                <p>${item.note || ""}</p>
              </div>
              <strong>${item.points > 0 ? "+" : ""}${item.points}</strong>
              <span>${new Date(item.createdAt).toLocaleString("zh-CN")}</span>
            </article>
          `).join("") : `<div class="empty-state">暂无积分流水。</div>`}
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
                <p>会员折扣：${moneyText(order.memberDiscountAmountYuan)} · 预计/获得积分：${order.pointsAwarded || "待支付确认"}</p>
              </div>
              <strong>${moneyText(order.paidAmountYuan)}</strong>
              <span>${orderStatusLabel(order.status)}</span>
              ${order.status === "pending_payment" ? `<button class="button button-secondary" type="button" data-admin-pay="${order.id}">开发确认支付</button>` : ""}
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
      ["普通会员", "¥0", "无", "满 ¥599 包邮"],
      ["银卡会员", "¥3,000", "98 折", "满 ¥499 包邮"],
      ["金卡会员", "¥8,000", "95 折", "满 ¥399 包邮"],
      ["黑卡会员", "¥20,000", "92 折", "顺丰包邮"]
    ];
    mount.innerHTML = `
      ${memberNav()}
      ${current ? `<div class="member-summary"><strong>${current.tier.name}</strong><span>${current.nextTier ? `距离 ${current.nextTier.name} 还差 ${moneyText(current.amountToNextTierYuan)}` : "已达到最高等级"}</span></div>` : ""}
      <div class="tier-table">
        <div><strong>等级</strong><strong>累计消费</strong><strong>折扣</strong><strong>免运</strong></div>
        ${tiers.map((tier) => `<div>${tier.map((cell) => `<span>${cell}</span>`).join("")}</div>`).join("")}
      </div>
      <div class="policy-list member-policy-list">
        <article><h2>积分计算</h2><p>每实际支付 ¥1 获得 1 积分。运费、取消订单和退款金额不计入积分。</p></article>
        <article><h2>升级规则</h2><p>订单由后台确认支付后，系统自动累加有效消费并匹配最高可达等级。第一版会员等级永久保留，不做自动降级。</p></article>
        <article><h2>折扣规则</h2><p>会员折扣只作用于商品金额，不作用于运费。特价商品后续可配置为不参与会员折扣。</p></article>
      </div>
    `;
  }

  async function renderAdminPage() {
    const mount = $("[data-admin-page]");
    if (!mount) return;
    const key = window.localStorage.getItem("sa_admin_key")
      || (["localhost", "127.0.0.1"].includes(window.location.hostname) ? "dev-admin" : "");
    if (!key) {
      mount.innerHTML = `
        <form class="account-form" data-admin-key-form>
          <label class="field-label">后台密钥<input name="key" required></label>
          <button class="button button-primary" type="submit">进入后台</button>
        </form>
      `;
      $("[data-admin-key-form]", mount)?.addEventListener("submit", (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        window.localStorage.setItem("sa_admin_key", formData.get("key"));
        renderAdminPage();
      });
      return;
    }
    window.localStorage.setItem("sa_admin_key", key);
    try {
      const [members, orders, points, logs] = await Promise.all([
        apiFetch("/api/admin/members", { headers: { "x-admin-key": key } }),
        apiFetch("/api/admin/orders", { headers: { "x-admin-key": key } }),
        apiFetch("/api/admin/points", { headers: { "x-admin-key": key } }),
        apiFetch("/api/admin/audit-logs", { headers: { "x-admin-key": key } })
      ]);
      mount.innerHTML = `
        <div class="section-heading">
          <p class="eyebrow">Admin</p>
          <h2>会员与订单管理</h2>
          <p>本页面用于本地开发确认支付和退款，上线前应替换为正式后台认证。</p>
          <button class="button button-secondary" type="button" data-admin-export>导出会员名单</button>
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
                    <p>${orderStatusLabel(order.status)} · 积分 ${order.pointsAwarded}</p>
                  </div>
                  <strong>${moneyText(order.paidAmountYuan)}</strong>
                  ${order.status === "pending_payment" ? `<button class="button button-secondary" type="button" data-admin-pay="${order.id}">确认支付</button>` : ""}
                  ${order.status === "paid" ? `<button class="button button-secondary" type="button" data-admin-refund="${order.id}">退款</button>` : ""}
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
    } catch (error) {
      mount.innerHTML = `<div class="empty-state">${error.message}</div>`;
    }
  }

  function pointTypeLabel(type) {
    return {
      earn_order: "订单积分",
      use_order: "订单抵扣",
      refund_reversal: "退款扣回",
      admin_adjust: "人工调整"
    }[type] || type;
  }

  function orderStatusLabel(status) {
    return {
      pending_payment: "待确认支付",
      paid: "已支付",
      processing: "处理中",
      shipped: "已发货",
      completed: "已完成",
      cancelled: "已取消",
      refunded: "已退款"
    }[status] || status;
  }

  function adminActionLabel(action) {
    return {
      adjust_member_tier: "调整会员等级",
      adjust_member_points: "调整积分",
      update_order_status: "修改订单状态",
      confirm_order_paid: "确认支付",
      refund_order: "退款",
      create_member_tier: "新增会员等级",
      update_member_tier: "更新会员等级"
    }[action] || action;
  }

  async function refreshMemberQuote() {
    const entries = cartStore.getItems();
    const mounts = $all("[data-member-quote]");
    if (!mounts.length || !entries.length) return;
    try {
      const quote = await quoteCheckout(entries);
      mounts.forEach((mount) => {
        mount.innerHTML = `
          <strong>${quote.tier.name}</strong>
          <span>会员折扣 ${moneyText(quote.memberDiscountAmountYuan)} · 运费 ${moneyText(quote.shippingAmountYuan)} · 应付 ${moneyText(quote.paidAmountYuan)} · 预计获得 ${quote.pointsToEarn} 积分</span>
        `;
      });
    } catch {
      mounts.forEach((mount) => {
        mount.textContent = "登录会员后可查看会员折扣和预计积分。";
      });
    }
  }

  function addToCart(id) {
    try {
      const item = cartStore.addItem(id);
      renderCartShell();
      renderCartPage();
      refreshMemberQuote();
      showToast(`${item.name} 已加入购物车`);
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
      const checkout = event.target.closest("[data-checkout]");
      const service = event.target.closest("[data-service-action]");
      const logout = event.target.closest("[data-logout]");
      const adminPay = event.target.closest("[data-admin-pay]");
      const adminRefund = event.target.closest("[data-admin-refund]");
      const adminExport = event.target.closest("[data-admin-export]");

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
          showToast("已退出登录。");
          window.location.href = "index.html";
        } catch (error) {
          showToast(error.message);
        }
      }
      if (adminPay) {
        const key = window.prompt("输入后台确认支付密钥", "dev-admin");
        if (!key) return;
        try {
          await adminPayOrder(adminPay.dataset.adminPay, key);
          resetSessionCache();
          showToast("订单已确认支付，积分和等级已更新。");
          await renderOrdersPage();
          await initAuthHeader();
        } catch (error) {
          showToast(error.message);
        }
      }
      if (adminRefund) {
        const key = window.prompt("输入后台退款密钥", window.localStorage.getItem("sa_admin_key") || "dev-admin");
        if (!key) return;
        try {
          await apiFetch(`/api/admin/orders/${encodeURIComponent(adminRefund.dataset.adminRefund)}/refund`, {
            method: "POST",
            headers: {
              "x-admin-key": key
            }
          });
          resetSessionCache();
          showToast("订单已退款，积分和累计消费已扣回。");
          await renderAdminPage();
          await renderOrdersPage();
          await initAuthHeader();
        } catch (error) {
          showToast(error.message);
        }
      }
      if (adminExport) {
        const key = window.localStorage.getItem("sa_admin_key") || window.prompt("输入后台导出密钥", "dev-admin");
        if (!key) return;
        try {
          const response = await fetch("/api/admin/members/export.csv", {
            headers: {
              "x-admin-key": key
            }
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || "会员名单导出失败。");
          }
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `scent-archive-members-${new Date().toISOString().slice(0, 10)}.csv`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          showToast("会员名单已导出。");
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
