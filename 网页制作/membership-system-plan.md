# 气味档案会员系统实施计划

## 目标

为「气味档案 Scent Archive」增加一套可实际运行的会员系统，实现以下能力：

1. 用户可以注册、登录、查看会员中心。
2. 用户真实支付订单后，根据实际支付金额获得积分。
3. 用户累计有效消费达到门槛后自动升级会员等级。
4. 不同会员等级享受不同折扣、免运和权益。
5. 购物车和结账页可以展示会员折扣、可得积分、当前等级和升级进度。
6. 后续可以扩展生日礼、升等礼、会员日、优惠券和线下消费导入。

当前网站是静态前端，因此会员系统需要新增后端、数据库和真实订单/支付流程。不能只靠 `localStorage` 实现。

## 参考对象

参考小台香 taigrance 的会员入口和 CYBERBIZ 类会员体系：

- 会员登入
- 注册新会员
- 我的账户
- 订单查询
- 专属优惠券
- 收藏清单
- 会员等级
- 红利点数
- 会员专属折扣
- 生日礼
- 升等礼
- 会员日

本项目第一版不建议一次做完整 CYBERBIZ 级别功能，先做最关键闭环：

```text
注册 / 登录 -> 下单支付 -> 积分入账 -> 累计消费 -> 等级升级 -> 购物车折扣
```

## 会员规则设计

### 积分计算规则

积分必须基于实际支付金额，而不是商品原价。

```text
实际支付金额 = 商品小计 - 商品折扣 - 会员折扣 - 优惠券折扣 - 积分抵扣
```

不计入积分：

- 运费
- 未支付订单
- 已取消订单
- 已退款金额
- 手续费
- 人工调整的非消费金额

推荐第一版积分规则：

```text
每实际支付 ¥1 获得 1 积分
积分 = floor(实际支付金额)
```

示例：

```text
普通会员实际支付 ¥980
积分 = floor(980) = 980

金卡会员实际支付 ¥980
积分 = floor(980) = 980
```

### 积分抵扣规则

第一版建议简单清晰：

```text
100 积分 = ¥1
每单最多抵扣商品应付金额的 10%
积分不可抵扣运费
退款时需按比例追回已发放积分
```

如果想降低财务风险，第一版可以只发积分，不开放积分抵扣。等订单和退款流程稳定后再开放抵扣。

### 会员等级规则

会员等级按累计有效消费金额自动升级。

累计有效消费金额：

```text
会员所有已支付且未退款的订单 eligible_paid_amount 总和
```

推荐等级：

| 等级 | 累计有效消费门槛 | 订单折扣 | 免运权益 |
|---|---:|---:|---|
| 普通会员 | ¥0 | 无 | 满 ¥599 包邮 |
| 银卡会员 | ¥3,000 | 98 折 | 满 ¥499 包邮 |
| 金卡会员 | ¥8,000 | 95 折 | 满 ¥399 包邮 |
| 黑卡会员 | ¥20,000 | 92 折 | 顺丰包邮 |

规则说明：

- 升级自动发生在订单支付成功后。
- 降级第一版不做，会员等级永久保留。
- 后续如需年度保级，再增加等级有效期和续会条件。
- 会员折扣默认不与大促折扣叠加，避免折上折失控。

### 折扣叠加规则

第一版推荐顺序：

```text
商品原价
-> 商品活动价
-> 会员等级折扣
-> 优惠券
-> 积分抵扣
-> 运费
-> 最终支付金额
```

限制：

- 已经是清仓、即期、限量特价的商品可以设置 `member_discount_excluded = true`。
- 会员折扣只作用于商品金额，不作用于运费。
- 如果商品活动价已经低于会员折扣价，取更优惠的价格，但不要再重复折扣。

## 系统架构

### 推荐技术方案

当前网站是静态站，建议新增一个轻量后端。

可选方案：

```text
前端：当前 Eleventy 静态站
后端：Node.js + Express / Fastify
数据库：PostgreSQL
认证：Session Cookie 或 JWT
支付：Stripe / 微信支付 / 支付宝
部署：Render / Railway / Fly.io / VPS
```

如果暂时不接真实支付，也可以先做：

```text
订单提交 -> 后台人工确认 -> 手动标记已支付 -> 发放积分和升级
```

