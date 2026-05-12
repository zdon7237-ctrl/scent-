# 馥屿真实线上平台改造计划

更新日期：2026-05-06

## 当前结论

项目当前实际位于仓库的 `网页制作/` 子目录里，已经从纯静态展示页发展成一个可本地运行的电商开发版：

```text
Eleventy 静态页面 + 本地 Node API + JSON 数据库 + 会员/订单/积分/积分商城闭环
```

下一阶段目标不是继续堆页面，而是把系统从“本地演示可用”改造成“真实线上可运营”。优先级应当围绕五件事：

1. 数据可靠。
2. 后台安全。
3. 结账真实。
4. 支付可信。
5. 订单履约完整。

推荐路线调整为：

```text
测试和 CI 兜底
-> PostgreSQL + repository + migration
-> 后台安全和生产账号策略
-> 真实结账基础：地址、商品最小表、SKU、库存预留、订单快照
-> 真实支付
-> 发货、物流、退款、售后
-> 部署、监控、备份
-> 商品/品牌/内容后台化
-> 合规和运营准备
```

核心原则：用户进入真实支付前，系统必须已经有可靠的收货地址、商品价格、上下架状态、库存策略和订单金额快照。

## 线上 MVP 标准

达到以下标准，才算进入真实线上平台的第一版：

| 模块 | MVP 标准 |
|---|---|
| CI | 每次提交自动在 `网页制作/` 下运行 `npm ci`、`npm test`、`npm run build` 和 `node --check` |
| 数据 | 用户、会员、订单、积分、积分商城、优惠券、后台日志使用正式数据库，不再依赖 JSON 文件 |
| 数据库 | 有 migration 版本记录；生产启动不自动乱改 schema；上线前有备份和回滚方案 |
| 账户 | 会员登录、管理员登录都有安全会话、密码哈希、退出和基础防护 |
| 后台 | 生产环境禁用 `x-admin-key`；后台 API 需要管理员身份、角色权限和 CSRF/Origin 防护 |
| 商品 | 商品价格、上下架、SKU、库存使用数据库；订单保存商品和价格快照 |
| 库存 | 普通商品使用库存预留；支付超时或订单取消会释放库存 |
| 支付 | 接入真实支付渠道，支付回调有 raw body 验签、幂等处理和金额校验 |
| 幂等 | 创建订单、支付回调、确认收货、退款、积分兑换都有幂等键或唯一约束 |
| 订单 | 用户可填写收货地址；后台可发货、填写物流单号；用户可查看订单状态 |
| 积分 | 确认收货后发积分，退款扣回，积分商城 FIFO 消耗和取消返还规则稳定 |
| 请求安全 | JSON body 有大小限制；非法 JSON 不会导致服务崩溃 |
| 部署 | 有生产环境变量、HTTPS、日志、错误监控、数据库备份和恢复方案 |
| 前端 | 使用真实商品/品牌内容；移动端购买链路可用；错误、空状态、加载状态清楚 |
| 合规 | 准备服务条款、隐私政策、退换货说明、支付与配送说明、经营主体和客服信息 |

## 阶段 0：测试和 CI 兜底

### 目标

让之后每次改底层能力时，都能知道有没有破坏现有业务规则。

### 已完成

- `npm start` 已改为先构建，再从 `dist` 提供静态页面。
- 后端核心 API 已新增 `node:test` 自动化测试。
- 测试覆盖注册、订单、支付确认、确认收货、退款、积分商城和 FIFO 积分消耗。
- 后台认证、管理员 session、角色权限、Origin 校验和 webhook secret 已有测试保护。
- PostgreSQL 第一阶段基础设施已建立：`pg`、migration、seed、repository 入口和可跳过 smoke test。
- GitHub Actions 已在仓库根目录配置，默认工作目录为 `网页制作/`，会运行 `npm ci`、脚本语法检查、`npm run launch:preflight`，并用测试运营值跑 `npm run launch:strict`。

