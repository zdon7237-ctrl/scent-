# 馥屿商业版发布 Runbook

更新日期：2026-07-10

## 1. 部署模型

| 用途 | 平台 | 输出 | 数据环境 |
|---|---|---|---|
| Production | Vercel | `dist/` + `/api/*` Function | Neon Production、生产 Blob、生产 Upstash、Resend Production |
| Pull Request Preview | Vercel | `dist/` + `/api/*` Function | 独立 Neon 分支、预览 Blob/前缀、预览 Upstash、Resend 测试环境 |
| 应急只读降级 | Netlify | `dist-public/` | 无动态 API、无会员和交易数据 |

Vercel build 不执行 migration 或 seed。数据库变化必须在部署候选之前通过 `scripts/release-migrate.mjs` 显式执行。`dist-public` 不是正常商业生产包。

## 2. 一次性平台配置

### Vercel

1. 将项目连接到仓库根目录；根目录 `vercel.json` 会安装并构建 `网页制作/`。
2. Node.js 版本使用 22。
3. 开启 Git Preview；每个 PR 必须得到独立 Preview URL。
4. 在 Vercel 中按 **Production** 与 **Preview** 分别录入环境变量。不要把同一个 secret 同时勾选两个环境。
5. Preview 的 `DATABASE_URL` 使用 Neon preview branch；Production 使用 Neon 主生产分支。

两个环境都必须设置：

```text
DEPLOYMENT_ENV
DATA_RESIDENCY_DECISION   # Production 必填
SITE_URL
APP_ORIGIN
CONTACT_EMAIL
CONTACT_WECHAT
BUSINESS_NAME             # Production 必填
DATABASE_URL
RESEND_API_KEY
EMAIL_FROM
BLOB_READ_WRITE_TOKEN
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Production 的 `DEPLOYMENT_ENV=production`，`APP_ORIGIN=SITE_URL`。Preview 的 `DEPLOYMENT_ENV=preview`，`SITE_URL` 与 `APP_ORIGIN` 使用预览域名。Preview 的数据库、Blob、Redis 与邮件密钥必须与 Production 不同。

发布工作流会在 migration 前比较两套环境文件。也可本地运行：

```bash
npm run check:isolation -- /tmp/scent-atoll-production.env /tmp/scent-atoll-preview.env
```

检查只报告冲突的变量名，不输出 secret 值。

Production 的 `BUSINESS_NAME` 必须填写真实经营主体。`DATA_RESIDENCY_DECISION` 只能是 `cross_border_approved` 或 `domestic_infrastructure`；评估未完成时发布门禁必须失败，交易功能不得上线。

可选项：`STUDIO_BOOKING`、`CUSTOMER_HOURS`、`OG_IMAGE`、`EMAIL_REPLY_TO`。`ERROR_WEBHOOK_URL` 与 `ERROR_WEBHOOK_TOKEN` 必须同时设置或同时省略。

Production 不得设置 `SEED_ADMIN_EMAIL` 或 `SEED_ADMIN_PASSWORD`。Production 与 Preview 都不得设置 `PAYMENT_WEBHOOK_SECRET`；初始 owner 只能通过一次性 bootstrap 流程创建，开发支付 webhook 在 Vercel 部署中关闭。

Production 与 Preview 都要设置各自独立、至少 32 位的 `CRON_SECRET`。Vercel 每 10 分钟以 Bearer token 调用 `/api/internal/release-expired-reservations`，释放超时未付款订单的库存；该入口未通过密钥鉴权时只返回 401。

第一阶段设置 `WECHAT_PAY_ENABLED=false`。第二阶段只有在商户号、AppID、商户证书序列号/私钥、API v3 密钥、通知 URL、平台证书序列号/公钥全部配置后才改为 `true`；`check:env` 会在启用时强制检查完整凭据。

### GitHub Production Environment

创建名为 `production` 的 Environment，开启 required reviewer，并配置：

Secrets：

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
VERCEL_AUTOMATION_BYPASS_SECRET   # Vercel Deployment Protection 开启时必填
```

Variable：

```text
PRODUCTION_URL=https://正式主域名
```

Production Environment 只允许 `main` 分支。关闭管理员绕过审批，保留部署记录。

## 3. 全新数据库首次初始化

本节只在全新的 Production 数据库执行一次。日常发布直接进入下一节，绝不重复 bootstrap 或 seed。

先拉取 Production 环境并执行 migration：

```bash
vercel pull --yes --environment=production
vercel env pull /tmp/scent-atoll-production.env --yes --environment=production

cd 网页制作
VERCEL_ENV=production ALLOW_RELEASE_MIGRATION=production \
  node --env-file=/tmp/scent-atoll-production.env scripts/release-migrate.mjs
```

再初始化会员等级、首批商品和积分商品。脚本在任一业务基础表已有数据时拒绝覆盖：

```bash
BOOTSTRAP_COMMERCE_CONFIRM=initialize-commerce-data \
  node --env-file=/tmp/scent-atoll-production.env scripts/bootstrap-commerce.mjs
```

