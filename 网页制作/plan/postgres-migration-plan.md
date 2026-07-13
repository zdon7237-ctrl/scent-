# PostgreSQL 迁移计划

更新日期：2026-07-10

## 目标

项目实际目录是 `网页制作/`。本阶段先建立 PostgreSQL 的 schema、migration、seed、repository 入口和测试保护，不一口气重写全部 API。

## 当前状态

- 未设置 `DATABASE_URL` 时，本地开发和默认单元测试仍可使用 JSON；Production / Preview 部署必须设置 PostgreSQL，生产不得 fallback。
- 设置 `DATABASE_URL` 后，主业务 API 通过 repository 读写 PostgreSQL。
- 设置 `DATABASE_URL` 后可运行 PostgreSQL migration 和 seed。
- 已新增 `server/src/db.mjs`、`server/src/migrate.mjs`、`server/src/seed.mjs`、`server/src/repository.mjs`。
- 已新增 `scripts/migrate.mjs` 和 `scripts/seed.mjs`。
- package scripts 已新增 `db:migrate` 和 `db:seed`。

## 命令

```bash
cd 网页制作
npm run db:migrate
npm run db:seed
```

本地测试库示例：

```bash
createdb scent_archive_test
DATABASE_URL=postgres://localhost:5432/scent_archive_test npm run db:migrate
DATABASE_URL=postgres://localhost:5432/scent_archive_test npm run db:seed
```

## 第一版 Schema

已覆盖当前 JSON 数据结构：

```text
users
sessions
admin_users
admin_sessions
operation_logs
member_profiles
member_tiers
tier_history
orders
order_items
point_transactions
points_mall_items
points_redemption_orders
points_redemption_items
coupons
coupon_redemptions
```

已预留真实结账和支付基础：

```text
products
product_variants
product_images
inventory_items
inventory_movements
stock_reservations
addresses
order_addresses
payments
payment_events
refunds
refund_events
idempotency_keys
schema_migrations
```

规则：

- 金额字段使用整数分，命名为 `*_amount`。
- 积分字段使用整数。
- 主表有 `id`、`created_at`，可变主表有 `updated_at`。
- `order_items` 保存商品快照字段和 `product_snapshot`。
- `payments` 金额字段为 `payment_amount`。
- `refunds` 金额字段为 `refund_amount`。
- `payment_events` 使用 `(provider, provider_event_id)` 唯一约束。
- `idempotency_keys` 使用 `(scope, key)` 唯一约束。
- `point_transactions.source_transaction_id` 保留 FIFO 溯源能力。

## Seed 数据

seed 可重复执行，内容包括：

- 默认会员等级。
- 默认积分商城商品。
- 本地 seed 管理员。
- 最小商品数据，包含 `vespree`。

生产环境不能运行 seed，也不能设置 `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`。初始 owner 使用一次性 bootstrap 流程创建；seed 仅用于本地或可丢弃的测试数据库。

## 发布迁移规则

- Vercel build command 不执行 migration 或 seed。
- Preview 先对对应 Neon branch 运行 `ALLOW_RELEASE_MIGRATION=preview node scripts/release-migrate.mjs`，再部署并验证 Preview。
- Production 由受保护 GitHub workflow 运行 `ALLOW_RELEASE_MIGRATION=production node scripts/release-migrate.mjs`，然后部署 production-target candidate；候选检查通过后才 promote。
- migration 必须向后兼容上一应用版本。应用 rollback 不自动回滚 schema；破坏性变更使用 expand/migrate/contract 多次发布。
- 每次生产 migration 前确认 Neon 备份/时间点恢复可用，并记录 migration ID。

## Repository 切换状态

已建立 repository 入口：

- JSON repository：保留现有 JSON fallback。
- PostgreSQL repository：提供基础 query、transaction 和 smoke 查询能力。

当前已切到 repository 的 API：

```text
全部现有 Node API 都通过 app.mjs 的 readDb/writeDb 接入 createRepository({ dataFile })。
未设置 DATABASE_URL 时落 JSON；设置 DATABASE_URL 时落 PostgreSQL。
```

仍待切换的 API：

```text
无按路由单独切换的待办；下一步待办是把 repository 的整库读写升级为更细粒度 SQL、事务和并发锁。
```

## 上线前必须事务化

- 订单创建。
- 支付确认。
- 确认收货。
- 退款。
- 积分兑换。
- 取消兑换。
- 库存预留和释放。

这些流程切 PostgreSQL 时必须使用 transaction，不能拆成多个无保护写入。
