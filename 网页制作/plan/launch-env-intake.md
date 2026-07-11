# 馥屿商业部署变量收集表

更新日期：2026-07-10

真实 secret 只录入 Vercel 或 GitHub Environment，不要发在聊天、工单正文或提交到 Git。变量名与格式参考 `.env.production.example` 和 `.env.preview.example`。

## 公开运营信息

```text
SITE_URL=https://正式主域名
APP_ORIGIN=https://正式主域名
CONTACT_EMAIL=客服邮箱
CONTACT_WECHAT=客服微信
BUSINESS_NAME=真实经营主体名称
STUDIO_BOOKING=预约方式
CUSTOMER_HOURS=12:00 - 20:00
```

`SITE_URL` 与 `APP_ORIGIN` 必须是相同的 HTTPS 根地址，不带路径、查询参数、hash 或末尾 `/`。Production 的 `BUSINESS_NAME` 必须是真实经营主体，不能只填品牌名。`OG_IMAGE` 可选，必须是 HTTPS PNG/JPG/WebP URL。

## Production Secret

由部署负责人直接录入 Vercel Production：

```text
DEPLOYMENT_ENV=production
DATA_RESIDENCY_DECISION=<cross_border_approved 或 domestic_infrastructure>
DATABASE_URL=<Neon Production>
RESEND_API_KEY=<Resend Production>
EMAIL_FROM=<已验证发件人>
BLOB_READ_WRITE_TOKEN=<Production Blob>
UPSTASH_REDIS_REST_URL=<Production Upstash>
UPSTASH_REDIS_REST_TOKEN=<Production Upstash>
WECHAT_PAY_ENABLED=false
```

可选：`EMAIL_REPLY_TO`。告警使用 `ERROR_WEBHOOK_URL` + `ERROR_WEBHOOK_TOKEN`，两者必须成对配置。不要设置 `SEED_ADMIN_EMAIL`、`SEED_ADMIN_PASSWORD` 或开发用 `PAYMENT_WEBHOOK_SECRET`。

`cross_border_approved` 表示已完成大陆用户个人信息跨境存储评估并获准使用境外基础设施；`domestic_infrastructure` 表示账号、地址和订单数据已迁移到境内基础设施。评估仍在进行时不要填写任一值，也不要发布交易功能。

## Preview Secret

Vercel Preview 使用同名变量，但值必须来自独立 Neon 分支、预览 Blob/前缀、预览 Upstash 和 Resend 测试环境，并设置：

```text
DEPLOYMENT_ENV=preview
```

Vercel 的 Production 与 Preview 都不要设置 `PAYMENT_WEBHOOK_SECRET`。开发支付 webhook 在部署环境关闭；Preview 的人工收款测试通过后台确认收款完成。

第一阶段保持 `WECHAT_PAY_ENABLED=false`。只有商户号、AppID、商户证书序列号/私钥、API v3 密钥、通知 URL、平台证书序列号/公钥全部齐全后，才设为 `true`；门禁会在启用时强制检查全部八项。

不得把 Production secret 同时勾选到 Preview。Preview 域名不提交搜索引擎，也不对外传播。

## GitHub Production Environment

Secrets：`VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`，开启 Deployment Protection 时再设置 `VERCEL_AUTOMATION_BYPASS_SECRET`。

Variable：

```text
PRODUCTION_URL=https://正式主域名
```

Environment 必须启用 required reviewer 且只允许 `main`。

## 验证

平台环境由 Vercel build 自动执行 `npm run check:env`。本地仅用临时文件验证变量结构，不把真实值写入 Git：

```bash
vercel env pull /tmp/scent-atoll-production.env --yes --environment=production
vercel env pull /tmp/scent-atoll-preview.env --yes --environment=preview
cd 网页制作
VERCEL_ENV=production node --env-file=/tmp/scent-atoll-production.env scripts/check-launch-env.mjs
npm run check:isolation -- /tmp/scent-atoll-production.env /tmp/scent-atoll-preview.env
npm run check:deploy
```

完整迁移、候选部署、验证、promote 与回滚步骤见 `launch-runbook.md`。
