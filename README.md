# 馥屿 Scent Atoll 网站

小众香水买手店的公开展示站。当前上线版本定位为：

```text
品牌展示 + 香水浏览 + 试香咨询 + 人工购买确认
```

香水商品内容和图片由店主在最终上线前替换。真实在线支付、会员积分正式运营和后台管理不部署到公开站。

## 项目位置

实际项目在子目录：

```bash
cd 网页制作
```

## 本地检查

建议使用 Node 22。仓库根目录和 `网页制作/` 子目录都提供了 `.nvmrc`。

```bash
nvm use
cd 网页制作
npm ci
npm run launch:preflight
```

## 正式发布包

正式上线只部署：

```text
网页制作/dist-public
```

不要部署普通开发构建的 `网页制作/dist`，它保留本地开发用的后台、会员、订单和积分页面。

生成并检查公开发布包：

```bash
npm run launch:check
```

如需一次跑完测试、开发构建和公开发布包检查：

```bash
npm run launch:preflight
```

## 必填上线变量

正式上线前必须在部署平台设置：

```text
SITE_URL
CONTACT_EMAIL
CONTACT_WECHAT
```

`BUSINESS_NAME` 可选；不设置时网站会使用已确认的店名 `馥屿 Scent Atoll`。如果你后续有正式经营主体名称，可以在部署平台额外设置 `BUSINESS_NAME` 覆盖默认值。
`STUDIO_BOOKING` 可选；不设置时网站会显示 `通过客服微信预约`。如果你后续有表单、小红书私信或其他预约方式，可以额外设置 `STUDIO_BOOKING` 覆盖默认值。

`OG_IMAGE` 可选；不设置时会使用站内品牌分享图 `og-image.png`。等你准备好最终图片后，可以再设置为正式图片 URL。

`SITE_URL` 必须是正式 `https://` 域名根地址，不要带末尾 `/`、路径、查询参数或 `#`，例如 `https://www.example.com`。

模板见 [网页制作/.env.production.example](网页制作/.env.production.example)。
模板文件故意使用“你的...”占位。复制为 `网页制作/.env.production` 后必须全部替换成真实值，否则严格检查会失败。该文件已被 git 忽略，部署平台中设置的环境变量会优先于本地文件。

设置完成后运行严格上线检查。它会重新构建 public-only 发布包，校验真实运营信息，并检查 Netlify / Vercel 部署配置：

```bash
cd 网页制作
npm run launch:status
npm run check:env
npm run launch:strict
```

`launch:status` 是只读状态检查，不构建、不部署、不联网；它会汇总部署配置、真实运营变量、Git 发布交接和全仓补丁空白状态。

如果本次上线改动已经提交并推送，也可以运行本地最终组合门禁：

```bash
npm run launch:ready
```

`launch:ready` 会运行 Git 发布检查、全仓补丁空白检查、测试 / 普通构建 / 公开包检查和严格上线构建。

部署后可检查线上站点：

```bash
cd 网页制作
SITE_URL=https://你的正式域名 CONTACT_EMAIL=你的客服邮箱 CONTACT_WECHAT=你的客服微信 npm run check:live
```

也可以把可选 `BUSINESS_NAME`、可选 `STUDIO_BOOKING`、可选 `CUSTOMER_HOURS` 和可选 `OG_IMAGE` 一起传入；不传可选项时，`check:live` 会检查默认经营主体、默认预约方式和默认客服时间已经出现在上线后的公开页面中。

## 部署

仓库根目录和 `网页制作/` 子目录都放置了 Netlify / Vercel 配置。若部署平台从仓库根目录读取配置，会自动进入 `网页制作/` 并发布 `网页制作/dist-public`。

如果平台从 GitHub 拉取代码，部署前先确认本次上线配置、脚本、测试、CI 和计划文档已经提交并推送到目标分支。不要提交 `网页制作/.env.production`、`网页制作/dist` 或 `网页制作/dist-public`。

```bash
cd 网页制作
npm run check:git-release
git diff --check -- :/
```

部署平台的 build command 已设为 `npm run launch:strict`。正式部署前必须先在平台环境变量里填好 `SITE_URL`、`CONTACT_EMAIL`、`CONTACT_WECHAT`；缺失或仍是占位值时，平台构建会失败，避免误发示例域名或占位联系方式。`BUSINESS_NAME` 和 `STUDIO_BOOKING` 可选，不设置时使用默认值。

GitHub Actions 会在 `网页制作/` 下运行语法检查、测试、开发构建、`launch:check`，并使用测试运营值跑一遍 `launch:strict`，确保上线门禁本身持续可用。

当前仍需处理的上线阻塞见 [网页制作/plan/README.md](网页制作/plan/README.md) 的“当前阻塞”表。解除真实运营变量和 Git 发布交接两个阻塞后，再按 runbook 部署。

上线变量先填 [网页制作/plan/launch-env-intake.md](网页制作/plan/launch-env-intake.md)，更多上线清单见 [网页制作/plan/launch-readiness-checklist.md](网页制作/plan/launch-readiness-checklist.md)，发布当天按 [网页制作/plan/launch-runbook.md](网页制作/plan/launch-runbook.md) 执行。
