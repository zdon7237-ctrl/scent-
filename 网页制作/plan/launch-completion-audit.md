# 馥屿上线准备完成度审计

> 历史记录（展示版）：本文审计的是早期 `dist-public/` public-only 方案，不再定义当前主生产架构。当前商业版以 `launch-readiness-checklist.md` 和 `launch-runbook.md` 为准：Vercel 发布完整 `dist/` + API，`dist-public/` 仅作应急只读降级。

更新日期：2026-05-12

## 目标复述

完成馥屿 Scent Atoll 网站正式上线前的工程、部署、SEO、合规页面和公开发布包准备。香水商品内容与图片由店主后续自行替换。

## 审计结论

代码侧上线准备已经完成到可部署状态，正式发布包、部署配置、SEO 基础、合规页面、404、安全响应头、CI 和自动检查均已落地。

当前不能标记为“完全上线就绪”，因为仍缺少真实运营信息，且因此还不能完成真实域名部署后的线上 `check:live`：

- 正式域名。
- 客服邮箱。
- 客服微信。

经营主体名称现在可选；不设置 `BUSINESS_NAME` 时，公开页面会使用已确认店名 `馥屿 Scent Atoll`，后续有正式主体名称时可用环境变量覆盖。
工作室试香预约方式现在可选；不设置 `STUDIO_BOOKING` 时，公开页面会使用 `通过客服微信预约`，后续有预约表单、小红书私信或其他方式时可用环境变量覆盖。

如果部署平台从 GitHub 拉取代码，还必须先把本次上线配置、脚本、测试、CI、SEO / 合规页面和计划文档提交并推送到目标分支。当前本地存在大量上线相关未提交 / 未跟踪改动；本地检查通过只证明工作区可用，不代表远端部署平台已经能读取这些文件。

这些信息不是香水商品内容或图片，但属于合规和 SEO 必填项，必须由店主确认后才能通过严格上线检查。默认分享图已改为站内 `og-image.png` 品牌资产；如后续提供 `OG_IMAGE`，会覆盖默认图。严格检查通过并部署到正式域名后，还必须运行 `npm run check:live` 确认线上结果。

## Prompt 到交付物检查表

