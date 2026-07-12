# 馥屿项目日志

本文件按日期倒序记录项目阶段、验证结果和下一步。它用于日常跟进，不替代发布清单或发布 Runbook。

## 2026-07-12：商业发布平台接入

### 已完成

- GitHub 已创建 PR #1，发布分支为 `codex/commercial-launch-2026-07-10`。
- 修复 Vercel `includeFiles` 新 Schema 要求，并让部署自检识别字符串 glob。
- Vercel Hobby 不支持每 10 分钟 Cron，改为 GitHub Actions 定时调用库存预留释放接口；`CRON_SECRET` 已同步到 Vercel 与 GitHub。
- 正式域名确认是 `https://scentatoll.com`。
- 已从 Vercel Production/Preview 删除 `SEED_ADMIN_EMAIL`、`SEED_ADMIN_PASSWORD`、`PAYMENT_WEBHOOK_SECRET`。
- 创建公开商品图片存储 `scent-blob`，作用域为 Production 与 Preview。
- 创建免费 Upstash 数据库 `scent-redis`，区域 `iad1`，每月 500,000 次命令，已连接 Production 与 Preview。
- 创建免费 Resend 资源 `scent-email`，域名 `scentatoll.com`，每月 3,000 封、每日 100 封；仍待连接项目和确认域名验证。
- 代码已兼容 Vercel Blob OIDC 与 Upstash Marketplace 自动变量名；115 项测试 114 passed、1 skipped，构建通过。
- 新增 `使用与维护说明.md`，记录前后端、外部平台、本地开发、修改和发布方法。

### 当前阻塞与风险

- 本地提交 `c6467a2` 因 GitHub 网络间歇超时尚未确认推送；本地提交安全保留。
- Resend 尚未完成项目连接、API Key 注入、DNS 验证与 `EMAIL_FROM` 配置。
- Production 与 Preview 当前仍共享部分 Neon、Blob、Upstash 资源，不满足最终隔离门禁。
- 真实 Neon Preview migration/seed smoke、并发测试、备份恢复和完整浏览器业务验收尚未执行。
- Vercel 账户仍显示账单地址不完整警告。

## 2026-07-10：正式上线启动检查

### 已完成

- 执行 `npm run launch:status`：部署配置和差异格式通过，环境资料与 Git 发布交接未通过。
- 执行 `npm run launch:preflight`：115 项测试中 114 passed、1 skipped，完整构建、静态降级包和部署配置检查通过。
- 确认 GitHub remote 为 `zdon7237-ctrl/scent-`，当前分支为 `main`；商业化改造仍是未提交工作区。
- 创建 `codex/commercial-launch-2026-07-10` 上线分支承接当前工作区；尚未 commit 或 push。
- 使用固定版本 Vercel CLI 50.28.0 完成只读预检；当前机器没有 Vercel 登录凭据，仓库也没有 `.vercel/project.json` 关联信息。
- 本机没有 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`，尚不能创建 Preview 或执行受保护的 Production release。

### 当前外部阻塞

- 需要店主提供正式域名、客服邮箱、客服微信、真实经营主体名称和数据驻留/跨境合规结论。
- 需要店主完成 Vercel 登录，并授权创建或关联项目及可能产生费用的 Neon、Blob、Resend、Upstash 资源。
- 需要分别创建 Production 与 Preview 资源，完成环境变量隔离后才能运行真实 Neon migration 和 Preview 验收。
- 需要评审当前未提交改造，形成 commit 并 push；正式发布不能直接从脏工作区执行。

## 2026-07-10：Owner 管理工作台重构

### 当前结论

后台已从“全部模块堆在单页”改为按任务组织的 Owner 工作台。会员与管理员共用账户登录入口，服务端根据真实账号类型签发对应 Session 并自动分流；管理员数据、Cookie 和 RBAC 仍与会员隔离。

### 本次完成

- 新增项目级 `PRODUCT.md`，记录管理端用户、产品目标、设计原则、反例和 WCAG AA 要求。
- 统一 `login.html` 登录入口：Owner 账户进入 `admin.html#overview`，普通会员进入 `account.html`；旧后台登录 API 继续保留给测试和兼容流程。
- 后台使用独立应用画布，不再显示前台公告、商城导航、页脚和购物车。
- 主导航拆为概览、订单、商品、会员、积分商城和更多；积分商城包含积分商品、兑换订单和积分流水三个子入口。
- 概览首页优先显示待核款、待发货、待处理兑换和低库存，并链接到对应筛选结果。
- 各模块改为按当前视图请求数据；商品详情默认收起，订单和会员使用可展开详情，列表增加搜索与状态筛选。
- 人工核款、发货、退款、代客确认收货、人工调分、库存调整、图片删除、商品归档和取消兑换使用正式确认面板，替代后台原生 `prompt` / `confirm`。
- 桌面使用固定侧栏，手机使用抽屉导航；1024 宽度商品表单调整为两列，390 宽度保留紧急运营流程。
- 第一版界面只开放 Owner 全权限，现有角色和权限模型继续保留，后续可增加客服与仓库账号。