### 后续保持

仓库根目录不是项目根目录，所有本地、CI 和部署命令都必须进入 `网页制作/`：

```bash
cd 网页制作
npm ci
npm test
npm run build
npm start
```

GitHub Actions 或云平台构建需要配置：

```yaml
defaults:
  run:
    working-directory: 网页制作
```

当前 GitHub Actions 已按上述方式配置；后续新增脚本或关键前端模块时，需要同步加入语法检查或测试。

每个阶段完成后都必须跑：

```bash
cd 网页制作
npm test
npm run build
node --check server/src/app.mjs
node --check src/assets/script.js
```

### 验收

- CI 在 `网页制作/` 下运行，不在仓库根目录误找 `package.json`。
- 所有测试通过。
- 本地 `npm start` 能访问首页、后台页和 API。
- 测试不污染真实本地开发数据库。

## 阶段 1：PostgreSQL + Repository + Migration

### 目标

用 PostgreSQL 替换 `server/data/db.json`，建立 migration、seed、repository 和事务封装，同时保持现有 API 行为不变。

### 当前状态

第一阶段已经建立基础设施，并已接入主业务 API 的数据入口：

- `DATABASE_URL` 未设置时继续使用 JSON，本地测试不依赖 PostgreSQL。
- `DATABASE_URL` 设置时，`server/src/app.mjs` 通过 repository 读写 PostgreSQL，不直接写 SQL。
- `npm run db:migrate` 执行第一版 schema migration。
- `npm run db:seed` 写入默认会员等级、默认积分商城商品、本地 seed 管理员和 `vespree` 最小商品数据。
- `tests/server-api.test.mjs` 在没有 `DATABASE_URL` 时跳过 PostgreSQL smoke；如果设置了安全测试库，则验证 migrate/seed 可重复执行。
- `payments.payment_amount` 和 `refunds.refund_amount` 使用整数分。

下一步不是重做 schema，而是把当前整库读写升级为更细粒度 repository 方法，并把订单、支付、积分、库存相关写操作放入 PostgreSQL transaction、并发锁和库存预留流程。

### 推荐选择

首选 PostgreSQL。原因：

- 订单、积分、退款、库存都需要事务。
- 未来后台筛选、报表、会员导出会更容易。
- 云平台支持成熟，备份和迁移方便。

### 目标表清单

第一版数据库计划至少覆盖当前已有数据结构，并为真实结账和支付预留地基：

```text
users
user_credentials
sessions

admin_users
admin_sessions
admin_roles
admin_user_roles
operation_logs
login_attempts
password_reset_tokens

member_profiles
member_tiers
tier_history

products
product_variants
product_images
inventory_items
inventory_movements
stock_reservations

orders
order_items
order_addresses
shipments

payments
payment_events
refunds
refund_events

point_transactions
point_consumptions

points_mall_items
points_redemption_orders
points_redemption_items

coupons
coupon_redemptions

addresses
idempotency_keys
schema_migrations
```

说明：

- 当前 `defaultDb()` 已有 `coupons` 和 `couponRedemptions`，迁移时不能漏。若暂不做优惠券，也必须明确废弃并从代码中删除；默认建议迁移。
- `point_consumptions` 建议独立建表，用于记录每次兑换具体消耗了哪一批积分、多少积分、对应哪个兑换订单，取消时也能准确返还到原批次。
- 商品、SKU、库存表可以先建最小字段版本，完整商品后台化可后置，但价格、上下架、SKU、库存必须在真实支付前进入数据库。

### 实施顺序

1. 新增数据库连接层，不直接在业务代码里散落 SQL。
2. 建立 migration 脚本，生成初始 schema 和 `schema_migrations`。
3. 建立 seed 脚本：会员等级、默认积分商城商品、开发管理员账号、必要商品最小数据。
4. 新增 repository 层，替换 `readDb/writeDb`。
5. 对订单创建、确认收货、退款、积分兑换、库存预留使用数据库事务。
6. 建立临时 JSON 迁移脚本，只用于把开发数据导入 PostgreSQL。
7. 保持现有 API 行为不变，跑现有 API 测试。