| 要求 | 交付物 | 证据 | 状态 |
|---|---|---|---|
| 工程准备 | 构建脚本、语法检查、测试、CI、Node 版本约束、上线入口文档 | `package.json` 含 `build:public`、`check:env`、`check:public`、`check:deploy`、`check:live`、`check:git-release`、`launch:check`、`launch:preflight`、`launch:strict`、本地最终门禁 `launch:ready`、只读状态入口 `launch:status` 和 `engines.node >=22`；`launch:ready` 会串起 Git 发布检查、全仓补丁空白、`launch:preflight` 和 `launch:strict`；`scripts/check-deploy-config.mjs` 已校验这些发布脚本的关键命令片段，防止 `launch:strict`、`launch:ready` 或 CI 入口被误改；根目录和项目子目录有 `.nvmrc`；Netlify 根目录和子目录配置显式设置 `NODE_VERSION = "22"`；`.github/workflows/scent-atoll-ci.yml` 读取 `网页制作/.nvmrc` 并在 `网页制作/` 下执行 `npm ci`、对 `scripts/*.mjs` 和 `tests/*.test.mjs` 做通配语法检查、`npm run launch:preflight`，并用测试运营值和临时输出目录执行 `npm run launch:strict`；`check:deploy` 也会确认 CI 仍跑这些步骤且没有误用本地专用的 `launch:ready`；CI 支持 `workflow_dispatch`，可在正式部署前手动触发；`scripts/paths.mjs` 让脚本从自身位置定位项目根，避免从仓库根目录直接运行时写错目录；`scripts/load-env.mjs` 支持本地 `.env.production` 且不覆盖已设置环境变量；仓库根目录 `README.md` 说明子目录、发布包和必填环境变量；项目子目录 `README.md` 提供进入 `网页制作/` 后的短版上线入口；`plan/launch-runbook.md` 提供发布当天操作顺序、平台配置、部署后 smoke check 和回滚步骤 | 已完成 |
| 部署准备 | 静态 public-only 发布包 | `scripts/build-public.mjs` 输出 `dist-public/`，移除后台、会员、真实结账、订单、积分页面和 `assets/js` 开发模块；除固定私有文件清单外，还按 `admin`、`account`、`login`、`register`、`member`、`membership`、`checkout`、`orders`、`points` 前缀兜底删除未来新增私有 HTML | 已完成 |
| 部署平台配置 | Netlify / Vercel / Cloudflare Pages 基础配置 | 子目录 `netlify.toml` / `vercel.json` 指向 `dist-public`，build command 使用 `npm run launch:strict`；仓库根目录 `netlify.toml` / `vercel.json` 适配整仓库部署并指向 `网页制作/dist-public`，同样使用严格上线门禁作为平台构建命令；Netlify 配置显式设置 Node 22，Vercel 和 Cloudflare Pages 在 runbook 中要求确认 Node 22；`src/pages/headers.njk` 和 `src/pages/redirects.njk` 生成 Cloudflare/Netlify 文件；`cart.html`、`404.html` 在 Netlify/Vercel/_headers 中都有 `X-Robots-Tag: noindex, nofollow`；Netlify、Vercel 和 `_headers` 的特殊页面规则自身都包含完整安全响应头，不依赖平台合并多条匹配规则；安全响应头包含保守 HSTS：`Strict-Transport-Security: max-age=31536000` | 已完成 |
| SEO 基础 | canonical、OG、Twitter、favicon、robots、sitemap | `src/_includes/layout.njk` 使用 `site.url`、`site.shareImage`；`scripts/generate-og-image.mjs` 生成站内 PNG 品牌分享图；`src/pages/robots.njk`、`src/pages/sitemap.njk` 使用环境变量域名；`src/_data/catalog.js` 从 `src/assets/data.js` 读取 catalog id，并生成 `product-{id}.html`、`brand-{id}.html`、`article-{id}.html` 静态详情页路径，让 sitemap 自动包含可收录的商品、品牌、文章详情 URL；旧的 `product.html`、`brand.html`、`article.html` 入口保留兼容但设为 `noindex`；`npm run check:public` 会校验公开 HTML 的 title、description、canonical、OG、Twitter、noindex、旧兼容详情入口 noindex、canonical/`og:url` 逐页精确匹配、catalog 详情 URL 已进入 sitemap、以及 sitemap 私有页排除；`npm run check:live` 会在部署后探测 `og:image` / `twitter:image` 是否可访问且返回图片类型，确认 canonical/`og:url` 指向当前线上页面，校验旧兼容详情入口 noindex，确认随机未知路径返回 404，并拒绝 `example.com`、“上线前填写”和“你的...”占位；`check:live` 还会确认客服邮箱、客服微信、默认或自定义经营主体、默认或自定义预约方式、默认或自定义客服时间已出现在上线后的公开页面中；如果传入 `OG_IMAGE`，会确认线上分享元数据实际使用这个图片 URL；线上 `og:image` 和 `twitter:image` 必须一致 | 已完成，等待真实域名 |
| 合规页面 | 隐私政策、用户协议、人工购买说明、客服/配送/退换说明 | `src/pages/privacy.njk`、`src/pages/terms.njk`、`src/pages/payment.njk`、`src/pages/service.njk` 已存在并进入 sitemap；未确认的发货时效、快递、包邮门槛和无理由退换承诺已从公开页移除，统一改为购买前客服确认 | 已完成，等待真实客服信息 |
| 公开发布包不暴露开发能力 | 不部署后台、会员、积分、订单、checkout 真实结账页和旧支付前端 | `npm run check:public` 检查 forbidden files、forbidden private path patterns、forbidden patterns、HTML 本地链接和 CSS 本地 `url(...)` 完整性；`rg` 扫描 `dist-public` 没有 `/api/admin`、`/api/checkout`、`dev-admin` 等；临时发布目录加入 `admin-settings.html` 或 `checkout.html` 后检查器会失败 | 已完成 |
| 香水内容和图片后置 | 不强制处理商品数据和图片 | `plan/launch-readiness-checklist.md` 明确商品资料、商品图片、品牌图片、文章图片、OG 最终素材由后续替换；`plan/soft-launch-showcase-plan.md` 已区分“商品资料和图片后置”与“真实运营信息仍需补齐” | 已按用户边界处理 |
| 计划文件夹收口 | 删除已完成旧方案，保留仍指导上线和后续开发的计划 | `plan/README.md` 明确当前只保留上线变量收集表、上线清单、发布运行手册、完成度审计、展示 / 试运营计划、生产化路线图、PostgreSQL、会员和积分规则文档；当前剩余动作改为补真实运营信息、跑严格检查、按 runbook 部署 `dist-public/` 和线上 smoke check | 已完成 |
| 环境变量和生成物保护 | 避免示例值伪装成正式值，避免提交本地构建产物 | `.env.production.example` 的必填项统一使用“你的...”占位，复制后不替换时 `npm run launch:strict` 会失败；仓库根目录和 `网页制作/` 子目录的 `.gitignore` 都会忽略真实 `.env.production`、本地 `.env*.local`、构建产物、脚本生成的 `src/assets/og-image.png` 和本地 JSON 数据库；已将历史追踪的 `网页制作/dist/` 从 Git 索引移除但保留本地文件；项目根目录遗留生成物如 `404.html`、`_headers`、`robots.txt`、`sitemap.xml`、`og-image.png`、`payment.html`、`privacy.html`、`terms.html` 也已忽略，正式源文件保留在 `src/pages/`；后续不会把含开发页的普通构建产物或根目录遗留输出误提交；当前工作区不存在真实 `.env.production`，避免临时值误入仓库 | 已完成 |
| Git 发布交接 | 防止平台部署拿不到本地新增上线文件 | `scripts/check-git-release.mjs` 和 `npm run check:git-release` 已补充；该检查会确认关键上线文件已被 Git 跟踪、关键上线路径没有未提交 / 未跟踪改动、生成物和本地 secret 文件没有被错误追踪，并在本地分支领先 upstream 时失败；必跟踪清单覆盖根目录发布配置、CI、Node / README、Eleventy 配置、上线脚本、`build-script.mjs`、数据库脚本、上线测试、`server-api.test.mjs`、server 源文件、public-only 直接源文件（`src/assets/data.js`、`styles.css`、`public-app.js` 及 catalog/cart 依赖）、普通构建 JS 入口和依赖（`app.js`、api/auth/admin/member/points 模块和 `src/assets/js/package.json`）、SEO / 合规页面、公开页面源文件和上线计划；`plan/launch-readiness-checklist.md` 和 `plan/launch-runbook.md` 已要求部署前运行 `npm run check:git-release` 和 `git diff --check -- :/`，并明确必须提交 / 推送 `.github`、根目录和子目录部署配置、Node 版本文件、脚本、测试、SEO / 合规页面和上线文档；同时明确真实 `.env.production`、`dist/`、`dist-public/`、`src/assets/og-image.png` 和本地生成物不能提交 | 机制已完成，实际提交 / 推送待执行 |
| 严格上线检查 | 填入真实运营信息后无占位符，且部署配置仍可用 | `npm run check:env` 会在构建前校验必需环境变量、邮箱格式、正式 `https://` 域名根地址和可选 `OG_IMAGE`；`npm run launch:strict` 会先运行 `check:env`，再重新构建 public-only 发布包，把示例域名、示例邮箱和“上线前填写”占位视为失败，并继续运行 `npm run check:deploy` 校验 Netlify / Vercel 配置；strict public check 还会确认客服邮箱、客服微信、默认或自定义经营主体、默认或自定义工作室预约方式和默认或自定义客服时间已经实际渲染进公开发布包；用临时输出目录和测试运营信息运行已通过 | 机制已完成，真实值待填 |

## 实际验证记录

