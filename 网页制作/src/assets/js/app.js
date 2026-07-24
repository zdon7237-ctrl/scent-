import {
  articleById,
  brandById,
  catalogData as data,
  formatPrice,
  hasCatalogData,
  productById,
  replaceCatalogProducts
} from "./catalog.js";
import { apiFetch, moneyText } from "./api-client.js";
import {
  currentSession, deleteMemberAccount, loginMember, logoutMember, registerMember,
  requestPasswordReset, resetPassword, resetSessionCache, revokeOtherSessions, verifyEmail
} from "./auth-client.js";
import { cartStore } from "./cart-store.js";
import { closeCart, openCart, renderCartPage, renderCartShell } from "./cart-ui.js";
import {
  adminChangePassword,
  adminAdjustMemberPoints,
  adminCancelRedemption,
  adminAdjustProductInventory,
  adminCompleteOrder,
  adminCreateMallItem,
  adminCreateProduct,
  adminDeleteProductImage,
  adminGetAuditLogs,
  adminGetMembers,
  adminGetOrders,
  adminGetPoints,
  adminGetPointsMallItems,
  adminGetProducts,
  adminGetPointsRedemptions,
  adminLogout,
  adminPayOrder,
  adminRefundOrder,
  adminRevokeOtherSessions,
  adminShipOrder,
  adminSetProductStatus,
  adminSetMallItemStatus,
  adminUpdateProduct,
  adminUpdateRedemptionStatus,
  adminUploadProductImage,
  getCurrentAdmin
} from "./admin-client.js";
import {
  cancelOrder, confirmReceiptOrder, createAddress, createOrder, deleteAddress, getAddresses, getMemberOrders,
  getMemberProfile, getPointTransactions, getTierProgress, quoteOrder, startPayment
} from "./member-client.js";
import {
  getPointsMallItem,
  getPointsMallItems,
  getPointsRedemptions,
  redeemPointsMallItem
} from "./points-mall-client.js";