### 关键规则

- 金额继续使用整数分存储。
- 积分继续使用整数。
- 订单商品必须保存快照，不能依赖后续商品数据变化。
- 积分 FIFO 必须可查账：`point_transactions` 记录流水，`point_consumptions` 记录消耗明细。
- 库存预留、订单创建、支付确认、积分兑换必须在事务里完成。
- 生产启动不能自动修改 schema，只能通过明确 migration 命令执行。

### 验收

- 停用 `MEMBER_DB` JSON 后，系统仍能完成注册、下单、后台支付、确认收货、退款、积分发放、FIFO 积分消耗、积分商城兑换和取消返还。
- 现有 `npm test` 全部通过，并新增数据库级测试覆盖并发兑换、重复确认收货、重复退款和幂等 `requestId`。
- 并发兑换同一积分商品不会扣成负库存。
- 重复支付回调、重复确认收货、重复退款不会重复结算。

### 第一张任务单建议

```text
将当前 JSON 数据库迁移为 PostgreSQL，建立 migration、seed、repository 和事务封装，
覆盖 users、sessions、member_profiles、member_tiers、orders、order_items、
point_transactions、points_mall_items、points_redemption_orders、operation_logs、
coupons、coupon_redemptions 等当前已有数据结构；
保持现有 API 行为不变，现有测试全部通过，并新增并发兑换、重复确认收货、
重复退款和幂等 requestId 的数据库级测试。
```

## 阶段 2：后台安全硬化与生产账号策略

### 目标

在当前已接入的管理员登录、后台 session、角色权限和 Origin 校验基础上，补齐生产账号创建、限流、监控、审计和运维流程。

### 重要原则

生产环境禁用 `x-admin-key` 和默认开发密码。后台必须继续使用：

```text
admin_users + admin_sessions + role permission
```

本地 seed 管理员只能用于开发；生产环境必须显式设置安全的 `SEED_ADMIN_PASSWORD`，且不能等于默认开发密码。若后续保留任何调试开关，也必须满足：

```text
NODE_ENV !== "production"
```

### 功能范围

1. 管理员账号创建流程和初始 owner 交接流程。
2. 登录失败限流、异常登录记录和监控告警。
3. session 生命周期、退出、轮换和失效策略。
4. 角色权限继续保持：
   - `owner`：全部权限。
   - `ops`：订单、发货、退款、积分商城处理。
   - `support`：查看会员、查看订单、处理客服信息。
5. 后台操作日志记录可信的 `admin_user_id`，不能依赖前端传来的操作者信息。

### API 调整

已接入并需要保持：

```http
POST /api/admin/auth/login
POST /api/admin/auth/logout
GET  /api/admin/auth/me
```

现有 `/api/admin/*` 接口：

- 继续校验管理员 session 和角色权限。
- state-changing admin API 继续校验可信 Origin/Referer。
- 本地开发模拟支付可以保留，但只能在非生产环境或已登录管理员 session 下使用。

### 安全要求

- 密码继续使用强哈希，后续可升级为 Argon2 或 bcrypt。
- Cookie 使用 `HttpOnly`、`SameSite=Lax`，生产环境开启 `Secure`。
- state-changing admin API 校验 CSRF token 或 Origin/Referer。
- 管理员登录失败需要限流，并记录到 `login_attempts`。
- 管理员 session token 入库前哈希。
- 登录后轮换 session。
- 后台 API 不返回密码哈希。

### 验收

- 未登录后台不能访问管理接口。
- 生产环境下 `x-admin-key` 无效。
- 不同角色访问权限符合预期。
- 所有后台改动都写入 `operation_logs.admin_user_id`。
- 会员端前端 bundle 不再包含后台支付密钥或后台支付入口。

