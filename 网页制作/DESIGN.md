---
name: 馥屿 Scent Atoll
description: 面向国内用户的小众香水买手店，结合编辑式选品、试香服务和清晰购买路径。
colors:
  ink: "#1d211f"
  muted: "#666b67"
  paper: "#fbfaf6"
  chalk: "#f0eee8"
  moss: "#1f3b34"
  moss-soft: "#dce5dd"
  wine: "#763342"
  clay: "#a46a4b"
  gold: "#b48b48"
  line: "#ded9cf"
  surface: "#ffffff"
  focus: "#8ca89d"
  danger: "#9b3d32"
  success: "#2f6b4f"
typography:
  display:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: "76px"
    fontWeight: 500
    lineHeight: 1.06
    letterSpacing: "0"
  headline:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: "46px"
    fontWeight: 500
    lineHeight: 1.06
    letterSpacing: "0"
  title:
    fontFamily: "Inter, Noto Sans SC, PingFang SC, Microsoft YaHei, Arial, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.24
    letterSpacing: "0"
  body:
    fontFamily: "Inter, Noto Sans SC, PingFang SC, Microsoft YaHei, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  label:
    fontFamily: "Inter, Noto Sans SC, PingFang SC, Microsoft YaHei, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    lineHeight: 1.55
    letterSpacing: "0"
rounded:
  md: "8px"
  pill: "999px"
  circle: "50%"
spacing:
  chip-gap: "7px"
  sm: "12px"
  md: "18px"
  lg: "34px"
  section-y: "86px"
  section-x: "70px"
components:
  button-primary:
    backgroundColor: "{colors.moss}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "18px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "9px 11px"
    height: "42px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "7px 12px"
  status-badge:
    backgroundColor: "{colors.moss-soft}"
    textColor: "{colors.moss}"
    rounded: "{rounded.pill}"
    padding: "5px 10px"
---

# Design System: 馥屿 Scent Atoll

## 1. Overview

**Creative North Star: "安静的买手香水柜"**

当前视觉系统已经建立了小众香水买手店的基础气质：暖纸色背景、苔绿主色、金色小面积强调、Georgia 衬线标题与中文无衬线正文。整体应该像一个安静、有判断力的香水柜台，先给用户审美和信任，再把他们带向试香、筛选和购买。

这个系统的默认 register 是 `brand`。首页、品牌、Journal、关于我们可以保留更多氛围和编辑感；商品列表、商品详情、购物车、会员、积分和账户页面必须按 `product` 思路保持清楚、稳定、少干扰。

**Key Characteristics:**

- 暖色纸面背景承接大面积内容，避免纯白电商货架感。
- 苔绿负责主要行动和品牌稳定感，金色只做小面积编辑提示。
- 衬线大标题建立气质，中文正文和操作控件使用清晰无衬线。
- 卡片和表单统一使用 8px 圆角、细边框和低干扰表面。
- 图片承担香水、品牌和场景表达，装饰性图形应保持克制。

## 2. Colors

当前调色板是暖中性色加深苔绿的克制品牌系统，适合“安静、专业、有编辑感”的小众香水买手店。

### Primary

- **深苔绿** (`#1f3b34`): 主按钮、购物车数量、已选筛选项和关键行动。使用面积应受控，避免把整站变成绿色主题。
- **柔苔绿** (`#dce5dd`): 香调标签、轻量提示和低风险辅助状态。适合承载“可探索、可试香”的轻提示。

### Secondary

- **陈酒红** (`#763342`): 当前 token 已存在，适合后续用于少量情绪化编辑内容、节日专题或高风险提示。不要在普通按钮中滥用。
- **陶土棕** (`#a46a4b`): 当前 token 已存在，适合用于香材、季节、木质或琥珀主题内容。保持辅助角色。
- **旧金色** (`#b48b48`): Eyebrow、小面积链接下划线和品牌强调。它是编辑标记，不是大面积填充色。

### Neutral

- **墨黑绿** (`#1d211f`): 正文主色、深色公告栏和页脚背景。它比纯黑更适合香水品牌气质。
- **雾灰绿** (`#666b67`): 次级正文、说明文字、表单标签和商品元信息。
- **暖纸色** (`#fbfaf6`): 页面主背景，让品牌页和商品页都带有轻微纸张感。
- **粉笔灰** (`#f0eee8`): 分段背景，用于首页和列表的 alternate section。
- **亚麻线色** (`#ded9cf`): 边框、分隔线、输入框和卡片轮廓。
- **卡片白** (`#ffffff`): 当前卡片、输入框和搜索框表面。后续新设计应优先使用暖纸色或轻微 tinted surface，避免扩大纯白面积。
- **焦点苔绿** (`#8ca89d`): 键盘焦点轮廓和可访问状态。
- **错误砖红** (`#9b3d32`): 表单错误和失败消息。
- **成功深绿** (`#2f6b4f`): 表单成功和正向状态消息。

