# 馥屿会员系统计划与实现状态

更新日期：2026-05-05

## 当前结论

会员系统第一版已经实现为可本地运行的闭环：

```text
注册 / 登录 -> 创建订单 -> 后台确认支付 -> 客户确认收货 -> 发积分 -> 累计消费 -> 自动升级 -> 会员折扣
```

当前仍是开发版，不是正式生产版。支付使用后台人工确认，数据库仍保留本地 JSON fallback；真实交易上线前需要接真实支付、正式数据库、生产管理员账号策略、限流、审计和监控。

## 当前会员规则

### 会员等级

| 等级 | 累计有效消费门槛 | 商品折扣 | 积分倍数 | 免运权益 |
|---|---:|---:|---:|---|
| 普通会员 | ¥0 | 无 | 1.0x | 满 ¥599 包邮 |
| 银卡会员 | ¥1,000 | 95 折 | 1.1x | 满 ¥499 包邮 |
| 金卡会员 | ¥10,000 | 92 折 | 1.2x | 满 ¥399 包邮 |
| 钻卡会员 | ¥20,000 | 88 折 | 1.5x | 顺丰包邮 |
| 黑卡会员 | ¥50,000 | 85 折 | 2.0x | 顺丰包邮 |
| 至尊会员 | ¥200,000 | 8 折 | 2.0x | 顺丰包邮 |

免运门槛暂时不继续调整。钻卡、黑卡、至尊沿用高等级包邮。

### 积分规则

积分只在客户确认收货后发放。

```text
积分 = floor(确认收货订单的实付商品金额 * 当前订单会员等级积分倍数)
```

不计入积分：

- 运费
- 未支付订单
- 未确认收货订单
- 已取消订单
- 已退款订单
- 人工调整的非消费金额

积分有效期：

```text
确认收货日起 1 年
```

未来积分商城消耗积分时采用 FIFO：

```text
优先消耗最早获得、最早过期的积分
```

当前规则明确：积分不能抵现金。后续开发积分商城，用积分兑换香水、小样或赠品。

### 支付、确认收货和退款

支付成功只改变订单状态：

```text
pending_payment -> paid
```

确认收货才结算会员权益：

```text
paid / shipped -> completed
发放积分
累计有效消费
自动匹配会员等级
写入积分流水和等级记录
```

退款规则：

```text
paid / shipped / completed -> refunded
```

- 未确认收货的订单退款：不扣积分，不扣累计消费，因为还没有结算。
- 已确认收货的订单退款：扣回积分，扣回累计有效消费，并重新计算会员等级。
- 退款后不保级。

## 已实现内容

### 前端页面

| 页面 | 状态 | 说明 |
|---|---|---|
| `login.html` | 已实现 | 会员登录 |
| `register.html` | 已实现 | 注册后默认普通会员 |
| `account.html` | 已实现 | 会员中心、等级、积分、累计消费 |
| `member.html` | 已实现 | 会员权益与等级规则 |
| `membership.html` | 已实现 | 会员规则入口 |
| `points.html` | 已实现 | 积分余额、流水、有效期 |
| `orders.html` | 已实现 | 订单列表、确认收货 |
| `admin.html` | 已实现 | 本地开发后台 |

### 后端能力

| 模块 | 状态 | 说明 |
|---|---|---|
| 会员注册 / 登录 / 退出 | 已实现 | Session Cookie |
| 会员资料 | 已实现 | 姓名、生日、营销偏好预留 |
| 会员等级 | 已实现 | 6 个等级、折扣、积分倍数、免运门槛 |
| 后端报价 | 已实现 | 商品价格、折扣、运费由后端计算 |
| 订单创建 | 已实现 | 保存商品快照和订单金额 |
| 支付确认 | 已实现 | 开发版人工确认和 webhook |
| 确认收货 | 已实现 | 确认收货后发积分和升级 |
| 积分流水 | 已实现 | 订单积分、退款扣回、人工调整、过期扣回 |
| 积分有效期 | 已实现 | 订单积分一年有效 |
| 退款 | 已实现 | 扣回积分、累计消费、重新计算等级 |
| 后台管理 | 已实现 | 会员、订单、积分流水、操作日志、会员导出 |
| 操作日志 | 已实现 | 记录后台调分、调级、支付、退款、确认收货 |

### 已实现接口

Auth：

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

Member：

```http
GET  /api/member/profile
PATCH /api/member/profile
GET  /api/member/points
GET  /api/member/orders
GET  /api/member/tier-progress
POST /api/member/orders/:id/confirm-receipt
```

Checkout：

```http
POST /api/checkout/quote
POST /api/checkout/create-order
POST /api/checkout/start-payment
```

Payment：

