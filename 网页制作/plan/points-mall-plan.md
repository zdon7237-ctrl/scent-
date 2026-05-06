# 积分商城落地计划

更新日期：2026-05-05

## 当前状态

第一版开发功能已实现，并通过本地临时数据库接口验收。

已经实现的闭环：

```text
会员登录 -> 进入积分商城 -> 选择积分商品 -> 使用积分兑换 -> FIFO 扣积分 -> 扣库存 -> 生成兑换订单 -> 后台处理 / 取消
```

当前仍是开发版：

- 数据库仍使用本地 JSON。
- 后台仍使用开发密钥。
- 物流仍是后台手动填写状态和单号。

## 目标

为「气味档案 Scent Archive」增加积分商城，让会员可以使用积分兑换指定商品。

积分商城主要用于：

- 消化难卖商品。
- 发放官方赠送小样。
- 提升会员积分使用率。
- 引导用户尝试更多香水，带动后续正装购买。

当前规则明确：

```text
积分不能抵现金。
积分只能兑换积分商城内指定商品。
积分商城上架什么商品由后台手动决定。
不设置兑换次数限制。
```

## 第一版范围与实现状态

第一版已完成可运行的兑换闭环：

```text
会员登录 -> 进入积分商城 -> 选择积分商品 -> 使用积分兑换 -> 扣积分 -> 扣库存 -> 后台处理兑换订单
```

第一版已明确不做：

- 积分加钱购
- 自动推荐商品
- 复杂促销
- 多仓库存
- 自动物流接口
- 兑换次数限制
- 积分抵扣现金

## 商品策略

### 可上架商品类型

| 类型 | 适合商品 | 目的 |
|---|---|---|
| 官方小样 | 品牌送的 1.5ml / 2ml 小样 | 低成本提升会员活跃 |
| 试香套装 | 茶香、木质、新客发现等小套装 | 引导用户试香后购买正装 |
| 难卖商品 | 滞销正装、旧批次、库存压力商品 | 清理库存 |
| 赠品组合 | 小样 + 香卡 + 试香纸 | 控制成本并提升体验 |

### 首批测试商品建议

先上少量商品验证流程，不要一开始放太多。当前默认测试商品是前 5 个，`starter-sample` 作为第二批可选项。

| 商品 | 商品来源 | 建议积分 | 建议库存 | 说明 |
|---|---|---:|---:|---|
| 官方随机小样 1 支 | 新建积分商品 | 300 | 50 | 最低门槛，测试兑换意愿 |
| 官方随机小样 3 支 | 新建积分商品 | 800 | 30 | 提高积分消耗 |
| 茶香官方小样组合 | 新建积分商品 | 600 | 30 | 适合茶香用户 |
| `tea-sample` 茶香主题试香套装 | 现有商品 | 1600 | 10 | 当前已有商品，可作为测试 |
| `wood-sample` 木质与焚香试香套装 | 现有商品 | 1800 | 10 | 当前已有商品，可作为测试 |
| `starter-sample` 新客发现试香套装 | 现有商品 | 2200 | 10 | 第二批可选，适合新会员兑换 |

注意：虽然没有兑换次数限制，仍然需要库存限制。库存为 0 后自动不可兑换。

## 兑换规则

### 基础规则

```text
用户必须登录。
用户必须有足够可用积分。
商品必须处于上架状态。
商品库存必须大于 0。
兑换成功后立刻扣积分。
兑换成功后立刻扣库存。
兑换订单由后台处理发货。
```

### 无兑换次数限制

第一版不限制：

- 每人每天兑换次数
- 每人每月兑换次数
- 单个商品每人兑换次数
- 总兑换次数

只要用户积分足够、商品库存足够，就可以继续兑换。

风险控制方式改为：

- 控制上架库存。
- 控制兑换积分价格。
- 后台可随时下架商品。
- 后台可取消异常兑换并返还积分。

### FIFO 扣积分

积分商城扣积分必须使用 FIFO。

```text
优先扣除最早获得、最早过期的积分。
```

示例：

| 积分批次 | 可用积分 | 过期时间 |
|---|---:|---|
| A | 500 | 2026-06-01 |
| B | 800 | 2026-12-01 |