但最终必须有后端订单状态，不能继续只靠前端模拟。

### 模块划分

```text
frontend/
  会员页面
  购物车会员折扣显示
  会员中心

backend/
  auth
  members
  tiers
  orders
  points
  discounts
  payments
  admin

database/
  users
  member_profiles
  member_tiers
  orders
  order_items
  point_transactions
  tier_history
  coupons
  coupon_redemptions
```

## 数据库设计

### users

保存登录账号。

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

说明：

- `status` 可选：`active`、`disabled`、`deleted`
- email 和 phone 至少需要一个
- 密码必须 hash，不能明文存储

### member_tiers

保存会员等级配置。

```sql
CREATE TABLE member_tiers (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  min_lifetime_paid_amount INTEGER NOT NULL,
  discount_rate NUMERIC(5, 4) NOT NULL,
  point_multiplier NUMERIC(5, 2) NOT NULL,
  free_shipping_threshold INTEGER,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

示例数据：

```sql
INSERT INTO member_tiers
(id, code, name, min_lifetime_paid_amount, discount_rate, point_multiplier, free_shipping_threshold, sort_order)
VALUES
(gen_random_uuid(), 'base', '普通会员', 0, 1.00, 1.00, 59900, 1),
(gen_random_uuid(), 'silver', '银卡会员', 300000, 0.98, 1.10, 49900, 2),
(gen_random_uuid(), 'gold', '金卡会员', 800000, 0.95, 1.30, 39900, 3),
(gen_random_uuid(), 'black', '黑卡会员', 2000000, 0.92, 1.50, 0, 4);
```

金额建议用“分”为单位：

```text
¥3,000 = 300000
```

### member_profiles

保存会员资料、等级、累计消费和积分余额。

```sql
CREATE TABLE member_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  tier_id UUID NOT NULL REFERENCES member_tiers(id),
  lifetime_paid_amount INTEGER NOT NULL DEFAULT 0,
  available_points INTEGER NOT NULL DEFAULT 0,
  birthday DATE,
  accepts_marketing BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### orders

保存订单和支付金额。

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  order_no TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  status TEXT NOT NULL,
  subtotal_amount INTEGER NOT NULL DEFAULT 0,
  product_discount_amount INTEGER NOT NULL DEFAULT 0,
  member_discount_amount INTEGER NOT NULL DEFAULT 0,
  coupon_discount_amount INTEGER NOT NULL DEFAULT 0,
  points_discount_amount INTEGER NOT NULL DEFAULT 0,
  shipping_amount INTEGER NOT NULL DEFAULT 0,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  eligible_paid_amount INTEGER NOT NULL DEFAULT 0,
  points_used INTEGER NOT NULL DEFAULT 0,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  payment_provider TEXT,
  payment_reference TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

订单状态建议：

```text
pending_payment
paid
processing
shipped
completed
cancelled
refunded
partially_refunded
```

### order_items

保存订单商品快照。

```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id),
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  brand_name TEXT,
  unit_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  subtotal_amount INTEGER NOT NULL,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  member_discount_excluded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

说明：

- 订单必须保存商品快照，不能只保存商品 ID。
- 后续商品改价不应影响历史订单。

### point_transactions

保存积分流水。

```sql
CREATE TABLE point_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  order_id UUID REFERENCES orders(id),
  type TEXT NOT NULL,
  points INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  expires_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

积分流水类型：

```text
earn_order
use_order
refund_reversal
admin_adjust
birthday_gift
tier_upgrade_gift
expire
```

### tier_history

保存等级变化记录。

