# 馥屿正式发布运行手册

更新日期：2026-05-12

## 发布边界

本手册只适用于当前公开展示版：

- 品牌展示。
- 香水浏览。
- 试香咨询。
- 人工购买确认。

不要把 Node API、后台、会员积分、订单和真实支付作为本次公开部署内容。正式发布目录固定为：

```text
网页制作/dist-public
```

## 发布前准备

先在 `launch-env-intake.md` 填完并确认正式运营信息。

在部署平台配置以下环境变量：

```text
SITE_URL=https://你的正式域名
CONTACT_EMAIL=你的客服邮箱
CONTACT_WECHAT=你的客服微信
```

可选：

```text
BUSINESS_NAME=馥屿 Scent Atoll
STUDIO_BOOKING=通过客服微信预约
CUSTOMER_HOURS=12:00 - 20:00
OG_IMAGE=https://你的正式域名/og-image.jpg
```

`OG_IMAGE` 不填时会使用站内 `/og-image.png`。如果填写，必须是 `https://` 的 PNG、JPG 或 WebP 图片 URL。
`BUSINESS_NAME` 不填时会使用已确认的店名 `馥屿 Scent Atoll`；如有正式经营主体名称，可在部署平台填写它覆盖默认值。
`STUDIO_BOOKING` 不填时会使用 `通过客服微信预约`；如有正式预约表单、小红书私信或其他方式，可填写它覆盖默认值。
`SITE_URL` 必须是正式域名根地址，例如 `https://www.example.com`，不要填成 `https://www.example.com/shop.html`。

## 本地最终检查

在仓库根目录进入项目子目录：

```bash
cd 网页制作
nvm use
npm ci
```

先跑常规门禁：

```bash
npm run launch:preflight
```

这个命令会依次运行 `npm test`、`npm run build` 和 `npm run launch:check`。

再用真实运营信息跑严格门禁：

```bash
npm run launch:status
npm run check:env
npm run launch:strict
```

`launch:status` 是只读状态检查，不构建、不部署、不联网；它用于在发布前快速确认还缺哪些上线条件。

如果本次上线改动已经提交并推送到 GitHub，也可以用本地最终组合门禁：

```bash
npm run launch:ready
```

这个命令会依次确认 Git 发布状态、整个仓库的补丁空白检查、测试 / 普通构建 / 公开包检查和严格上线构建。它只适合本地发布前运行；部署平台 build command 仍然使用 `npm run launch:strict`。

如果代码已经推到 GitHub，也可以在 Actions 页面手动运行 `Scent Atoll CI`。这个 workflow 支持 `workflow_dispatch`，会跑语法检查、测试、开发构建、公开发布包检查和严格上线门禁。

严格门禁通过后，才允许发布 `dist-public/`。

## GitHub 发布确认

如果部署平台连接 GitHub 仓库，先确认目标分支已经包含本次上线准备的所有文件，再触发平台部署。尤其要确认根目录 / 子目录的 Netlify、Vercel、Node 版本、CI、上线脚本、测试、SEO / 合规页面和计划文档都已提交。

```bash
npm run check:git-release
git diff --check -- :/
```

处理原则：

- `dist/` 和 `dist-public/` 不提交，平台会通过 `npm run launch:strict` 重新生成。
- `.env.production` 和 `.env*.local` 不提交，真实值只放在部署平台环境变量里。
- `src/assets/og-image.png` 不提交，它由 `scripts/generate-og-image.mjs` 在构建时生成。
- `网页制作/` 根目录下的旧静态 HTML、`script.js`、`styles.css`、`data.js` 不作为正式部署来源；正式页面源文件以 `src/`、上线脚本、部署配置和计划文档为准。
- 如果 `git status` 里还有 `.github/`、`netlify.toml`、`vercel.json`、`.nvmrc`、`scripts/`、`tests/`、`src/` 或 `网页制作/plan/` 的未跟踪 / 未提交改动，不要开始正式部署。
- `check:git-release` 在本地分支领先 upstream 时会失败；没有 upstream 时会给 warning，需要你人工确认目标分支已经推到 GitHub。
- `npm run launch:ready` 已经包含 `check:git-release`、`git diff --check -- :/`、`launch:preflight` 和 `launch:strict`，可作为发布前最后一次本地总闸门。

建议 staging 范围从仓库根目录执行，先只纳入上线关键文件：

```bash
git add -- .github .gitignore .nvmrc README.md netlify.toml vercel.json
git add -- 网页制作/.eleventy.js 网页制作/.gitignore 网页制作/.nvmrc 网页制作/README.md
git add -- 网页制作/package.json 网页制作/package-lock.json 网页制作/.env.production.example 网页制作/netlify.toml 网页制作/vercel.json
git add -- 网页制作/scripts 网页制作/server/src 网页制作/tests 网页制作/src 网页制作/plan
git rm --cached -r --ignore-unmatch 网页制作/dist
git status --short --untracked-files=all
```

`git rm --cached -r --ignore-unmatch 网页制作/dist` 只用于提交“停止追踪旧构建产物”的索引删除，不删除本地 `dist/` 文件；如果当前索引已经没有 `dist/`，它会安静通过。提交前再次确认 `git status` 里没有 `.env.production`、`dist-public/`、`src/assets/og-image.png` 或本地数据库文件。

