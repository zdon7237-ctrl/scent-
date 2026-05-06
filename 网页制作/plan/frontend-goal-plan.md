# 前端 Goal 制作计划

更新日期：2026-05-06

## 当前状态

项目已经是一个多页面小众香水买手店静态站，使用 Eleventy 生成页面。

## 执行状态

本计划已在 2026-05-06 完成一轮前端执行。

执行产物：

- `PRODUCT.md`
- `DESIGN.md`
- `plan/frontend-critique-report.md`
- `plan/frontend-redesign-brief.md`
- `plan/frontend-verification-report.md`

已完成：

- Goal 0：建立设计系统上下文。
- Goal 1：完成现状审计。
- Goal 2：产出整体改版 brief。
- Goal 3：完成首页第一轮重设计。
- Goal 4：完成核心购买链路第一轮优化。
- Goal 5：完成内容与信任页面第一轮打磨。
- Goal 6：完成会员、积分和账户页面第一轮状态打磨。
- Goal 7：完成移动端、状态和可访问性基础补强。
- Goal 8：完成构建和浏览器验收。

后续如果继续迭代，应从 `frontend-verification-report.md` 和真实运营反馈开始，而不是重复 Goal 0。

当前已完成：

- 多页面结构已存在：首页、香水列表、商品详情、品牌、试香、选香指南、Journal、购物车、会员、积分商城等。
- 全局样式集中在 `src/assets/styles.css`。
- 页面模板集中在 `src/pages/*.njk`。
- 公共结构集中在 `src/_includes/*.njk`。
- 已创建 `PRODUCT.md`，明确默认 register 为 `brand`。
- 已创建 `DESIGN.md`，记录当前设计系统。

当前缺口：

- 真实品牌图片仍需后续替换 Unsplash 占位图。
- 真实支付、正式会员登录、后台权限和线上接口错误仍需生产环境验证。
- 试香套装是否抵扣正装仍需运营规则确认。

## 总目标

把「气味档案 Scent Archive」前端打磨成一个面向国内用户的小众香水买手店网站：

- 对小众香爱好者：体现选品判断、品牌理解和编辑感。
- 对初次购买香水的人：降低盲买风险，让试香、筛选、购买路径清楚。
- 对移动端用户：保证浏览、筛选、加入购物车和结账入口足够顺畅。

整体设计策略：

```text
默认 register：brand
品牌页、首页、Journal、关于我们：强调气质、选品、内容信任
商品列表、商品详情、购物车、登录、会员、积分商城：按 product 思路保证效率和清晰度
```

## Goal 执行总顺序

```text
Goal 0: 建立设计系统上下文
Goal 1: 做现状审计
Goal 2: 产出整体改版 brief
Goal 3: 重设计首页
Goal 4: 重设计核心购买链路
Goal 5: 打磨内容与信任页面
Goal 6: 打磨会员、积分和账户页面
Goal 7: 移动端适配与状态补全
Goal 8: 最终 polish 与验收
```

不要跳过 Goal 0 到 Goal 2。它们是后续制作不跑偏的基础。

## Goal 0：建立设计系统上下文

### Objective

生成并确认 `DESIGN.md`，把当前网站已有的颜色、字体、按钮、卡片、导航、表单、间距和阴影提取成设计系统。

### 建议使用的 impeccable 命令

```text
/impeccable document
```

### 主要输入

- `PRODUCT.md`
- `src/assets/styles.css`
- `src/_includes/header.njk`
- `src/_includes/footer.njk`
- `src/pages/index.njk`
- `src/pages/shop.njk`
- `src/pages/product.njk`

### 产物

- `DESIGN.md`
- 当前视觉系统摘要
- 可继续使用、需要调整、应避免的设计规则

### 验收标准

- `DESIGN.md` 存在于项目根目录。
- 设计系统明确记录主色、背景、文字、边框、按钮、卡片、输入框和导航规则。
- 后续 goal 可以引用 `PRODUCT.md` 与 `DESIGN.md` 进行设计判断。

## Goal 1：做现状审计

### Objective

审计当前前端的问题，形成优先级清单，避免直接凭感觉改页面。

### 建议使用的 impeccable 命令

```text
/impeccable critique src/pages src/assets/styles.css
```

如需补充技术质量：

```text
/impeccable audit 当前网站
```

### 审计重点

- 首页是否像买手店橱窗，而不是普通模板电商。
- 商品列表是否能让用户快速按香调、品牌、场景和价格筛选。
- 商品详情是否降低盲买风险。
- 试香入口是否足够明显。
- 购物车是否清楚、可信、可继续购物。
- 中文移动端是否易读、易点、少遮挡。
- 是否存在重复卡片网格、廉价促销感、AI 模板感。

### 产物

- 前端问题清单
- P0/P1/P2/P3 优先级
- 需要优先处理的页面名单

### 验收标准

- 每个主要问题都有明确页面、原因和建议修复方向。
- 后续 Goal 2 的 brief 能直接引用这些问题。

