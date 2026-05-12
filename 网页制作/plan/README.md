# 计划文档索引

这个文件夹只保留仍会指导后续开发和上线的计划。已经完成的一次性设计方案、旧验收记录和临时修复计划已清理。

## 当前主要计划

| 文件 | 说明 | 状态 |
|---|---|---|
| `soft-launch-showcase-plan.md` | 展示 / 试运营版上线计划，先公开品牌、商品浏览、试香咨询和基础 SEO / 合规，不开放真实支付 | 工程已收口，等待真实运营信息和部署后验收 |
| `launch-env-intake.md` | 正式上线变量收集表，用于填写域名和客服；经营主体、预约方式可选覆盖默认值 | 当前优先执行 |
| `launch-readiness-checklist.md` | 正式上线前的发布包、环境变量、部署平台和人工复核清单 | 当前优先执行 |
| `launch-runbook.md` | 正式发布当天的操作顺序、平台配置、部署后 smoke check 和回滚步骤 | 当前优先执行 |
| `launch-completion-audit.md` | 上线目标到交付物的完成度审计，记录已验证事项和仍需店主提供的信息 | 当前优先执行 |
| `production-platform-roadmap.md` | 从本地开发版改造成真实线上平台的总路线图 | 当前主线 |
| `postgres-migration-plan.md` | PostgreSQL 基础设施、repository 后续细化、事务和并发改造计划 | 进行中 |
| `membership-system-plan.md` | 会员等级、积分、订单结算规则和生产化注意事项 | 规则文档，后续还会引用 |
| `points-mall-plan.md` | 积分商城规则、兑换闭环、FIFO 和后续运营事项 | 规则文档，后续还会引用 |

## 当前重点

展示 / 试运营版已经按 `soft-launch-showcase-plan.md` 收口到 public-only 发布包。当前上线前重点以 `launch-env-intake.md`、`launch-readiness-checklist.md`、`launch-runbook.md` 和 `launch-completion-audit.md` 为准：补齐真实域名和客服，提交并推送上线关键文件，跑本地最终门禁，然后通过平台 `npm run launch:strict` 构建并发布 `dist-public/`，最后做线上 smoke check。`BUSINESS_NAME` 不填时使用已确认店名 `馥屿 Scent Atoll`；`STUDIO_BOOKING` 不填时使用 `通过客服微信预约`。

会员系统、积分商城、后台权限和 PostgreSQL 第一阶段基础设施已进入开发版可运行状态，但真实交易平台改造后置到 `production-platform-roadmap.md`。

注意仓库根目录不是项目根目录，CI、部署和本地命令都应在 `网页制作/` 下执行。

展示 / 试运营版当前剩余动作：

1. 先在 `launch-env-intake.md` 填完真实 `SITE_URL`、`CONTACT_EMAIL`、`CONTACT_WECHAT`；如有正式经营主体名称或预约方式，再额外填写 `BUSINESS_NAME`、`STUDIO_BOOKING`。
2. 在部署平台填入这些真实环境变量。
3. 提交并推送上线关键文件；不要提交真实 `.env.production`、`dist/` 或 `dist-public/`。
4. 运行 `npm run launch:status` 看当前还卡在哪些门。
5. 运行 `npm run check:env` 和 `npm run launch:strict`，确保没有示例域名、示例邮箱或“上线前填写”占位。
6. 如果从 GitHub 部署，再运行 `npm run launch:ready`，确认 Git 发布状态、全仓补丁空白、测试 / 普通构建 / 公开包检查和严格上线构建都通过。
7. 正式上线只部署 `dist-public/`，不要部署包含开发页的普通 `dist/`。
8. 按 `launch-runbook.md` 部署；Netlify / Vercel / Cloudflare Pages 的 build command 使用 `npm run launch:strict`，发布目录是 `dist-public/`。
9. 部署后运行 `SITE_URL=https://你的正式域名 CONTACT_EMAIL=你的客服邮箱 CONTACT_WECHAT=你的客服微信 npm run check:live`。
10. 运营侧在正式公开推广前替换真实商品资料和授权图片；这不阻塞本轮工程、部署、SEO 和合规收口。

## 当前阻塞

| 阻塞 | 负责人 | 解除方式 | 验证命令 |
|---|---|---|---|
| 真实运营变量未填 | 店主 | 提供正式 `SITE_URL`、`CONTACT_EMAIL`、`CONTACT_WECHAT`，并填入部署平台环境变量；`BUSINESS_NAME` 和 `STUDIO_BOOKING` 可选，不填时分别使用 `馥屿 Scent Atoll`、`通过客服微信预约` | `npm run check:env`、`npm run launch:strict` |
| Git 发布交接未完成 | 开发 / 部署负责人 | 提交并推送上线关键文件，保持 `.env.production`、`dist/`、`dist-public/`、`src/assets/og-image.png` 和本地数据库不进 Git | `npm run check:git-release`、`git diff --check -- :/`、`npm run launch:ready` |

两个阻塞都解除后，按 `launch-runbook.md` 部署 `dist-public/`，再运行 `SITE_URL=https://你的正式域名 CONTACT_EMAIL=你的客服邮箱 CONTACT_WECHAT=你的客服微信 npm run check:live`。

真实交易平台后续重点仍包括 PostgreSQL 细粒度 SQL、事务和并发锁，地址、SKU、库存预留、订单快照、真实支付、履约、监控和备份。