最后创建首个 owner。邮箱、姓名和至少 14 位的高强度密码必须通过受保护的临时环境或 CI secret 注入，不得提交或保存在 Vercel 常驻环境：

```bash
BOOTSTRAP_CONFIRM=create-first-owner \
BOOTSTRAP_OWNER_EMAIL=正式负责人邮箱 \
BOOTSTRAP_OWNER_PASSWORD=一次性高强度密码 \
BOOTSTRAP_OWNER_NAME=负责人姓名 \
  node --env-file=/tmp/scent-atoll-production.env scripts/bootstrap-owner.mjs
```

完成后立即删除所有 `BOOTSTRAP_*` 变量，登录后台更换密码并确认 `/api/health/ready` 返回 `ready`。初始化中途失败时保留数据库现场并核对三个基础表与 owner 状态；禁止运行开发 `db:seed` 补救。

## 4. PR Preview 流程

涉及 schema 的 PR 必须先迁移它自己的 Neon preview branch，再重新部署 Preview：

```bash
vercel pull --yes --environment=preview --git-branch=<PR分支>
vercel env pull /tmp/scent-atoll-preview.env --yes --environment=preview --git-branch=<PR分支>

cd 网页制作
VERCEL_ENV=preview \
  node --env-file=/tmp/scent-atoll-preview.env scripts/check-launch-env.mjs

VERCEL_ENV=preview ALLOW_RELEASE_MIGRATION=preview \
  node --env-file=/tmp/scent-atoll-preview.env scripts/release-migrate.mjs
```

然后重新触发该 commit 的 Vercel Preview，并检查：

```bash
DEPLOYMENT_URL=https://该PR的预览地址 \
VERCEL_AUTOMATION_BYPASS_SECRET=预览保护密钥 \
node scripts/check-commercial-deployment.mjs
```

合并前必须确认：CI 全绿；Preview 检查通过；注册、登录、下单、人工收款、发货、确认收货、退款和积分流程按本次变更范围完成；Preview 没有读取或修改 Production 数据。

## 5. Production 发布

1. 确认 PR 已合并至 `main`，CI 和 Vercel Preview 均通过。
2. 确认 Neon 自动备份/时间点恢复可用，并记录当前生产 deployment ID 与 migration ID。
3. 在 GitHub Actions 手动运行 **Scent Atoll Production Release**，输入 `RELEASE`。
4. Production reviewer 核对 commit、数据库备份与变更单后批准。
5. 工作流会按不可跳过的顺序执行：

```text
env contract
-> production migration
-> vercel build --prod
-> production-target candidate (--skip-domain)
-> candidate pages/API/auth verification
-> vercel promote
-> production alias verification
```

候选验证失败时工作流不会 promote。禁止另行运行 `vercel --prod` 绕过门禁，也禁止在 Vercel build command 中临时加入 migration 或 seed。

发布成功后人工完成一次最小交易演练，并检查错误告警、订单审计、邮件、库存和积分记录。24 小时内重点观察 5xx、登录失败率、邮件失败、重复幂等冲突和数据库连接耗尽。

## 6. 失败、回滚与降级

- **migration 失败**：停止发布，不部署候选；修复为新的前向 migration 后重跑，禁止在现场编辑生产表。
- **候选验证失败**：不 promote；保留当前 Production，查看 Vercel Function 日志和服务告警。
- **promote 后应用故障**：使用 `vercel rollback` 或 promote 上一个已知正常 deployment。数据库 migration 必须保持向后兼容，应用回滚不自动回滚 schema。
- **数据损坏**：立刻冻结订单与后台写操作；按 Neon 时间点恢复流程恢复到新分支，核对订单、库存、积分后再切换连接。每季度至少做一次恢复演练并记录耗时。
- **动态服务长时间不可用**：明确暂停登录、订单、积分和后台后，运行 `npm run launch:strict` 生成 `dist-public/`，由 Netlify 发布只读展示页。恢复 Vercel 前不得把降级期咨询误标成线上订单。

任何回滚后都要再次运行：

```bash
DEPLOYMENT_URL=https://正式主域名 node scripts/check-commercial-deployment.mjs
```

若当前处于 Netlify 静态降级，则改用 `npm run check:live` 验证公开展示边界。

## 7. 发布完成标准

- GitHub Release workflow 完整成功，没有跳过 migration、candidate verification 或 production verification。
- Production 使用 `dist/` 与 `/api/*`，不是 `dist-public/`。
- Production 与 Preview 的数据库和托管服务凭据相互隔离。
- 没有默认管理员、开发 seed 或占位联系方式。
- 全新数据库已按 migration -> commerce bootstrap -> owner bootstrap 完成一次性初始化，常驻环境不存在 `BOOTSTRAP_*`。
- Vercel 定时任务已用独立 `CRON_SECRET` 成功释放一次测试超时订单，重复调用没有重复释放库存。
- `/sitemap.xml` 来自数据库商品源并包含当前活动商品 slug，不再依赖静态种子商品列表。
- 生产域名、HTTPS、安全响应头、商品 API、匿名会话和后台匿名拒绝均通过检查。
- 备份可用、告警可触发、回滚目标已记录，并完成订单到退款的演练。