兑换需要 700 积分时：

```text
先扣 A 批 500
再扣 B 批 200
```

### 积分有效期

当前会员积分规则：

```text
订单积分确认收货后发放。
积分有效期为确认收货日起 1 年。
过期积分不可兑换。
```

积分商城兑换时，只能使用未过期积分。

## 兑换订单状态

第一版使用这些状态：

| 状态 | 含义 |
|---|---|
| `pending_fulfillment` | 待处理 |
| `processing` | 处理中 |
| `shipped` | 已发货 |
| `completed` | 已完成 |
| `cancelled` | 已取消 |

状态流：

```text
pending_fulfillment -> processing -> shipped -> completed
pending_fulfillment -> cancelled
processing -> cancelled
```

取消规则：

```text
后台取消兑换订单时，返还已扣积分，并恢复库存。
已完成订单原则上不取消。
```

## 已实现内容

### 前端页面

| 页面 | 状态 | 说明 |
|---|---|---|
| `points-mall.html` | 已实现 | 积分商城列表 |
| `points-item.html` | 已实现 | 积分商品详情和兑换 |
| `points-redemptions.html` | 已实现 | 用户兑换记录 |
| `admin.html` | 已实现 | 积分商品管理和兑换订单处理 |

### 后端能力

| 能力 | 状态 |
|---|---|
| 积分商品数据结构 | 已实现 |
| 首批测试商品 | 已实现，默认 5 个 |
| 前台积分商品列表 | 已实现 |
| 前台积分商品详情 | 已实现 |
| 会员兑换积分商品 | 已实现 |
| FIFO 扣积分 | 已实现 |
| 扣库存 | 已实现 |
| 无兑换次数限制 | 已实现 |
| requestId 防重复提交 | 已实现 |
| 用户兑换记录 | 已实现 |
| 后台积分商品新增 | 已实现 |
| 后台上架 / 下架 | 已实现 |
| 后台兑换订单查询 | 已实现 |
| 后台兑换订单状态修改 | 已实现 |
| 后台取消兑换 | 已实现 |
| 取消后返还积分 | 已实现 |
| 取消后恢复库存 | 已实现 |
| 操作日志 | 已实现 |

### 已实现接口

前台：

```http
GET  /api/points-mall/items
GET  /api/points-mall/items/:id
POST /api/points-mall/redeem
GET  /api/points-mall/redemptions
GET  /api/points-mall/redemptions/:id
```

后台：

```http
GET   /api/admin/points-mall/items
POST  /api/admin/points-mall/items
PATCH /api/admin/points-mall/items/:id
POST  /api/admin/points-mall/items/:id/activate
POST  /api/admin/points-mall/items/:id/deactivate
GET   /api/admin/points-mall/redemptions
GET   /api/admin/points-mall/redemptions/:id
PATCH /api/admin/points-mall/redemptions/:id/status
POST  /api/admin/points-mall/redemptions/:id/cancel
```

## 数据结构

### points_mall_items

保存积分商城商品。