本轮已执行并通过：

```bash
git diff --check
node --check src/assets/js/public-app.js
node --check scripts/build-public.mjs
node --check scripts/check-public-build.mjs
node --check scripts/check-live.mjs
node --check scripts/check-git-release.mjs
node --check scripts/check-deploy-config.mjs
node --check tests/check-git-release.test.mjs
node --test tests/check-git-release.test.mjs # 当前 4 passed，覆盖 plan 索引一致性、干净已提交发布树、未提交上线关键改动和生成物 / 旧静态副本被误追踪
node --check tests/deploy-config.test.mjs
node --test tests/deploy-config.test.mjs # 当前 4 passed，覆盖部署配置、发布脚本和 CI 契约的正向与负向路径，并确认平台配置不会误用本地专用 launch:ready
node --check scripts/launch-status.mjs
node --check tests/launch-status.test.mjs
node --test tests/launch-status.test.mjs # 当前 2 passed，覆盖 launch:status 在本地门禁全绿和缺运营变量时的摘要行为
npm run build
npm run launch:check
npm test
```

本轮最终复核补充：

```bash
npm run launch:preflight # 当前通过；随后完成普通构建和 public 发布包检查
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-current-strict SITE_URL=https://www.scent-atoll.test CONTACT_EMAIL=hello@scent-atoll.test CONTACT_WECHAT=ScentAtoll BUSINESS_NAME='Scent Atoll Studio Ltd' STUDIO_BOOKING='Wechat appointment' npm run launch:strict # 当前通过，确认部署 strict 门禁仍可用
npm run check:env # 当前按预期失败，缺少 SITE_URL、CONTACT_EMAIL、CONTACT_WECHAT；BUSINESS_NAME 默认使用馥屿 Scent Atoll，STUDIO_BOOKING 默认使用通过客服微信预约
npm run check:deploy # 当前通过，确认 Netlify / Vercel 仍使用 npm run launch:strict
npm run check:deploy # 当前也校验 package.json 发布脚本和 CI workflow 关键命令片段，防止 strict / ready / CI 入口被误改
npm run check:public # 当前通过；未填真实运营信息时只输出占位 warning，strict 模式会失败
npm run check:git-release # 当前按预期失败，列出未被 Git 跟踪或仍有未提交改动的上线关键文件；提交并推送后才应通过
npm run launch:ready # 当前按预期失败在 check:git-release，确认本地最终组合门禁会先挡住未提交 / 未推送的发布风险；通过后会继续运行 git diff --check -- :/、launch:preflight 和 launch:strict
npm run launch:status # 当前按预期失败，摘要显示 Launch environment 和 Git release handoff 仍需处理，Deployment config 与 Patch whitespace 已通过
for file in scripts/*.mjs; do node --check "$file"; done # 当前通过，确认 CI 的脚本语法通配会覆盖 check-git-release.mjs
npm run launch:check # 当前通过，确认新增 Git 发布门禁不影响 public-only 发布包检查、公开包边界检查和部署配置检查
git diff --check
```

本轮还复核并清理了 `plan/production-platform-roadmap.md`、`plan/membership-system-plan.md` 和 `plan/points-mall-plan.md` 中关于“正式后台登录”的旧表述：当前文档已改为生产管理员账号、强密码、限流、审计、监控和现有后台 session / 角色权限复核，不再把已实现的后台登录/session/角色权限误写成未开始事项。

本轮新增 `网页制作/README.md` 作为项目子目录内的上线入口，避免部署或交接时只看到代码目录而漏掉正式发布包、必填变量、strict 门禁和部署后 `check:live` 步骤。

本轮仓库卫生复核发现历史生成的 `网页制作/dist/` 仍被 Git 追踪。已执行 `git rm --cached -r 网页制作/dist`，只从 Git 索引移除，不删除本地文件；`git ls-files 网页制作/dist` 当前无输出，`git check-ignore --no-index 网页制作/dist/index.html 网页制作/dist/admin.html` 确认会被 `网页制作/.gitignore` 忽略。

本轮也发现项目根目录有未追踪的旧静态输出：`404.html`、`_headers`、`_redirects`、`robots.txt`、`sitemap.xml`、`og-image.png`、`payment.html`、`privacy.html`、`terms.html`。当前构建脚本只写 `dist/` 和 `dist-public/`，正式源文件在 `src/pages/`，因此已把这些根目录遗留输出加入忽略；复核确认 `src/pages/*.njk` 和上线检查脚本没有被误忽略。

本轮还把 Netlify 根目录和子目录配置显式钉到 Node 22，并把 `NODE_VERSION = "22"`、根目录和项目 `.nvmrc`、`package.json engines.node >=22`、Vercel `npm ci` 安装命令纳入 `npm run check:deploy` 门禁；`node --check scripts/check-deploy-config.mjs` 和 `npm run check:deploy` 均已通过。Vercel / Cloudflare Pages 的 Node 22 确认步骤已写入 `launch-runbook.md`。

本轮补强了根目录 `README.md`、项目子目录 `README.md` 和 `.env.production.example` 中的 `SITE_URL` 填写说明，明确要求正式 `https://` 域名根地址，不带末尾 `/`、路径、查询参数或 `#`，避免上线当天生成错误 canonical、OG URL、robots 和 sitemap。

本轮将 GitHub Actions 的脚本语法检查从手工列举改为 `for file in scripts/*.mjs; do node --check "$file"; done`，避免后续新增脚本漏过 CI；本地已运行同等 `scripts/*.mjs` 和 `tests/*.test.mjs` 通配语法检查并通过。

本轮补充了 `launch-runbook.md` 的“域名和 DNS”步骤，明确先选唯一 canonical 主域名，让 `SITE_URL` 与它完全一致；www / 裸域只保留一个主域名，另一个域名 301 / 308 跳转；平台预览域名不得提交搜索引擎或写入外部渠道。

