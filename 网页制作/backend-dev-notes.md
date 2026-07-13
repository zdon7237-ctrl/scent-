# 后端开发备忘

更新日期：2026-07-10

阶段进度、验证结果和剩余风险统一记录在 `plan/project-log.md`。本文件只保留本地运行和后端操作备忘。

## 启动命令

```bash
npm start
```

`npm start` 从 `dist` 目录提供静态页面。需要临时服务其他目录时，可以设置 `PUBLIC_DIR`。

启动后访问：

```text
http://localhost:8788
```

## 数据库模式

项目实际目录是 `网页制作/`。默认仍使用本地 JSON fallback：

```text
server/data/db.json
```

设置 `DATABASE_URL` 后，可以使用 PostgreSQL 基础设施：

```bash
DATABASE_URL=postgres://localhost:5432/scent_archive_test npm run db:migrate
DATABASE_URL=postgres://localhost:5432/scent_archive_test npm run db:seed
```

`DATABASE_URL` 启用后，主业务 API 通过 repository 读写 PostgreSQL；未设置时只允许本地开发和测试使用 JSON fallback。Production 必须配置 PostgreSQL，否则应用直接拒绝启动。

本地测试库示例：

```bash
createdb scent_archive_test
DATABASE_URL=postgres://localhost:5432/scent_archive_test npm run db:migrate
DATABASE_URL=postgres://localhost:5432/scent_archive_test npm run db:seed
```

PostgreSQL smoke test 只会在 `DATABASE_URL` 指向看起来像测试库的数据库时执行；否则会跳过，避免污染生产数据库。

`db:seed` 仅用于本地或可丢弃的测试数据库。全新 Production 数据库按以下顺序初始化：

```text
release migration -> db:bootstrap-commerce -> db:bootstrap-owner
```

后续 Production 发布只执行 release migration，不再运行 seed 或 bootstrap。完整命令见 `plan/launch-runbook.md`。

支付和退款金额字段统一使用 `payment_amount` / `refund_amount`。

## 后台入口

会员与管理员共用登录入口，服务端验证账号后自动分流：

```text
http://localhost:8788/login.html
```

Owner 登录后进入后台管理页面：

```text
http://localhost:8788/admin.html#overview
```

后台接口地址：

```text
http://localhost:8788/api/admin
```

## 本地后台账号

本地 JSON 数据库没有管理员时，后端会自动 seed 一个开发管理员：

```text
email: admin@scent.local
password: dev-admin
role: owner
```

可用环境变量覆盖：

```bash
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=replace-me
SEED_ADMIN_ROLE=owner
```

后台访问不再使用前端密钥。管理员登录成功后，后端会写入独立的 `sa_admin_session` cookie。

统一登录只统一页面入口，不合并管理员和会员身份。Owner 邮箱不要同时注册为普通会员邮箱；管理员与会员继续使用独立的数据表和 Session Cookie。

`ADMIN_KEY` / `x-admin-key` 不再是后台访问方式。`dev-admin` 只允许作为本地 seed 管理员密码使用，不能作为生产密码。

## 后台权限

后台接口通过管理员 session 和角色权限判断：

```text
admin_users
admin_sessions
role permissions
```

第一版角色：

- `owner`：全部权限。
- `manager`：运营管理权限，不包含系统级管理员创建。
- `support`：查看会员、查看订单、处理订单状态。
- `fulfillment`：订单和兑换履约相关权限。

操作日志记录可信的管理员 ID、邮箱、名称和角色，不读取前端传来的 actor。

后台写接口还会校验请求来源。`POST` / `PATCH` / `PUT` / `DELETE` 的 `/api/admin/*` 请求必须带有可信 `Origin` 或 `Referer`：

- 默认允许当前服务自身 host。
- 可通过 `APP_ORIGIN` 配置额外允许来源，多个来源用逗号分隔。
- 来源校验只是后台 session 的补充保护，不能替代登录和权限。

## 支付与 Webhook

旧支付 webhook 只保留给本地开发测试：

```text
POST /api/webhooks/payment
header: x-webhook-secret
```

本地默认：

```text
PAYMENT_WEBHOOK_SECRET=dev-webhook
```

Production 和 Preview 都禁止设置 `PAYMENT_WEBHOOK_SECRET`。第一阶段使用微信人工转账，由后台登录管理员核对参考号后确认收款。

第二阶段的微信支付回调使用 API v3 平台证书、公钥和原始请求签名验签，不使用旧 webhook secret。取得商户号、AppID 和证书并完成退款、查询与对账闭环前，必须保持：

```text
WECHAT_PAY_ENABLED=false
```

## 生产环境提醒

- 不要把本地 seed 密码用于生产。
- Production 不得设置 `SEED_ADMIN_EMAIL`、`SEED_ADMIN_PASSWORD` 或 `PAYMENT_WEBHOOK_SECRET`。
- 初始 owner 只能通过一次性 `db:bootstrap-owner` 创建，完成后删除全部 `BOOTSTRAP_*` 变量。
- Production 必须配置 PostgreSQL、Resend、Blob、Upstash、至少 32 位 `CRON_SECRET`、真实 `APP_ORIGIN` 和 `SITE_URL`。
- 后台接口不能回退到 `ADMIN_KEY`、`x-admin-key`、共享 key 或浏览器 localStorage 密钥。
- 微信支付状态只能由可信 API v3 回调或主动查询改变，不能由浏览器或普通后台状态编辑直接伪造。