if (hasCatalogData) {
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
      if (!Array.isArray(payload.products)) throw new Error("商品数据格式无效。");
      replaceCatalogProducts(payload.products || [], { clearBundledSamples: true });
      document.body.dataset.catalogStatus = "ready";
    } catch (error) {
      state.catalogAvailable = false;
      replaceCatalogProducts([], { clearBundledSamples: true });
      document.body.dataset.catalogStatus = "unavailable";
      console.error("Managed products unavailable; commerce has been paused.", error);
    }
  }

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
    return (product.status || []).slice(0, 2).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  }

  function shortText(text = "", max = 58) {
    return text.length > max ? `${text.slice(0, max)}...` : text;
  }

  function entryUrl(prefix, id) {
    return `${prefix}-${encodeURIComponent(id)}.html`;
  }

  function productUrl(id) {
    return `/products/${encodeURIComponent(id)}`;
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

  function catalogUnavailableMarkup() {
    return `
      <div class="empty-state commerce-unavailable" role="alert">
        <h2>商品服务暂时不可用</h2>
        <p>为避免显示过期价格或库存，当前已暂停商品浏览和下单。请重新加载后再试。</p>
        <div class="button-row">
          <button class="button button-primary" type="button" data-retry-catalog>重新加载</button>
          <a class="button button-secondary" href="service.html">联系客服</a>
        </div>
      </div>
    `;
  }

  function actionIdempotencyKey(element, prefix, payload = {}) {
    const signature = JSON.stringify(payload);
    if (!element.dataset.idempotencyKey || element.dataset.idempotencySignature !== signature) {
      const randomPart = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, "0")).join("");
      element.dataset.idempotencyKey = `${prefix}-${randomPart}`;
      element.dataset.idempotencySignature = signature;
    }
    return element.dataset.idempotencyKey;
  }

  function escapeHtml(value = "") {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function safeImageStyle(value, property = "--image") {
    const cssString = JSON.stringify(String(value || "")).replaceAll("<", "\\u003c");
    return `style="${property}:url(${escapeHtml(cssString)})"`;
  }

  function safeTagList(items = []) {
    return items.slice(0, 4).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  }

  function productStatusLabel(status) {
    return {
      draft: "草稿",
      active: "已上架",
      inactive: "已下架",
      archived: "已归档"
    }[status] || status || "草稿";
  }

  function orderedProductImages(product = {}) {
    return (product.images || [])
      .slice()
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  }

  function imageSizeText(byteSize) {
    const bytes = Number(byteSize || 0);
    if (!bytes) return "";
    return bytes >= 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  function imageUpdatePayload(image, index, primaryImageUrl) {
    return {
      ...image,
      role: image.imageUrl === primaryImageUrl ? "hero" : "gallery",
      sortOrder: index + 1
    };
  }

  function adminImageFileError(file) {
    if (!file || !file.name || !Number(file.size)) return "请选择要上传的图片。";
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      return "仅支持 JPEG、PNG、WebP 或 AVIF 图片。";
    }
    if (file.size > 5 * 1024 * 1024) return "图片不能超过 5 MB。";
    return "";
  }

  async function saveProductImageOrder(product, images, reason, primaryImageUrl = product.heroImageUrl || images[0]?.imageUrl || "") {
    const ordered = images.map((image, index) => imageUpdatePayload(image, index, primaryImageUrl));
    return adminUpdateProduct(product.id, {
      images: ordered,
      heroImageUrl: primaryImageUrl,
      reason
    });
  }

  function adminProductImages(product) {
    const images = orderedProductImages(product);
    const headingId = `product-images-${product.id}`;
    return `
      <section aria-labelledby="${escapeHtml(headingId)}">
        <div class="admin-product-summary">
          <div>
            <h3 id="${escapeHtml(headingId)}">商品图片</h3>
            <p>主图优先展示，其他图片按当前顺序排列。可调整顺序或上传替换。</p>
          </div>
          <span>${images.length} 张</span>
        </div>
        <div class="member-table admin-nested-table">
          ${images.map((image, index) => {
            const isPrimary = product.heroImageUrl === image.imageUrl || (!product.heroImageUrl && index === 0);
            const cannotDelete = product.status === "active" && images.length === 1;
            const metadata = [image.contentType, imageSizeText(image.byteSize)].filter(Boolean).join(" · ");
            return `
              <article>
                <img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.alt || product.name)}" width="88" height="88" loading="lazy" style="object-fit:cover;border-radius:8px">
                <div>
                  <h3>${isPrimary ? "主图" : `图片 ${index + 1}`}</h3>
                  <p>${escapeHtml(image.alt || product.name)}${metadata ? ` · ${escapeHtml(metadata)}` : ""}</p>
                  <div class="button-row">
                    <button class="button button-secondary" type="button" data-admin-image-primary="${escapeHtml(image.id)}" data-product-id="${escapeHtml(product.id)}" ${isPrimary ? "disabled" : ""}>设为主图</button>
                    <button class="button button-secondary" type="button" data-admin-image-move="${escapeHtml(image.id)}" data-product-id="${escapeHtml(product.id)}" data-direction="-1" ${index === 0 ? "disabled" : ""} aria-label="上移 ${escapeHtml(image.alt || product.name)}">上移</button>
                    <button class="button button-secondary" type="button" data-admin-image-move="${escapeHtml(image.id)}" data-product-id="${escapeHtml(product.id)}" data-direction="1" ${index === images.length - 1 ? "disabled" : ""} aria-label="下移 ${escapeHtml(image.alt || product.name)}">下移</button>
                    <button class="button button-secondary" type="button" data-admin-image-delete="${escapeHtml(image.id)}" data-product-id="${escapeHtml(product.id)}" ${cannotDelete ? "disabled title=\"请先上传替代图片或下架商品\"" : ""}>删除</button>
                  </div>
                </div>
                <form class="admin-inventory-form" data-admin-image-replace="${escapeHtml(image.id)}" data-product-id="${escapeHtml(product.id)}">
                  <label class="field-label">替换图片<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required></label>
                  <button class="button button-secondary" type="submit">上传替换</button>
                  <p class="form-message" data-form-message aria-live="polite"></p>
                </form>
              </article>
            `;
          }).join("") || `<div class="empty-state">还没有商品图。上传第一张图片后，系统会自动将它设为主图。</div>`}
        </div>
        <form class="admin-inventory-form" data-admin-image-upload="${escapeHtml(product.id)}">
          <label class="field-label">选择图片<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required></label>
          <label class="field-label">图片说明<input name="alt" value="${escapeHtml(product.name)}" required></label>
          <label class="checkbox-row"><input name="isHero" type="checkbox" ${images.length ? "" : "checked"}><span>设为主图</span></label>
          <button class="button button-secondary" type="submit">上传图片</button>
          <p class="form-message" data-form-message aria-live="polite">支持 JPEG、PNG、WebP、AVIF，单张不超过 5 MB。</p>
        </form>
      </section>
    `;
  }

  function adminProductPayload(form) {
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
      variantName: formData.get("variantName") || "默认规格",
      priceAmountYuan: Number(formData.get("priceAmountYuan") || 0),
      stockQuantity: Number(formData.get("stockQuantity") || 0),
      reason: formData.get("reason") || "后台保存商品"
    };
    const variantId = formData.get("variantId");
    if (variantId) payload.variantId = variantId;
    return payload;
  }

  function adminProductForm(product = null) {
    const variant = product?.primaryVariant || {};
    const inventory = variant.inventory || {};
    const isCreate = !product;
    const id = product?.id || "";
    return `
      <form class="admin-product-form ${isCreate ? "" : "admin-product-edit"}" ${isCreate ? "data-admin-product-create" : `data-admin-product-edit="${escapeHtml(id)}"`}>
        ${!isCreate ? `<input type="hidden" name="variantId" value="${escapeHtml(variant.id || "")}">` : ""}
        <div class="admin-form-grid">
          <label class="field-label">商品名<input name="name" value="${escapeHtml(product?.name || "")}" required></label>
          <label class="field-label">Slug<input name="slug" value="${escapeHtml(product?.slug || "")}" placeholder="ruby-tea" required></label>
          <label class="field-label">品牌<input name="brandName" value="${escapeHtml(product?.brandName || "")}"></label>
          <label class="field-label">状态
            <select name="status">
              ${["draft", "active", "inactive", "archived"].map((status) => `<option value="${status}" ${product?.status === status || (!product && status === "draft") ? "selected" : ""}>${productStatusLabel(status)}</option>`).join("")}
            </select>
          </label>
          <label class="field-label">价格<input name="priceAmountYuan" type="number" min="0" step="0.01" value="${escapeHtml(variant.priceAmountYuan || "")}"></label>
          <label class="field-label">库存<input name="stockQuantity" type="number" min="0" step="1" value="${escapeHtml(inventory.quantityOnHand ?? "")}"></label>
          <label class="field-label">SKU<input name="sku" value="${escapeHtml(variant.sku || "")}"></label>
          <label class="field-label">规格<input name="variantName" value="${escapeHtml(variant.name || "默认规格")}"></label>
          <label class="field-label">容量<input name="volume" value="${escapeHtml(product?.volume || "")}" placeholder="50ml"></label>
          <label class="field-label">浓度<input name="concentration" value="${escapeHtml(product?.concentration || "")}" placeholder="EDP"></label>
          <label class="field-label">香调家族<input name="family" value="${escapeHtml(product?.family || "")}"></label>
          <label class="field-label">图片排版
            <select name="imageLayout">
              ${["grid", "editorial", "detail", "minimal"].map((layout) => `<option value="${layout}" ${(product?.imageLayout || "grid") === layout ? "selected" : ""}>${layout}</option>`).join("")}
            </select>
          </label>
          <label class="field-label">分类<input name="category" value="${escapeHtml(product?.category || "fragrance")}"></label>
          <label class="field-label">国家<input name="country" value="${escapeHtml(product?.country || "")}"></label>
          <label class="field-label">甜度<input name="sweetness" value="${escapeHtml(product?.sweetness || "")}" placeholder="low / medium / high"></label>
          <label class="field-label">标签<input name="statusTags" value="${escapeHtml((product?.statusTags || []).join("、"))}" placeholder="New、买手推荐"></label>
          <label class="field-label admin-wide-field">香调<input name="notes" value="${escapeHtml((product?.notes || []).join("、"))}" placeholder="茶香、木质、麝香"></label>
          <label class="field-label admin-wide-field">场景<input name="scenes" value="${escapeHtml((product?.scenes || []).join("、"))}" placeholder="daily、gift"></label>
          ${isCreate ? `<p class="form-message admin-wide-field">先创建草稿，再在商品图片区上传图片。</p>` : ""}
          <label class="field-label admin-wide-field">描述<textarea name="description" rows="3">${escapeHtml(product?.description || "")}</textarea></label>
          <label class="field-label admin-wide-field">买手点评<textarea name="buyerNote" rows="3">${escapeHtml(product?.buyerNote || "")}</textarea></label>
          <label class="field-label">适合场景<input name="bestFor" value="${escapeHtml(product?.bestFor || "")}"></label>
          <label class="field-label">盲买提醒<input name="caution" value="${escapeHtml(product?.caution || "")}"></label>
          <label class="field-label">前调<input name="topNotes" value="${escapeHtml(product?.topNotes || "")}"></label>
          <label class="field-label">中调<input name="middleNotes" value="${escapeHtml(product?.middleNotes || "")}"></label>
          <label class="field-label">后调<input name="baseNotes" value="${escapeHtml(product?.baseNotes || "")}"></label>
          <label class="field-label">备注<input name="reason" value="${isCreate ? "后台新增商品" : "后台更新商品"}"></label>
        </div>
        <div class="button-row">
          <button class="button button-primary" type="submit">${isCreate ? "新增商品" : "保存商品"}</button>
          ${!isCreate && product.status !== "active" ? `<button class="button button-secondary" type="button" data-admin-product-activate="${escapeHtml(id)}">上架</button>` : ""}
          ${!isCreate && product.status === "active" ? `<button class="button button-secondary" type="button" data-admin-product-deactivate="${escapeHtml(id)}">下架</button>` : ""}
          ${!isCreate && product.status !== "archived" ? `<button class="button button-secondary" type="button" data-admin-product-archive="${escapeHtml(id)}">归档</button>` : ""}
        </div>
      </form>
    `;
  }

  function adminProductsMarkup(productsPayload, options = {}) {
    const allProducts = productsPayload.products || [];
    const products = options.stock === "low"
      ? allProducts.filter((product) => product.availableQuantity > 0 && product.availableQuantity <= 3)
      : allProducts;
    const summary = productsPayload.summary || {};
    return `
      <section class="admin-products-panel">
        <div class="admin-panel-head">
          <div>
            <h2>商品上架与库存</h2>
            <p>维护香水资料、图片排版、上下架状态和可售库存。</p>
          </div>
          <div class="admin-stat-row">
            <span><strong>${summary.total || 0}</strong>全部</span>
            <span><strong>${summary.active || 0}</strong>上架</span>
            <span><strong>${summary.lowStock || 0}</strong>低库存</span>
            <span><strong>${summary.outOfStock || 0}</strong>售罄</span>
          </div>
        </div>
        <div class="admin-toolbar">
          <label class="admin-search"><span>搜索商品</span><input type="search" data-admin-list-search placeholder="商品、品牌、Slug 或 SKU"></label>
          ${options.stock === "low" ? `<a class="button button-secondary" href="#products">查看全部商品</a>` : ""}
        </div>
        <details class="admin-create-product" ${allProducts.length ? "" : "open"}>
          <summary>新增商品</summary>
          ${adminProductForm()}
        </details>
        <div class="admin-product-list" data-admin-record-list>
          ${products.map((product) => `
            <details class="admin-product-item" data-admin-search-value="${escapeHtml([product.name, product.slug, product.brandName, product.primaryVariant?.sku].filter(Boolean).join(" ").toLowerCase())}">
              <summary class="admin-product-summary">
                <div>
                  <h3>${escapeHtml(product.name)}</h3>
                  <p>${escapeHtml(product.slug)} · ${escapeHtml(product.brandName || "未填品牌")} · ${moneyText(product.priceAmountYuan)} · 库存 ${product.availableQuantity}</p>
                </div>
                <span class="status-badge">${escapeHtml(productStatusLabel(product.status))}</span>
                <span>${(product.images || []).length} 张图</span>
              </summary>
              <div class="admin-product-body">
                ${adminProductForm(product)}
                ${adminProductImages(product)}
                ${product.primaryVariant ? `
                  <form class="admin-inventory-form" data-admin-inventory-form="${escapeHtml(product.id)}" data-variant-id="${escapeHtml(product.primaryVariant.id)}">
                    <label class="field-label">库存变动<input name="quantityDelta" type="number" step="1" placeholder="+5 或 -2" required></label>
                    <label class="field-label">原因<input name="reason" value="后台库存调整"></label>
                    <button class="button button-secondary" type="submit">检查并调整</button>
                  </form>
                ` : ""}
              </div>
            </details>
          `).join("") || adminEmptyMarkup(options.stock === "low" ? "当前没有低库存商品" : "还没有商品", options.stock === "low" ? "库存充足，无需立即补货。" : "先新增一件商品，再补充图片和库存。")}
        </div>
      </section>
    `;
  }

  function productCard(product, options = {}) {
    const compact = options.compact ? " product-card-compact" : "";
    const favorite = state.favorites.has(product.id);
    const scenes = sceneLabels(product.scenes).slice(0, 2).join(" / ");
    const href = productUrl(product.slug || product.id);
    if (options.compact) {
      return `
        <article class="product-card${compact} product-card-minimal">
          <a class="product-card-media" href="${escapeHtml(href)}" ${safeImageStyle(product.image)} aria-label="查看 ${escapeHtml(product.name)}"></a>
          <div class="product-card-body">
            <span class="product-kicker">${escapeHtml(product.brand)}</span>
            <h3><a href="${escapeHtml(href)}">${escapeHtml(product.name)}</a></h3>
            <p>${escapeHtml(product.family)}</p>
            <div class="price-row">
              <strong>${formatPrice(product.price)}</strong>
              <span>${escapeHtml(product.volume)}</span>
            </div>
          </div>
        </article>
      `;
    }
    return `
      <article class="product-card${compact}">
        <a class="product-card-media" href="${escapeHtml(href)}" ${safeImageStyle(product.image)} aria-label="查看 ${escapeHtml(product.name)}"></a>
        <div class="product-card-body">
          <div class="product-card-topline">
            <div class="meta-line">
              <span>${escapeHtml(product.brand)}</span>
              <span>${escapeHtml(product.stock)}</span>
            </div>
            <div class="card-flags">${statusFlags(product)}</div>
          </div>
          <h3><a href="${escapeHtml(href)}">${escapeHtml(product.name)}</a></h3>
          <p>${escapeHtml(product.family)} · ${escapeHtml(product.concentration)}</p>
          <div class="scent-brief" aria-label="气味判断">
            <div><span>场景</span><strong>${escapeHtml(scenes || product.bestFor)}</strong></div>
            <div><span>甜度</span><strong>${sweetnessLabel(product.sweetness)}</strong></div>
          </div>
          <p class="card-note">${escapeHtml(shortText(product.buyer || product.description))}</p>
          <p class="risk-line"><span>购买前</span>${buyingCue(product)}</p>
          <div class="tag-row">${safeTagList(product.notes)}</div>
          <div class="price-row">
            <strong>${formatPrice(product.price)}</strong>
            <span>${escapeHtml(product.volume)}</span>
          </div>
          <div class="card-actions">
            <button class="button button-secondary" type="button" data-favorite="${escapeHtml(product.id)}" aria-pressed="${favorite}">
              ${favorite ? "已收藏" : "收藏"}
            </button>
            <button class="button button-primary" type="button" data-add-cart="${escapeHtml(product.id)}" ${product.canPurchase === false ? "disabled" : ""}>${product.canPurchase === false ? "暂不可购买" : "加入意向清单"}</button>
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
        <a class="brand-card-media" href="${escapeHtml(href)}" ${safeImageStyle(brand.hero)} aria-label="查看 ${escapeHtml(brand.name)}"></a>
        <div class="brand-card-body">
          <span class="eyebrow">${escapeHtml(brand.country)}</span>
          <h3><a href="${escapeHtml(href)}">${escapeHtml(brand.name)}</a></h3>
          <p>${escapeHtml(brand.intro)}</p>
          <div class="tag-row">${safeTagList(brand.keywords)}</div>
          <strong>入门：${escapeHtml(brand.starter)}</strong>
          <a class="text-link" href="${escapeHtml(href)}">${products.length} 件作品</a>
        </div>
      </article>
    `;
  }

  function articleCard(article) {
    const href = articleUrl(article.id);
    return `
      <article class="article-card">
        <a class="article-media" href="${escapeHtml(href)}" ${safeImageStyle(article.image)} aria-label="阅读 ${escapeHtml(article.title)}"></a>
        <div class="article-card-body">
          <span class="eyebrow">${escapeHtml(article.category)} · ${escapeHtml(article.date)}</span>
          <h3><a href="${escapeHtml(href)}">${escapeHtml(article.title)}</a></h3>
          <p>${escapeHtml(article.excerpt)}</p>
          <a class="text-link" href="${escapeHtml(href)}">阅读全文</a>
        </div>
      </article>
    `;
  }

  function sampleCard(set) {
    return `
      <article class="sample-card" id="set-${escapeHtml(set.id)}">
        <a class="sample-media" href="samples.html#set-${encodeURIComponent(set.id)}" ${safeImageStyle(set.image)}></a>
        <div class="sample-card-body">
          <span class="eyebrow">${escapeHtml(set.volume)}</span>
          <h3>${escapeHtml(set.name)}</h3>
          <p>${escapeHtml(set.intro || set.description)}</p>
          <div class="tag-row">${safeTagList(set.notes)}</div>
          <div class="price-row">
            <strong>${formatPrice(set.price)}</strong>
            <span>${escapeHtml(set.bestFor)}</span>
          </div>
          <button class="button button-primary" type="button" data-add-cart="${escapeHtml(set.id)}" ${set.canPurchase === false ? "disabled" : ""}>${set.canPurchase === false ? "暂不可购买" : "加入意向清单"}</button>
        </div>
      </article>
    `;
  }

  function initNavigation() {
    const header = $("[data-header]");
    const toggle = $("[data-nav-toggle]");
    const nav = $("[data-nav]");
    const page = document.body.dataset.page;

    function setNavigationOpen(open, { restoreFocus = false } = {}) {
      if (!header || !toggle) return;
      header.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "关闭主导航" : "打开主导航");
      if (!open && restoreFocus) toggle.focus();
    }

    if (toggle && header) {
      toggle.addEventListener("click", () => {
        setNavigationOpen(!header.classList.contains("nav-open"));
      });

      document.addEventListener("click", (event) => {
        if (header.classList.contains("nav-open") && !header.contains(event.target)) {
          setNavigationOpen(false);
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && header.classList.contains("nav-open")) {
          setNavigationOpen(false, { restoreFocus: true });
        }
      });
    }

    if (nav) {
      $all("a", nav).forEach((link) => {
        if (link.dataset.nav === page) link.classList.add("active");
        link.addEventListener("click", () => {
          setNavigationOpen(false);
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
      if (!state.catalogAvailable) {
        newGrid.innerHTML = catalogUnavailableMarkup();
        return;
      }
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

    if (!state.catalogAvailable) {
      if (form) form.setAttribute("inert", "");
      if (result) result.textContent = "商品服务暂时不可用";
      grid.innerHTML = catalogUnavailableMarkup();
      return;
    }

    if (noteWrap) {
      noteWrap.innerHTML = ["全部", ...data.notes].map((note) => `
        <label class="chip">
          <input type="radio" name="note" value="${escapeHtml(note === "全部" ? "all" : note)}">
          <span>${escapeHtml(note)}</span>
        </label>
      `).join("");
    }

    if (brandSelect) {
      brandSelect.innerHTML = `<option value="all">全部品牌</option>${data.brands.map((brand) => `<option value="${escapeHtml(brand.id)}">${escapeHtml(brand.name)}</option>`).join("")}`;
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
          return [product.brand, product.name, product.family, product.country, product.description, ...(product.notes || []), ...(product.status || [])].join(" ").toLowerCase().includes(q);
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

    if (!state.catalogAvailable) {
      mount.innerHTML = catalogUnavailableMarkup();
      return;
    }

    if (!data.products.length) {
      mount.innerHTML = `
        <div class="empty-state">
          <h2>暂无已上架商品</h2>
          <p>商品上架后，这里会自动显示详情。</p>
          <a class="button button-primary" href="shop.html">返回香水列表</a>
        </div>
      `;
      return;
    }
    const requestedId = params().get("id") || mount.dataset.entryId || data.products[0].id;
    const product = productById(requestedId);
    if (!product) {
      mount.innerHTML = `
        <div class="empty-state">
          <h2>商品暂未上架</h2>
          <p>这支香水可能已经下架，或后台还没有发布。</p>
          <a class="button button-primary" href="shop.html">返回香水列表</a>
        </div>
      `;
      return;
    }
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
        <span>${escapeHtml(product.name)}</span>
      </nav>
      <section class="product-detail">
        <div class="product-gallery">
          <div class="product-main-image" ${safeImageStyle(product.image)}></div>
          <div class="gallery-note">可查看瓶身、包装和细节图，购买前也可以先选择试香套装。</div>
        </div>
        <div class="product-purchase">
          <p class="eyebrow">${escapeHtml(product.brand)} · ${escapeHtml(product.country)}</p>
          <h1>${escapeHtml(product.name)}</h1>
          <p>${escapeHtml(product.description)}</p>
          <div class="tag-row">${safeTagList(product.notes)}</div>
          <div class="purchase-guidance" aria-label="购买前判断">
            <div>
              <span>买手判断</span>
              <p>${escapeHtml(product.buyer)}</p>
            </div>
            <div>
              <span>适合场景</span>
              <strong>${escapeHtml(product.bestFor)}</strong>
            </div>
            <div>
              <span>盲买提醒</span>
              <p>${escapeHtml(product.caution)}</p>
            </div>
          </div>
          <div class="purchase-box">
            <div><span>价格</span><strong>${formatPrice(product.price)}</strong></div>
            <div><span>容量</span><strong>${escapeHtml(product.volume)}</strong></div>
            <div><span>浓度</span><strong>${escapeHtml(product.concentration)}</strong></div>
            <div><span>库存</span><strong>${escapeHtml(product.stock)}</strong></div>
          </div>
          <div class="scent-brief product-detail-brief" aria-label="香水摘要">
            <div><span>香调家族</span><strong>${escapeHtml(product.family)}</strong></div>
            <div><span>甜度</span><strong>${sweetnessLabel(product.sweetness)}</strong></div>
            <div><span>购买建议</span><strong>${buyingCue(product)}</strong></div>
          </div>
          <div class="purchase-actions">
            <button class="button button-primary" type="button" data-add-cart="${escapeHtml(product.id)}" ${product.canPurchase === false ? "disabled" : ""}>${product.canPurchase === false ? "暂不可购买" : "咨询这支香"}</button>
            <a class="button button-secondary" href="samples.html">不确定，先试香</a>
            <button class="button button-secondary" type="button" data-favorite="${escapeHtml(product.id)}" aria-pressed="${state.favorites.has(product.id)}">${state.favorites.has(product.id) ? "已收藏" : "收藏"}</button>
          </div>
        </div>
      </section>
      <section class="detail-panels">
        <article>
          <h2>香调结构</h2>
          <dl class="note-list">
            <div><dt>前调</dt><dd>${escapeHtml(product.top)}</dd></div>
            <div><dt>中调</dt><dd>${escapeHtml(product.middle)}</dd></div>
            <div><dt>后调</dt><dd>${escapeHtml(product.base)}</dd></div>
            <div><dt>香调家族</dt><dd>${escapeHtml(product.family)}</dd></div>
            <div><dt>调香师</dt><dd>${escapeHtml(product.perfumer)}</dd></div>
            <div><dt>发布年份</dt><dd>${escapeHtml(product.year)}</dd></div>
          </dl>
        </article>
        <article>
          <h2>买手点评</h2>
          <p>${escapeHtml(product.buyer)}</p>
          <p><strong>适合：</strong>${escapeHtml(product.bestFor)}</p>
          <p><strong>提醒：</strong>${escapeHtml(product.caution)}</p>
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
          <nav class="breadcrumb" aria-label="面包屑"><a href="brands.html">品牌</a><span>/</span><span>${escapeHtml(brand.name)}</span></nav>
          <p class="eyebrow">${escapeHtml(brand.country)}</p>
          <h1>${escapeHtml(brand.name)}</h1>
          <p>${escapeHtml(brand.intro)}</p>
          <div class="tag-row">${safeTagList(brand.keywords)}</div>
        </div>
        <div class="split-image" ${safeImageStyle(brand.hero)}></div>
      </section>
      <section class="detail-panels">
        <article>
          <h2>品牌故事</h2>
          <p>${escapeHtml(brand.story)}</p>
        </article>
        <article>
          <h2>创作信息</h2>
          <p><strong>创办人 / 调香：</strong>${escapeHtml(brand.founder)}</p>
          <p><strong>买手入门款：</strong>${escapeHtml(brand.starter)}</p>
        </article>
        <article>
          <h2>入门路线</h2>
          <p>第一次接触 ${escapeHtml(brand.name)}，建议先看关键词是否贴合你的场景，再从入门款或同品牌试香开始。</p>
          <a class="text-link" href="shop.html?brand=${encodeURIComponent(brand.id)}">查看可购买作品</a>
        </article>
      </section>
      <section class="section-tight">
        <div class="section-heading row-heading">
          <div>
            <p class="eyebrow">Works</p>
            <h2>${escapeHtml(brand.name)} 作品</h2>
          </div>
          <a class="text-link" href="shop.html?brand=${encodeURIComponent(brand.id)}">进入商品列表</a>
        </div>
        <div class="product-grid">${products.map((product) => productCard(product, { compact: true })).join("")}</div>
      </section>
    `;
  }

  function renderSamples() {
    const grid = $("[data-sample-grid]");
    if (!grid) return;
    if (!state.catalogAvailable) {
      grid.innerHTML = catalogUnavailableMarkup();
      return;
    }
    const sampleProducts = data.products.filter((product) => product.category === "sample");
    grid.innerHTML = sampleProducts.length
      ? sampleProducts.map(sampleCard).join("")
      : `<div class="empty-state"><h2>试香套装正在整理</h2><p>当前没有已上架的试香组合，可先联系客服说明香调偏好。</p><a class="button button-secondary" href="service.html">联系客服</a></div>`;
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
        <nav class="breadcrumb" aria-label="面包屑"><a href="journal.html">Journal</a><span>/</span><span>${escapeHtml(article.category)}</span></nav>
        <p class="eyebrow">${escapeHtml(article.category)} · ${escapeHtml(article.date)}</p>
        <h1>${escapeHtml(article.title)}</h1>
        <div class="article-hero-image" ${safeImageStyle(article.image)}></div>
        ${article.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
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
      try {
        const adminSession = await getCurrentAdmin();
        if (adminSession.admin) {
          mount.innerHTML = `<a class="account-link" href="admin.html">管理后台</a>`;
          return;
        }
      } catch {
        // Anonymous visitors should see the normal customer sign-in actions.
      }
      mount.innerHTML = `
        <a class="account-link" href="login.html">登录</a>
        <a class="text-link" href="register.html">注册</a>
      `;
      return;
    }

    mount.innerHTML = `
      <a class="account-link" href="account.html">我的账户</a>
      <a class="text-link" href="points.html">${escapeHtml(session.profile.availablePoints)} 积分</a>
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
          const result = await loginMember({
            account: formData.get("account"),
            password: formData.get("password")
          });
          const isAdmin = result.accountType === "admin";
          setFormMessage(loginForm, isAdmin ? "身份已确认，正在进入运营后台。" : "登录成功，正在进入会员中心。", "success");
          showToast("登录成功。");
          window.location.href = result.destination || (isAdmin ? "admin.html#overview" : "account.html");
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
          const result = await registerMember({
            name: formData.get("name"),
            email: formData.get("email"),
            phone: formData.get("phone"),
            password: formData.get("password"),
            acceptTerms: formData.has("acceptTerms"),
            acceptPrivacy: formData.has("acceptPrivacy")
          });
          if (result.verificationRequired) {
            setFormMessage(registerForm, "注册成功。请查收邮件完成验证后再登录。", "success");
            showToast("验证邮件已发送。");
          } else {
            setFormMessage(registerForm, "注册成功，正在进入会员中心。", "success");
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
  }

  async function renderEmailVerificationPage() {
    const mount = $("[data-verify-email-page]");
    if (!mount) return;
    const token = params().get("token");
    if (!token) {
      mount.innerHTML = `<div class="empty-state"><h2>验证链接不完整</h2><p>请从邮件中重新打开验证链接。</p></div>`;
      return;
    }
    try {
      await verifyEmail(token);
      resetSessionCache();
      mount.innerHTML = `<div class="empty-state"><h2>邮箱已验证</h2><p>账号已可以正常使用。</p><a class="button button-primary" href="account.html">进入会员中心</a></div>`;
    } catch (error) {
      mount.innerHTML = `<div class="empty-state"><h2>验证失败</h2><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  function renderPasswordResetPage() {
    const mount = $("[data-reset-password-page]");
    if (!mount) return;
    const token = params().get("token");
    mount.innerHTML = token
      ? `<form class="account-form" data-new-password-form><label class="field-label">新密码<input name="password" type="password" minlength="10" autocomplete="new-password" required></label><p class="form-message" data-form-message></p><button class="button button-primary" type="submit">更新密码</button></form>`
      : `<form class="account-form" data-password-reset-request><label class="field-label">注册邮箱<input name="email" type="email" autocomplete="email" required></label><p class="form-message" data-form-message></p><button class="button button-primary" type="submit">发送重置邮件</button></form>`;
    $("[data-password-reset-request]", mount)?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        await requestPasswordReset(new FormData(form).get("email"));
        setFormMessage(form, "如果该邮箱已注册，将收到重置邮件。", "success");
      } catch (error) { setFormMessage(form, error.message, "error"); }
    });
    $("[data-new-password-form]", mount)?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        await resetPassword(token, new FormData(form).get("password"));
        setFormMessage(form, "密码已更新，请重新登录。", "success");
        setTimeout(() => { window.location.href = "login.html"; }, 700);
      } catch (error) { setFormMessage(form, error.message, "error"); }
    });
  }

  function checkoutErrorDetails(error) {
    const status = Number(error?.status || 0);
    const message = String(error?.message || "请求失败。");
    if (status === 401) {
      return { kind: "auth", title: "请先登录", message: "登录后才能读取收货地址并提交订单。" };
    }
    if (status === 409 || /库存|暂不可购买|已下架|售罄/.test(message)) {
      return { kind: "stock", title: "部分商品暂时无法购买", message };
    }
    if (status === 0) {
      return { kind: "network", title: "网络连接失败", message: "没有成功连接到订单服务，请检查网络后重试。" };
    }
    if (status >= 500) {
      return { kind: "service", title: "订单服务暂时不可用", message: "服务器暂时无法确认价格和库存，请稍后重试。" };
    }
    return { kind: "request", title: "暂时无法确认订单", message };
  }

  function checkoutErrorMarkup(error) {
    const details = checkoutErrorDetails(error);
    if (details.kind === "auth") return requireLoginMarkup();
    return `
      <div class="empty-state checkout-error" role="alert">
        <h2>${escapeHtml(details.title)}</h2>
        <p>${escapeHtml(details.message)}</p>
        <div class="button-row">
          <button class="button button-primary" type="button" data-checkout-retry>重新检查订单</button>
          <a class="button button-secondary" href="cart.html">返回意向清单</a>
        </div>
      </div>
    `;
  }

  function checkoutReviewMarkup(quote) {
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
            <h2 id="checkout-review-title">商品明细</h2>
          </div>
          <a class="text-link" href="cart.html">修改清单</a>
        </div>
        <div class="checkout-lines">
          ${(quote.lines || []).map((line) => `
            <article class="checkout-line">
              <div>
                <h3>${escapeHtml(line.productName)}</h3>
                <p>${escapeHtml(line.brandName || "Scent Atoll")} · 数量 ${escapeHtml(line.quantity)}</p>
                ${line.memberDiscountExcluded ? `<span>此商品不参与会员折扣</span>` : ""}
              </div>
              <dl>
                <div><dt>单价</dt><dd>${moneyText(line.unitPriceYuan)}</dd></div>
                <div><dt>小计</dt><dd>${moneyText(line.subtotalAmountYuan)}</dd></div>
              </dl>
            </article>
          `).join("")}
        </div>
        <dl class="checkout-totals" aria-label="订单金额">
          <div><dt>商品小计</dt><dd>${moneyText(quote.subtotalAmountYuan)}</dd></div>
          <div><dt>优惠</dt><dd class="checkout-discount">${totalDiscount > 0 ? `-${moneyText(totalDiscount)}` : moneyText(0)}</dd></div>
          <div><dt>运费</dt><dd>${moneyText(quote.shippingAmountYuan)}${Number(quote.shippingAmountYuan || 0) === 0 ? "（免运费）" : ""}</dd></div>
          <div class="checkout-total-row"><dt>应付总额</dt><dd>${moneyText(quote.paidAmountYuan)}</dd></div>
        </dl>
        ${quote.tier?.name ? `<p class="checkout-tier-note">当前按 ${escapeHtml(quote.tier.name)} 会员权益计价，确认收货后预计获得 ${escapeHtml(quote.pointsToEarn || 0)} 积分。</p>` : ""}
      </section>
    `;
  }

  async function renderCheckoutPage() {
    const mount = $("[data-checkout-page]");
    if (!mount) return;
    if (!state.catalogAvailable) {
      mount.innerHTML = catalogUnavailableMarkup();
      return;
    }
    const items = cartStore.getItems().map((entry) => ({ productId: entry.id, quantity: entry.qty }));
    if (!items.length) {
      mount.innerHTML = `<div class="empty-state"><h2>购物清单是空的</h2><a class="button button-primary" href="shop.html">返回香水列表</a></div>`;
      return;
    }
    try {
      const [quote, addressPayload] = await Promise.all([quoteOrder(items), getAddresses()]);
      const addresses = addressPayload.addresses || [];
      mount.innerHTML = `
        <div class="checkout-layout">
          ${checkoutReviewMarkup(quote)}
          <form class="account-form checkout-form" data-checkout-form>
          <div class="checkout-section-heading"><div><p class="eyebrow">Delivery</p><h2>配送信息</h2></div></div>
          ${addresses.length ? `<label class="field-label">收货地址<select name="addressId" required>${addresses.map((address) => `<option value="${escapeHtml(address.id)}">${escapeHtml(`${address.recipientName} ${address.recipientPhone} ${address.province}${address.city}${address.district || ""}${address.addressLine}`)}</option>`).join("")}</select></label>` : `
            <label class="field-label">收件人<input name="recipientName" required></label>
            <label class="field-label">手机号<input name="recipientPhone" inputmode="tel" required></label>
            <label class="field-label">省份<input name="province" required></label>
            <label class="field-label">城市<input name="city" required></label>
            <label class="field-label">区县<input name="district"></label>
            <label class="field-label">详细地址<input name="addressLine" required></label>`}
          <label class="checkbox-row"><input name="acceptPrivacy" type="checkbox" required><span>我已阅读并同意<a class="text-link" href="privacy.html" target="_blank" rel="noopener">隐私政策</a></span></label>
          <label class="checkbox-row"><input name="acceptTerms" type="checkbox" required><span>我已阅读并同意<a class="text-link" href="terms.html" target="_blank" rel="noopener">服务条款</a></span></label>
          <p class="form-message" data-form-message aria-live="polite"></p>
          <button class="button button-primary" type="submit">提交订单并获取转账指引</button>
          </form>
        </div>`;
      $("[data-checkout-form]", mount)?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (form.dataset.submitting === "true") return;
        const formData = new FormData(form);
        const shippingAddress = addresses.length ? undefined : {
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
        const submitButton = $("button[type='submit']", form);
        form.dataset.submitting = "true";
        if (submitButton) submitButton.disabled = true;
        try {
          const result = await createOrder(orderPayload, requestId);
          const paymentIdempotencyKey = actionIdempotencyKey(form, "payment", { orderId: result.order.id });
          const payment = await startPayment(result.order.id, { idempotencyKey: paymentIdempotencyKey });
          cartStore.clear();
          renderCartShell();
          mount.innerHTML = `<div class="empty-state"><h2>订单 ${escapeHtml(result.order.orderNo)} 已创建</h2><p>${escapeHtml(payment.message)}</p><p>客服微信：<strong>${escapeHtml(payment.contactWechat || "请查看页脚联系方式")}</strong></p><a class="button button-primary" href="orders.html">查看订单</a></div>`;
        } catch (error) {
          setFormMessage(form, checkoutErrorDetails(error).message, "error");
        } finally {
          form.dataset.submitting = "false";
          if (submitButton?.isConnected) submitButton.disabled = false;
        }
      });
    } catch (error) {
      mount.innerHTML = checkoutErrorMarkup(error);
      $("[data-checkout-retry]", mount)?.addEventListener("click", async () => {
        mount.innerHTML = `<div class="empty-state" role="status">正在重新确认价格和库存。</div>`;
        await renderCheckoutPage();
      });
    }
  }

  async function renderAccountPage() {
    const mount = $("[data-account-page]");
    if (!mount) return;
    try {
      const [data, addressPayload] = await Promise.all([getMemberProfile(), getAddresses()]);
      const addresses = addressPayload.addresses || [];
      mount.innerHTML = `
        ${memberNav()}
        <div class="member-dashboard">
          <article>
            <span class="eyebrow">Current tier</span>
            <h2>${escapeHtml(data.tier.name)}</h2>
            <p>当前折扣：${discountLabel(data.tier.discountRate)} · 积分倍数：${escapeHtml(data.tier.pointMultiplier || 1)}x</p>
          </article>
          <article>
            <span class="eyebrow">Points</span>
            <h2>${escapeHtml(data.profile.availablePoints)}</h2>
            <p>可用积分</p>
          </article>
          <article>
            <span class="eyebrow">Lifetime paid</span>
            <h2>${moneyText(data.profile.lifetimePaidAmountYuan)}</h2>
            <p>${data.nextTier ? `距离 ${escapeHtml(data.nextTier.name)} 还差 ${moneyText(data.amountToNextTierYuan)}` : "已达到最高等级"}</p>
          </article>
        </div>
        <form class="account-form compact-account-form" data-profile-form>
          <label class="field-label">姓名<input name="name" value="${escapeHtml(data.user.name || "")}"></label>
          <label class="field-label">生日<input name="birthday" type="date" value="${escapeHtml(data.profile.birthday || "")}"></label>
          <button class="button button-secondary" type="submit">保存资料</button>
        </form>
        <section class="account-form">
          <h2>收货地址</h2>
          <div class="member-table">${addresses.length ? addresses.map((address) => `<article><div><h3>${escapeHtml(address.recipientName)} ${address.isDefault ? "· 默认" : ""}</h3><p>${escapeHtml(`${address.recipientPhone} ${address.province}${address.city}${address.district || ""}${address.addressLine}`)}</p></div><button class="button button-secondary" type="button" data-delete-address="${escapeHtml(address.id)}">删除</button></article>`).join("") : `<div class="empty-state">还没有收货地址。</div>`}</div>
          <form class="compact-account-form" data-address-form>
            <label class="field-label">收件人<input name="recipientName" required></label><label class="field-label">手机号<input name="recipientPhone" required></label>
            <label class="field-label">省份<input name="province" required></label><label class="field-label">城市<input name="city" required></label>
            <label class="field-label">区县<input name="district"></label><label class="field-label">详细地址<input name="addressLine" required></label>
            <label class="checkbox-row"><input name="isDefault" type="checkbox"><span>设为默认地址</span></label>
            <button class="button button-secondary" type="submit">新增地址</button>
          </form>
        </section>
        <section class="account-form"><h2>账号安全</h2><button class="button button-secondary" type="button" data-revoke-sessions>退出其他设备</button>
          <form class="compact-account-form" data-delete-account-form><label class="field-label">输入密码注销账号<input name="password" type="password" autocomplete="current-password" required></label><button class="button button-secondary" type="submit">注销账号</button></form>
        </section>
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
      $("[data-address-form]", mount)?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        try {
          await createAddress({ ...Object.fromEntries(formData.entries()), isDefault: formData.has("isDefault") });
          showToast("收货地址已保存。");
          await renderAccountPage();
        } catch (error) { showToast(error.message); }
      });
      $all("[data-delete-address]", mount).forEach((button) => button.addEventListener("click", async () => {
        if (!window.confirm("确定删除这个收货地址？")) return;
        try { await deleteAddress(button.dataset.deleteAddress); await renderAccountPage(); } catch (error) { showToast(error.message); }
      }));
      $("[data-revoke-sessions]", mount)?.addEventListener("click", async () => {
        try { await revokeOtherSessions(); showToast("其他设备已退出。"); } catch (error) { showToast(error.message); }
      });
      $("[data-delete-account-form]", mount)?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!window.confirm("账号注销后无法恢复，是否继续？")) return;
        try { await deleteMemberAccount(new FormData(event.currentTarget).get("password")); window.location.href = "index.html"; } catch (error) { showToast(error.message); }
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
          <strong>${escapeHtml(profile.profile.availablePoints)}</strong>
          <span>可用积分</span>
        </div>
        <div class="member-table">
          ${points.transactions.length ? points.transactions.map((item) => `
            <article>
              <div>
                <h3>${escapeHtml(pointTypeLabel(item.type))}</h3>
                <p>${escapeHtml(item.note || "")}${item.expiresAt ? ` · 有效至 ${new Date(item.expiresAt).toLocaleDateString("zh-CN")}` : ""}</p>
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
          <strong>${escapeHtml(profile.profile.availablePoints)}</strong>
          <span>可用积分</span>
        </div>
        <div class="mall-grid">
          ${mall.items.length ? mall.items.map((item) => `
            <article class="mall-card">
              <a class="mall-image" href="points-item.html?id=${encodeURIComponent(item.id)}" ${safeImageStyle(item.image, "background-image")}></a>
              <div>
                <p class="eyebrow">${item.stockQuantity > 0 ? `库存 ${item.stockQuantity}` : "已兑完"}</p>
                <h2>${escapeHtml(item.name)}</h2>
                <p>${escapeHtml(item.description || "")}</p>
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
          <div class="mall-detail-image" ${safeImageStyle(item.image, "background-image")}></div>
          <div class="mall-detail-panel">
            <p class="eyebrow">${item.stockQuantity > 0 ? `库存 ${item.stockQuantity}` : "已兑完"}</p>
            <h2>${escapeHtml(item.name)}</h2>
            <p>${escapeHtml(item.description || "")}</p>
            <div class="member-summary compact-summary">
              <strong>${item.pointsPrice}</strong>
              <span>兑换积分 · 你有 ${escapeHtml(profile.profile.availablePoints)} 积分</span>
            </div>
            <form class="account-form compact-account-form" data-redeem-form>
              <label class="field-label">兑换数量<input name="quantity" type="number" min="1" max="${item.stockQuantity}" value="1" required></label>
              <label class="field-label">收件人<input name="recipientName" value="${escapeHtml(profile.user.name || "")}" required></label>
              <label class="field-label">联系电话<input name="recipientPhone" type="tel" inputmode="tel" pattern="1[3-9][0-9]{9}" value="${escapeHtml(profile.user.phone || "")}" required></label>
              <label class="field-label">收货地址<input name="shippingAddress" required></label>
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
                <h3>${escapeHtml(order.orderNo)}</h3>
                <p>${order.items.map((item) => `${escapeHtml(item.name)} x ${escapeHtml(item.quantity)}`).join("、")}</p>
                <p>${order.trackingNo ? `物流单号：${escapeHtml(order.trackingNo)}` : "等待后台处理"}</p>
              </div>
              <strong>${order.totalPoints} 积分</strong>
              <span class="status-badge">${escapeHtml(redemptionStatusLabel(order.status))}</span>
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
                <h3>${escapeHtml(order.orderNo)}</h3>
                <p>${order.items.map((item) => `${escapeHtml(item.productName)} x ${escapeHtml(item.quantity)}`).join("、")}</p>
                <p>会员折扣：${moneyText(order.memberDiscountAmountYuan)} · ${orderPointsText(order)}</p>
                ${order.shipment ? `<p>${escapeHtml(order.shipment.carrier)} · ${escapeHtml(order.shipment.trackingNo)}</p>` : ""}
              </div>
              <strong>${moneyText(order.paidAmountYuan)}</strong>
              <span class="status-badge">${escapeHtml(orderStatusLabel(order.status))}</span>
              ${order.status === "shipped" ? `<button class="button button-secondary" type="button" data-confirm-receipt="${escapeHtml(order.id)}">确认收货</button>` : ""}
              ${order.status === "pending_payment" ? `<button class="button button-secondary" type="button" data-cancel-order="${escapeHtml(order.id)}">取消订单</button>` : ""}
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
      ${current ? `<div class="member-summary"><strong>${escapeHtml(current.tier.name)}</strong><span>${current.nextTier ? `距离 ${escapeHtml(current.nextTier.name)} 还差 ${moneyText(current.amountToNextTierYuan)}` : "已达到最高等级"}</span></div>` : ""}
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

  const adminViews = {
    overview: { label: "概览", title: "今天需要处理的事", description: "先处理会影响客户和库存的事项。" },
    orders: { label: "订单", title: "订单与履约", description: "核对收款、安排发货并处理退款。" },
    products: { label: "商品", title: "商品与库存", description: "维护商品资料、图片、状态和可售库存。" },
    members: { label: "会员", title: "会员", description: "查看会员状态、订单价值和积分余额。" },
    "points-items": { label: "积分商品", title: "积分商品", description: "设置积分价格、库存和上下架状态。" },
    "points-redemptions": { label: "兑换订单", title: "兑换订单", description: "处理积分兑换、发货和取消返还。" },
    "points-ledger": { label: "积分流水", title: "积分流水", description: "追踪积分获得、消耗、过期和人工调整。" },
    more: { label: "更多", title: "更多管理", description: "查看操作日志、导出数据和管理账号安全。" }
  };
  let adminHashListenerBound = false;

  function adminLocationState() {
    const raw = window.location.hash.replace(/^#/, "") || "overview";
    const [requestedView, query = ""] = raw.split("?");
    return {
      view: adminViews[requestedView] ? requestedView : "overview",
      params: new URLSearchParams(query)
    };
  }

  function adminHref(view, values = {}) {
    const query = new URLSearchParams(Object.entries(values).filter(([, value]) => value)).toString();
    return `#${view}${query ? `?${query}` : ""}`;
  }

  function adminNavLink(view, label, activeView) {
    return `<a href="#${view}" class="admin-nav-link ${activeView === view ? "is-active" : ""}" ${activeView === view ? "aria-current=\"page\"" : ""}>${escapeHtml(label)}</a>`;
  }

  function adminRoleLabel(role) {
    return { owner: "Owner", manager: "Manager", support: "客服", fulfillment: "仓库" }[role] || role;
  }

  function adminShellMarkup(session, activeView) {
    const pointsOpen = activeView.startsWith("points-");
    return `
      <div class="admin-app">
        <header class="admin-mobile-bar">
          <a class="admin-mobile-brand" href="#overview"><span class="brand-mark">SA</span><strong>馥屿运营</strong></a>
          <button class="admin-menu-button" type="button" data-admin-nav-toggle aria-expanded="false" aria-controls="admin-sidebar">菜单</button>
        </header>
        <aside class="admin-sidebar" id="admin-sidebar" data-admin-sidebar>
          <div class="admin-brand">
            <a href="#overview" aria-label="返回运营概览"><span class="brand-mark">SA</span><span><strong>馥屿</strong><small>Operations</small></span></a>
          </div>
          <nav class="admin-nav" data-admin-nav aria-label="后台主导航">
            ${adminNavLink("overview", "概览", activeView)}
            ${adminNavLink("orders", "订单", activeView)}
            ${adminNavLink("products", "商品", activeView)}
            ${adminNavLink("members", "会员", activeView)}
            <details class="admin-nav-group" ${pointsOpen ? "open" : ""}>
              <summary class="${pointsOpen ? "is-active" : ""}">积分商城</summary>
              <div>
                ${adminNavLink("points-items", "积分商品", activeView)}
                ${adminNavLink("points-redemptions", "兑换订单", activeView)}
                ${adminNavLink("points-ledger", "积分流水", activeView)}
              </div>
            </details>
            ${adminNavLink("more", "更多", activeView)}
          </nav>
          <div class="admin-sidebar-footer">
            <a class="admin-store-link" href="index.html">查看店铺</a>
            <div><strong>${escapeHtml(session.admin.name || "Owner")}</strong><span>${escapeHtml(session.admin.email)}</span></div>
            <button class="text-button" type="button" data-admin-logout>退出后台</button>
          </div>
        </aside>
        <div class="admin-sidebar-scrim" data-admin-sidebar-scrim></div>
        <div class="admin-workspace" id="admin-workspace">
          <header class="admin-page-header">
            <div>
              <p class="admin-kicker">运营后台</p>
              <h1 data-admin-view-title></h1>
              <p data-admin-view-description></p>
            </div>
            <span class="admin-role-badge">${escapeHtml(adminRoleLabel(session.admin.role))}</span>
          </header>
          <section class="admin-view" data-admin-view aria-live="polite"></section>
        </div>
        <dialog class="admin-dialog" data-admin-dialog></dialog>
      </div>
    `;
  }

  function adminLoadingMarkup() {
    return `<div class="admin-skeleton" aria-label="正在读取数据"><span></span><span></span><span></span></div>`;
  }

  function adminEmptyMarkup(title, detail) {
    return `<div class="admin-empty"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p></div>`;
  }

  function adminOrderActions(order) {
    return `
      <div class="admin-record-actions">
        ${order.status === "pending_payment" ? `<button class="button button-primary" type="button" data-admin-pay="${escapeHtml(order.id)}" data-payment-amount="${escapeHtml(order.paidAmountYuan)}" data-order-no="${escapeHtml(order.orderNo)}">确认收款</button>` : ""}
        ${["paid", "processing"].includes(order.status) ? `<button class="button button-secondary" type="button" data-admin-ship="${escapeHtml(order.id)}" data-order-no="${escapeHtml(order.orderNo)}">登记发货</button>` : ""}
        ${order.status === "shipped" ? `<button class="button button-secondary" type="button" data-admin-complete="${escapeHtml(order.id)}" data-order-no="${escapeHtml(order.orderNo)}">代客确认收货</button>` : ""}
        ${["paid", "shipped", "completed"].includes(order.status) ? `<button class="button button-danger" type="button" data-admin-refund="${escapeHtml(order.id)}" data-order-no="${escapeHtml(order.orderNo)}">登记退款</button>` : ""}
      </div>
    `;
  }

  function adminOrdersMarkup(payload, status = "") {
    const orders = payload.orders || [];
    const matchesStatus = (order, value) => value === "fulfillment"
      ? ["paid", "processing"].includes(order.status)
      : !value || order.status === value;
    const filtered = orders.filter((order) => matchesStatus(order, status));
    const filters = [
      ["", "全部"], ["pending_payment", "待核款"], ["fulfillment", "待发货"], ["shipped", "已发货"], ["completed", "已完成"], ["refunded", "已退款"]
    ];
    return `
      <div class="admin-toolbar">
        <label class="admin-search"><span>搜索订单</span><input type="search" data-admin-list-search placeholder="订单号、商品或客户"></label>
        <nav class="admin-filter-row" aria-label="订单状态筛选">
          ${filters.map(([value, label]) => `<a href="${adminHref("orders", { status: value })}" class="${status === value ? "is-active" : ""}">${label}<span>${orders.filter((order) => matchesStatus(order, value)).length}</span></a>`).join("")}
        </nav>
      </div>
      <div class="admin-record-list" data-admin-record-list>
        ${filtered.map((order) => {
          const customer = order.shippingAddress?.recipientName || order.user?.name || order.user?.email || "会员";
          const search = [order.orderNo, customer, ...order.items.map((item) => item.productName)].join(" ").toLowerCase();
          return `
            <details class="admin-record" data-admin-search-value="${escapeHtml(search)}">
              <summary>
                <span><strong>${escapeHtml(order.orderNo)}</strong><small>${escapeHtml(customer)} · ${order.items.length} 件商品</small></span>
                <span class="status-badge status-${escapeHtml(order.status)}">${escapeHtml(orderStatusLabel(order.status))}</span>
                <strong class="admin-record-amount">${moneyText(order.paidAmountYuan)}</strong>
              </summary>
              <div class="admin-record-detail">
                <div class="admin-detail-grid">
                  <div><span>商品</span><strong>${order.items.map((item) => `${escapeHtml(item.productName)} x ${escapeHtml(item.quantity)}`).join("、")}</strong></div>
                  <div><span>积分状态</span><strong>${escapeHtml(orderPointsText(order))}</strong></div>
                  <div><span>收货地址</span><strong>${order.shippingAddress ? escapeHtml(`${order.shippingAddress.province}${order.shippingAddress.city}${order.shippingAddress.district || ""}${order.shippingAddress.addressLine}`) : "未记录"}</strong></div>
                  <div><span>物流</span><strong>${order.shipment ? escapeHtml(`${order.shipment.carrier} ${order.shipment.trackingNo}`) : "未发货"}</strong></div>
                </div>
                ${adminOrderActions(order)}
              </div>
            </details>
          `;
        }).join("") || adminEmptyMarkup("没有符合条件的订单", "调整筛选条件或搜索其他订单。")}
      </div>
    `;
  }

  function adminMembersMarkup(payload) {
    const members = payload.members || [];
    return `
      <div class="admin-toolbar">
        <label class="admin-search"><span>搜索会员</span><input type="search" data-admin-list-search placeholder="姓名、邮箱或手机"></label>
      </div>
      <div class="admin-record-list" data-admin-record-list>
        ${members.map((member) => {
          const name = member.user.name || member.user.email || member.user.phone;
          const search = [name, member.user.email, member.user.phone].filter(Boolean).join(" ").toLowerCase();
          return `
            <details class="admin-record" data-admin-search-value="${escapeHtml(search)}">
              <summary>
                <span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(member.user.email || member.user.phone)}</small></span>
                <span>${escapeHtml(member.tier.name)}</span>
                <strong class="admin-record-amount">${escapeHtml(member.profile.availablePoints)} 积分</strong>
              </summary>
              <div class="admin-record-detail">
                <div class="admin-detail-grid">
                  <div><span>累计有效消费</span><strong>${moneyText(member.profile.lifetimePaidAmountYuan)}</strong></div>
                  <div><span>加入时间</span><strong>${new Date(member.user.createdAt).toLocaleDateString("zh-CN")}</strong></div>
                </div>
                <form class="admin-inline-form" data-admin-points-form="${escapeHtml(member.user.id)}">
                  <label class="field-label">积分变动<input name="points" type="number" step="1" placeholder="+100 或 -50" required></label>
                  <label class="field-label">调整原因<input name="reason" value="后台积分调整" required></label>
                  <button class="button button-secondary" type="submit">检查并调整</button>
                </form>
              </div>
            </details>
          `;
        }).join("") || adminEmptyMarkup("还没有会员", "新会员注册后会显示在这里。")}
      </div>
    `;
  }

  function adminMallItemsMarkup(payload) {
    const items = payload.items || [];
    return `
      <details class="admin-create-panel" ${items.length ? "" : "open"}>
        <summary>新增积分商品</summary>
        <form class="admin-inline-form admin-create-form" data-admin-mall-item-form>
          <label class="field-label">名称<input name="name" required></label>
          <label class="field-label">关联商品 ID<input name="productId" placeholder="可选"></label>
          <label class="field-label">积分价格<input name="pointsPrice" type="number" min="1" required></label>
          <label class="field-label">库存<input name="stockQuantity" type="number" min="0" required></label>
          <button class="button button-primary" type="submit">创建积分商品</button>
        </form>
      </details>
      <div class="admin-record-list">
        ${items.map((item) => `
          <article class="admin-simple-record">
            <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(mallItemStatusLabel(item.status))}</small></span>
            <span>${escapeHtml(item.pointsPrice)} 积分</span>
            <span>库存 ${escapeHtml(item.stockQuantity)}</span>
            <div class="admin-record-actions">
              ${item.status === "active" ? `<button class="button button-secondary" type="button" data-admin-mall-deactivate="${escapeHtml(item.id)}">下架</button>` : ""}
              ${item.status !== "active" && item.stockQuantity > 0 ? `<button class="button button-secondary" type="button" data-admin-mall-activate="${escapeHtml(item.id)}">上架</button>` : ""}
            </div>
          </article>
        `).join("") || adminEmptyMarkup("还没有积分商品", "创建第一件积分商品后即可开始兑换。")}
      </div>
    `;
  }

  function adminRedemptionsMarkup(payload, status = "") {
    const all = payload.redemptions || [];
    const redemptions = status ? all.filter((item) => item.status === status) : all;
    return `
      <nav class="admin-filter-row" aria-label="兑换订单状态筛选">
        ${[["", "全部"], ["pending_fulfillment", "待处理"], ["processing", "处理中"], ["shipped", "已发货"], ["completed", "已完成"]].map(([value, label]) => `<a href="${adminHref("points-redemptions", { status: value })}" class="${status === value ? "is-active" : ""}">${label}<span>${value ? all.filter((item) => item.status === value).length : all.length}</span></a>`).join("")}
      </nav>
      <div class="admin-record-list">
        ${redemptions.map((order) => `
          <details class="admin-record">
            <summary>
              <span><strong>${escapeHtml(order.orderNo)}</strong><small>${escapeHtml(order.user?.name || order.user?.email || order.user?.phone || "未知会员")}</small></span>
              <span class="status-badge">${escapeHtml(redemptionStatusLabel(order.status))}</span>
              <strong class="admin-record-amount">${order.totalPoints} 积分</strong>
            </summary>
            <div class="admin-record-detail">
              <p>${order.items.map((item) => `${escapeHtml(item.name)} x ${escapeHtml(item.quantity)}`).join("、")}</p>
              <div class="admin-record-actions">
                ${order.status === "pending_fulfillment" ? `<button class="button button-secondary" type="button" data-admin-redemption-status="${escapeHtml(order.id)}" data-status="processing">开始处理</button>` : ""}
                ${["pending_fulfillment", "processing"].includes(order.status) ? `<button class="button button-primary" type="button" data-admin-redemption-status="${escapeHtml(order.id)}" data-status="shipped">登记发货</button>` : ""}
                ${order.status === "shipped" ? `<button class="button button-secondary" type="button" data-admin-redemption-status="${escapeHtml(order.id)}" data-status="completed">标记完成</button>` : ""}
                ${!["cancelled", "completed"].includes(order.status) ? `<button class="button button-danger" type="button" data-admin-redemption-cancel="${escapeHtml(order.id)}" data-order-no="${escapeHtml(order.orderNo)}">取消兑换</button>` : ""}
              </div>
            </div>
          </details>
        `).join("") || adminEmptyMarkup("没有符合条件的兑换订单", "新的积分兑换会显示在这里。")}
      </div>
    `;
  }

  function adminPointsMarkup(payload) {
    const transactions = payload.transactions || [];
    return `<div class="admin-record-list">
      ${transactions.map((item) => `
        <article class="admin-simple-record admin-ledger-row">
          <span><strong>${escapeHtml(pointTypeLabel(item.type))}</strong><small>${escapeHtml(item.user?.name || item.user?.email || item.user?.phone || "未知会员")}${item.orderNo ? ` · ${escapeHtml(item.orderNo)}` : ""}</small></span>
          <strong class="${item.points < 0 ? "is-negative" : "is-positive"}">${item.points > 0 ? "+" : ""}${item.points}</strong>
          <span>${new Date(item.createdAt).toLocaleString("zh-CN")}</span>
        </article>
      `).join("") || adminEmptyMarkup("暂无积分流水", "订单结算或人工调整后会显示记录。")}
    </div>`;
  }

  function adminMoreMarkup(payload, session) {
    const logs = payload.logs || [];
    const securityMarkup = session.admin.role === "owner" ? `
      <section class="admin-security-section" aria-labelledby="admin-security-title">
        <div class="admin-section-heading">
          <div><h2 id="admin-security-title">账号安全</h2><p>修改密码会自动退出此 Owner 在其他设备上的后台会话。</p></div>
        </div>
        <div class="admin-security-grid">
          <form class="admin-security-form" data-admin-change-password>
            <h3>修改后台密码</h3>
            <label class="field-label">当前密码<input name="currentPassword" type="password" autocomplete="current-password" required></label>
            <label class="field-label">新密码<input name="newPassword" type="password" minlength="14" autocomplete="new-password" aria-describedby="admin-password-hint" required></label>
            <p id="admin-password-hint">至少 14 位，且不能与当前密码相同。</p>
            <label class="field-label">再次输入新密码<input name="confirmPassword" type="password" minlength="14" autocomplete="new-password" required></label>
            <p class="form-message" data-form-message aria-live="polite"></p>
            <button class="button button-primary" type="submit">更新密码</button>
          </form>
          <form class="admin-security-form" data-admin-revoke-sessions-form>
            <h3>登录设备</h3>
            <p>发现陌生登录或使用过公用电脑时，可退出除当前浏览器外的所有后台会话。</p>
            <p class="form-message" data-form-message aria-live="polite"></p>
            <button class="button button-secondary" type="submit">退出其他设备</button>
          </form>
        </div>
      </section>
    ` : `
      <section class="admin-security-section" aria-labelledby="admin-security-title">
        <div class="admin-section-heading"><div><h2 id="admin-security-title">账号安全</h2><p>后台密码和会话由 Owner 统一管理。</p></div></div>
      </section>
    `;
    return `
      ${securityMarkup}
      <section class="admin-more-actions" aria-labelledby="admin-data-title">
        <div><h2 id="admin-data-title">数据与退出</h2><p>低频操作集中在这里，避免打断日常订单处理。</p></div>
        <div class="button-row"><button class="button button-secondary" type="button" data-admin-export>导出会员名单</button><button class="button button-secondary" type="button" data-admin-logout>退出后台</button></div>
      </section>
      <section class="admin-log-section">
        <div class="admin-section-heading"><h2>操作日志</h2><span>最近 ${Math.min(logs.length, 50)} 条</span></div>
        <div class="admin-record-list">
          ${logs.slice(0, 50).map((item) => `<article class="admin-simple-record"><span><strong>${escapeHtml(adminActionLabel(item.action))}</strong><small>${escapeHtml(item.reason || item.entityType)} · ${escapeHtml(item.actor)}</small></span><span>${new Date(item.createdAt).toLocaleString("zh-CN")}</span></article>`).join("") || adminEmptyMarkup("暂无操作日志", "敏感操作完成后会记录在这里。")}
        </div>
      </section>
    `;
  }

  function adminOverviewMarkup(ordersPayload, redemptionsPayload, productsPayload, logsPayload) {
    const orders = ordersPayload.orders || [];
    const redemptions = redemptionsPayload.redemptions || [];
    const products = productsPayload.products || [];
    const tasks = [
      { label: "待核款", count: orders.filter((item) => item.status === "pending_payment").length, detail: "核对微信转账", href: adminHref("orders", { status: "pending_payment" }) },
      { label: "待发货", count: orders.filter((item) => ["paid", "processing"].includes(item.status)).length, detail: "填写物流信息", href: adminHref("orders", { status: "fulfillment" }) },
      { label: "待处理兑换", count: redemptions.filter((item) => item.status === "pending_fulfillment").length, detail: "积分商品出库", href: adminHref("points-redemptions", { status: "pending_fulfillment" }) },
      { label: "低库存", count: products.filter((item) => item.availableQuantity > 0 && item.availableQuantity <= 3).length, detail: "补货或调整状态", href: adminHref("products", { stock: "low" }) }
    ];
    const recentOrders = orders.slice(0, 6);
    const logs = (logsPayload.logs || []).slice(0, 6);
    return `
      <section class="admin-task-section" aria-labelledby="admin-task-title">
        <div class="admin-section-heading"><h2 id="admin-task-title">今日待办</h2><span>${tasks.reduce((sum, item) => sum + item.count, 0)} 项待处理</span></div>
        <div class="admin-task-list">
          ${tasks.map((item) => `<a href="${item.href}"><span><strong>${item.label}</strong><small>${item.detail}</small></span><b>${item.count}</b><span aria-hidden="true">→</span></a>`).join("")}
        </div>
      </section>
      <div class="admin-overview-columns">
        <section>
          <div class="admin-section-heading"><h2>近期订单</h2><a href="#orders">查看全部</a></div>
          <div class="admin-compact-list">${recentOrders.map((order) => `<a href="${adminHref("orders", { status: order.status })}"><span><strong>${escapeHtml(order.orderNo)}</strong><small>${escapeHtml(orderStatusLabel(order.status))}</small></span><b>${moneyText(order.paidAmountYuan)}</b></a>`).join("") || adminEmptyMarkup("暂无订单", "新订单会显示在这里。")}</div>
        </section>
        <section>
          <div class="admin-section-heading"><h2>最近操作</h2><a href="#more">查看日志</a></div>
          <div class="admin-compact-list">${logs.map((item) => `<div><span><strong>${escapeHtml(adminActionLabel(item.action))}</strong><small>${escapeHtml(item.actor)}</small></span><time>${new Date(item.createdAt).toLocaleDateString("zh-CN")}</time></div>`).join("") || adminEmptyMarkup("暂无操作", "操作记录会显示在这里。")}</div>
        </section>
      </div>
    `;
  }

  function bindAdminListSearch(root) {
    const input = $("[data-admin-list-search]", root);
    if (!input) return;
    input.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();
      $all("[data-admin-search-value]", root).forEach((item) => {
        item.hidden = Boolean(query) && !item.dataset.adminSearchValue.includes(query);
      });
    });
  }

  async function requestAdminAction({ title, description, confirmLabel, danger = false, fields = [] }) {
    const dialog = $("[data-admin-dialog]");
    if (!dialog) return null;
    dialog.innerHTML = `
      <form method="dialog" class="admin-dialog-form">
        <header><p class="admin-kicker">敏感操作</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></header>
        <div class="admin-dialog-fields">${fields.map((field) => `<label class="field-label">${escapeHtml(field.label)}<input name="${escapeHtml(field.name)}" type="${escapeHtml(field.type || "text")}" value="${escapeHtml(field.value || "")}" ${field.required === false ? "" : "required"} ${field.step ? `step="${escapeHtml(field.step)}"` : ""}></label>`).join("")}</div>
        <div class="admin-dialog-actions"><button class="button button-secondary" value="cancel" formnovalidate>返回检查</button><button class="button ${danger ? "button-danger" : "button-primary"}" value="confirm">${escapeHtml(confirmLabel)}</button></div>
      </form>
    `;
    const form = $("form", dialog);
    return new Promise((resolve) => {
      dialog.addEventListener("close", () => {
        resolve(dialog.returnValue === "confirm" ? Object.fromEntries(new FormData(form)) : null);
      }, { once: true });
      dialog.showModal();
      $("input", dialog)?.focus();
    });
  }

  async function bindAdminViewForms(view, data) {
    const mount = $("[data-admin-page]");
    if (!mount) return;
    const products = data?.products || [];
    const productsById = new Map(products.map((product) => [product.id, product]));
    $("[data-admin-change-password]", mount)?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      const currentPassword = String(formData.get("currentPassword") || "");
      const newPassword = String(formData.get("newPassword") || "");
      const confirmPassword = String(formData.get("confirmPassword") || "");
      if (newPassword !== confirmPassword) {
        setFormMessage(form, "两次输入的新密码不一致。", "error");
        $("[name='confirmPassword']", form)?.focus();
        return;
      }
      const submitButton = $("button[type='submit']", form);
      if (submitButton) submitButton.disabled = true;
      setFormMessage(form, "正在更新密码...");
      try {
        await adminChangePassword({ currentPassword, newPassword });
        form.reset();
        setFormMessage(form, "密码已更新，其他设备已退出后台。", "success");
      } catch (error) {
        setFormMessage(form, error.message, "error");
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
    $("[data-admin-revoke-sessions-form]", mount)?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submitButton = $("button[type='submit']", form);
      if (submitButton) submitButton.disabled = true;
      setFormMessage(form, "正在退出其他设备...");
      try {
        const result = await adminRevokeOtherSessions();
        setFormMessage(form, `已退出 ${Number(result.revokedSessions || 0)} 个其他后台会话。`, "success");
      } catch (error) {
        setFormMessage(form, error.message, "error");
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
    $("[data-admin-mall-item-form]", mount)?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      const payload = { name: formData.get("name"), productId: formData.get("productId"), pointsPrice: Number(formData.get("pointsPrice")), stockQuantity: Number(formData.get("stockQuantity")), status: "active" };
      payload.idempotencyKey = actionIdempotencyKey(form, "mall-create", payload);
      try { await adminCreateMallItem(payload); showToast("积分商品已创建。"); await renderAdminPage(); }
      catch (error) { showToast(error.message); }
    });
    $("[data-admin-product-create]", mount)?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = adminProductPayload(form);
      payload.idempotencyKey = actionIdempotencyKey(form, "product-create", payload);
      try { await adminCreateProduct(payload); showToast("商品草稿已创建。"); await renderAdminPage(); }
      catch (error) { showToast(error.message); }
    });
    $all("[data-admin-product-edit]", mount).forEach((form) => form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = adminProductPayload(form);
      payload.idempotencyKey = actionIdempotencyKey(form, "product-update", payload);
      try { await adminUpdateProduct(form.dataset.adminProductEdit, payload); showToast("商品已保存。"); await renderAdminPage(); }
      catch (error) { showToast(error.message); }
    }));
    $all("[data-admin-points-form]", mount).forEach((form) => form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const payload = { points: Number(formData.get("points")), reason: formData.get("reason") || "后台积分调整" };
      const confirmed = await requestAdminAction({ title: "确认调整会员积分", description: `会员积分将变动 ${payload.points > 0 ? "+" : ""}${payload.points}，操作会写入审计日志。`, confirmLabel: "确认调整积分", danger: payload.points < 0 });
      if (!confirmed) return;
      payload.idempotencyKey = actionIdempotencyKey(form, "points", payload);
      try { await adminAdjustMemberPoints(form.dataset.adminPointsForm, payload); showToast("会员积分已调整。"); await renderAdminPage(); }
      catch (error) { showToast(error.message); }
    }));
    $all("[data-admin-image-upload]", mount).forEach((form) => form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const file = formData.get("image");
      const fileError = adminImageFileError(file);
      if (fileError) return setFormMessage(form, fileError, "error");
      const product = productsById.get(form.dataset.adminImageUpload);
      if (!product) return setFormMessage(form, "商品数据已变化，请刷新后重试。", "error");
      const submitButton = $("button[type='submit']", form);
      setFormMessage(form, "正在上传图片...");
      if (submitButton) submitButton.disabled = true;
      try { await adminUploadProductImage(product.id, file, { alt: formData.get("alt") || product.name, role: formData.has("isHero") || !(product.images || []).length ? "hero" : "gallery" }); showToast("商品图片已上传。"); await renderAdminPage(); }
      catch (error) { setFormMessage(form, error.message, "error"); }
      finally { if (submitButton?.isConnected) submitButton.disabled = false; }
    }));
    $all("[data-admin-image-replace]", mount).forEach((form) => form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const file = formData.get("image");
      const fileError = adminImageFileError(file);
      if (fileError) return setFormMessage(form, fileError, "error");
      const product = productsById.get(form.dataset.productId);
      const images = orderedProductImages(product);
      const imageIndex = images.findIndex((image) => image.id === form.dataset.adminImageReplace);
      const previous = images[imageIndex];
      if (!previous) return setFormMessage(form, "原图片已变化，请刷新后重试。", "error");
      const submitButton = $("button[type='submit']", form);
      setFormMessage(form, "正在上传替换图片...");
      if (submitButton) submitButton.disabled = true;
      try {
        const uploaded = await adminUploadProductImage(product.id, file, { alt: previous.alt || product.name, role: product.heroImageUrl === previous.imageUrl ? "hero" : "gallery" });
        await adminDeleteProductImage(product.id, previous.id);
        const nextImages = images.slice();
        nextImages[imageIndex] = uploaded.image;
        await saveProductImageOrder(product, nextImages, "后台替换商品图片", product.heroImageUrl === previous.imageUrl ? uploaded.image.imageUrl : product.heroImageUrl);
        showToast("商品图片已替换。");
        await renderAdminPage();
      } catch (error) { setFormMessage(form, `${error.message} 请刷新后核对图片列表。`, "error"); }
      finally { if (submitButton?.isConnected) submitButton.disabled = false; }
    }));
    $all("[data-admin-image-move]", mount).forEach((button) => button.addEventListener("click", async () => {
      const product = productsById.get(button.dataset.productId);
      const images = orderedProductImages(product);
      const currentIndex = images.findIndex((image) => image.id === button.dataset.adminImageMove);
      const targetIndex = currentIndex + Number(button.dataset.direction);
      if (!product || currentIndex < 0 || targetIndex < 0 || targetIndex >= images.length) return;
      [images[currentIndex], images[targetIndex]] = [images[targetIndex], images[currentIndex]];
      button.disabled = true;
      try { await saveProductImageOrder(product, images, "后台调整商品图片顺序"); showToast("图片顺序已更新。"); await renderAdminPage(); }
      catch (error) { button.disabled = false; showToast(error.message); }
    }));
    $all("[data-admin-image-primary]", mount).forEach((button) => button.addEventListener("click", async () => {
      const product = productsById.get(button.dataset.productId);
      const images = orderedProductImages(product);
      const image = images.find((item) => item.id === button.dataset.adminImagePrimary);
      if (!product || !image) return;
      button.disabled = true;
      try { await saveProductImageOrder(product, images, "后台设置商品主图", image.imageUrl); showToast("商品主图已更新。"); await renderAdminPage(); }
      catch (error) { button.disabled = false; showToast(error.message); }
    }));
    $all("[data-admin-image-delete]", mount).forEach((button) => button.addEventListener("click", async () => {
      const product = productsById.get(button.dataset.productId);
      const images = orderedProductImages(product);
      if (!product || (product.status === "active" && images.length === 1)) return;
      const confirmed = await requestAdminAction({ title: "删除商品图片", description: "图片记录和对应的 Vercel Blob 文件都会被删除，此操作不能撤销。", confirmLabel: "删除图片", danger: true });
      if (!confirmed) return;
      button.disabled = true;
      try { await adminDeleteProductImage(product.id, button.dataset.adminImageDelete); showToast("商品图片已删除。"); await renderAdminPage(); }
      catch (error) { button.disabled = false; showToast(error.message); }
    }));
    $all("[data-admin-inventory-form]", mount).forEach((form) => form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const payload = { mode: "adjust", quantityDelta: Number(formData.get("quantityDelta")), reason: formData.get("reason") || "后台库存调整" };
      const confirmed = await requestAdminAction({ title: "确认调整库存", description: `可售库存将变动 ${payload.quantityDelta > 0 ? "+" : ""}${payload.quantityDelta}，请确认实物库存已经核对。`, confirmLabel: "确认调整库存", danger: payload.quantityDelta < 0 });
      if (!confirmed) return;
      payload.idempotencyKey = actionIdempotencyKey(form, "inventory", payload);
      try { await adminAdjustProductInventory(form.dataset.adminInventoryForm, form.dataset.variantId, payload); showToast("库存已调整。"); await renderAdminPage(); }
      catch (error) { showToast(error.message); }
    }));
  }

  async function renderAdminView(session) {
    const { view, params: viewParams } = adminLocationState();
    const meta = adminViews[view];
    const root = $("[data-admin-page]");
    const content = $("[data-admin-view]", root);
    if (!content) return;
    $("[data-admin-view-title]", root).textContent = meta.title;
    $("[data-admin-view-description]", root).textContent = meta.description;
    $all(".admin-nav-link", root).forEach((link) => {
      const active = link.getAttribute("href") === `#${view}`;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
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
      const sidebar = $("[data-admin-sidebar]", root);
      sidebar?.classList.remove("is-open");
      $("[data-admin-nav-toggle]", root)?.setAttribute("aria-expanded", "false");
    } catch (error) {
      content.innerHTML = `<div class="admin-error" role="alert"><h2>后台数据没有读取成功</h2><p>${escapeHtml(error.message)}</p><button class="button button-secondary" type="button" data-admin-retry>重新读取</button></div>`;
      $("[data-admin-retry]", content)?.addEventListener("click", () => renderAdminView(session));
    }
  }

  async function renderAdminPage() {
    const mount = $("[data-admin-page]");
    if (!mount) return;
    let session;
    try {
      session = await getCurrentAdmin();
    } catch {
      mount.innerHTML = `<div class="admin-access-state"><span class="brand-mark">SA</span><h1>请登录运营账户</h1><p>使用统一登录入口验证身份后，系统会自动进入对应账户。</p><a class="button button-primary" href="login.html">前往账户登录</a></div>`;
      return;
    }
    const { view } = adminLocationState();
    mount.innerHTML = adminShellMarkup(session, view);
    const sidebar = $("[data-admin-sidebar]", mount);
    const toggle = $("[data-admin-nav-toggle]", mount);
    const closeSidebar = () => { sidebar?.classList.remove("is-open"); toggle?.setAttribute("aria-expanded", "false"); };
    toggle?.addEventListener("click", () => {
      const open = !sidebar?.classList.contains("is-open");
      sidebar?.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
    $("[data-admin-sidebar-scrim]", mount)?.addEventListener("click", closeSidebar);
    $all("a", sidebar).forEach((link) => link.addEventListener("click", closeSidebar));
    if (!adminHashListenerBound) {
      window.addEventListener("hashchange", () => renderAdminPage());
      adminHashListenerBound = true;
    }
    await renderAdminView(session);
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
      pending_payment: "待核款",
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
    if (order.status === "refunded") return order.pointsAwarded ? "已退款，积分已撤回" : "已退款，不发放积分";
    if (order.pointsAwarded) return `已发放积分：${order.pointsAwarded}`;
    if (["paid", "processing", "shipped"].includes(order.status)) return "确认收货后发放积分";
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
      cancel_points_redemption: "取消兑换订单",
      create_product: "新增商品",
      update_product: "更新商品",
      activate_product: "上架商品",
      deactivate_product: "下架商品",
      archive_product: "归档商品",
      adjust_product_inventory: "调整商品库存",
      upload_product_image: "上传商品图片",
      delete_product_image: "删除商品图片",
      ship_order: "登记订单发货",
      release_expired_reservations: "释放超时库存"
    }[action] || action;
  }

  function refreshMemberQuote() {
    const mounts = $all("[data-member-quote]");
    if (!mounts.length) return;
    mounts.forEach((mount) => {
      mount.textContent = "试运营期间采用微信人工转账。登录后可提交订单，库存会短时预留，待后台核对转账后确认收款。";
    });
  }

  function addToCart(id, trigger) {
    if (!state.catalogAvailable) {
      showToast("商品服务暂时不可用，请重新加载后再试。");
      return;
    }
    try {
      const item = cartStore.addItem(id);
      renderCartShell();
      renderCartPage();
      refreshMemberQuote();
      openCart(trigger);
      showToast(`${item.name} 已加入意向清单`);
    } catch (error) {
      showToast(error.message);
    }
  }

  function changeCart(id, delta, control) {
    const wasOpen = $("[data-cart-drawer]")?.classList.contains("open");
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
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
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
          showToast("已退出登录。");
          window.location.href = "index.html";
        } catch (error) {
          showToast(error.message);
        }
      }
      if (adminPay) {
        const confirmed = await requestAdminAction({
          title: `确认订单 ${adminPay.dataset.orderNo || ""} 已收款`,
          description: `请先在微信中核对到账金额。订单应收 ${moneyText(adminPay.dataset.paymentAmount || 0)}，确认后将扣减库存并记录操作人。`,
          confirmLabel: "确认已经收款",
          fields: [
            { name: "paymentAmount", label: "实际到账金额", type: "number", step: "0.01", value: adminPay.dataset.paymentAmount },
            { name: "paymentReference", label: "微信转账单号或对账参考号" }
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
          showToast("订单已确认支付，等待客户确认收货后结算积分和等级。");
          await renderOrdersPage();
          await renderAdminPage();
          await initAuthHeader();
        } catch (error) {
          showToast(error.message);
        }
      }
      if (adminShip) {
        const confirmed = await requestAdminAction({
          title: `登记订单 ${adminShip.dataset.orderNo || ""} 发货`,
          description: "物流信息会发送给客户。提交前请检查公司名称和单号。",
          confirmLabel: "确认登记发货",
          fields: [
            { name: "carrier", label: "物流公司" },
            { name: "trackingNo", label: "物流单号" }
          ]
        });
        if (!confirmed) return;
        const { carrier, trackingNo } = confirmed;
        const shipmentPayload = { carrier, trackingNo };
        shipmentPayload.idempotencyKey = actionIdempotencyKey(adminShip, "order-ship", shipmentPayload);
        try { await adminShipOrder(adminShip.dataset.adminShip, shipmentPayload); showToast("发货信息已保存。"); await renderAdminPage(); }
        catch (error) { showToast(error.message); }
      }
      if (cancelMemberOrder) {
        if (!window.confirm("确定取消这个订单？")) return;
        const idempotencyKey = actionIdempotencyKey(cancelMemberOrder, "order-cancel");
        try { await cancelOrder(cancelMemberOrder.dataset.cancelOrder, "member_cancelled", idempotencyKey); showToast("订单已取消。"); await renderOrdersPage(); }
        catch (error) { showToast(error.message); }
      }
      if (confirmReceipt) {
        if (!window.confirm("确认已经收到商品？确认后将结算积分和会员等级。")) return;
        const idempotencyKey = actionIdempotencyKey(confirmReceipt, "order-receive");
        try {
          await confirmReceiptOrder(confirmReceipt.dataset.confirmReceipt, idempotencyKey);
          resetSessionCache();
          showToast("已确认收货，积分和等级已结算。");
          await renderOrdersPage();
          await initAuthHeader();
        } catch (error) {
          showToast(error.message);
        }
      }
      if (adminComplete) {
        const confirmed = await requestAdminAction({
          title: `代客确认订单 ${adminComplete.dataset.orderNo || ""} 已收货`,
          description: "确认后将结算会员积分和等级。只有已经核实客户收货时才能继续。",
          confirmLabel: "确认客户已经收货"
        });
        if (!confirmed) return;
        const idempotencyKey = actionIdempotencyKey(adminComplete, "admin-complete");
        try {
          await adminCompleteOrder(adminComplete.dataset.adminComplete, idempotencyKey);
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
        const confirmed = await requestAdminAction({
          title: `登记订单 ${adminRefund.dataset.orderNo || ""} 退款`,
          description: "确认后将恢复库存，并撤回相关积分和累计消费。请先完成实际退款转账。",
          confirmLabel: "确认已经退款",
          danger: true,
          fields: [
            { name: "refundReference", label: "退款转账参考号" },
            { name: "reason", label: "退款原因", value: "后台人工退款" }
          ]
        });
        if (!confirmed) return;
        const refundPayload = { refundReference: confirmed.refundReference, reason: confirmed.reason };
        refundPayload.idempotencyKey = actionIdempotencyKey(adminRefund, "admin-refund", refundPayload);
        try {
          await adminRefundOrder(adminRefund.dataset.adminRefund, refundPayload);
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
        const idempotencyKey = actionIdempotencyKey(node, `mall-${action}`);
        try {
          await adminSetMallItemStatus(node.dataset.adminMallActivate || node.dataset.adminMallDeactivate, action, idempotencyKey);
          showToast(action === "activate" ? "积分商品已上架。" : "积分商品已下架。");
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
            title: "归档商品",
            description: "归档后商品不会出现在店铺中。历史订单仍会保留商品快照。",
            confirmLabel: "确认归档商品",
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
          showToast(action === "activate" ? "商品已上架。" : action === "deactivate" ? "商品已下架。" : "商品已归档。");
          await renderAdminPage();
        } catch (error) {
          showToast(error.message);
        }
      }
      if (adminRedemptionStatus) {
        const isShipping = adminRedemptionStatus.dataset.status === "shipped";
        const confirmed = isShipping
          ? await requestAdminAction({ title: "登记兑换订单发货", description: "提交后会员可以看到兑换订单已发货。", confirmLabel: "确认登记发货", fields: [{ name: "trackingNo", label: "物流单号", required: false }] })
          : { trackingNo: "" };
        if (!confirmed) return;
        const trackingNo = confirmed.trackingNo || "";
        const redemptionPayload = {
          status: adminRedemptionStatus.dataset.status,
          trackingNo
        };
        redemptionPayload.idempotencyKey = actionIdempotencyKey(adminRedemptionStatus, "redeem-status", redemptionPayload);
        try {
          await adminUpdateRedemptionStatus(adminRedemptionStatus.dataset.adminRedemptionStatus, redemptionPayload);
          showToast("兑换订单状态已更新。");
          await renderAdminPage();
        } catch (error) {
          showToast(error.message);
        }
      }
      if (adminRedemptionCancel) {
        const confirmed = await requestAdminAction({
          title: `取消兑换 ${adminRedemptionCancel.dataset.orderNo || ""}`,
          description: "兑换订单会取消，已经扣除的积分和商品库存将返还。",
          confirmLabel: "取消兑换并返还",
          danger: true
        });
        if (!confirmed) return;
        const idempotencyKey = actionIdempotencyKey(adminRedemptionCancel, "redeem-cancel");
        try {
          await adminCancelRedemption(adminRedemptionCancel.dataset.adminRedemptionCancel, idempotencyKey);
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