```http
POST /api/webhooks/payment
```

Admin：

```http
GET   /api/admin/members
GET   /api/admin/members/:id
GET   /api/admin/members/export.csv
PATCH /api/admin/members/:id/tier
POST  /api/admin/members/:id/points
GET   /api/admin/orders
PATCH /api/admin/orders/:id/status
POST  /api/admin/orders/:id/pay
POST  /api/admin/orders/:id/complete
POST  /api/admin/orders/:id/refund
GET   /api/admin/points
GET   /api/admin/audit-logs
GET   /api/admin/member-tiers
POST  /api/admin/member-tiers
PATCH /api/admin/member-tiers/:id
```

## 当前技术实现

| 项目 | 当前实现 | 上线建议 |
|---|---|---|
| 前端 | Eleventy 静态页面 + 打包后的 `script.js` | 可继续使用 |
| 后端 | Node.js 内置 HTTP 服务 | 可换 Express / Fastify，也可继续轻量实现 |
| 数据库 | `server/data/db.json` | 换 PostgreSQL / MySQL |
| 后台权限 | 管理员登录、session、角色权限和 Origin 校验已接入 | 生产环境继续配置强密码、限流、监控和管理员创建流程 |
| 支付 | 手动确认 + 开发 webhook | 接微信支付 / 支付宝 / Stripe，并验证签名 |
| 积分商城 | 开发版已实现 | 已支持兑换商品、FIFO 扣积分、扣库存、后台处理和取消返还 |

## 已验证项目

已经通过本地临时数据库接口验收：

- 新用户注册后自动生成普通会员资料。
- 未登录不能访问会员中心接口。
- 购物车报价由后端计算，前端篡改价格无效。
- 支付确认后订单变为 `paid`，但不发积分、不升级。
- 客户确认收货后订单变为 `completed`，积分入账，累计消费入账。
- 重复确认收货不会重复发积分。
- 积分流水关联订单。
- 积分有效期为确认收货日起一年。
- 积分过期会扣回可用积分，并写入过期流水。
- 累计消费达到门槛后自动升级。
- 已确认收货订单退款后会扣回积分和累计消费，并重新计算会员等级。
- 未确认收货订单退款不会错误扣减累计消费。
- 会员折扣在 quote 和订单中一致。
- 后台可以查看会员、订单、积分流水和操作日志。
- 金额计算通过整数分处理，避免小数误差。
- 积分商城已支持无兑换次数限制、FIFO 扣积分、库存扣减、兑换订单、后台状态处理和取消返还。

最近验证命令：

```bash
npm run build
node --check server/src/app.mjs
node --check script.js
```

## 暂未实现

这些不属于当前第一版闭环，但后续上线或运营会需要：

| 功能 | 状态 | 说明 |
|---|---|---|
| 真实支付 | 未实现 | 需要接微信支付 / 支付宝 / Stripe |
| 正式数据库 | 未实现 | 当前仍是本地 JSON |
| 正式后台运营配置 | 部分实现 | 管理员登录/session/角色已实现；真实上线前仍需生产管理员账号、强密码、审计、限流和监控 |
| 优惠券 | 预留 | 数据结构预留，业务未实现 |
| 生日礼 | 未实现 | 需要结合生日月份和领取规则 |
| 升等礼 | 未实现 | 需要升级事件和礼券/赠品规则 |
| 会员日 | 未实现 | 需要活动日、折扣和适用范围 |
| 线下消费导入 | 未实现 | 需要导入后台和去重规则 |
| 普通订单物流/发货流程 | 基础预留 | 普通订单当前只有订单状态，积分兑换订单已支持后台填写物流单号 |
| 邮件/短信通知 | 未实现 | 支付、发货、升级、积分到期提醒 |

## 后续开发顺序建议

1. 接正式数据库，迁移 JSON 数据结构到 PostgreSQL。
2. 配置生产管理员账号、强密码、限流、审计和监控，复核现有后台 session / 角色权限。
3. 接真实支付，并校验支付平台签名。
4. 补完整普通订单发货流程，包括物流单号和确认收货入口。
5. 用真实运营数据试跑积分商城，确认兑换价格、库存和后台处理流程。
6. 做积分到期提醒。
7. 做生日礼、升等礼、会员日和优惠券。

## 本地运行

启动：

```bash
npm start
```

访问：

```text
http://localhost:8788
```

本地 seed 管理员：

```text
admin@scent.local
```

本地开发默认密码由 seed 脚本生成；生产环境必须显式设置安全的 `SEED_ADMIN_PASSWORD`，不能使用默认开发密码。

开发数据库：

```text
server/data/db.json
```

该数据库文件已被 `.gitignore` 忽略。删除后重新启动服务会自动生成空数据库。
