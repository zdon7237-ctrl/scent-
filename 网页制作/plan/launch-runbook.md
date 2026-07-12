# 馥屿商业版发布 Runbook

更新日期：2026-07-13

## 1. 部署模型

| 用途 | 平台 | 输出 | 数据环境 |
|---|---|---|---|
| Production | Vercel | `dist/` + `/api/*` Function | Neon Production、生产 Blob、生产 Upstash、Resend Production |
| Pull Request Preview | Vercel | `dist/` + `/api/*` Function | 独立 Neon branch、独立 Blob/Upstash/Resend 测试资源 |
| 应急只读降级 | Netlify | `dist-public/` | 无动态 API、会员或交易数据 |

Vercel build 只校验环境并构建，不执行 migration 或 seed。`dist-public` 不是商业生产包。

## 2. 为什么合并 main 不会直接发布

根目录与 `网页制作/` 的 `vercel.json` 都配置了 `ignoreCommand`。当 Vercel Git 集成发现 `main` commit 时，`scripts/check-vercel-auto-deploy.mjs` 返回 Vercel 的“跳过构建”状态；PR 分支仍正常生成 Preview。

正式 Production 只能由 `.github/workflows/scent-atoll-release.yml` 发布。该工作流先完成审批、平台审计、隔离检查和数据库 migration，再用 `SCENT_ATOLL_CONTROLLED_RELEASE=1` 创建不绑定域名的 Vercel 云端候选，验证后才 promote。

不要在 Vercel 控制台手工 Redeploy Production，也不要本地运行 `vercel --prod`。这些操作不属于受保护链路，即使技术上有权限也视为发布失败。

可本地验证忽略规则：

```bash
cd 网页制作
VERCEL_GIT_PROVIDER=github VERCEL_GIT_COMMIT_REF=main \
  node scripts/check-vercel-auto-deploy.mjs
test $? -eq 0   # Vercel 约定：0 表示跳过

VERCEL_GIT_PROVIDER=github VERCEL_GIT_COMMIT_REF=feature/test \
  node scripts/check-vercel-auto-deploy.mjs
test $? -eq 1   # Vercel 约定：1 表示继续 Preview build
```

## 3. 一次性平台配置

### Vercel

1. 项目连接仓库根目录，Production Branch 设置为 `main`。
2. Project Settings -> Build and Deployment -> Node.js Version 设置为 `22.x`。
3. 按本项目的发布门禁，从 Hobby 升级到适用的 Pro/Enterprise 套餐；平台审计会阻止 Hobby 发布。
4. 保留 Git Preview；每个 PR 必须有 Preview URL。
5. Production 与 Preview 分别录入 runtime 环境变量，不能把同一个 secret 同时勾选两个环境。

runtime 必需变量及 Marketplace 新旧名称见 `.env.production.example`、`.env.preview.example`。新版 Blob 使用 `BLOB_STORE_ID` 和平台自动注入的 `VERCEL_OIDC_TOKEN`；Marketplace Upstash 使用 `UPSTASH_REDIS_KV_REST_API_URL` / `UPSTASH_REDIS_KV_REST_API_TOKEN`。

Production 必须填写真实 `BUSINESS_NAME`。`DATA_RESIDENCY_DECISION` 只能是 `cross_border_approved` 或 `domestic_infrastructure`。Production 不得设置 `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`，两个环境都不得设置 `PAYMENT_WEBHOOK_SECRET`。

### GitHub production Environment

创建名为 `production` 的 Environment：

- required reviewer 至少一人；
- deployment branch policy 使用 custom policy，且只允许 `main`；
- 不允许管理员绕过审批。

`main` branch protection 同时要求至少一次 PR review、必需状态检查 `Scent Atoll CI / build-and-test`，并将规则应用到管理员。代码无法替代这些平台设置。

Environment Secrets：

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

`GITHUB_RELEASE_AUDIT_TOKEN` 使用只限当前仓库的 fine-grained token，授予 `Environments: read` 和 `Administration: read`，不授予代码写入权限。`PRODUCTION_DATABASE_URL` 是 migration 专用 secret，必须指向与 Vercel Production `DATABASE_URL` 相同的 Neon branch。

Environment Variables：

```text
PRODUCTION_URL=https://正式主域名
PREVIEW_URL=https://稳定的预览别名
PRODUCTION_BLOB_STORE_ID=<实际 Store ID>
PREVIEW_BLOB_STORE_ID=<实际 Store ID>
PRODUCTION_UPSTASH_REDIS_REST_URL=<实际 REST URL>
PREVIEW_UPSTASH_REDIS_REST_URL=<实际 REST URL>
PRODUCTION_RESEND_RESOURCE_ID=<Marketplace 不可变资源 ID>
PREVIEW_RESEND_RESOURCE_ID=<Marketplace 不可变资源 ID>
PRODUCTION_EMAIL_FROM=<Production 发件人>
PREVIEW_EMAIL_FROM=<Preview 发件人>
```

