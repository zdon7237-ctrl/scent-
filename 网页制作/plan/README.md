# 计划文档索引

这个文件夹集中保存项目计划、修复计划和阶段性方案。

## 当前主要计划

| 文件 | 说明 | 状态 |
|---|---|---|
| `production-platform-roadmap.md` | 从本地开发版改造成真实线上平台的阶段路线图 | 新增，建议作为后续主线 |
| `membership-system-plan.md` | 会员系统规则、实现状态、验收记录和后续计划 | 第一版已实现，后续还有生产化工作 |
| `points-mall-plan.md` | 积分商城落地计划，包含无兑换限制、FIFO、后台和验收方案 | 第一版开发功能已实现 |
| `frontend-goal-plan.md` | 前端整体 goal 制作计划，覆盖 impeccable 设计系统、审计、改版、制作和验收 | 已执行一轮 |
| `frontend-critique-report.md` | 前端现状审计报告，记录 P1/P2 问题和修复方向 | 已完成 |
| `frontend-redesign-brief.md` | 前端整体改版 brief，记录页面职责、设计方向和实现顺序 | 已完成 |
| `frontend-verification-report.md` | 前端构建、浏览器、移动端和购物车交互验收记录 | 已完成 |
| `repair-plan-checkout-layout.md` | 早期网页结构和购物车修复计划 | 已执行主要修复 |
| `niche-perfume-website-plan.md` | 香水网站早期整体规划 | 历史参考 |
| `niche-perfume-multipage-design-plan.md` | 多页面设计规划 | 历史参考 |

## 当前重点

会员系统、积分商城和核心后端测试已进入开发版可运行状态。后续主线应按 `production-platform-roadmap.md` 从本地开发版改造成真实线上平台。

后续生产化重点仍包括：

1. 接正式数据库。
2. 做正式后台登录和权限。
3. 接真实支付。
4. 完整订单履约、发货、物流和退款流程。
5. 部署、监控、备份和真实运营内容。
