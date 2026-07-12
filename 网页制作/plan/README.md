# 馥屿商业上线文档索引

## 当前主线

主生产目标已经从 public-only 展示站切换为 **Vercel 完整商业应用**。Vercel 发布 `dist/` 与 `/api/*`；Netlify 的 `dist-public/` 仅作为暂停动态功能时的应急只读降级包。

| 文件 | 说明 | 状态 |
|---|---|---|
| `project-log.md` | 按日期记录阶段成果、验证证据、风险和下一步 | 当前日志 |
| `launch-env-intake.md` | Production / Preview / GitHub Environment 变量收集与隔离规则 | 当前执行 |
| `launch-readiness-checklist.md` | 商业上线前工程、数据、平台、合规与演练门禁 | 当前执行 |
| `launch-runbook.md` | migration、production candidate、验证、promote、回滚与静态降级步骤 | 当前执行 |
| `launch-completion-audit.md` | 旧展示版工程审计记录 | 历史参考，不能作为当前部署边界 |
| `production-platform-roadmap.md` | 商业平台后端、交易、安全和运维路线 | 当前主线 |
| `postgres-migration-plan.md` | PostgreSQL schema、repository、事务与迁移约束 | 进行中 |
| `membership-system-plan.md` | 会员、等级、积分与订单结算规则 | 规则文档 |
| `points-mall-plan.md` | 积分商城、FIFO、取消与返还规则 | 规则文档 |
| `soft-launch-showcase-plan.md` | 早期静态展示版方案 | 历史参考，仅对应应急降级包 |

## 当前发布顺序

1. 补齐 Production 和 Preview 的独立 Neon、Resend、Blob、Upstash、客服与密钥，并用资源 ID/endpoint 确认环境完全隔离。
2. 完成生产代码与数据库测试，在 PR Preview 上先迁移对应 Neon branch 并跑完整业务验收。
3. `main` CI 通过后，确认 Vercel Git 自动 Production 被 `ignoreCommand` 跳过，再由受保护的 GitHub `production` Environment 审批正式工作流。
4. 工作流只读审计 GitHub/Vercel 外部设置，随后执行资源隔离、production migration、Vercel 云端 candidate、页面/API/权限边界验证、promote 和正式域名复验。
5. 做真实订单到退款演练、备份恢复演练与告警触发验证后，再开放推广。

## 当前外部阻塞

| 阻塞 | 负责人 | 完成条件 |
|---|---|---|
| 客服与经营资料 | 店主 | `CONTACT_EMAIL`、`CONTACT_WECHAT`、真实经营主体与政策页面为真实值 |
| 托管服务隔离 | 部署负责人 | 在 Vercel 详情页人工核对 ID/endpoint；Production / Preview 使用不同 Neon branch、Blob Store、Upstash endpoint 与 Resend resource |
| 生产审批 | 仓库管理员 | GitHub `production` Environment 有 reviewer/仅 main，main 有 PR review、`Scent Atoll CI / build-and-test` 和 admin 保护，release secrets/variables 齐全 |
| Vercel 商业配置 | 部署负责人 | Node 固定 22.x，并从 Hobby 升级为适合商业用途的套餐 |
| 数据合规 | 经营负责人 | 明确境外基础设施的数据跨境合规结论，或切换到境内基础设施 |
| 微信支付 | 商户负责人 | 商户号、AppID 与证书齐全后才启用第二阶段真实支付 |

生产不得使用 JSON fallback、默认管理员或开发 seed。真实密钥、`.env.*.local`、`dist/`、`dist-public/` 和本地数据库不得提交 Git。

最新工程进度和验证结果见 `project-log.md`。发布判断仍以 `launch-readiness-checklist.md` 为准。