资源 ID 必须取自平台 URL/详情页，不能使用自定义别名伪造隔离。完整说明见 `launch-env-intake.md`。

### GitHub Actions 库存清理

`.github/workflows/release-expired-reservations.yml` 每 10 分钟调用 `/api/internal/release-expired-reservations`；这是 Hobby 不支持 10 分钟 Vercel Cron 后采用的调度方式，不是 Vercel Cron。

定时 job 不引用需要人工 reviewer 的 `production` Environment，否则每次 schedule 都会等待审批。在仓库级 Actions Variables 设置 `PRODUCTION_URL`，在仓库级 Actions Secrets 设置 `CRON_SECRET`；该 secret 必须与 Vercel Production runtime 的 `CRON_SECRET` 一致。上线前用手动触发和一次真实 schedule 各验证一次。

## 4. 不回拉 Sensitive env

Release workflow 禁止 `vercel env pull`，也不执行本地 `vercel build --prod`：

- Vercel Sensitive env 只在 Vercel 云端 build/runtime 解密；
- migration 只读取 GitHub Environment 的 `PRODUCTION_DATABASE_URL`；
- workflow 用 `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` 生成临时 `.vercel/project.json`，不下载环境文件；
- source candidate 上传 Vercel 后，由 Vercel 云端使用实际 Production runtime env 运行 `check:env` 和 build。

不要把 Vercel Sensitive 变量改成普通明文变量来迁就 CI，也不要把 `vercel env pull` 加回工作流。

## 5. 资源隔离验证

工作流通过 `ISOLATION_PRODUCTION_*` / `ISOLATION_PREVIEW_*` 映射 GitHub Secrets/Variables，运行：

```bash
node scripts/check-environment-isolation.mjs --prefixed-env
```

判断规则：

- Neon：忽略用户名、密码、query 和 `-pooler` 差异，比较数据库 host、port 与库名；
- Blob：优先比较 `BLOB_STORE_ID`，旧集成才比较 `BLOB_READ_WRITE_TOKEN`；OIDC token 是临时凭据，不作为资源身份；
- Upstash：兼容旧变量与 Marketplace `UPSTASH_REDIS_KV_*`，比较规范化 REST URL；不同 token 指向同一 URL 仍判定共享；
- Resend：Release 使用 Marketplace 不可变 `RESEND_RESOURCE_ID`；旧环境文件才回退比较 API key；
- `SITE_URL`、`APP_ORIGIN`、`EMAIL_FROM`、`CRON_SECRET` 也必须不同。

检查只比较 GitHub Secrets/Variables 中人工填入的资源身份，不会从 Vercel Marketplace 自动发现 Blob、Upstash 或 Resend 资源。录入前必须在 Vercel 资源详情页人工核对 ID/endpoint。脚本只输出变量/资源类别，不输出 secret 值。

## 6. 外部设置只读审计

Production workflow 在 migration 前运行：

```bash
node scripts/check-platform-release-settings.mjs
```

它通过 GitHub/Vercel API 只读检查：Environment reviewer、只允许 `main`、`main` PR/CI/admin 保护、Vercel Node 22，以及团队套餐不是 Hobby。API token 权限不足、设置不存在或 API 无法读取都会失败；脚本不会自动修复平台设置，也不会触发部署。

本地复查示例：

```bash
cd 网页制作
GITHUB_RELEASE_AUDIT_TOKEN="$(gh auth token)" \
GITHUB_REPOSITORY=zdon7237-ctrl/scent- \
VERCEL_TOKEN=<只读可检查项目和团队的token> \
VERCEL_ORG_ID=<team-id> \
VERCEL_PROJECT_ID=<project-id> \
node scripts/check-platform-release-settings.mjs
```

## 7. PR Preview 流程

涉及 schema 的 PR 必须先迁移独立 Neon Preview branch。直接从 Neon 获取该 branch 的连接串，用终端隐藏输入，不从 Vercel 回拉：

```bash
cd 网页制作
read -rsp "Preview DATABASE_URL: " PREVIEW_DATABASE_URL; echo
DEPLOYMENT_ENV=preview \
DATABASE_URL="$PREVIEW_DATABASE_URL" \
ALLOW_RELEASE_MIGRATION=preview \
node scripts/release-migrate.mjs
unset PREVIEW_DATABASE_URL
```

然后重新触发同一 commit 的 Vercel Preview，并执行：

```bash
DEPLOYMENT_URL=https://该PR预览地址 \
VERCEL_AUTOMATION_BYPASS_SECRET=预览保护密钥 \
node scripts/check-commercial-deployment.mjs
```

