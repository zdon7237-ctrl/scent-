# 前端现状审计报告

更新日期：2026-05-06

## 审计范围

本次审计对应 `frontend-goal-plan.md` 的 Goal 1。

检查对象：

- `PRODUCT.md`
- `DESIGN.md`
- `src/pages/*.njk`
- `src/_includes/*.njk`
- `src/assets/styles.css`
- `src/assets/js/app.js`
- `src/assets/js/cart-ui.js`

已执行：

```text
npm run build
```

结果：构建通过，Eleventy 成功写出 23 个页面。

自动 detector 说明：

```text
npx impeccable --json --fast src/pages src/_includes
```

该命令需要从 npm registry 下载并执行外部包。沙盒内首先因网络失败，随后升级请求被安全策略拒绝，原因是执行未固定版本的外部 npm 包有工作区数据风险。因此本报告采用本地源码审计，不依赖外部 detector。

## 总体判断

当前网站已经具备完整页面结构和可运行购买/会员/积分流程，但视觉与信息层级仍偏“静态电商 demo”。主要问题不是功能缺失，而是页面气质、购买判断信息、移动端效率和状态反馈还没有系统打磨。

当前最需要处理的是：

1. 首页首屏存在 hero-metric 模板感，和买手店定位不够贴合。
2. 多处页面依赖重复卡片网格，缺少编辑节奏和页面职责差异。
3. 商品卡与商品详情虽然有基础信息，但新手需要的“盲买风险、适合人群、先试香路径”还不够前置。
4. 移动端筛选、导航、表格和会员页面可用，但不够轻。
5. Focus、错误、加载、空状态有基础，但还没形成统一状态系统。

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---:|---:|---|
| 1 | Visibility of System Status | 2 | 加入购物车和接口错误主要依赖 toast，表单提交和加载状态不够一致 |
| 2 | Match System / Real World | 3 | 买手语言已有基础，但列表卡片还偏商品参数 |
| 3 | User Control and Freedom | 3 | 筛选可清除，购物车可改数量，但抽屉缺少更完整的恢复/继续路径 |
| 4 | Consistency and Standards | 3 | 全站样式统一，但内容页、商品页、会员页的信息密度差异还不够有意图 |
| 5 | Error Prevention | 2 | 登录、兑换、结账等流程缺少内联错误和提交中状态 |
| 6 | Recognition Rather Than Recall | 3 | 导航清楚，筛选项明确，但新手判断香水仍需要记忆香调含义 |
| 7 | Flexibility and Efficiency | 2 | 香水爱好者能筛选，但移动端筛选效率一般 |
| 8 | Aesthetic and Minimalist Design | 2 | 首页和列表有重复网格，首屏指标模块有 AI 模板感 |
| 9 | Error Recovery | 2 | 多数错误只 toast，没有就地恢复指引 |
| 10 | Help and Documentation | 3 | 试香、指南和服务页已存在，但与购买链路连接还可更强 |
| **Total** | | **25/40** | **可运行，但需要品牌化与产品化打磨** |

## Priority Issues

### P1：首页首屏有模板感

**页面：** `src/pages/index.njk`、`src/assets/styles.css`

**问题：** Hero 右下角使用 `36 / 8 / 48h` 这类大数字指标，接近 hero-metric 模板。它传达信息，但不够像小众香水买手店的编辑橱窗。

**影响：** 用户会先看到“指标型官网”而不是“懂香水的买手店”。

**修复方向：** 把指标模块改为三条购买路径或气味判断线索：先试香、看买手推荐、按场景选香。减少大数字，强化具体行动。

### P1：核心购买信息没有足够照顾新手

**页面：** `src/assets/js/app.js`、`src/pages/shop.njk`

**问题：** 商品卡显示品牌、库存、香调、价格和操作，但缺少适合场景、盲买风险、试香建议。商品详情已有买手点评和提醒，但离购买 CTA 还不够近。

**影响：** 初次购买香水的人仍然可能不知道怎么判断是否适合自己。

**修复方向：** 商品卡增加场景或一句气味判断；商品详情购买区增加“适合 / 先试香 / 盲买提醒”近场模块。

### P1：移动端筛选和任务页密度需要收紧

**页面：** `src/pages/shop.njk`、`src/assets/styles.css`

**问题：** 880px 以下筛选面板变为普通块，字段较多，会占据移动端结果前的较大空间。

**影响：** 移动端用户需要先滚过筛选才能看到商品，探索效率下降。

**修复方向：** 让筛选面板在移动端更紧凑，增加标题/说明、压缩间距，强化结果数量和“先试香”入口。

### P2：内容页过薄，主要依赖卡片网格

**页面：** `src/pages/brands.njk`、`src/pages/journal.njk`、动态 `brand.html`、`article.html`

**问题：** 品牌和 Journal 入口目前是 hero + grid，缺少对“如何读/如何买”的分流说明。

**影响：** 内容页能展示内容，但专业信任感没有充分利用。

**修复方向：** 增加编辑说明、内容分类、品牌选择逻辑和导向商品/试香的 CTA。

### P2：状态系统不完整

**页面：** 登录、注册、账户、订单、积分、购物车、积分商城

**问题：** 空状态已经存在，但错误主要使用 toast；focus-visible、提交中、禁用、错误提示没有形成统一系统。

**影响：** 任务页面在真实接口失败、键盘操作和移动端表单时会显得不够生产化。

**修复方向：** 增加全局 focus-visible 样式、form note/error 区块、loading 文案和更清楚的 empty state CTA。

### P2：会员与积分页面视觉融入度不足

**页面：** `account`、`orders`、`points`、`points-mall`

**问题：** 功能结构清楚，但信息表格在移动端容易变成长列表，状态和下一步不够突出。

**影响：** 用户能读懂，但不够像正式会员中心。

**修复方向：** 增加 dashboard/card 层级、状态 badge、操作说明，保持 product 风格，不做过度装饰。

## What Is Working

- 多页面信息架构已经基本正确：首页、香水、品牌、试香、选香指南、Journal、会员、积分商城都有独立入口。
- `PRODUCT.md` 和 `DESIGN.md` 已经建立，后续设计判断有统一依据。
- 数据模型里已有 `buyer`、`bestFor`、`caution`、`notes`、`scenes`，具备做新手友好购买判断的基础。
- 购物车、会员、积分商城已有可运行 JS 流程，前端重点可以放在表达和状态打磨，而不是重写业务逻辑。

## Recommended Actions

1. 先产出整体 redesign brief，明确各页面职责和制作顺序。
2. 首页先移除 hero-metric 模板，改为买手分流和试香路径。
3. 商品卡和商品详情补充“适合场景、盲买提醒、先试香”。
4. 品牌和 Journal 页增加编辑导读，减少单纯卡片墙感。
5. 全局补齐 focus、表单说明、状态 badge、移动端密度。
6. 最后构建并用桌面、平板、手机视口验收。