## 阶段 3：真实结账基础

### 目标

在接真实支付前，先把结账需要的基础数据做真实：地址、商品最小表、SKU、库存预留和订单快照。

### 为什么放在支付前

用户不能在没有可靠收货地址、库存、商品价格和订单金额快照的情况下进入真实支付。否则会出现用户已支付但库存不足、地址缺失、价格从静态 JS 被篡改或商品已下架仍可购买的问题。

### 商品最小模型

第一版不需要完整 CMS，但必须有：

```text
products
product_variants 或 skus
product_images
inventory_items
inventory_movements
stock_reservations
```

最小规则：

- 商品价格从数据库读取。
- 商品上下架从数据库读取。
- 订单保存商品名称、品牌、规格、单价、折扣、实付金额快照。
- 商品图片使用稳定地址，不能依赖 Unsplash 占位图作为线上主图。

### 库存策略

普通商品建议使用库存预留：

```text
创建订单 -> 锁定库存/生成库存预留 -> 等待支付
支付成功 -> 确认扣减
支付超时/取消 -> 释放库存
```

积分商城可以继续“兑换时直接扣积分和库存”，但普通商品订单不建议支付成功时才第一次扣库存。

### 订单基础能力

1. 用户收货地址簿。
2. 下单时保存订单地址快照。
3. 创建订单支持幂等键。
4. 支付超时关闭订单并释放库存。
5. 用户端只能创建订单、发起支付、查看支付结果、确认收货。
6. 后台端负责查看订单、发货、退款、人工补偿和调整。

### 需要清理的开发痕迹

会员侧不能保留直接调用后台支付的能力。当前类似 `adminPayOrder(orderId, key)` 的开发接口必须满足：

```text
仅非生产环境可见
或
仅已登录管理员 session 可用
```

不能出现在普通会员前端的生产 bundle 里。

### 验收

- 用户可以提交包含地址的订单。
- 下架商品不能购买。
- 库存不足不能进入支付。
- 订单创建会生成库存预留。
- 支付超时或取消会释放库存预留。
- 商品价格变更不影响历史订单。
- 会员端生产代码没有后台支付入口。

## 阶段 4：真实支付

### 目标

把“后台确认支付”替换为真实支付渠道，同时保留严格隔离的开发模拟支付能力。

### 推荐路线

国内用户优先考虑：

1. 微信支付。
2. 支付宝。

如果先做跨境或开发验证，也可以先接 Stripe，但国内小众香水买手店更应该优先考虑微信支付/支付宝。

### 支付流程

```text
用户提交订单 -> 后端生成订单和库存预留 -> 创建支付单
-> 前端跳转/拉起支付 -> 支付平台回调 -> raw body 验签
-> 记录 payment_events -> 幂等处理 -> 标记 payment paid
-> 标记订单 paid -> 确认扣减库存 -> 用户确认收货后发积分
```

### 表设计要求

支付相关建议拆成两张核心表：

| 表 | 作用 |
|---|---|
| `payments` | 系统内部支付单：订单 ID、金额、状态、渠道、provider trade no |
| `payment_events` | 支付平台 webhook 原始事件：事件 ID、签名校验结果、处理状态、幂等记录 |

退款相关建议同步准备：

| 表 | 作用 |
|---|---|
| `refunds` | 系统内部退款单 |
| `refund_events` | 支付平台退款回调或退款状态事件 |

### 必须实现

1. webhook 路由单独读取 raw body。
2. 先验签，再 JSON parse。
3. `provider_event_id` 唯一约束。
4. `order_id + payment_amount + currency` 三重校验。
5. 回调幂等：同一支付事件不能重复处理。
6. 订单状态校验：只有 `pending_payment` 可以变 `paid`。
7. 支付状态只能按合法状态流转。
8. 支付超时关闭订单并释放库存预留。
9. JSON body 有大小限制，非法 JSON 不崩服务。