### 验证记录

- `npm test`：115 项，114 passed，0 failed，1 skipped；跳过项仍为缺少安全真实 Neon 测试分支。
- `npm run build`、服务端与客户端语法检查、`git diff --check` 通过。
- 浏览器完成统一 Owner 登录、8 个后台视图切换、商品详情展开和敏感操作面板取消测试。
- 1440 x 1000、1024 x 900、390 x 844 三个视口无横向溢出；后台只有一个 `main` 地标，不加载前台导航，控制台无错误。
- 浏览器验证只读取本地数据并取消敏感操作，没有创建订单、调整库存、退款或变更积分。

### 后续范围

- 员工账号创建、邀请、停用和权限编辑暂不开放；增加客服或仓库人员时再启用对应管理界面。
- 管理端仍需在隔离 Vercel Preview 与真实 Neon 分支完成完整订单到退款验收。

## 2026-07-10：商业试运营架构改造

### 当前结论

项目已从“本地功能开发版”推进到“可接入真实平台资源进行 Production / Preview 验收”的阶段。第一阶段人工收款业务链路已在本地跑通，但尚未部署真实商业环境，也不应开放真实用户和资金。

### 本次完成

- 主生产架构统一为 Vercel 完整应用，发布 `dist/` 与 `/api/*`；Netlify 的 `dist-public/` 只保留为应急只读降级包。
- migration 与 build 分离，新增受保护的 production release workflow，固定执行环境校验、migration、candidate 部署、验证、promote 和正式域名复验。
- Production 禁止 JSON fallback、开发 seed 管理员和旧支付 webhook；新增一次性 commerce bootstrap 与 owner bootstrap。
- PostgreSQL schema 增加邮箱验证、密码重置、登录审计、地址、订单地址快照、物流、支付、退款、幂等、邮件投递和 Blob 图片元数据。
- PostgreSQL 写入改为事务内差异 upsert/delete，资金、积分和库存流程使用事务、锁及唯一约束；JSON 开发仓库使用串行 mutation 和原子写入。
- 完成人工收款订单、库存预留与释放、后台核款、发货、物流、确认收货后发积分、退款后撤回积分与累计消费。
- 完成邮箱验证、找回密码、Session 撤销、账号注销、登录限流、Origin/CSRF 防护、RBAC、审计日志和关键写接口幂等。
- 接入 Resend、Vercel Blob、Upstash 和结构化日志/告警的服务层与环境门禁。
- PostgreSQL 模式下数据库成为唯一商品源；商品详情使用稳定 slug，并输出 canonical、description 和 Product JSON-LD。
- 新增数据库商品 sitemap、每 10 分钟释放超时库存的 Vercel Cron，以及注册、重发验证和密码重置申请限流。
- 微信支付 API v3 的签名、JSAPI/H5 下单、查询、关单、退款请求、支付回调验签和 AES-GCM 解密基础已实现；真实支付仍由功能开关关闭。

### 验证记录

- `npm test`：114 项，113 passed，0 failed，1 skipped。
- 跳过项：本机没有安全的真实 Neon 测试分支，PostgreSQL migration/seed smoke test 未运行。
- `npm run build`、`npm run launch:check`、使用测试运营值的 `npm run launch:strict`、语法检查和 `git diff --check` 全部通过。
- `npm audit`：207 个依赖，0 个已知漏洞。
- 浏览器完成注册、默认地址、加购、结账、人工核款、发货、确认收货、积分发放、退款和积分撤回全流程。
- 桌面与 390 x 844 手机视口无横向溢出、文字裁切或坏图；首页、注册、结账、会员中心和后台共 5 个关键页面未发现控制台错误。
- 浏览器验收产生的测试账号、订单及关联流水已从本地开发数据库清理。

### 本次发现并修复

- 幂等重放改为返回第一次请求的原 HTTP 状态和响应体，不再把订单创建的 `201` 改成 `200`。
- 补上已定义但未使用的库存预留定时清理入口，并验证未授权请求返回 `401`、重复执行不会二次释放。
- Vercel 的 `/sitemap.xml` 改为读取数据库活动商品 slug，避免静态商品列表与线上商品链接漂移。
- 服务端商品图内联样式改为安全 URL 序列化，避免不可信图片 URL 破坏 CSS 上下文。
- 修正退款成功后后台仍显示“已发放积分”的文案；现在区分“积分已撤回”和“未发放积分”。
- 测试订单在 JSON 开发模式下会先读取商品 API，确保测试实际覆盖规格、库存预留、扣减和释放。

