# 馥屿 Scent Atoll 应用

此目录是应用根目录，包含完整 storefront、会员、订单、积分、运营后台和 Node API。

最新开发进度、验证结果和剩余风险见 [plan/project-log.md](plan/project-log.md)。本地后端运行说明见 [backend-dev-notes.md](backend-dev-notes.md)。

## 本地运行与检查

```bash
nvm use
npm ci
npm test
npm run build
npm run check:deploy
```

完整构建输出到 `dist/`。本地启动 API 与页面：

```bash
npm start
```

## 商业生产部署

Vercel 是唯一主生产平台：

- `vercel.json` 输出 `dist/` 并保留 `/api/*` Function rewrite。
- 平台 build command 只运行 `check:env`、`check:deploy` 和 `build`。
- build 不连接数据库执行 migration，也不 seed 任何管理员或业务数据。
- Production 缺少 PostgreSQL、Resend、Blob、Upstash 或应用源地址时，`check:env` 会使构建失败；部署环境若配置开发支付 webhook 密钥也会失败。

Production 与 Preview 环境清单分别见 `.env.production.example` 和 `.env.preview.example`。Preview 必须使用独立 Neon 分支、Blob Store、Upstash endpoint 和 Resend 测试资源，不得复制 Production 凭据。

Production 还必须填写真实 `BUSINESS_NAME` 和 `DATA_RESIDENCY_DECISION`。后者只接受 `cross_border_approved` 或 `domestic_infrastructure`；跨境评估仍未完成时，生产构建会被阻止。

全新的 Production 数据库只初始化一次，顺序是 migration、commerce bootstrap、owner bootstrap。连接串和一次性 owner 密码只通过当前 shell 或受保护的 secret 注入，不写入仓库、命令脚本或 Vercel 常驻环境。完整命令、安全清理和失败处理只在 [plan/launch-runbook.md](plan/launch-runbook.md) 维护，避免多份流程漂移。

日常发布只执行 release migration，不得运行 `db:seed`、`db:bootstrap-commerce` 或 `db:bootstrap-owner`。

## 正式发布门禁

持续集成运行：

```bash
npm run launch:preflight
npm run launch:strict
npm run check:deploy
```

正式发布由根目录 `.github/workflows/scent-atoll-release.yml` 手动触发。它按固定顺序执行：

1. 只读检查 GitHub reviewer/分支保护、Vercel Node 22 与商业套餐。
2. 按资源 ID/地址检查 Production 与 Preview 数据库、Blob、Upstash、Resend 隔离。
3. 从 GitHub `PRODUCTION_DATABASE_URL` 注入连接，显式运行 migration。
4. 由 Vercel 云端读取 Sensitive env 构建 production candidate，并用 `--skip-domain` 部署。
5. 检查首页、登录、后台页面、商品 API、匿名会员会话与匿名后台拒绝。
6. 验证通过后 `vercel promote`，随后复验正式域名。

Vercel Git 集成会继续生成 PR Preview，但 `ignoreCommand` 会跳过 `main` 的自动 Production 构建，避免新代码先于 migration 到达正式域名。工作流不执行 `vercel env pull`；Vercel Sensitive env 无需、也不应被回拉到 GitHub runner。

失败时不得手工跳过验证直接 promote。具体审批、secrets、回滚与数据库恢复流程见 [plan/launch-runbook.md](plan/launch-runbook.md)。

## 静态应急降级

`dist-public/` 仅用于暂停动态功能后的只读展示降级：

```bash
npm run launch:strict
```

根目录和本目录的 Netlify 配置继续发布该目录。降级包不包含登录、会员、订单、积分、后台或 API，不得当作完整商业版部署。

不要提交 `.env.production`、`.env.*.local`、`dist/`、`dist-public/` 或本地数据库文件。