### 验收

- 正常支付后订单变为 `paid`，库存预留变为确认扣减。
- 重复回调只处理一次。
- 金额不一致的回调被拒绝。
- 签名错误的回调被拒绝。
- provider event 重复时命中唯一约束或幂等处理。
- 支付成功不发积分，确认收货才发积分。

## 阶段 5：发货、物流、退款和售后

### 目标

把订单从“支付/确认收货”扩展成真实电商履约流程。

### 普通订单状态

建议统一为：

```text
pending_payment -> paid -> processing -> shipped -> completed
                 -> cancelled
                 -> refunded
```

### 需要补齐

1. 发货：
   - 后台填写物流公司、物流单号、发货时间。
   - 用户订单页显示物流信息。
2. 确认收货：
   - 用户手动确认。
   - 后续可加自动确认收货。
3. 退款：
   - 区分未发货退款、已发货退款、已完成退款。
   - 已完成订单退款继续扣回积分和累计消费。
   - 退款状态和支付渠道退款状态分开记录。
4. 售后：
   - 第一版可以先做后台备注和人工处理。
   - 后续再做用户发起售后申请。

### 验收

- 后台可以发货并填写物流信息。
- 用户可以在订单页看到发货状态。
- 退款不会造成积分、累计消费、库存重复变更。
- 重复退款请求不会重复提交支付渠道退款。

## 阶段 6：部署、环境和监控

### 目标

让系统可以稳定运行在真实服务器或云平台。

### 环境变量

至少需要：

```text
NODE_ENV
PORT
PUBLIC_DIR
DATABASE_URL
SESSION_SECRET
ADMIN_SESSION_SECRET
PAYMENT_PROVIDER
PAYMENT_WEBHOOK_SECRET
PAYMENT_MERCHANT_ID
PAYMENT_PRIVATE_KEY
APP_ORIGIN
COOKIE_SECURE
BODY_SIZE_LIMIT
```

### 部署建议

第一版可以采用：

```text
Node 服务 + PostgreSQL + 对象存储/CDN + HTTPS 反向代理
```

部署前必须有：

1. 生产环境构建命令。
2. 生产启动命令。
3. 数据库迁移命令。
4. 日志输出。
5. 错误监控。
6. 数据库自动备份。
7. 迁移回滚或备份恢复方案。
8. 健康检查接口。

### 验收

- 新环境从空数据库迁移后可启动。
- 健康检查接口可用。
- 服务重启后用户和订单数据不丢。
- 错误日志可追踪到请求和用户/订单上下文。
- 上线前有数据库备份和回滚步骤。

## 阶段 7：商品、品牌和内容后台化

### 目标

让网站从“演示商品目录”变成可运营商品系统。

### 商品数据

当前商品主要来自 `src/assets/data.js`。线上建议逐步迁移为后台可管理数据：

| 内容 | 建议 |
|---|---|
| 商品价格、SKU、库存、上下架 | 支付前必须进数据库 |
| 品牌 | 可以先静态，后续进后台 |
| 文章 | 初期可继续静态，后续做 CMS |
| 图片 | 使用对象存储或 CDN |
| 价格 | 存数据库，订单保存快照 |

### 后台运营能力

1. 商品上下架。
2. 商品价格、库存、图片、香调、品牌、适合场景编辑。
3. 积分商城商品维护。
4. 优惠券维护。
5. 订单筛选和导出。
6. 会员筛选和导出。
7. 文章和买手笔记管理可以后置。

### 验收

- 下架商品不能购买。
- 价格变更不影响历史订单。
- 商品图片来自稳定地址，不依赖 Unsplash 占位图。
- 优惠券要么可管理，要么明确不开放并从前后端隐藏。

## 阶段 8：前端上线体验、安全、合规和运营准备

