# 气味档案网页修复计划：购物车结账与公共布局

## 背景

当前网页已经具备完整的静态多页面结构，包括首页、商品列表、品牌、试香套装、选香指南、文章、商品详情和购物车抽屉。

本阶段只修复两个问题：

1. 购物车和结账流程目前只是前端模拟，缺少可接真实业务的结构。
2. Header、Footer、购物车挂载点等公共布局在多个 HTML 文件中重复维护。

目标不是立刻接入真实支付，而是先把项目改成后续可扩展、可维护的结构。

## 阶段 1：重构公共布局

### 目标

消除每个 HTML 文件里重复复制的 Header、Footer、购物车挂载点和公共脚本引用。

改造后，导航、页脚、全站搜索、购物车入口等公共区域只需要维护一份。

### 推荐方案

使用 Eleventy 加 Nunjucks 模板。

原因：

- 当前项目是多页面静态站，Eleventy 很适合。
- 构建后仍然输出普通 HTML，部署成本低。
- 每个页面可以保留独立 URL，例如 `index.html`、`shop.html`、`product.html`。
- 后续可以继续使用现有 `styles.css`、`script.js` 和 `data.js`。

### 目录建议

```text
src/
  _includes/
    layout.njk
    header.njk
    footer.njk
    cart-shell.njk
  pages/
    index.njk
    shop.njk
    product.njk
    brands.njk
    brand.njk
    samples.njk
    guide.njk
    journal.njk
    article.njk
    about.njk
    cart.njk
    service.njk
  assets/
    styles.css
    data.js
    script.js
```

构建输出：

```text
dist/
  index.html
  shop.html
  product.html
  brands.html
  brand.html
  samples.html
  guide.html
  journal.html
  article.html
  about.html
  cart.html
  service.html
  styles.css
  data.js
  script.js
```

### 实施步骤

1. 新增 Eleventy 配置。
2. 把公共页面外壳抽成 `layout.njk`。
3. 把顶部通知条、Header、导航、搜索框、购物车按钮抽成 `header.njk`。
4. 把 Footer 抽成 `footer.njk`。
5. 把 `<div data-cart-shell></div>` 抽成 `cart-shell.njk`。
6. 每个页面只保留自己的主体内容。
7. 用页面 front matter 管理标题、描述和当前导航状态。

页面示例：

```njk
---
layout: layout.njk
title: 香水 | 气味档案
description: 按品牌、香调、场景和价格筛选小众香水。
page: shop
---

<section class="page-hero shop-hero">
  <p class="eyebrow">Fragrances</p>
  <h1>香水列表</h1>
  <p>从香调、场景、品牌和价格开始缩小范围，找到适合日常、礼物或收藏的气味。</p>
</section>
```

导航高亮由 `page` 字段控制，不再在每个 HTML 里手动维护。

### 验收标准

- 修改导航文案或链接时，只需要改一个文件。
- 所有页面的 Header 和 Footer 完全一致。
- 当前页导航高亮仍然正确。
- 搜索框、移动端菜单、购物车按钮仍然正常。
- 构建后的页面路径不变。

## 阶段 2：重构购物车和结账结构

### 目标

保留当前前端体验，但把购物车和结账逻辑改成可接真实后端或第三方电商系统的结构。

本阶段不强制接入真实支付。

### 当前问题

当前购物车逻辑集中在 `script.js` 中：

- 购物车数据直接读写 `localStorage`。
- 加入购物车、数量修改、抽屉渲染、结账提示都混在一起。
- 结账按钮只是 `showToast` 提示，没有真实业务状态。
- 后续如果接 Shopify、WooCommerce 或自建后端，需要重写大量代码。

### 模块拆分建议

```text
src/assets/js/
  catalog.js
  cart-store.js
  cart-ui.js
  checkout.js
  app.js
```

模块职责：

```text
catalog.js
  商品查询、商品是否存在、是否可售、价格读取。

cart-store.js
  购物车状态管理。当前仍可使用 localStorage，但对外只暴露统一接口。

cart-ui.js
  购物车抽屉、购物车页面、数量控件、购物车计数渲染。

checkout.js
  结账入口。当前可以是占位实现，后续替换为真实支付或订单 API。

app.js
  初始化导航、页面渲染、全局事件绑定。
```

### Cart Store 接口建议

```js
cartStore.getItems()
cartStore.addItem(productId, quantity)
cartStore.updateQuantity(productId, quantity)
cartStore.removeItem(productId)
cartStore.clear()
cartStore.getCount()
cartStore.getSubtotal()
```

规则：

- UI 不直接操作 `localStorage`。
- UI 不直接计算商品价格。
- 加入购物车时必须通过商品数据校验。
- 购物车中只保存商品 ID 和数量，不保存价格快照。

### 商品校验建议

加入购物车前检查：

1. 商品 ID 是否存在。
2. 商品是否属于可售类型。
3. 商品库存状态是否允许加入购物车。
4. 商品价格是否有效。

示例规则：

```js
function canPurchase(item) {
  return item && item.price > 0 && item.stock !== "售罄";
}
```

### 结账入口建议

短期先把“模拟结账”改成更明确的业务动作。

可选方案：

1. `提交咨询订单`
2. `预约购买`
3. `发送订单到客服`
4. `继续结账`，但页面明确标注当前还未接入支付

如果暂时不接真实支付，推荐使用：

```text
提交咨询订单
```

这样比“模拟结账”更接近真实业务，也不会误导用户。

### 后续真实结账接入点

后续可以根据业务选择一种方案：

```text
Shopify Buy Button / Storefront API
WooCommerce REST API
自建后端 + Stripe
自建后端 + 微信支付 / 支付宝
表单订单 + 客服人工确认
```

当前阶段只需要在 `checkout.js` 中预留 adapter。

示例：

```js
const checkoutAdapter = {
  async startCheckout(cartItems) {
    return {
      status: "pending",
      message: "已收到订单咨询，请联系客服确认库存和支付方式。"
    };
  }
};
```

### 验收标准

- 加入购物车、减少数量、增加数量、删除商品都正常。
- 刷新页面后购物车仍然保留。
- 购物车计数和小计准确。
- 商品不存在或不可售时不能加入购物车。
- 结账按钮不再显示“模拟结账”。
- 结账逻辑集中在 `checkout.js`，后续可替换真实支付实现。

## 阶段 3：回归检查

完成阶段 1 和阶段 2 后，需要检查以下页面：

```text
index.html
shop.html
product.html
brands.html
brand.html
samples.html
guide.html
journal.html
article.html
about.html
cart.html
service.html
```

检查项目：

1. 页面能正常打开。
2. 页面标题和 meta description 正确。
3. 导航 active 状态正确。
4. Header、Footer 内容一致。
5. 搜索能跳转到商品页。
6. 商品筛选能正常工作。
7. 商品详情能根据 URL 参数渲染。
8. 品牌详情能根据 URL 参数渲染。
9. 文章详情能根据 URL 参数渲染。
10. 选香问卷能生成推荐结果。
11. 加入购物车和收藏功能正常。
12. 购物车抽屉和购物车页面同步。
13. 移动端菜单正常展开和关闭。
14. 页面没有横向滚动。

## 建议执行顺序

1. 先引入 Eleventy，但不改业务逻辑。
2. 抽出公共模板，确认所有页面输出一致。
3. 再拆分购物车模块，保持现有前端行为不变。
4. 最后调整结账按钮文案和 `checkout.js` adapter。

这样风险最低。先解决维护成本，再处理业务扩展点。