本轮把 `checkout.html` 纳入 public-only 边界：`build-public.mjs` 会删除 checkout 路径，`check-public-build.mjs` 会拒绝 checkout 文件和路径，`check-live.mjs` 会要求线上 `/checkout.html` 返回 404，`_redirects` 也生成 `/checkout.html /404.html 404`。新增 `tests/public-build.test.mjs` 用临时发布包注入 `checkout.html`，确认检查器会失败。

本轮补齐了 `CUSTOMER_HOURS` 可选项的渲染校验：如果 strict public check 或 live check 显式传入 `CUSTOMER_HOURS`，检查器会确认它实际出现在公开页面中。`tests/public-build.test.mjs` 和 `tests/live-check.test.mjs` 已覆盖对应失败路径。

本轮补齐了部署后未知路径检查：`check-live.mjs` 会请求 `/__scent-atoll-missing-page-check.html` 并要求返回 404，用于验证平台兜底 404 规则实际生效；`tests/live-check.test.mjs` 已覆盖未知路径错误返回 200 时应失败的负向路径。

本轮追加审计后已再次执行并通过：

```bash
rg -n "48 小时|¥599|顺丰|包邮|无理由|已记录|已收到|已加入收藏" dist-public
rg -n "(/api/checkout|/api/admin|/api/orders|dev-admin|x-admin|提交订单|前往结账|加入购物车)" dist-public
git diff --check
node --check src/assets/js/public-app.js
node --check scripts/build-site.mjs
node --check scripts/generate-og-image.mjs
node --check scripts/load-env.mjs
node --check scripts/paths.mjs
node --check scripts/check-deploy-config.mjs
node --check scripts/check-live.mjs
node --check scripts/check-public-build.mjs
node --check src/_data/catalog.js
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); JSON.parse(require('fs').readFileSync('网页制作/vercel.json','utf8'))"
npm run launch:check
npm run check:deploy
npm run launch:strict # 使用临时测试运营信息和 /private/tmp/scent-atoll-strict-check，未设置 OG_IMAGE，走站内 og-image.png
PUBLIC_OUTPUT_DIR=/private/tmp/scent-atoll-infer-check npm run check:public # 不带 SITE_URL 时，从 index.html canonical 推断站点基准 URL
node 网页制作/scripts/build-public.mjs # 从仓库根目录直接运行，确认仍写入 网页制作/dist-public 且不污染根目录
node 网页制作/scripts/check-public-build.mjs # 从仓库根目录直接运行，确认仍检查 网页制作/dist-public
npm run launch:strict # 使用临时测试运营信息和 OG_IMAGE=https://www.scent-atoll.test/share.jpg，验证自定义分享图类型输出为 image/jpeg
npm run launch:strict # 使用 BUSINESS_NAME=你的经营主体名称 时应失败，验证中文模板占位不会漏过
rg -n "canonical|og:url" /private/tmp/scent-atoll-canonical-check/index.html /private/tmp/scent-atoll-canonical-check/shop.html /private/tmp/scent-atoll-canonical-check/privacy.html
npm test
```

本次继续审计后已再次执行并确认：