```sql
CREATE TABLE tier_history (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  from_tier_id UUID REFERENCES member_tiers(id),
  to_tier_id UUID NOT NULL REFERENCES member_tiers(id),
  reason TEXT NOT NULL,
  order_id UUID REFERENCES orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### coupons

第一版可以先不做优惠券。如果要预留：

```sql
CREATE TABLE coupons (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  value INTEGER NOT NULL,
  min_order_amount INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 核心业务流程

### 注册流程

```text
1. 用户输入 email / phone / password
2. 后端校验账号是否已存在
3. 创建 users
4. 创建 member_profiles
5. 默认等级为普通会员
6. 返回登录状态
```

### 登录流程

```text
1. 用户输入账号和密码
2. 后端校验密码
3. 创建 session
4. 前端进入会员中心或回到购物车
```

### 下单流程

```text
1. 前端提交购物车商品
2. 后端重新读取商品价格和库存
3. 后端读取会员等级
4. 计算商品小计
5. 计算会员折扣
6. 计算优惠券折扣
7. 计算积分抵扣
8. 计算运费
9. 创建 pending_payment 订单
10. 发起支付
11. 返回支付链接或支付参数
```

关键点：

- 价格、折扣、积分必须由后端计算。
- 前端只能展示估算，不可信任。
- 订单创建时必须保存商品快照。

### 支付成功流程

```text
1. 支付平台发送 webhook
2. 后端验证 webhook 签名
3. 查询订单
4. 如果订单已处理，直接返回成功，避免重复发积分
5. 更新订单状态为 paid
6. 计算 eligible_paid_amount
7. 发放积分
8. 更新会员累计消费
9. 判断会员等级是否升级
10. 如果升级，写入 tier_history
11. 发送支付成功和会员权益通知
```

### 积分发放函数

伪代码：

```js
function calculatePoints(order) {
  return Math.floor(order.eligiblePaidAmount / 100);
}
```

金额单位是分：

```text
100 分 = ¥1
```

### 等级升级函数

伪代码：

```js
function resolveTier(lifetimePaidAmount, tiers) {
  return tiers
    .filter((tier) => tier.minLifetimePaidAmount <= lifetimePaidAmount)
    .sort((a, b) => b.minLifetimePaidAmount - a.minLifetimePaidAmount)[0];
}
```

### 退款流程

第一版也必须预留退款逻辑，否则积分会膨胀。

```text
1. 订单发生全额或部分退款
2. 计算退款对应的 eligible_paid_amount
3. 扣减 lifetime_paid_amount
4. 扣回对应积分
5. 如果积分余额不足，允许变为负数或记录待扣积分
6. 第一版不自动降级
```

推荐第一版：

```text
退款扣积分，但不降级
```

## API 设计

### Auth

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Member

```http
GET /api/member/profile
GET /api/member/points
GET /api/member/orders
GET /api/member/tier-progress
PATCH /api/member/profile
```

### Cart / Checkout

```http
POST /api/checkout/quote
POST /api/checkout/create-order
POST /api/checkout/start-payment
```

说明：

`quote` 用于购物车实时计算：

```json
{
  "items": [
    { "productId": "ruby-tea", "quantity": 1 }
  ],
  "couponCode": "WELCOME",
  "pointsToUse": 100
}
```

返回：

```json
{
  "subtotalAmount": 52000,
  "memberDiscountAmount": 2600,
  "couponDiscountAmount": 0,
  "pointsDiscountAmount": 100,
  "shippingAmount": 0,
  "payableAmount": 49300,
  "pointsToEarn": 493,
  "memberTier": {
    "name": "金卡会员",
    "discountRate": 0.95
  }
}
```

### Payment Webhook

```http
POST /api/webhooks/payment
```

要求：

- 必须验证支付平台签名。
- 必须做到幂等处理。
- 同一个支付事件不能重复发积分。

### Admin

```http
GET   /api/admin/members
GET   /api/admin/members/:id
PATCH /api/admin/members/:id/tier
POST  /api/admin/members/:id/points
GET   /api/admin/orders
PATCH /api/admin/orders/:id/status
GET   /api/admin/member-tiers
POST  /api/admin/member-tiers
PATCH /api/admin/member-tiers/:id
```

## 前端页面计划

### 新增页面

```text
login.html
register.html
account.html
member.html
points.html
orders.html
membership.html
```

### Header 修改

未登录：

```text
登录
注册
购物车
```

已登录：

```text
会员中心
当前等级
积分
订单
退出
购物车
```

### 会员中心 account.html

显示：

```text
会员姓名 / 邮箱 / 手机
当前等级
累计有效消费
可用积分
当前折扣
距离下一等级还差多少
最近订单
最近积分流水
专属权益
```

示例：

```text
当前等级：金卡会员
累计消费：¥9,260
可用积分：826
当前折扣：95 折
距离黑卡还差：¥10,740
```

### membership.html

显示完整会员规则：

```text
等级表
升级条件
积分计算方式
积分有效期
积分抵扣方式
退款后积分处理
折扣不可叠加说明
```

### 购物车改造

购物车需要展示：

```text
商品小计
会员等级
会员折扣
可用积分
本单可抵扣积分
本单预计获得积分
最终应付金额
距离下一等级还差多少
```

未登录时展示：

```text
登录后可获得积分，并享受会员等级折扣。
```

## 当前项目改造位置

当前项目已经有：

```text
src/assets/js/cart-store.js
src/assets/js/cart-ui.js
src/assets/js/checkout.js
src/assets/js/app.js
```

会员系统第一步需要新增：

```text
src/assets/js/auth-client.js
src/assets/js/member-client.js
src/assets/js/checkout-client.js
src/pages/login.njk
src/pages/register.njk
src/pages/account.njk
src/pages/member.njk
src/pages/points.njk
src/pages/orders.njk
src/pages/membership.njk
```

`checkout.js` 需要从当前的咨询订单 adapter 改成调用后端：

```js
async function startCheckout(cartItems) {
  const quote = await checkoutClient.quote(cartItems);
  const order = await checkoutClient.createOrder(cartItems, quote);
  return checkoutClient.startPayment(order.id);
}
```

## 后端项目结构建议

```text
server/
  src/
    app.js
    db.js
    modules/
      auth/
        auth.routes.js
        auth.service.js
      members/
        members.routes.js
        members.service.js
      tiers/
        tiers.service.js
      orders/
        orders.routes.js
        orders.service.js
      points/
        points.service.js
      checkout/
        checkout.routes.js
        checkout.service.js
      payments/
        payments.routes.js
        payments.service.js
      admin/
        admin.routes.js
    utils/
      money.js
      errors.js
  migrations/
  package.json
```

## 开发阶段

### 阶段 1：会员基础

目标：

```text
可以注册、登录、退出、查看当前会员资料。
```

任务：

1. 建立后端项目。
2. 建立 PostgreSQL 数据库。
3. 创建 `users`、`member_profiles`、`member_tiers` 表。
4. 实现注册、登录、退出、当前用户接口。
5. 前端新增登录、注册、会员中心页面。
6. Header 根据登录状态显示不同入口。

验收：

- 新用户注册后自动成为普通会员。
- 登录后能看到会员中心。
- 退出后不能访问会员中心。

### 阶段 2：订单与支付

目标：

```text
购物车可以创建真实订单，并进入支付流程。
```

任务：

1. 创建 `orders`、`order_items` 表。
2. 后端实现 `/api/checkout/quote`。
3. 后端实现 `/api/checkout/create-order`。
4. 接入一个支付方式。
5. 实现支付 webhook。
6. 订单支付成功后状态变为 `paid`。

验收：

- 订单金额由后端计算。
- 前端篡改价格无效。
- 支付成功后订单状态正确。
- webhook 重复发送不会重复处理。

### 阶段 3：积分系统

目标：

```text
支付成功后自动发放积分。
```

任务：

1. 创建 `point_transactions` 表。
2. 实现积分计算函数。
3. 支付成功后写入积分流水。
4. 更新会员可用积分。
5. 会员中心显示积分余额和流水。

验收：

- 实际支付 ¥980，普通会员获得 980 积分。
- 积分流水有订单关联。
- 刷新会员中心后积分仍然正确。
- 取消订单不会发积分。

### 阶段 4：会员等级升级

目标：

```text
累计有效消费达到门槛后自动升级。
```

任务：

1. 创建 `tier_history` 表。
2. 支付成功后更新累计有效消费。
3. 根据累计消费匹配最高等级。
4. 升级后写入等级记录。
5. 会员中心显示升级进度。

验收：

- 累计消费达到 ¥3,000 后升级银卡。
- 累计消费达到 ¥8,000 后升级金卡。
- 会员中心展示距离下一等级还差多少。
- 重复 webhook 不会重复升级或重复写流水。

### 阶段 5：会员折扣

目标：

```text
购物车和订单按会员等级享受折扣。
```

任务：

1. `/api/checkout/quote` 加入会员折扣计算。
2. 购物车显示会员等级和折扣金额。
3. 订单保存 `member_discount_amount`。
4. 支持商品排除会员折扣。

验收：

- 金卡会员下单享 95 折。
- 特价商品可配置不参与会员折扣。
- 订单详情能看到会员折扣金额。

### 阶段 6：积分抵扣

目标：

```text
会员可以用积分抵扣部分订单金额。
```

任务：

1. 设置积分抵扣比例。
2. 购物车输入使用积分。
3. 后端校验可用积分和抵扣上限。
4. 创建订单时锁定或扣除积分。
5. 支付失败时释放积分。
6. 退款时按比例返还或追回积分。

验收：

- 100 积分可抵 ¥1。
- 每单最多抵扣商品应付金额 10%。
- 积分不足时不能提交。
- 支付失败不扣积分。

### 阶段 7：优惠券和会员礼

目标：

```text
扩展生日礼、升等礼、会员日、专属优惠券。
```

任务：

1. 创建 `coupons`、`coupon_redemptions` 表。
2. 注册礼。
3. 生日礼。
4. 升等礼。
5. 会员日。
6. 会员专属优惠券列表。

验收：

- 新会员注册可获得注册礼。
- 升级后可获得升等礼。
- 生日月份可领取生日礼。
- 优惠券使用后不能重复使用。

## 管理后台需求

第一版后台可以先做简单表格。

需要功能：

```text
会员列表
会员详情
订单列表
订单详情
手动调整积分
手动调整会员等级
会员等级配置
积分流水查询
导出会员名单
```

后台必须记录操作日志：

```text
谁在什么时候调整了哪个会员的积分或等级
调整前是什么
调整后是什么
原因是什么
```

## 风险和注意事项

### 金额必须用整数

数据库里金额用“分”为单位，不能用浮点数。

错误：

```text
980.00
```

正确：

```text
98000
```

### 积分发放必须幂等

支付 webhook 可能重复发送。

必须保证同一个订单只发一次积分：

```text
如果 orders.points_awarded > 0，则不再重复发放
```

### 前端数据不能可信

不能相信前端传来的：

- 商品价格
- 折扣金额
- 会员等级
- 积分余额
- 应付金额

这些都必须由后端重新计算。

### 退款会影响积分

如果不处理退款，会员可以通过买后退款刷积分和等级。

第一版至少要做到：

```text
退款订单扣回对应积分
退款金额从累计有效消费中扣除
暂不自动降级
```

### 会员等级是否永久

第一版建议永久等级，降低实现复杂度。

后续如要做保级，需要增加：

```text
tier_started_at
tier_expires_at
renewal_required_amount
renewal_period
```

## 第一版最小可行范围

建议第一版只做这些：

1. 注册 / 登录 / 退出。
2. 会员中心。
3. 后端订单。
4. 支付成功 webhook。
5. 按实际支付金额发积分。
6. 累计有效消费。
7. 自动升级会员等级。
8. 购物车显示会员折扣。
9. 会员中心显示积分、等级、升级进度。

暂不做：

- 积分抵扣
- 生日礼
- 升等礼
- 会员日
- 复杂优惠券
- 年度保级
- 线下 POS 导入

## 里程碑

### M1：会员基础可用

交付：

```text
登录注册
会员中心
会员等级基础表
```

### M2：订单支付闭环

交付：

```text
创建订单
支付成功
订单记录
```

### M3：积分和等级

交付：

```text
积分发放
积分流水
累计消费
自动升级
升级记录
```

### M4：会员折扣

交付：

```text
购物车会员折扣
订单会员折扣
等级权益展示
```

### M5：运营功能

交付：

```text
后台会员管理
手动调整积分
会员名单导出
优惠券预留
```

## 验收清单

上线前必须验证：

1. 新用户注册后自动生成会员资料。
2. 登录后 Header 显示会员入口。
3. 未登录不能查看会员中心。
4. 购物车价格由后端 quote 返回。
5. 支付成功后订单状态变为 `paid`。
6. 支付成功后积分正确入账。
7. 积分流水和订单关联。
8. 累计消费达到门槛后自动升级。
9. 会员折扣在购物车和订单中一致。
10. 重复 webhook 不会重复发积分。
11. 退款后积分和累计消费能被扣回。
12. 前端篡改价格不会影响最终订单金额。
13. 后台可以查看会员、订单、积分流水。
14. 所有金额计算没有小数误差。