合并前必须确认 CI、Preview migration、页面/API 检查和本次业务 E2E 全部通过，且 Preview 没有读取或写入 Production 资源。

## 8. 全新 Production 数据库初始化

只对空的 Production 数据库执行一次。先确认 Neon 备份/时间点恢复可用，再从 Neon 直接取得连接串：

```bash
cd 网页制作
read -rsp "Production DATABASE_URL: " PRODUCTION_DATABASE_URL; echo

DEPLOYMENT_ENV=production \
DATABASE_URL="$PRODUCTION_DATABASE_URL" \
ALLOW_RELEASE_MIGRATION=production \
node scripts/release-migrate.mjs

DATABASE_URL="$PRODUCTION_DATABASE_URL" \
BOOTSTRAP_COMMERCE_CONFIRM=initialize-commerce-data \
node scripts/bootstrap-commerce.mjs

read -rp "Owner email: " BOOTSTRAP_OWNER_EMAIL
read -rp "Owner name: " BOOTSTRAP_OWNER_NAME
read -rsp "One-time owner password: " BOOTSTRAP_OWNER_PASSWORD; echo
DATABASE_URL="$PRODUCTION_DATABASE_URL" \
BOOTSTRAP_CONFIRM=create-first-owner \
BOOTSTRAP_OWNER_EMAIL="$BOOTSTRAP_OWNER_EMAIL" \
BOOTSTRAP_OWNER_NAME="$BOOTSTRAP_OWNER_NAME" \
BOOTSTRAP_OWNER_PASSWORD="$BOOTSTRAP_OWNER_PASSWORD" \
node scripts/bootstrap-owner.mjs

unset PRODUCTION_DATABASE_URL BOOTSTRAP_OWNER_EMAIL BOOTSTRAP_OWNER_NAME BOOTSTRAP_OWNER_PASSWORD
```

脚本在已有业务基础数据或 owner 时拒绝覆盖。禁止运行开发 `db:seed`。初始化后登录后台更换一次性密码，确认 `/api/health/ready` 为 `ready`，并把同一 Production 数据库连接安全写入 GitHub `PRODUCTION_DATABASE_URL` 与 Vercel Production `DATABASE_URL`。

## 9. Production 发布

1. PR 合并到 `main` 后，确认 Vercel 的 Git Production deployment 显示 skipped，而不是 Ready/Building。
2. 确认 CI 全绿，记录当前 production deployment ID、migration ID、Neon 备份点和回滚目标。
3. GitHub Actions 手动运行 **Scent Atoll Production Release**，从 `main` 输入 `RELEASE`。
4. Reviewer 核对 commit、备份、平台审计与变更单后批准。
5. 工作流按固定顺序执行：

```text
release credential/branch gate
-> GitHub/Vercel settings audit
-> Production/Preview resource isolation
-> production migration
-> Vercel cloud candidate (--prod --skip-domain)
-> candidate pages/API/auth verification
-> promote
-> production alias verification
```

候选 build 或验证失败时不会 promote。发布成功后完成一次最小订单演练，检查错误告警、订单审计、邮件、库存和积分。24 小时内重点观察 5xx、登录失败率、邮件失败、幂等冲突和数据库连接耗尽。

## 10. 失败、回滚与降级

- **migration 失败**：停止发布；修复为新的前向 migration 后重跑，禁止现场编辑生产表。
- **candidate 失败**：不 promote，Production alias 不切换。此时 migration 已作用于生产数据库，必须确认 schema 向后兼容，并同时检查当前生产版本与 Vercel build/function 日志。
- **promote 后故障**：rollback 或 promote 上一个已知正常 deployment；schema 必须保持向后兼容。
- **数据损坏**：冻结订单与后台写操作；用 Neon 时间点恢复到新 branch，核对订单/库存/积分后再切换。
- **长期不可用**：暂停登录和交易后，`npm run launch:strict` 生成 `dist-public/`，由 Netlify 发布只读展示页。

回滚后再次运行：

```bash
DEPLOYMENT_URL=https://正式主域名 node scripts/check-commercial-deployment.mjs
```

## 11. 发布完成标准

- `main` Git 自动 Production deployment 被跳过，Production 只来自受保护 workflow。
- workflow 的平台审计、隔离、migration、candidate、两次线上验证全部成功。
- Vercel 是 Node 22 且使用适合商业用途的套餐，不是 Hobby。
- Production/Preview 使用不同 Neon branch、Blob Store、Upstash endpoint、Resend resource 和 Cron secret。
- Production 没有默认管理员、开发 seed、旧支付 webhook 或占位经营信息。
- 备份恢复、告警、应用回滚和订单到退款演练均有记录。