### 尚未完成

- 真实域名、客服邮箱、客服微信、经营主体资料和数据驻留/跨境合规结论尚未提供。
- Vercel、Neon、Blob、Resend、Upstash 的 Production / Preview 资源尚未创建和隔离配置。
- 真实 Neon 分支上的 migration、并发库存争抢、幂等和备份恢复演练尚未执行。
- PostgreSQL 写请求仍会在事务内读取并锁定较大范围业务状态；低量试运营可保证一致性，但还没有完成领域级细粒度 SQL 重构和放量压测。
- 微信支付缺少商户号、AppID 和证书；退款回调、退款查询、每日对账和失败恢复后台尚未完成，因此 `WECHAT_PAY_ENABLED` 必须保持 `false`。
- 当前商业化改造仍是未提交工作区，正式发布前必须完成代码评审、commit、push 和隔离 Preview 验收。

### 下一步

1. 店主确认正式域名、客服资料、经营主体和数据合规方案。
2. 部署负责人创建并隔离 Vercel、Neon、Blob、Resend、Upstash 的 Production / Preview 资源。
3. 在 Neon Preview 分支执行 migration、一次性 commerce bootstrap、owner bootstrap 和真实数据库 smoke/concurrency 测试。
4. 在 Vercel Preview 完成桌面、手机和微信内置浏览器尺寸的订单到退款演练。
5. 通过 `launch-readiness-checklist.md` 后再运行受保护的 Production release workflow。

## 2026-07-12：商业 Preview 数据库与平台资源验收

### 本次完成

- Resend 发信域名 `scentatoll.com` 的 DKIM、SPF 与 MX 已全部验证，Preview / Production 已接入 Resend，发件人为 `馥屿 <noreply@scentatoll.com>`。
- 已创建 Neon 独立分支 `preview-commercial-launch`（ID：`br-wild-star-ahtci304`），从 `main` 仅复制 schema、不复制用户数据，并关闭自动删除。
- Vercel 的 `DATABASE_URL` 已仅在 Preview 环境覆盖为该独立 Neon 分支；Production 数据库未修改。
- Preview 已显式执行 release migration，验证到 `003_commercial_transaction_hardening`；未运行开发 seed。
- Preview 已执行一次性 commerce bootstrap，写入 6 个会员等级、5 个积分商城商品和 8 个商品，未创建管理员账号。
- 重新部署的 Vercel Preview 为 `https://scent-307m2qe75-scent-atoll.vercel.app`，deployment ID 为 `dpl_hqEcp1nYQn91AFTdLdXJDii1ncRb`，状态为 Ready。

### 验证记录

- `/api/health/live` 返回 `ok`。
- `/api/health/ready` 返回 `ready`、`database: postgres`、`products: 8`、`commerceFoundation: true`。
- `/api/products` 可读取数据库商品；匿名 `/api/auth/me` 返回空用户，匿名管理端接口拒绝访问。
- 已在 Preview 分支临时创建并清理 `scent_preview_test` 数据库，真实 PostgreSQL migration/seed 幂等 smoke test 与全量 `npm test` 均通过，不再跳过数据库 smoke。
- `npm run launch:check`、部署配置检查和 `git diff --check` 通过；静态应急包仍提示历史占位域名与客服资料，不能作为正式交易站发布。
- Preview 不包含 owner；后续浏览器业务验收如需后台操作，应使用一次性 Preview owner 初始化，不得把开发默认管理员写入常驻环境变量。

### 尚未完成

- 尚未执行真实 PostgreSQL 并发库存争抢、重复核款/退款/确认收货、积分兑换和 Session 安全测试。
- 尚未完成桌面、手机及微信内置浏览器尺寸下的注册、下单、人工收款、发货、确认收货和退款全流程。
- Blob、Upstash 与 Resend 当前仍由 Preview / Production 共享资源，尚未达到完全隔离门禁。
- Production migration、备份恢复演练、正式 owner 初始化和正式域名全流程验收尚未执行；本次不合并 PR、不 Promote Production。

## 历史记录入口

- `backend-dev-notes.md`：本地后端运行、数据库模式和开发账号备忘。
- `launch-completion-audit.md`：早期静态展示版的工程审计，仅作历史参考。
- `production-platform-roadmap.md`：商业平台后端、交易、安全和运维路线。