## Goal 2：产出整体改版 brief

### Objective

在不写代码的情况下，确定全站前端改版方向、页面职责、视觉策略和交互模型。

### 建议使用的 impeccable 命令

```text
/impeccable shape 小众香水买手店整体前端改版
```

### 必须明确的内容

- 首页的首屏任务和分流策略。
- 商品列表的筛选与结果展示策略。
- 商品详情的信息优先级。
- 试香页如何降低首次购买门槛。
- 品牌页和 Journal 如何建立专业信任。
- 购物车、会员、积分商城如何保持 product 效率。
- 桌面端和移动端的布局原则。

### 产物

- 已确认的整体设计 brief
- 页面职责矩阵
- 后续制作顺序

### 验收标准

- brief 被明确确认后，才能进入制作。
- 每个核心页面都知道自己负责什么、不负责什么。

## Goal 3：重设计首页

### Objective

把首页从“模块展示页”提升为“有编辑感的买手店橱窗”，用更少内容建立气质并把用户分流到正确路径。

### 建议使用的 impeccable 命令

```text
/impeccable craft 首页
```

必要时拆成专项：

```text
/impeccable layout 首页
/impeccable typeset 首页
/impeccable colorize 首页
```

### 主要文件

- `src/pages/index.njk`
- `src/assets/styles.css`
- `src/assets/data.js`
- `src/assets/script.js`

### 首页建议结构

1. 公告栏与导航
2. 主视觉 Hero
3. 当季主题或买手主推
4. 新品精选
5. 试香入口
6. 品牌精选
7. Journal 内容入口
8. 页脚

### 设计要求

- 首屏必须立刻传达“气味档案是小众香水买手店”。
- H1 不要空泛，要服务品牌和用户理解。
- Hero 使用真实香水、陈列、材质或气味相关视觉。
- 避免堆太多商品卡片。
- 试香入口要成为新用户的明显路径。

### 验收标准

- 用户 5 秒内能理解网站卖什么、适合谁、下一步去哪。
- 首页不承担完整商品列表职责。
- 桌面端和移动端首屏都不拥挤。

## Goal 4：重设计核心购买链路

### Objective

优化从浏览到购买的核心路径：

```text
首页 -> 香水列表 -> 商品详情 -> 加入购物车 -> 购物车
```

### 建议使用的 impeccable 命令

```text
/impeccable craft 核心购买链路
```

专项命令：

```text
/impeccable layout shop product cart
/impeccable clarify shop product cart
/impeccable harden shop product cart
```

### 主要文件

- `src/pages/shop.njk`
- `src/pages/product.njk`
- `src/pages/cart.njk`
- `src/_includes/cart-shell.njk`
- `src/assets/styles.css`
- `src/assets/js/cart-ui.js`
- `src/assets/js/cart-store.js`
- `src/assets/script.js`

### 关键改造点

#### 香水列表

- 筛选项清楚：关键词、香调、品牌、场景、分类、价格。
- 筛选结果数量即时可见。
- 商品卡片信息优先级明确：品牌、名称、价格、容量、香调、适合场景、操作。
- 移动端筛选不应占据过多首屏空间。

#### 商品详情

- 购买信息必须清楚：价格、容量、库存、加入购物车。
- 气味信息必须具体：主香调、气味印象、适合人群、适合场景、盲买风险。
- 强化试香路径：不确定时引导试香。
- 买手点评要比普通营销文案更具体。

#### 购物车

- 商品、数量、价格、总计和下一步清晰。
- 空购物车有有效引导。
- 加入购物车后有明确反馈。

### 验收标准

- 初次购买用户可以不懂香水也完成选择。
- 香水爱好者能快速定位品牌、香调和具体商品。
- 移动端能顺利筛选、查看详情、加入购物车。

## Goal 5：打磨内容与信任页面

### Objective

让品牌、Journal、关于我们和服务页面真正建立专业感，而不是只是补充信息。

### 建议使用的 impeccable 命令

```text
/impeccable craft 内容与信任页面
```

专项命令：

```text
/impeccable typeset brands brand journal article about service
/impeccable layout brands brand journal article about service
/impeccable clarify brands brand journal article about service
```

### 主要文件

- `src/pages/brands.njk`
- `src/pages/brand.njk`
- `src/pages/journal.njk`
- `src/pages/article.njk`
- `src/pages/about.njk`
- `src/pages/service.njk`
- `src/assets/styles.css`

### 页面职责

| 页面 | 职责 |
|---|---|
| `brands` | 展示品牌范围和选品眼光 |
| `brand` | 讲清品牌气质，并导向品牌商品 |
| `journal` | 建立内容专业感和 SEO |
| `article` | 用内容种草并关联商品 |
| `about` | 建立店铺可信度 |
| `service` | 解释试香、配送、售后和客服 |

### 验收标准

- 内容页面能导向商品、试香或品牌。
- 文章和品牌页不是孤立内容。
- 文案像买手建议，不像泛泛广告。

## Goal 6：打磨会员、积分和账户页面

