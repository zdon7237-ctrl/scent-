# 前端验收报告

更新日期：2026-05-06

## 验收范围

对应 `frontend-goal-plan.md` 的 Goal 8，并覆盖 Goal 3 到 Goal 7 的主要改动。

关键页面：

```text
index.html
shop.html
product.html
samples.html
cart.html
brands.html
journal.html
login.html
member.html
points-mall.html
```

## 构建验收

命令：

```text
npm run build
```

结果：

```text
Eleventy 成功写出 23 个页面。
构建通过。
```

## 本地预览

命令：

```text
npm run serve
```

结果：

```text
Server at http://localhost:8080/
```

沙盒内直接监听 `0.0.0.0:8080` 被限制，已使用授权后的本地预览服务完成浏览器验收。

## 浏览器验收

### 桌面端 1440 x 900

Chrome/CDP 检查结果：10 个关键页面均无横向溢出。

| 页面 | H1 | 横向溢出 |
|---|---|---|
| `index.html` | 不是更多香水，是更容易判断的气味选择。 | 否 |
| `shop.html` | 按气味、场景和风险筛选香水。 | 否 |
| `product.html` | Vespree 晚霞之约 | 否 |
| `samples.html` | 先试香，再决定正装。 | 否 |
| `cart.html` | 购物车 | 否 |
| `brands.html` | 先理解品牌，再进入作品。 | 否 |
| `journal.html` | 把抽象气味讲具体。 | 否 |
| `login.html` | 会员登录 | 否 |
| `member.html` | 会员权益 | 否 |
| `points-mall.html` | 积分商城 | 否 |

### 移动端检查

Chrome/CDP 以移动视口检查关键页面。结果：关键页面未检测到横向溢出，商品列表在移动断点下为单列网格。

已确认：

- 首页移动端无横向溢出。
- 移动端导航按钮可见。
- 商品详情、试香、购物车、品牌、Journal、登录、会员和积分商城页面无横向溢出。
- 商品列表结果区为单列商品网格。

## 交互验收

### 商品详情加入购物车

页面：

```text
product.html
```

检查结果：

```json
{
  "count": "1",
  "toast": "Vespree 晚霞之约 已加入购物车",
  "hasGuidance": true,
  "sampleLink": true
}
```

结论：

- 商品详情页存在购买前判断模块。
- 商品详情页存在先试香路径。
- 点击加入购物车后，购物车数量更新为 1。
- 成功 toast 显示正确商品名。

## 仍需后续真实运营验证

以下不属于本次前端静态验收的硬性完成项，但上线前仍应验证：

- 真实品牌图片替换 Unsplash 占位图。
- 真实支付接入后的 checkout 状态。
- 正式会员登录、后台权限和真实接口错误。
- 试香套装是否抵扣正装的运营规则。