```bash
git diff --check
node --check scripts/check-live.mjs
npm run check:live # 使用 SITE_URL=https://你的正式域名，预期失败，确认线上检查会先拒绝占位域名
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-ci-strict SITE_URL=https://www.scent-atoll.test CONTACT_EMAIL=hello@scent-atoll.test CONTACT_WECHAT=ScentAtoll BUSINESS_NAME='Scent Atoll Studio Ltd' STUDIO_BOOKING='Wechat appointment' npm run launch:strict # 与 CI 严格门禁步骤一致
npm run launch:check
node -e "const fs=require('fs'); const text=fs.readFileSync('dist-public/sitemap.xml','utf8'); console.log(JSON.stringify({product:(text.match(/product-[^<]+\\.html/g)||[]).length,brand:(text.match(/brand-[^<]+\\.html/g)||[]).length,article:(text.match(/article-[^<]+\\.html/g)||[]).length,query:/\\?id=/.test(text)}));" # 当前输出 {"product":8,"brand":6,"article":3,"query":false}，与 data.js 一致
rg -n "product\\.html\\?id|brand\\.html\\?id|article\\.html\\?id" src dist-public dist script.js assets/js || true # 无匹配为预期结果
rg -n "canonical|og:url|robots|data-entry-id" dist-public/product-vespree.html dist-public/brand-satori.html dist-public/article-first-niche.html dist-public/product.html dist-public/brand.html dist-public/article.html # 静态详情页 index,follow，旧兼容入口 noindex
node --check scripts/check-public-build.mjs
node --check scripts/check-live.mjs
node --check scripts/check-launch-env.mjs
npm run check:env # 未设置真实运营信息时预期失败，并列出 3 个必填变量；经营主体和预约方式使用安全默认值
env SITE_URL=https://www.scent-atoll.test CONTACT_EMAIL=hello@scent-atoll.test CONTACT_WECHAT=ScentAtoll BUSINESS_NAME='Scent Atoll Studio Ltd' STUDIO_BOOKING='Wechat appointment' npm run check:env
env SITE_URL=https://你的正式域名 CONTACT_EMAIL=你的客服邮箱 CONTACT_WECHAT=你的客服微信 BUSINESS_NAME=你的经营主体名称 STUDIO_BOOKING=你的预约方式 npm run check:env # 预期失败，确认 check:env 会拒绝模板占位
env SITE_URL=https://www.scent-atoll.test/shop.html CONTACT_EMAIL=hello@scent-atoll.test CONTACT_WECHAT=ScentAtoll BUSINESS_NAME='Scent Atoll Studio Ltd' STUDIO_BOOKING='Wechat appointment' npm run check:env # 预期失败，确认 SITE_URL 不能带路径
SITE_URL=https://www.scent-atoll.test/shop.html npm run check:live # 预期失败，确认线上 smoke check 也拒绝带路径的 SITE_URL
SITE_URL=https:// npm run check:live # 预期失败，确认线上 smoke check 不会接受无主机名 URL
SITE_URL=http://www.scent-atoll.test npm run check:live # 预期失败，确认线上 smoke check 要求 https
SITE_URL=https://user:pass@www.scent-atoll.test npm run check:live # 预期失败，确认线上 smoke check 拒绝带账号密码的 URL
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-ci-strict SITE_URL=https://www.scent-atoll.test/shop.html CONTACT_EMAIL=hello@scent-atoll.test CONTACT_WECHAT=ScentAtoll BUSINESS_NAME='Scent Atoll Studio Ltd' STUDIO_BOOKING='Wechat appointment' npm run build:public
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-ci-strict SITE_URL=https://www.scent-atoll.test/shop.html CONTACT_EMAIL=hello@scent-atoll.test CONTACT_WECHAT=ScentAtoll BUSINESS_NAME='Scent Atoll Studio Ltd' STUDIO_BOOKING='Wechat appointment' node scripts/check-public-build.mjs --strict # 预期失败，确认直接调用 strict public check 也拒绝带路径的 SITE_URL
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-ci-strict SITE_URL='   ' CONTACT_EMAIL='   ' CONTACT_WECHAT='   ' BUSINESS_NAME='   ' STUDIO_BOOKING='   ' node scripts/check-public-build.mjs --strict # 预期失败，确认 direct strict 会把全空格变量视为缺失
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-noindex-gate npm run build:public
perl -0pi -e 's/<meta name="robots" content="noindex,nofollow">//' /tmp/scent-atoll-noindex-gate/product.html
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-noindex-gate node scripts/check-public-build.mjs # 预期失败，确认旧兼容详情入口 noindex 门禁生效
env PUBLIC_OUTPUT_DIR=/private/tmp/scent-atoll-audit-strict SITE_URL=https://www.scent-atoll.test CONTACT_EMAIL=hello@scent-atoll.test CONTACT_WECHAT=ScentAtoll BUSINESS_NAME='Scent Atoll Studio Ltd' STUDIO_BOOKING='Wechat appointment' npm run launch:strict
env PUBLIC_OUTPUT_DIR=/private/tmp/scent-atoll-strict-with-deploy SITE_URL=https://www.scent-atoll.test CONTACT_EMAIL=hello@scent-atoll.test CONTACT_WECHAT=ScentAtoll BUSINESS_NAME='Scent Atoll Studio Ltd' STUDIO_BOOKING='Wechat appointment' npm run launch:strict # 确认严格门禁会继续执行 check:deploy
env PUBLIC_OUTPUT_DIR=/private/tmp/scent-atoll-placeholder-reject SITE_URL=https://你的正式域名 CONTACT_EMAIL=你的客服邮箱 CONTACT_WECHAT=你的客服微信 BUSINESS_NAME=你的经营主体名称 STUDIO_BOOKING=你的预约方式 npm run launch:strict # 预期失败，确认模板占位不会通过
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-strict-missing npm run launch:strict # 预期失败，确认缺少真实运营信息时 strict 不会通过
find /private/tmp/scent-atoll-audit-strict -maxdepth 2 -type f
rg -n "scent-atoll\.example\.com|上线前填写|hello@scent-atoll\.example\.com|/api/checkout|/api/admin|dev-admin|x-admin|提交订单|前往结账|加入购物车" /private/tmp/scent-atoll-audit-strict # 无匹配为预期结果
env PUBLIC_OUTPUT_DIR=/private/tmp/scent-atoll-forbidden-path-check node scripts/check-public-build.mjs # 临时加入 admin-settings.html，预期失败，确认私有路径前缀兜底生效
npm run build
node --check tests/launch-env.test.mjs
node --test tests/launch-env.test.mjs # 当前 9 passed，覆盖完整值、缺值、全空格、模板占位、默认主体 / 预约方式、SITE_URL 路径、非 https、带账号密码、非法 OG_IMAGE
node --check tests/site-data.test.mjs
node --test tests/site-data.test.mjs # 当前 2 passed，覆盖 site data 对部署环境变量的 trim 和空值 fallback
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-ci-strict SITE_URL=https://www.scent-atoll.test CONTACT_EMAIL=hello@scent-atoll.test CONTACT_WECHAT=ScentAtoll BUSINESS_NAME='Scent Atoll Studio Ltd' STUDIO_BOOKING='Wechat appointment' npm run launch:strict
npm run launch:check
npm test
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-public-explicit SITE_URL=https://www.scent-atoll.test/shop.html npm run build:public
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-public-explicit SITE_URL=https://www.scent-atoll.test/shop.html npm run check:public # 预期失败，确认非 strict 的公开包检查也会拒绝显式传入的带路径 SITE_URL
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-public-explicit-og OG_IMAGE=http://www.scent-atoll.test/share.txt npm run build:public
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-public-explicit-og OG_IMAGE=http://www.scent-atoll.test/share.txt npm run check:public # 预期失败，确认非 strict 的公开包检查也会拒绝显式传入的非 https 图片 OG_IMAGE
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-public-explicit-email CONTACT_EMAIL=not-an-email npm run build:public
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-public-explicit-email CONTACT_EMAIL=not-an-email npm run check:public # 预期失败，确认非 strict 的公开包检查也会拒绝显式传入的非法客服邮箱
node --check scripts/check-public-build.mjs
git diff --check
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-ci-strict SITE_URL=https://www.scent-atoll.test CONTACT_EMAIL=hello@scent-atoll.test CONTACT_WECHAT=ScentAtoll BUSINESS_NAME='Scent Atoll Studio Ltd' STUDIO_BOOKING='Wechat appointment' npm run launch:strict # 再次确认与 CI 严格门禁等价的完整流程通过
node --check scripts/check-deploy-config.mjs
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('vercel.json','utf8')); JSON.parse(fs.readFileSync('../vercel.json','utf8')); console.log('json ok');"
npm run check:deploy # 确认 Netlify / Vercel 平台 build command 均已切到 npm run launch:strict
npm run launch:check
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-ci-strict SITE_URL=https://www.scent-atoll.test CONTACT_EMAIL=hello@scent-atoll.test CONTACT_WECHAT=ScentAtoll BUSINESS_NAME='Scent Atoll Studio Ltd' STUDIO_BOOKING='Wechat appointment' npm run launch:strict
git diff --check
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist-public # 本地临时服务，用于浏览器复核，检查完成后已关闭
Chrome DevTools 375x812 mobile viewport audit # 打开 /、/shop.html、/product-vespree.html、/brands.html、/brand-satori.html、/samples.html、/journal.html、/article-first-niche.html、/about.html、/service.html、/payment.html、/privacy.html、/terms.html、/404.html
node --check scripts/check-public-build.mjs
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-rendered-env SITE_URL=https://www.scent-atoll.test CONTACT_EMAIL=hello@scent-atoll.test CONTACT_WECHAT=ScentAtoll BUSINESS_NAME='Scent Atoll Studio Ltd' STUDIO_BOOKING='Wechat appointment' npm run launch:strict # 确认 strict 会接受已渲染进页面的真实运营信息
env PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-rendered-env SITE_URL=https://www.scent-atoll.test CONTACT_EMAIL=hello@scent-atoll.test CONTACT_WECHAT=ScentAtoll BUSINESS_NAME='Scent Atoll Studio Ltd' STUDIO_BOOKING='Unrendered booking marker' node scripts/check-public-build.mjs --strict # 预期失败，确认 strict 会拒绝已设置但没有渲染进发布包的运营信息
npm run launch:check
git diff --check
node --check tests/public-build.test.mjs
node --test tests/public-build.test.mjs # 当前 2 passed，覆盖 strict public check 对真实运营信息实际渲染的正反路径，以及 checkout 文件进入 public build 时必须失败
npm test
for file in tests/*.test.mjs; do node --check "$file"; done # 与 CI 测试文件语法通配检查一致
node --check scripts/check-live.mjs
SITE_URL=https://www.scent-atoll.test/shop.html CONTACT_EMAIL=hello@scent-atoll.test CONTACT_WECHAT=ScentAtoll BUSINESS_NAME='Scent Atoll Studio Ltd' STUDIO_BOOKING='Wechat appointment' npm run check:live # 预期失败，确认线上检查仍先拒绝带路径的 SITE_URL
node --check tests/live-check.test.mjs
node --test tests/live-check.test.mjs # 当前 11 passed，覆盖 check:live 对线上真实运营信息展示、必填客服值、默认主体 / 预约方式 / 客服时间展示、非法客服邮箱、未知路径 404、自定义 OG_IMAGE 全站使用情况、OG/Twitter 分享图一致性的正反路径
npm test
git check-ignore -v --no-index .env.production 网页制作/.env.production 网页制作/dist/index.html 网页制作/dist-public/index.html 网页制作/src/assets/og-image.png 网页制作/server/data/db.json
npm run launch:preflight # 当前通过，依次执行 npm test、npm run build、npm run launch:check
```