## 平台部署

### Netlify

如果 Netlify 从仓库根目录读取配置，直接使用根目录 `netlify.toml`：

```text
base = 网页制作
build command = npm run launch:strict
publish = dist-public
NODE_VERSION = 22
```

如果 Netlify 项目根目录设为 `网页制作/`，使用子目录内 `netlify.toml`：

```text
build command = npm run launch:strict
publish = dist-public
NODE_VERSION = 22
```

### Vercel

如果 Vercel 从仓库根目录读取配置，使用根目录 `vercel.json`。它会自动进入 `网页制作/` 安装和构建，并发布：

```text
网页制作/dist-public
```

如果 Vercel 项目根目录设为 `网页制作/`，使用子目录内 `vercel.json`，输出目录为：

```text
dist-public
```

Vercel 项目设置里确认 Node.js Version 使用 22，或确认它读取 `网页制作/package.json` 的 `engines.node >=22`。

### Cloudflare Pages

把项目根目录设为 `网页制作/`，配置：

```text
Build command: npm run launch:strict
Output directory: dist-public
Node.js version: 22
```

`_headers` 和 `_redirects` 会随发布包生成。

## 域名和 DNS

正式发布前先选定唯一主域名，并让 `SITE_URL` 与它完全一致。例如选择：

```text
https://www.example.com
```

则不要把 `SITE_URL` 填成裸域、平台预览域或任何带路径的地址。

DNS 和平台域名设置建议：

- `www` 子域通常用 `CNAME` 指向部署平台提供的目标。
- 裸域通常按平台要求使用 `A`、`ALIAS`、`ANAME` 或 CNAME flattening。
- 只保留一个 canonical 主域名，另一个域名做 301 / 308 跳转到主域名。
- HTTPS 证书签发完成后再对外发布。
- 不要把 Netlify / Vercel / Cloudflare Pages 的预览域名提交给搜索引擎或写入外部渠道。

域名配置完成后，用最终主域名运行部署后 smoke check。

## 部署后 smoke check

部署完成并绑定正式域名后，在本地运行：

```bash
SITE_URL=https://你的正式域名 CONTACT_EMAIL=你的客服邮箱 CONTACT_WECHAT=你的客服微信 npm run check:live
```

如果有正式主体、预约方式或客服时间，建议也一起传入，确认线上页面展示的是本次正式值：

```bash
SITE_URL=https://你的正式域名 CONTACT_EMAIL=你的客服邮箱 CONTACT_WECHAT=你的客服微信 BUSINESS_NAME=你的经营主体名称 STUDIO_BOOKING=你的预约方式 CUSTOMER_HOURS="12:00 - 20:00" npm run check:live
```

它会检查：

- 公开页面返回 200。
- 私有开发路径返回 404。
- 随机未知路径返回 404。
- `robots.txt` 指向正式域名 sitemap。
- `sitemap.xml` 包含公开主路径和静态详情页。
- canonical 与 `og:url` 指向当前线上 URL。
- `og:image` / `twitter:image` 可访问且返回图片类型。
- 安全响应头存在。
- `cart.html`、`404.html` 有 `X-Robots-Tag: noindex, nofollow`。
- 旧兼容详情入口 `product.html`、`brand.html`、`article.html` 保持 `noindex`。
- 页面内没有示例域名、示例邮箱或“上线前填写”占位。
- 如果提供了客服邮箱、客服微信、经营主体、预约方式和客服时间，会确认它们已经出现在上线后的公开页面中。
- 如果提供了 `OG_IMAGE`，会确认线上分享元数据实际使用这个图片 URL，并确认 `og:image` 与 `twitter:image` 一致。

## 人工抽查

自动检查通过后，再手动打开：

- 首页 `/`
- 香水列表 `/shop.html`
- 一个商品静态详情页，例如 `/product-vespree.html`
- 品牌页 `/brands.html`
- 一个品牌静态详情页，例如 `/brand-satori.html`
- Journal `/journal.html`
- 一篇文章静态详情页，例如 `/article-first-niche.html`
- 试香 `/samples.html`
- 客服与配送 `/service.html`
- 隐私政策 `/privacy.html`
- 用户协议 `/terms.html`
- 404 `/404.html`

手机 375px 宽度也要抽查首页、香水列表、商品详情和购物意向清单。

## 回滚

如果部署后 `check:live` 失败：

1. 暂停把新地址提交给搜索引擎或外部渠道。
2. 在部署平台回滚到上一个通过 smoke check 的部署版本。
3. 保留失败部署的构建日志和 `check:live` 输出。
4. 修复后重新跑 `npm run launch:strict`。
5. 再次部署并跑 `SITE_URL=https://你的正式域名 CONTACT_EMAIL=你的客服邮箱 CONTACT_WECHAT=你的客服微信 npm run check:live`。

如果只是环境变量填错：

1. 在部署平台修正变量。
2. 重新触发构建。
3. 跑 `check:live`。

不要通过手动上传普通 `dist/` 来临时修复，因为 `dist/` 包含开发页。
