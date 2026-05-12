# 馥屿正式上线检查清单

更新日期：2026-05-12

## 上线边界

本次正式上线准备面向“公开展示 + 试香咨询 + 人工购买确认”版本。

不纳入本次准备范围：

- 香水真实商品资料。
- 商品图片、品牌图片、文章图片和 OG 图最终素材。
- 真实在线支付。
- 会员积分正式运营。
- 后台管理系统公开部署。

## 发布包

正式上线只部署：

```text
网页制作/dist-public
```

不要部署普通开发构建的 `dist/`，因为 `dist/` 会保留本地开发用的后台、会员、订单和积分页面。

生成正式发布包：

```bash
cd 网页制作
nvm use
npm ci
npm run launch:preflight
```

`launch:preflight` 会依次运行 `npm test`、`npm run build` 和 `npm run launch:check`。

如果已经补齐正式域名、客服邮箱和客服微信，可以使用更严格检查；经营主体和预约方式可按需覆盖默认值：

```bash
npm run launch:status
npm run check:env
npm run launch:strict
```

`launch:status` 是只读状态检查，不构建、不部署、不联网；它会汇总部署配置、真实运营变量、Git 发布交接和全仓补丁空白状态。

如果部署平台从 GitHub 拉取代码，并且你已经提交 / 推送本次上线改动，可以在本地使用最终组合门禁：

```bash
npm run launch:ready
```

`launch:ready` 会依次运行 `check:git-release`、`git diff --check -- :/`、`launch:preflight` 和 `launch:strict`。它只适合本地发布前使用，不用于 Netlify / Vercel / Cloudflare Pages 的平台构建命令。

## Git 发布状态

如果部署平台从 GitHub 仓库拉取代码，正式部署前必须确认上线相关改动已经提交并推送到目标分支。当前本地检查、脚本和配置通过，并不代表远端部署平台已经能拿到这些文件。

发布前检查：

```bash
npm run check:git-release
git diff --check -- :/
```

`check:git-release` 会确认关键上线文件已被 Git 跟踪、关键上线路径没有未提交 / 未跟踪改动、生成物和本地 secret 文件没有被错误追踪，并在本地分支领先 upstream 时失败。`git diff --check -- :/` 会从仓库根目录视角检查整个仓库的补丁空白问题。

如果这些检查和真实运营信息都已经准备好，也可以直接运行 `npm run launch:ready` 作为本地最终门禁。它会包含测试、普通构建、公开发布包检查和严格上线构建。

必须提交并推送的上线相关文件包括：

- 仓库根目录和 `网页制作/` 的 `.nvmrc`、`.gitignore`、`README.md`、`netlify.toml`、`vercel.json`。
- `.github/workflows/scent-atoll-ci.yml`。
- `网页制作/package.json`、`package-lock.json`、`.env.production.example`。
- `网页制作/scripts/` 下的构建、环境变量、公开包、部署配置和线上检查脚本。
- `网页制作/tests/` 下的上线门禁测试。
- `网页制作/src/` 下的页面、模板、SEO、合规、公开前端和数据构建改动。
- `网页制作/plan/` 下仍保留的全部计划文档，包括上线计划、清单、runbook、审计文档、生产化路线图、PostgreSQL、会员和积分规则文档。

不要提交真实 `.env.production`、本地 `.env*.local`、`dist/`、`dist-public/`、脚本生成的 `src/assets/og-image.png` 或本地数据库文件。它们已经被 `.gitignore` 覆盖，正式部署应该在平台环境变量中填入真实上线信息。

## 上线信息

这些不是香水内容和图片，但正式上线前必须填入或确认真实值。建议通过部署平台环境变量设置；本地严格检查也可以使用 `.env.production`，该文件已被 git 忽略，且不会覆盖 shell 或部署平台已设置的同名变量。

正式填写时先使用 `launch-env-intake.md` 收集并确认这些值，再复制到部署平台环境变量。

严格上线检查会强制校验以下 3 项：