严格门禁也已验证两种路径：

- 未设置真实运营信息时，`npm run launch:strict` 会失败，并列出缺失的 `SITE_URL`、`CONTACT_EMAIL`、`CONTACT_WECHAT`；`BUSINESS_NAME` 和 `STUDIO_BOOKING` 不设置时使用安全默认值。
- 使用 `.env.production.example` 中的中文占位形态，如 `SITE_URL=https://你的正式域名`、`CONTACT_EMAIL=你的客服邮箱`、`BUSINESS_NAME=你的经营主体名称`，`npm run launch:strict` 会失败。
- 本地临时 `.env.production` 能驱动 `npm run build` 和 `npm run launch:strict`，验证后已删除，当前工作区不存在 `.env.production`。
- 使用临时测试域名、客服、主体信息和站内默认分享图输出到 `/private/tmp/scent-atoll-strict-check` 时，`npm run launch:strict` 通过。
- 使用临时测试域名、客服、主体信息和自定义 JPG 分享图输出到 `/private/tmp/scent-atoll-strict-jpg` 时，`npm run launch:strict` 通过，`og:image:type` 输出为 `image/jpeg`。
- 使用临时测试域名输出到 `/private/tmp/scent-atoll-canonical-check` 时，首页、香水页、隐私页的 canonical 与 `og:url` 均精确匹配当前页面 URL。
- 使用临时测试域名输出到 `/private/tmp/scent-atoll-infer-check` 后，不再传 `SITE_URL` 运行 `npm run check:public` 也能通过，检查器会从首页 canonical 推断基准 URL。
- 非 strict 的 `npm run check:public` 也会校验已经显式传入的上线变量：带路径的 `SITE_URL`、非 `https://` 图片 `OG_IMAGE`、非法 `CONTACT_EMAIL` 都会失败；缺失真实运营信息仍保持 warning，方便本地开发包检查。
- Netlify / Vercel 的平台构建命令已改为 `npm run launch:strict`，部署平台缺少真实运营环境变量或仍使用占位值时会直接构建失败，不会发布带示例域名或占位联系方式的站点。
- 使用本地静态服务器和 Chrome DevTools 将主要公开页面逐页切到 375 x 812 移动视口后检查：14 个路径均有页面标题和正文内容，`documentElement.scrollWidth - innerWidth` 均为 0，未检测到 broken images；首页首屏截图显示品牌、CTA 和测试图片正常渲染。
- strict public check 现在会确认 `CONTACT_EMAIL`、`CONTACT_WECHAT`、默认或自定义 `BUSINESS_NAME`、默认或自定义 `STUDIO_BOOKING` 都已实际进入公开发布包；用故意不匹配的 `STUDIO_BOOKING` 复核时检查器按预期失败。

`npm test` 最新结果：48 tests，47 passed，1 skipped。跳过项为未设置 `DATABASE_URL` 时的 PostgreSQL smoke test，符合当前本地环境预期。

发布包扫描结果：

