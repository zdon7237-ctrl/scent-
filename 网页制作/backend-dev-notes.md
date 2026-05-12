# 后端开发备忘

更新日期：2026-05-06

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

当前阶段已建立 PostgreSQL schema、migration、seed、连接模块和 repository 入口。`DATABASE_URL` 启用后，主业务 API 会通过 repository 读写 PostgreSQL；未设置时继续使用 JSON fallback。

本地测试库示例：

```bash
createdb scent_archive_test
DATABASE_URL=postgres://localhost:5432/scent_archive_test npm run db:migrate
DATABASE_URL=postgres://localhost:5432/scent_archive_test npm run db:seed
```

PostgreSQL smoke test 只会在 `DATABASE_URL` 指向看起来像测试库的数据库时执行；否则会跳过，避免污染生产数据库。

支付和退款金额字段统一使用 `payment_amount` / `refund_amount`。

## 后台入口

后台管理页面：

```text
http://localhost:8788/admin.html
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

## 支付 Webhook

支付 webhook 使用独立密钥，不复用后台登录能力：

```text
POST /api/webhooks/payment
header: x-webhook-secret
```

本地默认：

```text
PAYMENT_WEBHOOK_SECRET=dev-webhook
```

生产环境必须设置强随机值，并通过支付服务端侧配置传入。webhook secret 只用于支付回调，不能用于后台 API。

## 生产环境提醒

- 不要把本地 seed 密码用于生产。
- 生产环境必须显式设置安全的 `SEED_ADMIN_PASSWORD`，或后续改成正式管理员创建流程。
- 生产环境必须显式设置强随机 `PAYMENT_WEBHOOK_SECRET`。
- 后台接口不能回退到 `ADMIN_KEY`、`x-admin-key`、共享 key 或浏览器 localStorage 密钥。
- webhook secret 只能用于支付回调，不能用于后台 API。