| 变量 | 用途 |
|---|---|
| `SITE_URL` | 生成 canonical、OG URL、robots 和 sitemap；必须是正式 `https://` 域名根地址，不带路径、查询参数或 `#` |
| `CONTACT_EMAIL` | 客服和隐私联系邮箱 |
| `CONTACT_WECHAT` | 客服微信 |

另有 3 项建议上线前确认：

| 变量 | 用途 |
|---|---|
| `BUSINESS_NAME` | 经营主体名称；不填时使用已确认店名 `馥屿 Scent Atoll` |
| `STUDIO_BOOKING` | 工作室试香预约方式；不填时使用 `通过客服微信预约` |
| `CUSTOMER_HOURS` | 客服时间；未设置时默认显示 `12:00 - 20:00` |

`OG_IMAGE` 是可选覆盖项。不设置时，网站会使用站内 `og-image.png` 品牌分享图；最终商品图片准备好后，可以再换成正式分享图 URL。

模板见 `.env.production.example`。模板文件故意使用“你的...”占位，复制成 `.env.production` 后必须全部替换成真实值，否则 `npm run launch:strict` 会失败。

## 发布平台

推荐静态部署，不部署 Node API：

- Node 版本：使用 Node 22，仓库根目录和 `网页制作/` 子目录均提供 `.nvmrc`，`package.json` 也声明了 `engines.node >=22`。

- Netlify：项目内已有 `netlify.toml`，发布目录为 `dist-public`，并显式设置 `NODE_VERSION = "22"`。
- Vercel：项目内已有 `vercel.json`，安装命令为 `npm ci`，构建命令为 `npm run launch:strict`，输出目录为 `dist-public`，并包含基础安全 headers；项目设置中确认 Node 使用 22。
- Cloudflare Pages：构建命令设为 `npm run launch:strict`，输出目录设为 `dist-public`，Node 版本设为 22，`_headers` 会随发布包生成。

仓库根目录也放置了 Netlify 和 Vercel 配置。如果部署平台从整仓库根目录读取配置，根目录配置会自动把构建切到 `网页制作/` 子目录，并发布 `网页制作/dist-public`。

正式发布当天按 `launch-runbook.md` 执行。它包含 Netlify、Vercel、Cloudflare Pages 的配置确认、部署后 smoke check 和回滚步骤。

## 自动检查覆盖

`npm run check:public` 会确认：

- 公开页面存在：首页、香水、品牌、试香、Journal、关于、服务、隐私、协议、人工购买、404。
- 私有开发页不存在：后台、会员、订单、积分、注册、登录、checkout 真实结账页。
- 发布包不包含 `assets/js/admin-client.js`、`auth-client.js`、`member-client.js`、`points-mall-client.js`。
- 发布包不包含 `/api/checkout`、`/api/admin`、旧结账文案或开发管理员 key。
- `robots.txt`、`sitemap.xml`、`_headers`、`_redirects` 已生成。
- 公开 HTML 的本地链接和 CSS 的本地 `url(...)` 都指向实际存在的发布文件。
- 公开 HTML 具备基础 SEO / 分享元标签，canonical 与 `og:url` 必须精确匹配当前页面 URL，`404.html`、`cart.html` 和旧兼容详情入口 `product.html`、`brand.html`、`article.html` 具备 `noindex`。
- `sitemap.xml` 包含公开主路径，并从当前 catalog 数据生成 `product-{id}.html`、`brand-{id}.html`、`article-{id}.html` 静态详情 URL；不包含后台、会员、订单、积分等开发页，也不包含 `?id=` 查询参数详情页。
- `_headers` 包含基础安全响应头规则；`cart.html`、`404.html` 的独立块也包含完整安全响应头和 `X-Robots-Tag: noindex, nofollow`；`_redirects` 明确把私有开发路径、`checkout.html` 和未知路径指向 404。

`npm run check:deploy` 会确认：