### 前端重点页面

1. 首页。
2. 商品列表。
3. 商品详情。
4. 购物车。
5. 登录/注册。
6. 结账页。
7. 支付结果页。
8. 订单详情页。
9. 会员中心。
10. 积分商城。
11. 后台管理页。

### 必须补齐的状态

- 加载中。
- 空状态。
- 接口失败。
- 表单校验失败。
- 未登录跳转。
- 支付处理中。
- 支付成功。
- 支付失败。
- 库存不足。
- 商品下架。

### 安全清单

1. 密码哈希和登录限流。
2. 管理员权限校验。
3. 后台 CSRF token 或 Origin/Referer 防护。
4. Cookie `HttpOnly`、`SameSite`、生产 `Secure`。
5. 输入校验和输出转义。
6. 支付回调 raw body 签名校验。
7. 管理接口限流。
8. JSON body 大小限制。
9. 错误信息不泄露内部路径、密钥和 SQL。

### 合规与内容

上线前至少准备：

- 经营主体信息。
- 客服联系方式。
- 隐私政策。
- 用户服务协议。
- 配送说明。
- 退换货说明。
- 支付说明。
- 发票/售后说明。
- 商品正品来源说明。
- 进口/代理/采购凭证留档。
- 商品图片和品牌授权风险检查。
- 独立域名部署时的备案要求。
- 隐私政策中明确收货地址、手机号、订单数据、营销偏好的使用方式。

具体法律文本需要按实际经营主体、地区、销售渠道和支付渠道要求确认，不能只靠技术文档兜底。

### 验收

- 移动端 375px 宽度无横向溢出。
- 用户从商品详情到支付完成路径可走通。
- 接口失败时不会静默失败。
- 关键按钮不会重复提交造成重复订单。
- 法务和运营所需基础页面可访问。

## 推荐执行顺序

### 第一轮：数据库改造

1. 加 PostgreSQL 连接和迁移脚本。
2. 建 schema 和 `schema_migrations`。
3. 种子会员等级、积分商城商品、开发管理员账号和商品最小数据。
4. 替换 JSON 读写为 repository。
5. 订单、积分、库存和兑换加事务。
6. 跑现有测试并补数据库并发测试。

### 第二轮：后台安全

1. 配置生产 owner 管理员和安全初始密码。
2. 补登录失败限流、异常登录记录和告警。
3. 检查 `/api/admin/*` 权限矩阵与后台菜单是否一致。
4. 确认操作日志绑定 `admin_user_id`。
5. 定期轮换管理员账号和清理过期 session。
6. 确认生产环境没有 `x-admin-key`、默认开发密码或调试入口。

### 第三轮：真实结账基础

1. 加地址簿和订单地址快照。
2. 加商品最小表、SKU、价格、上下架。
3. 加普通商品库存和库存预留。
4. 清理会员端后台支付开发入口。
5. 完善用户订单详情。

### 第四轮：真实支付

1. 抽象支付 provider。
2. 建 `payments` 和 `payment_events`。
3. 接一个真实支付渠道。
4. 做 raw body 验签、金额校验、状态流转和幂等。
5. 增加支付成功/失败前端状态页。

### 第五轮：履约和上线

1. 加发货、物流、退款和售后基础能力。
2. 配置生产环境变量。
3. 部署 Node 服务和 PostgreSQL。
4. 配 HTTPS。
5. 加日志、监控、备份。
6. 做上线前安全、合规、移动端和购买链路走查。

## 当前下一步

最推荐马上做：

```text
阶段 1：PostgreSQL + migration + repository + 事务 + 测试迁移
```

原因：

- 数据库是线上平台地基。
- 现有业务测试已经能保护核心规则。
- 支付、后台权限、库存预留和履约都依赖可靠数据库事务。

完成后再进入后台安全和生产账号策略，然后先补真实结账基础，最后接真实支付。
