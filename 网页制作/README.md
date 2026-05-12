# 馥屿 Scent Atoll 上线入口

这个目录是实际项目根目录。正式公开版本是：

```text
品牌展示 + 香水浏览 + 试香咨询 + 人工购买确认
```

香水商品内容和图片由店主最后替换；真实在线支付、会员积分正式运营和后台管理不部署到公开站。

## 必跑检查

```bash
nvm use
npm ci
npm run launch:preflight
```

`launch:preflight` 会运行测试、普通构建和 public-only 发布包检查。

## 正式发布包

只部署：

```text
dist-public/
```

不要部署 `dist/`，它保留本地开发用的后台、会员、订单和积分页面。

## 上线必填变量

正式部署前必须在部署平台填入：

```text
SITE_URL=
CONTACT_EMAIL=
CONTACT_WECHAT=
```

可选：

```text
BUSINESS_NAME=馥屿 Scent Atoll
STUDIO_BOOKING=通过客服微信预约
CUSTOMER_HOURS=12:00 - 20:00
OG_IMAGE=
```

`OG_IMAGE` 不设置时，会使用站内生成的 `/og-image.png`。
`BUSINESS_NAME` 不设置时，会使用已确认的店名 `馥屿 Scent Atoll`；如有正式经营主体名称，可以填写它覆盖默认值。
`STUDIO_BOOKING` 不设置时，会使用 `通过客服微信预约`；如有正式预约表单、小红书私信或其他方式，可以填写它覆盖默认值。
`SITE_URL` 必须是正式 `https://` 域名根地址，不要带末尾 `/`、路径、查询参数或 `#`，例如 `https://www.example.com`。

## 严格上线门禁

填完真实变量后运行：

```bash
npm run launch:status
npm run check:env
npm run launch:strict
```

`launch:status` 是只读状态检查，不构建、不部署、不联网；它会告诉你当前还卡在运营变量、Git 发布交接还是补丁空白。

部署平台的 Netlify / Vercel 配置也已使用 `npm run launch:strict` 作为 build command。缺少真实运营信息或仍使用占位值时，构建会失败。

如果本次上线改动已经提交并推送，可以在本地运行最终组合门禁：

```bash
npm run launch:ready
```

它会依次运行 Git 发布检查、整个仓库的补丁空白检查、测试 / 普通构建 / 公开包检查和严格上线门禁。平台构建仍然使用 `npm run launch:strict`。

当前仍需处理的上线阻塞见 [plan/README.md](plan/README.md) 的“当前阻塞”表。

## GitHub 部署前

如果部署平台从 GitHub 拉取代码，先确认上线相关改动已经提交并推送到目标分支：

```bash
npm run check:git-release
git diff --check -- :/
```

不要提交 `.env.production`、`dist/` 或 `dist-public/`；平台会用环境变量和 `npm run launch:strict` 重新生成正式发布包。
`网页制作/plan/` 下仍保留的计划文档也属于发布交接范围，旧方案删除和保留计划更新都应随上线关键文件一起提交。

## 部署后检查

绑定正式域名后运行：

```bash
SITE_URL=https://你的正式域名 CONTACT_EMAIL=你的客服邮箱 CONTACT_WECHAT=你的客服微信 npm run check:live
```

也可以带上可选 `BUSINESS_NAME`、可选 `STUDIO_BOOKING`、可选 `CUSTOMER_HOURS` 和可选 `OG_IMAGE`，线上检查会确认这些值已经出现在公开页面中，并确认分享图元数据正确。

## 相关文档

- `plan/launch-env-intake.md`：上线变量收集表。
- `plan/launch-readiness-checklist.md`：上线前检查清单。
- `plan/launch-runbook.md`：发布当天操作顺序。
- `plan/launch-completion-audit.md`：当前完成度和剩余阻塞。
