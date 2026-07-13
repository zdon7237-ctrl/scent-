# 馥屿商业部署变量收集表

更新日期：2026-07-13

真实 secret 只录入 Vercel 或 GitHub `production` Environment，不要发在聊天、工单正文或提交到 Git。Vercel runtime 与 GitHub release runner 是两套边界：前者负责云端构建/运行，后者只持有迁移和只读审计所需的最少凭据。

## Vercel Production runtime

公开运营信息：

```text
SITE_URL=https://正式主域名
APP_ORIGIN=https://正式主域名
CONTACT_EMAIL=客服邮箱
CONTACT_WECHAT=客服微信
BUSINESS_NAME=真实经营主体名称
STUDIO_BOOKING=预约方式
CUSTOMER_HOURS=12:00 - 20:00
```

服务配置：

```text
DEPLOYMENT_ENV=production
DATA_RESIDENCY_DECISION=<cross_border_approved 或 domestic_infrastructure>
DATABASE_URL=<Neon Production runtime 连接>
RESEND_API_KEY=<Resend Production>
EMAIL_FROM=<Production 已验证发件人>
BLOB_STORE_ID=<Production Blob Store ID>
UPSTASH_REDIS_KV_REST_API_URL=<Production Upstash>
UPSTASH_REDIS_KV_REST_API_TOKEN=<Production Upstash>
CRON_SECRET=<至少 32 位>
WECHAT_PAY_ENABLED=false
```

`VERCEL_OIDC_TOKEN` 由 Vercel 自动注入，不手工保存。旧 Blob 可使用 `BLOB_READ_WRITE_TOKEN`；旧 Upstash 集成可使用 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`。不要设置 `SEED_ADMIN_EMAIL`、`SEED_ADMIN_PASSWORD` 或 `PAYMENT_WEBHOOK_SECRET`。

`SITE_URL` 与 `APP_ORIGIN` 必须是相同 HTTPS 根地址。`BUSINESS_NAME` 必须是真实经营主体，不能只填品牌名。跨境评估未完成时不能填写 `DATA_RESIDENCY_DECISION`，也不能发布交易功能。

## Vercel Preview runtime

使用同名 runtime 变量，但必须来自独立 Neon branch、独立 Blob Store、独立 Upstash 数据库和独立 Resend 测试资源，并设置：

```text
DEPLOYMENT_ENV=preview
SITE_URL=https://稳定的预览别名
APP_ORIGIN=https://稳定的预览别名
```

不得把 Production secret 同时勾选到 Preview。第一阶段保持 `WECHAT_PAY_ENABLED=false`。Preview 不设置 `PAYMENT_WEBHOOK_SECRET`，人工收款测试走后台确认。

## GitHub production Environment

### Secrets

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
GITHUB_RELEASE_AUDIT_TOKEN
PRODUCTION_DATABASE_URL
PREVIEW_DATABASE_URL
CRON_SECRET
PREVIEW_CRON_SECRET
VERCEL_AUTOMATION_BYPASS_SECRET   # 仅开启 Deployment Protection 时
```

`PRODUCTION_DATABASE_URL` 是 migration 专用 secret，应指向与 Vercel Production runtime 相同的 Neon 生产分支。它单独保存在 GitHub Environment，release workflow 不依赖、也不允许通过 `vercel env pull` 获取 Vercel Sensitive env。`PREVIEW_DATABASE_URL` 只用于比较数据库资源指纹，不执行 Preview 写入。

`GITHUB_RELEASE_AUDIT_TOKEN` 使用只限当前仓库的 fine-grained token，授予 `Environments: read` 和 `Administration: read`，用于检查 Environment reviewer 和 `main` 分支保护。不授予 Contents 写入或其他写权限；权限不足时审计脚本会失败。

库存超时清理的 schedule 不引用需 reviewer 的 `production` Environment。因此还要在仓库级 Actions Variables 存放同一 `PRODUCTION_URL`，在仓库级 Actions Secrets 存放与 Vercel Production 一致的 `CRON_SECRET`。

### Variables

```text
PRODUCTION_URL=https://正式主域名
PREVIEW_URL=https://稳定的预览别名
PRODUCTION_BLOB_STORE_ID=<实际 Store ID>
PREVIEW_BLOB_STORE_ID=<实际 Store ID>
PRODUCTION_UPSTASH_REDIS_REST_URL=<实际 REST URL>
PREVIEW_UPSTASH_REDIS_REST_URL=<实际 REST URL>
PRODUCTION_RESEND_RESOURCE_ID=<Vercel Marketplace 不可变资源 ID>
PREVIEW_RESEND_RESOURCE_ID=<Vercel Marketplace 不可变资源 ID>
PRODUCTION_EMAIL_FROM=<Production 发件人>
PREVIEW_EMAIL_FROM=<Preview 发件人>
```

资源 ID 从 Vercel Storage/Marketplace 资源 URL 或详情页读取，不要填写随意的显示名称。隔离检查会忽略数据库密码与查询参数，按数据库主机/库名识别；Blob 比较 `BLOB_STORE_ID`；Upstash 同时兼容 `UPSTASH_REDIS_REST_URL` 与 Marketplace 的 `UPSTASH_REDIS_KV_REST_API_URL`，按实际 REST endpoint 识别。不同 token 指向同一 endpoint 仍会失败。

## 外部平台设置

- GitHub `production` Environment：至少一名 required reviewer；deployment branch policy 只允许 `main`。
- `main` branch protection：至少一次 PR review、必需状态检查 `Scent Atoll CI / build-and-test`、规则包含管理员。
- Vercel：Node.js 固定为 `22.x`；商业站点不能继续使用 Hobby，发布前升级到适用的商业套餐。
- Vercel Production Branch 保持 `main`。仓库 `ignoreCommand` 会跳过它的 Git 自动 Production build，正式版本只由 release workflow 发布。

这些配置不在 Git 内，不能因代码检查通过就视为完成。只读验证命令：

```bash
cd 网页制作
GITHUB_RELEASE_AUDIT_TOKEN="$(gh auth token)" \
GITHUB_REPOSITORY=zdon7237-ctrl/scent- \
VERCEL_TOKEN=<只读可检查项目和团队的token> \
VERCEL_ORG_ID=<team-id> \
VERCEL_PROJECT_ID=<project-id> \
node scripts/check-platform-release-settings.mjs
```

脚本只读取 GitHub/Vercel 设置，不修改账号或触发部署。Production workflow 会在 migration 之前再次执行同一审计。

Blob Store ID、Upstash REST endpoint 和 Resend resource ID 必须从 Vercel 资源详情页人工核对后录入 GitHub Variables。隔离脚本只比较这些输入，不会调用 Marketplace API 自动发现实际资源。

## 验证边界

GitHub workflow 在 migration 前依次运行下列三个检查，所需值由 GitHub Environment 映射：

```bash
node scripts/check-release-controls.mjs
node scripts/check-environment-isolation.mjs --prefixed-env
node scripts/check-platform-release-settings.mjs
```

Vercel 云端 candidate build 用实际 runtime env 执行 `npm run check:env` 和 `npm run check:deploy`。GitHub workflow 不下载 Vercel Sensitive env，也不在 runner 本地构建 Production candidate。

完整迁移、候选部署、验证、promote 与回滚步骤见 `launch-runbook.md`。
