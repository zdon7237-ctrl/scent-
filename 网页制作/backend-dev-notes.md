# 后端开发备忘

## 启动命令

```bash
npm start
```

`npm start` 会先执行构建，然后从 `dist` 目录提供静态页面。需要临时服务其他目录时，可以设置 `PUBLIC_DIR`。

启动后访问：

```text
http://localhost:8788
```

## 后台入口

后台管理页面：

```text
http://localhost:8788/admin.html
```

后台接口地址：

```text
http://localhost:8788/api/admin
```

## 后台开发密钥

```text
dev-admin
```

后台页面输入密钥时填：

```text
dev-admin
```

## 用途

本地开发阶段用于访问后台管理接口，例如：

- 确认订单已支付
- 退款
- 手动调整会员积分
- 手动调整会员等级
- 查看会员、订单、积分流水
- 导出会员名单
- 模拟支付 webhook

## 上线提醒

`dev-admin` 只适合本地开发。上线前应改成环境变量里的复杂密钥：

```bash
ADMIN_KEY=你的复杂密钥 npm start
```
