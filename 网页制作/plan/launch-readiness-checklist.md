# 馥屿商业上线检查清单

更新日期：2026-07-10

## 工程门禁

- [ ] `npm test`、`npm run build`、`npm run launch:preflight`、`npm run check:deploy` 全部通过。
- [ ] Vercel 输出为 `dist/`，`/api/*` rewrite 指向 Function；build command 没有 migration、seed、`launch:strict` 或 `build:public`。
- [ ] Netlify 仍只输出 `dist-public/`，并明确作为暂停动态功能后的应急降级。
- [ ] 所有资金、积分、库存写操作的幂等与并发测试通过；PostgreSQL 真实测试分支完成 migration smoke test。
- [ ] `scripts/check-commercial-deployment.mjs` 能检查完整页面、商品 API、匿名会员会话与匿名后台拒绝。

## 数据与账号

- [ ] Production 设置 `DATABASE_URL` 且应用在生产模式下不能回退 JSON。
- [ ] Preview 使用独立 Neon branch；没有任何测试连接指向 Production。
- [ ] Production migration 经 `ALLOW_RELEASE_MIGRATION=production` 明确确认，且生产流程不运行 seed。
- [ ] 全新数据库按 migration -> `db:bootstrap-commerce` -> `db:bootstrap-owner` 完成一次性初始化；初始化后删除全部 `BOOTSTRAP_*`，后续发布不再运行 bootstrap。
- [ ] 初始 owner 通过一次性 bootstrap 创建；Production 不含 `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` 或默认密码。
- [ ] Neon 自动备份开启，已完成一次恢复到新分支的演练并记录 RPO/RTO。

## 环境隔离

- [ ] Vercel Production / Preview 分别设置 `DEPLOYMENT_ENV=production` / `preview`。
- [ ] 两个环境的 Neon、Blob、Upstash、Resend 凭据不同；Production 与 Preview 均未配置开发用 `PAYMENT_WEBHOOK_SECRET`。
- [ ] 两个环境配置不同的至少 32 位 `CRON_SECRET`，未授权库存清理请求返回 401。
- [ ] Production 的 `APP_ORIGIN` 与 `SITE_URL` 完全一致；Preview 使用预览域名。
- [ ] Production 已填写真实 `BUSINESS_NAME`，并将 `DATA_RESIDENCY_DECISION` 设置为经证据确认的 `cross_border_approved` 或 `domestic_infrastructure`。
- [ ] `SITE_URL`、客服、经营主体、配送、退换货和隐私信息没有占位文本。
- [ ] `ERROR_WEBHOOK_URL` / `ERROR_WEBHOOK_TOKEN` 同时配置或同时省略。
- [ ] 第一阶段 `WECHAT_PAY_ENABLED=false`；启用第二阶段前八项微信支付 API v3 凭据全部通过门禁。

## 平台与发布

- [ ] GitHub `production` Environment 只允许 `main`，有 required reviewer，不能绕过审批。
- [ ] 已配置 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`、必要时的 bypass secret，以及 `PRODUCTION_URL`。
- [ ] PR 对应 Neon branch 已迁移，Vercel Preview 完整业务流程和移动端流程通过。
- [ ] Production Release workflow 按 migration -> candidate -> verify -> promote -> production verify 顺序完整成功。
- [ ] 已记录发布前 deployment ID、migration ID 和可回滚的上一版本。

## 运营、安全与合规

- [ ] 邮箱验证、找回密码、Session 撤销、登录限流、CSRF/Origin、RBAC 与审计日志验收通过。
- [ ] Resend 发信域名已验证；验证、找回密码、订单与发货邮件不会因重试重复发送。
- [ ] Blob 图片授权明确；删除或替换图片不会留下失效商品链接。
- [ ] `/sitemap.xml` 读取数据库活动商品 slug；商品改 slug、上下架后 sitemap 与详情页 canonical 保持一致。
- [ ] 健康/错误告警已实际触发；日志不打印密码、token、完整地址或数据库 URL。
- [ ] `DATA_RESIDENCY_DECISION` 有对应评估记录；中国大陆用户数据使用境外 Vercel/Neon 前已完成跨境合规评估，否则已改用境内基础设施。
- [ ] 经营主体、隐私政策、账号注销、配送、退换货、数据保留和图片/品牌授权已确认。

## 上线演练

- [ ] 桌面、手机和微信内置浏览器尺寸下完成注册、登录、下单、人工收款、发货、确认收货、退款和积分流程。
- [ ] 重复点击、重复回调和网络重试不会重复扣库存、确认收款、退款或发积分。
- [ ] Vercel 定时任务能取消超时未付款订单、释放预留库存并记录审计；重复执行返回 0 且不重复释放。
- [ ] 完成一次 production candidate 失败演练，确认不会 promote。
- [ ] 完成应用 rollback 演练，确认 schema 向后兼容。
- [ ] 完成 `dist-public/` 静态降级演练，并确认降级期间登录、会员、订单、积分和后台不可用且有运营通知。

只有以上项目全部完成，才开放真实用户与资金。微信支付 API v3 必须等待商户号、AppID 与证书齐全，并通过独立支付验签、退款和对账验收后启用。