- `dist-public/` 包含公开页面、`404.html`、`robots.txt`、`sitemap.xml`、`og-image.png`、`_headers`、`_redirects`、`styles.css`、`script.js`、`data.js`。
- `dist-public/og-image.png` 是 1200 x 630 PNG，所有公开 HTML 的 `og:image` / `twitter:image` 默认指向 `/og-image.png`，`twitter:card` 为 `summary_large_image`。
- `dist-public/` 不包含 `admin.html`、`account.html`、`login.html`、`register.html`、`member.html`、`orders.html`、`points*.html`。
- `dist-public/` 不包含 `admin-client`、`auth-client`、`member-client`、`points-mall-client`。
- `dist-public/` 没有 `/api/checkout`、`/api/admin`、`/api/orders`、`dev-admin`、`x-admin`、旧结账文案。
- `dist-public/` 内公开 HTML 的本地 `href` / `src` 引用，以及 CSS 的本地 `url(...)` 引用均指向存在的文件。
- `dist-public/` 内公开 HTML 具备基础 SEO / 分享元标签，`404.html`、`cart.html` 和旧兼容详情入口 `product.html`、`brand.html`、`article.html` 具备 `noindex`，并已纳入 `check:public` / `check:live` 门禁。
- `sitemap.xml` 包含公开主路径，并从当前 `data.js` 生成 8 个商品、6 个品牌、3 篇文章静态详情 URL；不包含后台、会员、订单、积分等私有开发页，也不包含 `?id=` 查询参数详情页。
- `product-{id}.html`、`brand-{id}.html`、`article-{id}.html` 的 canonical 与 `og:url` 指向自身静态 URL；旧兼容入口 `product.html`、`brand.html`、`article.html` 已设为 `noindex,nofollow`。
- `_headers` 包含基础安全响应头规则，`cart.html` 和 `404.html` 含 `X-Robots-Tag: noindex, nofollow`，`_redirects` 包含私有开发路径和未知路径的 404 规则；Vercel 根目录和子目录配置中的 `cart.html`、`404.html` 规则也单独包含完整安全响应头和 `X-Robots-Tag`。

## 剩余阻塞

本次续跑确认：