### Named Rules

**苔绿行动规则。** 深苔绿只用于主行动、已选状态和关键反馈。不要把它当作普通装饰色。

**金色标记规则。** 金色用于编辑式小标签和少量链接强调。不要使用大面积金色块、金色渐变或奢侈品式金黑组合。

**暖纸底规则。** 页面大面积背景优先使用暖纸色或粉笔灰。商品卡片可以是白色，但整页不应退化成普通白底电商。

## 3. Typography

**Display Font:** Georgia, Times New Roman, serif  
**Body Font:** Inter, Noto Sans SC, PingFang SC, Microsoft YaHei, Arial, sans-serif  
**Label Font:** Inter, Noto Sans SC, PingFang SC, Microsoft YaHei, Arial, sans-serif

**Character:** 标题用衬线字体建立编辑气质和精品店感，正文与 UI 控件用无衬线保证中文阅读和购买操作清晰。字号层级应服务“先理解，再行动”，不要为了高级感牺牲可读性。

### Hierarchy

- **Display** (500, 76px desktop / 34px mobile, line-height 1.06): 首页 Hero 和少数品牌主视觉标题。
- **Headline** (500, 46px desktop / 30px mobile, line-height 1.06): 分区标题、页面主标题和重要内容模块标题。
- **Product Headline** (500, 58px desktop / 34px mobile): 商品详情、文章详情和 split hero 的重点标题。
- **Title** (700, 21px, line-height 1.24): 卡片标题、商品名称、文章标题和模块内标题。
- **Body** (400, 16px, line-height 1.55): 正文、说明、买手描述和页面内容。长文内容保持 65-75ch 左右的行长。
- **Large Body** (400, 18-19px): Hero 支撑文案、文章详情段落和需要更强阅读感的说明。
- **Label** (800, 12-14px): Eyebrow、字段标签、元信息和筛选组标题。大写英文只用于小面积编辑标记。

### Named Rules

**中文优先规则。** 中文正文不得过小、过灰或行距过紧。移动端正文优先保证可读，不要用细字重制造“高级感”。

**标题克制规则。** 衬线标题只给品牌表达和内容层级使用。按钮、表单、导航、会员和积分页面不要使用显示型衬线字体。

## 4. Elevation

当前系统主要通过色块、边框和图片层级表达结构，阴影只用于浮层和临时反馈。常规卡片、筛选面板和表单使用 1px 边框，不依赖投影。

### Shadow Vocabulary

- **Overlay Shadow** (`0 18px 48px rgba(29, 33, 31, 0.14)`): 购物车抽屉、toast 或浮层反馈。不要用于普通商品卡片网格。

### Named Rules

**边框优先规则。** 常规内容表面使用 `#ded9cf` 细边框和暖色背景分层。阴影只在浮层、抽屉和状态反馈中出现。

**无玻璃规则。** 当前系统没有玻璃拟态。不要新增装饰性 blur、半透明玻璃卡片或复杂发光效果。

## 5. Components

### Buttons

- **Shape:** 8px 圆角，最小高度 44px，默认内边距 `11px 18px`，文字 800 字重。
- **Primary:** 深苔绿背景、白色文字。用于探索香水、查看试香、加入购物车、提交等主要行动。
- **Primary Hover / Focus:** 当前使用更深苔绿 `#152924`。后续必须补足清晰 focus-visible 轮廓。
- **Secondary:** 白色背景、亚麻线边框、墨黑绿文字。用于次要行动和替代路径。
- **Light Secondary:** 透明背景、白色边框和白字，仅用于深色 Hero 背景。
- **Disabled:** 透明度降至 0.55，cursor 为 not-allowed。

### Navigation

- **Top Notice:** 深色公告栏，三列桌面布局，移动端横向滚动。内容应只放关键服务信息，不放连续促销。
- **Header:** Sticky 顶部导航，高度 80px，暖纸色半透明背景和 18px blur。桌面为品牌、主导航、搜索与购物车三栏。
- **Brand Lockup:** 圆形 `SA` 标记加中英文品牌名。标记使用 1px 墨黑绿边框。
- **Primary Nav:** 14px 灰绿文字，active 和 hover 使用墨黑绿文字加金色下划线。
- **Mobile Nav:** 880px 以下显示菜单按钮，导航展开后进入 header 第二行。移动端搜索和购物车保持可见。

