# 馥屿上线变量收集表

更新日期：2026-05-12

这张表用于正式部署前收集运营信息。它不包含香水商品内容和图片。

## 直接回复模板

把下面 3 项真实值发给开发 / 部署负责人即可继续严格上线检查：

```text
SITE_URL=https://scentatoll.com
CONTACT_EMAIL=1244470336@qq.com
CONTACT_WECHAT=xxx70336
```

可选项如果暂时没有，可以先不填：

```text
BUSINESS_NAME=馥屿 Scent Atoll
STUDIO_BOOKING=通过客服微信预约
CUSTOMER_HOURS=12:00 - 20:00
OG_IMAGE=
```

`SITE_URL` 必须填正式 `https://` 域名根地址，例如 `https://www.example.com`。不要填写平台预览域名、带路径的页面地址、查询参数或 `#`。
`BUSINESS_NAME` 不填时会使用已确认的店名 `馥屿 Scent Atoll`；如果你有正式经营主体名称，可以填写它覆盖默认值。
`STUDIO_BOOKING` 不填时会使用 `通过客服微信预约`；如果你有预约表单、小红书私信或其他方式，可以填写它覆盖默认值。

## 必填项

| 变量 | 要填写的真实值 | 检查标准 |
|---|---|---|
| `SITE_URL` | https://scentatoll.com | 必须是正式 `https://` 域名根地址，不要带末尾 `/`、路径、查询参数或 `#`，例如 `https://www.example.com` |
| `CONTACT_EMAIL` | 1244470336@qq.com | 必须是可接收客服和隐私请求的邮箱 |
| `CONTACT_WECHAT` | xxx70336 | 必须是正式客服微信号或清晰的添加方式 |

## 建议项

| 变量 | 要填写的真实值 | 检查标准 |
|---|---|---|
| `BUSINESS_NAME` | 馥屿 Scent Atoll | 可选；不填时使用店名，填写时必须是对外可展示的经营主体名称 |
| `STUDIO_BOOKING` | 通过客服微信预约 | 可选；不填时使用客服微信预约，填写时应是工作室试香预约方式，例如微信预约、表单链接或小红书私信 |
| `CUSTOMER_HOURS` | 12:00 - 20:00 | 客服时间；不填时网站默认显示 `12:00 - 20:00` |
| `OG_IMAGE` |  | 可选；不填时使用站内 `/og-image.png`，填写时必须是 `https://` PNG、JPG 或 WebP 图片 URL |

## 部署平台环境变量格式

填完后，在 Netlify、Vercel 或 Cloudflare Pages 的环境变量里设置：

```text
SITE_URL=https://scentatoll.com
CONTACT_EMAIL=1244470336@qq.com
CONTACT_WECHAT=xxx70336
CUSTOMER_HOURS=12:00 - 20:00
```

如果有正式分享图，再额外设置：

```text
OG_IMAGE=
```

不要把 `.env.production.example` 里的“你的...”占位直接复制到部署平台。严格门禁会拒绝这些占位。

## 填完后的验证

在 `网页制作/` 下运行：

```bash
npm run launch:status
npm run check:env
npm run launch:strict
```

`launch:status` 是只读状态检查，用于快速确认是否还缺真实运营变量、Git 发布交接或全仓补丁空白检查。

如果部署平台从 GitHub 拉取代码，并且本次上线改动已经提交并推送到目标分支，发布前再运行本地最终组合门禁：

```bash
npm run launch:ready
```

`launch:ready` 会先检查 Git 发布状态和整个仓库的补丁空白问题，再运行测试 / 普通构建 / 公开包检查和严格上线构建。平台 build command 仍然使用 `npm run launch:strict`。

部署后运行：

```bash
SITE_URL=https://你的正式域名 CONTACT_EMAIL=你的客服邮箱 CONTACT_WECHAT=你的客服微信 npm run check:live
```

也可以带上本表中的可选主体、预约方式和客服时间信息运行，确认线上页面展示的是同一组正式值：

```bash
SITE_URL=https://你的正式域名 CONTACT_EMAIL=你的客服邮箱 CONTACT_WECHAT=你的客服微信 BUSINESS_NAME=你的经营主体名称 STUDIO_BOOKING=你的预约方式 CUSTOMER_HOURS="12:00 - 20:00" npm run check:live
```

只有这两步都通过，才进入正式对外发布。
