# 馥屿 Scent Atoll

馥屿是一个香水商品、会员、订单、积分与运营后台一体的商业站点。实际应用位于 `网页制作/`。

最新项目跟进见 [项目日志](网页制作/plan/project-log.md)，上线条件与外部阻塞见 [商业上线文档索引](网页制作/plan/README.md)。

## 部署边界

- **主生产部署：Vercel 完整应用**。构建输出为 `网页制作/dist`，`/api/*` 由 Vercel Function 提供。
- **应急降级：Netlify 静态展示包**。仅发布 `网页制作/dist-public`，不包含登录、订单、积分、后台或交易 API。
- Vercel build 只做环境校验、部署配置校验与站点构建，绝不执行数据库 migration 或 seed。
- 数据库 migration 只能通过受保护的生产发布工作流显式执行；生产环境永不运行开发 seed。

## 本地验证

```bash
nvm use
cd 网页制作
npm ci
npm run launch:preflight
npm run check:deploy
```

`launch:preflight` 会运行测试、完整 `dist` 构建和静态降级包检查。`check:deploy` 会阻止 Vercel build 中出现 migration、seed 或 `dist-public` 发布命令，并验证正式发布顺序。

## 环境变量

Vercel 的 Production 与 Preview 必须分别配置，不得共用数据库、Blob、Redis 或邮件凭据。完整清单见：

- 生产模板：[网页制作/.env.production.example](网页制作/.env.production.example)
- 预览模板：[网页制作/.env.preview.example](网页制作/.env.preview.example)

`DEPLOYMENT_ENV` 必须分别设置为 `production` 或 `preview`，并与 Vercel 注入的 `VERCEL_ENV` 一致。正式域名的 `APP_ORIGIN` 必须等于 `SITE_URL`。任何真实密钥都不得提交到 Git。

Production 必须填写真实经营主体 `BUSINESS_NAME`，并将 `DATA_RESIDENCY_DECISION` 设置为 `cross_border_approved` 或 `domestic_infrastructure`。没有完成并记录跨境评估或境内迁移决定时，商业交易发布会被门禁阻止。

## 发布流程

普通 PR 使用 Vercel Preview 和独立的 Neon 预览分支。预览验证通过后，从 GitHub Actions 手动运行 `Scent Atoll Production Release`：

```text
Production 环境校验 -> migration -> production-target candidate
-> 页面/API/权限边界验证 -> promote -> 正式域名复验
```

该工作流仅允许 `main` 分支、要求输入 `RELEASE`，并使用 GitHub `production` Environment 的审批和 secrets。发布当天步骤、必需 secrets、回滚和降级操作见 [launch-runbook.md](网页制作/plan/launch-runbook.md)。

静态降级包仍可单独生成：

```bash
cd 网页制作
npm run launch:strict
```

它不是正常商业生产包，只在 API 或数据库长时间不可用且决定暂停会员与交易功能时使用。