```sql
CREATE TABLE points_mall_items (
  id UUID PRIMARY KEY,
  product_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  points_price INTEGER NOT NULL,
  stock_quantity INTEGER NOT NULL,
  status TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

说明：

- `product_id` 可关联现有商品，也可以为空。
- 官方小样、赠品组合可以只存在积分商城，不一定要出现在普通商品列表。
- `status` 建议值：`draft`、`active`、`inactive`、`sold_out`。

### points_redemption_orders

保存积分兑换订单。

```sql
CREATE TABLE points_redemption_orders (
  id UUID PRIMARY KEY,
  order_no TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL,
  total_points INTEGER NOT NULL,
  recipient_name TEXT,
  recipient_phone TEXT,
  shipping_address TEXT,
  tracking_no TEXT,
  shipped_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### points_redemption_items

保存兑换订单明细。

```sql
CREATE TABLE points_redemption_items (
  id UUID PRIMARY KEY,
  redemption_order_id UUID NOT NULL,
  mall_item_id UUID NOT NULL,
  name TEXT NOT NULL,
  points_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  subtotal_points INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### point_transactions 扩展类型

当前积分流水需要增加：

```text
redeem_points       积分商城兑换扣除
redeem_refund       兑换取消返还
expire_points       积分过期扣除
```

建议兑换扣积分时记录来源：

```text
redemption_order_id
source_transaction_id
```

`source_transaction_id` 用于记录 FIFO 扣的是哪一批积分。

## 后端流程

### 兑换流程

```text
1. 用户提交 mall_item_id 和 quantity。
2. 后端检查用户是否登录。
3. 后端读取积分商品。
4. 检查商品是否上架。
5. 检查库存是否足够。
6. 计算所需积分。
7. 读取用户未过期积分批次。
8. 检查可用积分是否足够。
9. 按 FIFO 扣积分。
10. 扣减库存。
11. 创建兑换订单。
12. 写入兑换订单明细。
13. 写入积分流水 redeem_points。
14. 返回兑换订单。
```

### FIFO 扣积分伪代码

```js
function redeemPoints(userId, pointsNeeded) {
  const batches = getAvailablePointBatches(userId)
    .filter((batch) => batch.expiresAt > now())
    .sort((a, b) => {
      if (a.expiresAt !== b.expiresAt) return a.expiresAt - b.expiresAt;
      return a.createdAt - b.createdAt;
    });

  let remaining = pointsNeeded;

  for (const batch of batches) {
    if (remaining <= 0) break;
    const used = Math.min(batch.remainingPoints, remaining);
    createPointTransaction({
      type: "redeem_points",
      points: -used,
      sourceTransactionId: batch.id
    });
    remaining -= used;
  }

  if (remaining > 0) {
    throw new Error("积分不足");
  }
}
```

### 取消兑换流程

```text
1. 后台选择取消兑换订单。
2. 检查订单是否允许取消。
3. 找到该兑换订单扣除的积分流水。
4. 写入 redeem_refund 流水返还积分。
5. 恢复库存。
6. 更新兑换订单状态为 cancelled。
7. 写入后台操作日志。
```

## 前端页面

### points-mall.html

积分商城列表页。

显示：

- 用户当前可用积分
- 积分商品列表
- 商品图片
- 商品名称
- 所需积分
- 剩余库存
- 上架状态
- 兑换按钮

### points-item.html

积分商品详情页。

显示：

- 商品大图
- 商品说明
- 所需积分
- 剩余库存
- 兑换数量
- 兑换确认按钮

### points-redemptions.html

我的兑换记录。

显示：

- 兑换订单号
- 兑换商品
- 使用积分
- 状态
- 物流单号
- 创建时间

## 后台页面

在 `admin.html` 增加积分商城管理区。

已实现功能：

- 新增积分商品
- 编辑积分价格
- 编辑库存
- 上架 / 下架
- 查看兑换订单
- 修改兑换订单状态
- 填写物流单号
- 取消兑换订单并返还积分

## 首批测试配置

建议先放 5 个商品：

| 商品 | 商品类型 | 积分价格 | 初始库存 |
|---|---|---:|---:|
| 官方随机小样 1 支 | 官方小样 | 300 | 50 |
| 官方随机小样 3 支 | 官方小样 | 800 | 30 |
| 茶香官方小样组合 | 官方小样 | 600 | 30 |
| 茶香主题试香套装 | 现有试香套装 | 1600 | 10 |
| 木质与焚香试香套装 | 现有试香套装 | 1800 | 10 |

后续如果要扩大测试，可以再映射：

```text
tea-sample
wood-sample
starter-sample
```

难卖正装建议第二批再上。第一批先用小样和试香套装验证用户行为。

## 验收清单

上线前必须验证：

1. 未登录用户不能兑换。
2. 积分不足不能兑换。
3. 过期积分不能兑换。
4. FIFO 扣积分顺序正确。
5. 兑换成功后用户可用积分减少。
6. 兑换成功后商品库存减少。
7. 库存不足不能兑换。
8. 下架商品不能兑换。
9. 无兑换次数限制，用户只要积分和库存足够就能重复兑换。
10. 重复提交不会重复扣积分。
11. 兑换订单能在用户中心查看。
12. 后台能看到兑换订单。
13. 后台能修改兑换订单状态。
14. 后台取消兑换后积分返还。
15. 后台取消兑换后库存恢复。
16. 积分流水能看到兑换扣除和取消返还。
17. 后台操作日志记录取消、发货、改状态等操作。

## 验收结果

已通过本地临时数据库接口验收：

- 未登录用户不能兑换。
- 积分不足不能兑换。
- 过期积分不能兑换。
- FIFO 扣积分顺序正确。
- 兑换成功后用户可用积分减少。
- 兑换成功后商品库存减少。
- 库存不足不能兑换。
- 下架商品不能兑换。
- 无兑换次数限制，同一用户只要积分和库存足够就能重复兑换同一商品。
- 相同 requestId 重复提交不会重复扣积分。
- 用户能查看兑换记录。
- 后台能查看兑换订单。
- 后台能修改兑换订单状态。
- 后台取消兑换后积分返还。
- 后台取消兑换后库存恢复。
- 积分流水能看到兑换扣除和取消返还。
- 后台操作日志记录取消和状态修改。

最近验证命令：

```bash
npm run build
node --check server/src/app.mjs
node --check script.js
```

## 执行阶段

### 阶段 1：数据和接口

状态：已完成。

目标：

```text
积分商品可以上架，用户可以兑换，系统能正确扣积分和库存。
```

任务：

1. 增加积分商品数据结构。
2. 增加兑换订单数据结构。
3. 实现前台商品列表接口。
4. 实现兑换接口。
5. 实现 FIFO 扣积分。
6. 实现库存扣减。
7. 实现兑换订单查询。

### 阶段 2：后台管理

状态：已完成。

目标：

```text
运营可以自己管理积分商城商品和兑换订单。
```

任务：

1. 后台新增积分商品管理。
2. 后台新增兑换订单管理。
3. 支持上架 / 下架。
4. 支持改库存和积分价格。
5. 支持取消兑换并返还积分。
6. 支持填写物流单号。

### 阶段 3：前端页面

状态：已完成。

目标：

```text
会员可以浏览积分商城并完成兑换。
```

任务：

1. 新增积分商城列表页。
2. 新增积分商品详情页。
3. 新增我的兑换记录页。
4. 在会员中心增加积分商城入口。
5. 兑换成功后展示订单状态。

### 阶段 4：测试和试运营

状态：已完成接口验收，待真实运营数据验证。

目标：

```text
用少量小样验证兑换流程和用户意愿。
```

任务：

1. 上架 5 个测试商品。
2. 使用测试会员验证兑换。
3. 验证 FIFO。
4. 验证库存。
5. 验证后台取消返还。
6. 观察兑换率和库存消耗。

## 风险和控制

### 风险：用户集中兑换导致库存快速耗尽

控制方式：

- 不限制次数，但严格限制库存。
- 运营可随时下架商品。
- 首批库存不要太大。

### 风险：积分价格过低导致成本失控

控制方式：

- 小样从 300 到 800 分测试。
- 试香套装从 1600 到 2200 分测试。
- 正装暂不上，后续按库存压力单独定价。

### 风险：重复提交导致重复扣积分

控制方式：

- 后端兑换接口增加幂等校验。
- 前端提交后禁用按钮。
- 后端用订单号或 requestId 防重复。

### 风险：积分批次扣减不清晰

控制方式：

- 每笔兑换流水记录 `sourceTransactionId`。
- 后台可追踪扣的是哪一批积分。
- 取消兑换时按原流水返还。

## 建议结论

第一版积分商城已经达到开发版可运行状态。实际运营时仍建议小范围上线，不做复杂促销，不做兑换次数限制。用库存、积分价格和后台下架控制风险。

推荐先上官方小样和试香套装。等确认用户愿意兑换、后台处理流程顺畅后，再逐步加入难卖正装。

## 后续生产化事项

上线前建议继续补：

1. 正式数据库迁移。
2. 正式后台登录和权限。
3. 兑换订单物流字段完善。
4. 兑换订单导出。
5. 积分商城图片上传。
6. 积分商品批量上下架。
7. 积分到期提醒。