- `npm run check:git-release` 仍按预期失败，完整列出尚未被 Git 跟踪或仍有未提交改动的上线关键文件；这证明当前还不能从 GitHub 触发正式部署。
- `git status --short --untracked-files=all` 显示根目录发布配置、CI、Node 版本文件、上线脚本、测试、SEO / 合规页面、上线计划文档以及 `dist/` 从 Git 索引移除的变更仍未完成提交。
- `git diff --check -- :/` 当前通过，没有补丁空白问题。
- `npm run launch:status` 当前仍只剩 `Launch environment` 和 `Git release handoff` 两类阻塞；`Deployment config` 与 `Patch whitespace` 通过。
- `plan/soft-launch-showcase-plan.md` 和 `plan/README.md` 已再次明确：真实图片和商品资料属于店主侧运营内容准备，不阻塞本轮工程、部署、SEO 和合规收口。
- `网页制作/assets/js/admin-client.js` 和 `网页制作/assets/js/public-app.js` 是项目根目录旧静态副本，页面实际加载 `script.js`，public-only 构建实际使用 `src/assets/js/public-app.js`；已把这两个旧副本加入 `网页制作/.gitignore`，正式源码 `src/assets/js/admin-client.js` 和 `src/assets/js/public-app.js` 仍必须提交。
- `plan/launch-runbook.md` 已补充安全 staging 建议，明确只纳入上线关键源文件、脚本、测试、配置和计划文档，同时保持 `.env.production`、`dist-public/`、`src/assets/og-image.png` 和本地数据库文件不进入 Git。
- 已用 `git add -n` 预演 runbook 的 staging 范围，确认会纳入根目录发布配置、项目配置、上线脚本、server 源码、测试、`src/` 和 `plan/`，不会纳入已忽略的旧根目录 `assets/js/admin-client.js` / `assets/js/public-app.js`。预演也发现 `git add -u -- 网页制作/dist` 在当前索引状态下会报 pathspec，因此 runbook 已改为更稳的 `git rm --cached -r --ignore-unmatch 网页制作/dist`；当前 `dist/` 已经不在 Git 索引里。
- `plan/launch-env-intake.md` 已补充直接回复模板，店主只需提供 `SITE_URL`、`CONTACT_EMAIL`、`CONTACT_WECHAT` 即可继续严格上线检查；`BUSINESS_NAME`、`STUDIO_BOOKING`、`CUSTOMER_HOURS` 和 `OG_IMAGE` 保持可选。
- 最新轻量回归已执行：`npm run launch:check` 通过，`git diff --check -- :/` 通过；`npm test` 在默认沙箱中因本地服务器无法监听 `127.0.0.1` 被系统拦截，使用提升权限重跑后通过，结果为 48 tests，47 passed，1 skipped。跳过项是未设置 `DATABASE_URL` 时的 PostgreSQL smoke test。
- 最新生成物保护复核已执行：`git check-ignore --no-index` 确认 `网页制作/dist-public/index.html`、`网页制作/src/assets/og-image.png`、`网页制作/.env.production`、`网页制作/server/data/db.json`、旧根目录 `assets/js/admin-client.js` 和 `assets/js/public-app.js` 均被忽略；当前本地不存在真实 `网页制作/.env.production` 文件。
- 最新部署来源复核已执行：`package.json` 的上线脚本通过 Eleventy / public build 从 `src/` 生成 `dist-public/`，`.eleventy.js` 的 input 为 `src`；`plan/launch-runbook.md` 已明确 `网页制作/` 根目录旧静态 HTML、`script.js`、`styles.css`、`data.js` 不作为正式部署来源。
- 最新 Git 索引复核已执行：`git ls-files` 对 `.env.production`、`.env*.local`、`网页制作/dist-public`、`网页制作/src/assets/og-image.png`、`网页制作/server/data/db.json` 无输出；`git ls-files --stage -- 网页制作/dist | wc -l` 当前为 0，确认 forbidden 生成物和本地数据没有被 Git 跟踪。
- 最新 Git 发布门禁补强已执行：`scripts/check-git-release.mjs` 现在也会拒绝被强行追踪的旧根目录 `网页制作/assets/js/admin-client.js` 和 `网页制作/assets/js/public-app.js`；`tests/check-git-release.test.mjs` 已覆盖该负向路径。`node --check scripts/check-git-release.mjs`、`node --check tests/check-git-release.test.mjs`、`node --test tests/check-git-release.test.mjs` 和 `npm run check:deploy` 均通过。
- 最新计划文件夹交接门禁已执行：`scripts/check-git-release.mjs` 的必跟踪清单现在覆盖 `plan/README.md` 中仍保留的全部计划文档，包括 `membership-system-plan.md`、`points-mall-plan.md`、`postgres-migration-plan.md` 和 `production-platform-roadmap.md`；release status pathspec 也扩展为整个 `网页制作/plan`，旧方案删除和保留计划更新都会阻止正式 Git 发布交接。`node --check scripts/check-git-release.mjs` 和 `node --test tests/check-git-release.test.mjs` 通过；`npm run check:git-release` 当前按预期失败，并列出未提交 / 未跟踪的计划文件夹改动。
- 最新发布文档同步已执行：`plan/launch-readiness-checklist.md`、`plan/launch-runbook.md` 和项目 `README.md` 已明确 `网页制作/plan/` 下仍保留的全部计划文档都属于发布交接范围，不只包含 `launch-*.md`。`npm run check:deploy` 通过，`git diff --check -- :/` 通过，`npm run launch:status` 当前仍只剩真实运营变量和 Git 发布交接两类阻塞。
- 最新全量回归已执行：`npm test` 通过，结果为 48 tests，47 passed，1 skipped；跳过项仍是未设置 `DATABASE_URL` 时的 PostgreSQL smoke test。`npm run launch:check` 通过，并继续只在非 strict 模式输出示例域名、示例邮箱和“上线前填写”占位 warning；`git diff --check -- :/` 通过。
- 最新计划索引一致性测试已执行：`tests/check-git-release.test.mjs` 会解析 `plan/README.md` 当前计划表，并确认每个仍保留的计划文件都在 `scripts/check-git-release.mjs` 的必跟踪清单里；`node --test tests/check-git-release.test.mjs` 当前 4 passed。`npm run check:deploy` 通过，`npm run launch:status` 当前仍只剩真实运营变量和 Git 发布交接两类阻塞。
- 最新严格门禁回归已执行：使用临时测试运营信息和 `PUBLIC_OUTPUT_DIR=/tmp/scent-atoll-final-strict` 运行 `npm run launch:strict` 通过，确认 `check:env`、public-only 构建、strict public check 和 `check:deploy` 的完整严格链路仍可用。真实上线仍必须替换为正式 `SITE_URL`、客服邮箱和客服微信；经营主体和预约方式仅在需要覆盖默认值时填写。
- 最新交接清单已补充：`plan/README.md` 增加“当前阻塞”表，明确真实运营变量由店主提供并通过 `check:env` / `launch:strict` 验证，Git 发布交接由开发 / 部署负责人完成并通过 `check:git-release`、`git diff --check -- :/` 和 `launch:ready` 验证。
- 最新 README 交接入口已补充：仓库根目录 `README.md` 和项目子目录 `网页制作/README.md` 都已直接指向 `plan/README.md` 的“当前阻塞”表，避免部署人员只看 README 时漏掉真实运营变量和 Git 发布交接两个剩余事项。
- 最新组合预检已执行：`npm run launch:preflight` 通过，完整串起 `npm test`、普通构建和 `npm run launch:check`。其中最新单独 `npm test` 结果为 48 tests，47 passed，1 skipped；非 strict public check 继续只输出示例域名、示例邮箱和“上线前填写”占位 warning，等待真实运营变量后由 `launch:strict` 强制拦截。
- 最新 Git 发布交接预备已执行：已按 `launch-runbook.md` 建议范围 stage 上线关键文件、源码、脚本、测试、部署配置、计划文档和 `网页制作/dist/` 停止追踪的索引删除；未 stage `.env.production`、`dist-public/`、`src/assets/og-image.png`、本地数据库或旧根目录 JS 副本。`npm run check:git-release` 当前已从“必需文件未跟踪”收敛为“release-critical paths have uncommitted changes”，下一步需要 commit 并 push。
- 最新运营变量门禁收口已执行：`BUSINESS_NAME` 改为可选覆盖项，不设置时使用已确认店名 `馥屿 Scent Atoll`；`STUDIO_BOOKING` 也改为可选覆盖项，不设置时使用 `通过客服微信预约`；`SITE_URL`、`CONTACT_EMAIL` 和 `CONTACT_WECHAT` 仍为严格必填。相关回归 `node --test tests/launch-env.test.mjs tests/site-data.test.mjs tests/public-build.test.mjs tests/launch-status.test.mjs` 通过，结果为 15 passed；`node --test tests/live-check.test.mjs tests/public-build.test.mjs` 通过，覆盖默认值线上验收和 public strict 验收；`npm run check:env` 当前按预期只缺 3 个必填项。

把以下值填到部署平台环境变量后，再运行严格检查：

建议先在 `plan/launch-env-intake.md` 填完并确认这些值。

```bash
SITE_URL=https://你的正式域名
CONTACT_EMAIL=你的客服邮箱
CONTACT_WECHAT=你的客服微信
npm run launch:strict
```

`BUSINESS_NAME` 可选，不设置时使用 `馥屿 Scent Atoll`。`STUDIO_BOOKING` 可选，不设置时使用 `通过客服微信预约`。`OG_IMAGE` 可选。不设置时会使用站内 `og-image.png`；如果设置，必须是正式 `https://` 图片 URL。

最终完成条件是：填入真实域名、客服邮箱和客服微信，`npm run check:env` 和 `npm run launch:strict` 通过，发布 `dist-public/` 到正式域名后 `npm run check:live` 通过。商品资料与图片仍按用户计划最后替换。