### Objective

让登录、注册、会员、账户、订单、积分商城这些页面从视觉上融入网站，同时保持产品界面的清楚和效率。

### 建议使用的 impeccable 命令

```text
/impeccable polish 会员与账户页面
```

专项命令：

```text
/impeccable harden login register account member orders points points-mall
/impeccable clarify login register account member orders points points-mall
```

### 主要文件

- `src/pages/login.njk`
- `src/pages/register.njk`
- `src/pages/account.njk`
- `src/pages/member.njk`
- `src/pages/orders.njk`
- `src/pages/points.njk`
- `src/pages/points-mall.njk`
- `src/pages/points-item.njk`
- `src/pages/points-redemptions.njk`
- `src/assets/js/member-client.js`
- `src/assets/js/points-mall-client.js`
- `src/assets/styles.css`

### 关键要求

- 这些页面按 `product` 逻辑处理：清楚、稳定、少装饰。
- 表单、订单、积分、兑换状态要有明确反馈。
- 空状态和错误状态必须可理解。
- 不要把会员页面做成营销页。

### 验收标准

- 用户能理解积分余额、积分来源、兑换状态和订单状态。
- 登录注册错误提示清楚。
- 积分商城与主站视觉一致，但购买任务不被装饰干扰。

## Goal 7：移动端适配与状态补全

### Objective

系统补齐移动端体验、空状态、加载状态、错误状态、成功状态、焦点状态和减少动态效果。

### 建议使用的 impeccable 命令

```text
/impeccable adapt 全站移动端
/impeccable harden 全站状态
```

### 检查范围

- 导航展开与关闭
- 搜索框
- 商品筛选
- 商品卡片
- 商品详情购买区
- 购物车抽屉
- 登录注册表单
- 会员与订单页面
- 积分商城兑换流程
- 空数据页面
- 网络或接口错误提示

### 验收标准

- 375px 宽度下没有文字溢出、按钮重叠、内容遮挡。
- 触控目标足够大。
- 所有可交互元素有 hover/focus/active/disabled 状态。
- 空状态告诉用户下一步做什么。
- 错误状态说明发生了什么以及如何恢复。

## Goal 8：最终 polish 与验收

### Objective

做最终视觉、交互、构建和浏览器验收，保证前端可以作为一个完整版本交付。

### 建议使用的 impeccable 命令

```text
/impeccable polish 全站
```

最后复查：

```text
/impeccable critique 当前网站
```

### 技术验收命令

```text
npm run build
npm run serve
```

### 浏览器验收视口

- 手机：375 x 812
- 平板：768 x 1024
- 桌面：1440 x 900

### 必看路径

```text
index.html
shop.html
product.html
samples.html
cart.html
brands.html
journal.html
login.html
member.html
points-mall.html
```

### 验收标准

- 构建成功。
- 主要页面无明显布局破损。
- 移动端可完成核心路径。
- 视觉风格统一，符合 `PRODUCT.md` 与 `DESIGN.md`。
- 复查 critique 后没有 P0/P1 级设计问题。

## 推荐的实际 Goal 切分

如果使用 goal 工具，建议不要把所有内容塞进一个超大 goal。按下面拆分更稳。

### Goal A：设计系统与审计

```text
完成气味档案网站的设计系统建立与现状审计，为后续首页和购买链路改版提供明确方案。
```

包含：

- Goal 0
- Goal 1
- Goal 2

完成后再进入制作。

### Goal B：首页与购买链路制作

```text
根据已确认的设计 brief，重设计并实现气味档案首页与核心购买链路。
```

包含：

- Goal 3
- Goal 4

### Goal C：内容、会员与全站打磨

```text
完善气味档案内容信任页面、会员积分页面、移动端适配和最终前端验收。
```

包含：

- Goal 5
- Goal 6
- Goal 7
- Goal 8

## 文件修改边界

优先修改：

- `src/pages/*.njk`
- `src/_includes/*.njk`
- `src/assets/styles.css`
- `src/assets/script.js`
- `src/assets/js/*.js`
- `src/assets/data.js`

同步构建后会影响：

- 根目录生成的 `*.html`
- `dist/`
- `styles.css`
- `script.js`
- `data.js`
- `assets/js/*.js`

不要在没有明确需要时做：

- 大规模重写后端接口
- 改会员和积分业务规则
- 引入复杂前端框架
- 为了视觉效果破坏现有购物车、会员、积分流程

## 总体验收定义

完成全部前端 goal 后，网站应该达到以下状态：

- 首页像一个有审美判断的小众香水买手店，而不是普通商品集合页。
- 商品列表和商品详情能同时服务新手和香水爱好者。
- 试香路径清楚，能降低第一次购买的心理门槛。
- 内容页面能建立专业信任并自然导向商品。
- 会员、积分、订单页面清楚可用，不抢品牌页面的戏。
- 手机端没有明显布局、字号、点击和遮挡问题。
- 前端构建通过，主要页面浏览器验收通过。
