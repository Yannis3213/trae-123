# 长租公寓-月底集中处理租约申请系统

## 环境变量

在项目根目录创建 `.env` 文件（参考 `.env.example`）：

```
FRONTEND_PORT=5173
BACKEND_PORT=8080
```

## 启动方式

### 1. 启动后端

```bash
cd backend
go mod tidy
go run main.go
```

后端服务启动在 `BACKEND_PORT`（默认 8080）。

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端服务启动在 `FRONTEND_PORT`（默认 5173），API 请求自动代理到后端。

## 端口配置说明

| 配置项 | 环境变量 | 默认值 | 说明 |
|--------|----------|--------|------|
| 前端端口 | FRONTEND_PORT | 5173 | Vite 开发服务器端口 |
| 后端端口 | BACKEND_PORT | 8080 | Gin 服务监听端口 |
| CORS 白名单 | FRONTEND_PORT | 5173 | 后端允许的前端 Origin |
| API 代理 | BACKEND_PORT | 8080 | 前端 proxy 目标端口 |

所有端口配置统一读取 `.env` 中的 `FRONTEND_PORT` 和 `BACKEND_PORT`，不会写死其他端口。

## 角色说明

| 角色 | 英文标识 | 默认用户 | 职责 |
|------|----------|----------|------|
| 租务专员 | lease_clerk | 张租赁(user_001) | 维护入口数据、补正 |
| 维修协调员 | maintenance_coordinator | 李维修(user_002) | 核对过程、核验 |
| 门店经理 | store_manager | 王经理(user_003) | 确认结果 |

## 状态流转

```
待核验(pending_verification) ──维修协调员──→ 核验完成(verification_complete)
待核验(pending_verification) ──维修协调员──→ 核验失败(verification_failed)
核验失败(verification_failed) ──租务专员──→ 待核验(pending_verification)
核验完成(verification_complete) ──门店经理──→ 已确认(verification_complete)
```

## 接口校验规则

- 40101: 缺少角色信息
- 40301: 当前角色无权执行此操作
- 40302: 当前申请应由其他角色处理
- 40901: 版本冲突，数据已被其他人员修改
- 40902: 当前状态不允许执行此操作
- 40903: 缺少必要附件，无法完成核验
- 40904: 该申请已被处理，请勿重复提交