- 仓库根目录和 `网页制作/` 子目录的 `.nvmrc` 都固定为 Node 22，`package.json` 的 `engines.node` 要求 `>=22`。
- 仓库根目录和 `网页制作/` 子目录的 Netlify 配置都指向 `dist-public`，使用 `npm run launch:strict`，并显式设置 `NODE_VERSION = "22"`。
- 仓库根目录和 `网页制作/` 子目录的 Vercel 配置都指向正确输出目录，使用 `npm ci` 安装依赖，根目录配置会进入 `网页制作/` 安装和构建。
- Netlify / Vercel 配置都包含基础安全响应头，包括 `Strict-Transport-Security: max-age=31536000`，以及 `cart.html`、`404.html` 的 `X-Robots-Tag: noindex, nofollow`。Netlify / Vercel 的 `cart.html`、`404.html` 规则自身也包含完整安全响应头，不依赖平台合并多条匹配规则。

`npm run check:env` 会先独立校验正式运营信息，方便在完整构建前发现格式错误。

`npm run launch:strict` 会在以上检查基础上，把示例域名、示例邮箱和“上线前填写”占位视为失败。
严格模式也会直接校验 `SITE_URL`、`CONTACT_EMAIL`、`CONTACT_WECHAT` 是否已设置，并要求正式域名使用 `https://`、客服邮箱格式有效。若设置了 `BUSINESS_NAME`、`STUDIO_BOOKING` 或 `OG_IMAGE`，也会拒绝占位值；`OG_IMAGE` 必须是 `https://` 图片 URL。
严格模式还会确认客服邮箱、客服微信、经营主体和工作室预约方式已经实际渲染进公开发布包；未设置 `BUSINESS_NAME` 或 `STUDIO_BOOKING` 时，会检查默认值已经渲染，避免页面漏掉合规和预约信息。
CI 也会使用测试运营值和临时输出目录跑一遍 `npm run launch:strict`，确保严格门禁本身不会失效。

部署后可以运行线上 smoke check：

```bash
SITE_URL=https://你的正式域名 CONTACT_EMAIL=你的客服邮箱 CONTACT_WECHAT=你的客服微信 npm run check:live
```

该检查会请求公开页面、私有开发路径、随机未知路径、`robots.txt`、`sitemap.xml`、安全响应头和 `X-Robots-Tag`，确认部署平台没有破坏发布包边界和兜底 404，并确认 canonical 与 `og:url` 指向当前线上页面；旧兼容详情入口也会继续校验 `noindex`，避免与静态详情页重复收录。
它也会请求页面里的 `og:image` / `twitter:image`，确认正式分享图 URL 可访问且返回图片类型。
`check:live` 会要求提供 `CONTACT_EMAIL` 和 `CONTACT_WECHAT`，以确认线上页面展示的是本次正式客服信息。可选 `BUSINESS_NAME`、可选 `STUDIO_BOOKING` 和可选 `CUSTOMER_HOURS` 也可以一起提供；未设置可选项时，会检查默认经营主体、默认预约方式和默认客服时间已经渲染。
如果提供了 `OG_IMAGE`，它会确认线上 Open Graph / Twitter 元数据实际使用了这个图片 URL；提供的客服邮箱也会再次校验格式。线上 `og:image` 和 `twitter:image` 必须保持一致，避免不同平台出现不同分享图。

## 人工复核

自动检查不能替代下面这些人工确认：

- 手机端 375px 宽度无横向滚动。
- 首页、香水列表、商品详情、试香、关于、服务、隐私、协议、404 都能打开。
- 商品 CTA 进入意向清单或试香，不进入支付。
- 页脚客服、配送退换、隐私政策、用户协议可达。
- 公开页面没有未确认的发货时效、指定快递、包邮门槛或“已记录需求”类假提交文案。
- 真实图片无版权和商标授权风险。
- 商品价格、库存、试香规则和售后规则已确认。
- 线上 HTTPS 正常，自定义域名能访问。
- `SITE_URL` 与最终 canonical 主域名完全一致；www / 裸域只保留一个主域名，另一个域名跳转到主域名。
- 不把 Netlify / Vercel / Cloudflare Pages 的预览域名提交给搜索引擎或写入外部渠道。
- 搜索引擎收录前确认 `SITE_URL` 不是示例域名。