### Cards / Containers

- **Corner Style:** 8px 圆角。
- **Background:** 常规卡片为白色，页面背景为暖纸色，分段背景为粉笔灰。
- **Border:** 1px `#ded9cf`，用于商品卡、品牌卡、文章卡、试香卡、信息卡、表单和面板。
- **Internal Padding:** 常规卡片内容 18px，信息面板和会员卡片 22px，编辑图片卡 24px。
- **Media:** 商品、品牌、文章和试香卡片使用 `background-image` 媒体区，常规高度 280px，紧凑卡片 230px，移动端 230px。
- **Avoid:** 不要无限复制相同图标加标题加正文的卡片网格。品牌页面和首页需要通过图片比例、文案密度和模块节奏制造差异。

### Inputs / Fields

- **Style:** 42px 最小高度，8px 圆角，白色背景，亚麻线边框，`9px 11px` 内边距。
- **Search:** 顶部搜索框宽 260px，包含“搜索”标签和输入框。移动端宽度占满可用空间。
- **Labels:** 字段标签使用 13px、800 字重、灰绿文字，竖向 8px 间距。
- **Focus:** 全局 `focus-visible` 使用焦点苔绿 3px outline，offset 3px。
- **Error / Disabled:** 表单消息使用错误砖红或成功深绿；禁用按钮透明度降至 0.55。

### Chips

- **Unselected:** 白色背景、亚麻线边框、灰绿文字，pill 圆角，`7px 12px` 内边距。
- **Selected:** 深苔绿背景、深苔绿边框、白色文字。
- **Tag Chips:** 香调标签使用柔苔绿背景和深苔绿文字，`5px 9px` 内边距。
- **Rule:** Chips 主要用于筛选和香调，不要变成装饰标签堆叠。

### Product Surfaces

- **Product Grid:** 默认 3 列，compact grid 为 4 列，1180px 以下 2 列，620px 以下 1 列。
- **Shop Layout:** 桌面为 290px sticky 筛选栏加结果区，880px 以下变为单列。
- **Product Detail:** 桌面为大图加购买信息双栏，移动端购买信息前置。
- **Purchase Panels:** 价格、容量、库存和配送等信息使用边框面板，不使用复杂装饰。

### Cart / Feedback

- **Cart Drawer:** 固定全屏遮罩，右侧 440px 面板，暖纸色背景，overlay shadow。打开动效为 220ms 横向位移。
- **Cart Rows:** 68px x 78px 图片、商品信息、数量控制三列布局。
- **Toast:** 底部居中，墨黑绿背景，白字，overlay shadow，180ms 位移和透明度过渡。
- **Motion Rule:** 动效只表达状态变化，不做页面加载编排。遵守 `prefers-reduced-motion`。

### Status / Forms

- **Status Badge:** 柔苔绿背景、深苔绿文字、pill 圆角，用于订单状态、兑换状态和低干扰状态标记。
- **Form Message:** 14px 文本，默认雾灰绿；错误用错误砖红，成功用成功深绿。登录、注册和后续表单应优先使用内联消息，不只依赖 toast。
- **Purchase Guidance:** 粉笔灰背景、亚麻线边框、8px 圆角，用于商品详情中贴近购买 CTA 的适合场景与盲买提醒。

## 6. Do's and Don'ts

### Do

- 用首页、品牌页和 Journal 建立安静、专业、有编辑感的买手店气质。
- 在商品列表、商品详情、购物车、会员和积分页面优先保证任务效率。
- 保持暖纸色背景、苔绿行动色、金色编辑标记的清晰分工。
- 用具体香调、场景、试香和买手点评降低选择成本。
- 保持中文移动端字号、行距、点击区域和表单状态清楚。
- 保留真实香水、品牌、香材或陈列图片作为主要视觉资产。

### Don't

- 不要做廉价促销首页、淘宝式货架页、网红种草页或冷硬奢侈品官网。
- 不要使用渐变文字、玻璃拟态、发光装饰、侧边粗色条或 hero-metric 模板。
- 不要让相同卡片网格连续主导多个页面。
- 不要把金色扩大成奢侈品风格，也不要把深苔绿当作任意装饰色。
- 不要在任务页面使用过大的衬线标题、复杂动效或装饰性布局。
- 不要只用颜色表达状态；必须补充文字、图标、边框或可访问属性。
