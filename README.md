# 社区团购平台月底集中处理团购订单系统

## 技术栈

- **前端**: Nuxt 3 + Vue 3 + TypeScript + @nuxt/ui + Pinia
- **后端**: Node.js + NestJS + TypeORM + SQLite (better-sqlite3)
- **数据库**: 本地 SQLite（文件：`backend/data.db`）

## 端口配置

| 服务 | 端口 | 环境变量 |
|------|------|----------|
| 前端（Nuxt 3） | 3000 | `FRONTEND_PORT` |
| 后端（NestJS） | 3001 | `BACKEND_PORT` |

前端请求地址、后端监听端口、CORS 白名单均共用这组端口。

## 快速启动

### 1. 安装依赖

```bash
# 方式一：根目录统一安装
npm run install:all

# 方式二：分别安装
cd backend && npm install
cd ../frontend && npm install
```

### 2. 启动开发服务

```bash
# 方式一：根目录同时启动前后端
npm run dev

# 方式二：分别启动
# 终端1 - 后端
cd backend && npm run start:dev

# 终端2 - 前端
cd frontend && npm run dev
```

启动后访问：
- 前端：http://localhost:3000
- 后端 API：http://localhost:3001
- Swagger 文档：http://localhost:3001/api

## 角色说明

| 角色 | 角色编码 | 职责 |
|------|----------|------|
| 团购登记员 | `GROUPON_REGISTRAR` | 发起订单、派发、补齐材料 |
| 团购审核主管 | `AUDIT_SUPERVISOR` | 派发订单、退回补正 |
| 复核负责人 | `REVIEW_LEADER` | 复核归档、退回补正 |
| 团长运营 | `LEADER_OPERATOR` | 补齐材料、补正凭证 |
| 履约专员 | `FULFILLMENT_SPECIALIST` | 办理订单、录入凭证 |
| 城市经理 | `CITY_MANAGER` | 收口、复核归档、批量处理 |

## 状态流转

```
待派发 (PENDING_ASSIGN)
    ↓ 派发
处理中 (PROCESSING)
    ↓ 履约专员处理
处理中 (PROCESSING) - 提交复核
    ↓ 城市经理复核通过
已关闭 (CLOSED)

退回补正：
处理中 → 团长运营补正材料 → 履约专员重新处理
处理中 → 状态冲突时保留原值，记录异常原因
```

## 预警机制

- **正常**：距截止日期 > 24 小时
- **临期**：距截止日期 ≤ 24 小时
- **逾期**：已超过截止日期，节点显示责任人

## 数据库表

- `group_orders` - 团购订单主表
- `attachments` - 附件表（上架/订单/履约凭证）
- `processing_records` - 处理记录表
- `audit_notes` - 审计备注表
- `exception_reasons` - 异常原因表

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/group-orders` | 创建订单 |
| GET | `/group-orders` | 查询订单列表（分页、筛选） |
| GET | `/group-orders/:id` | 获取订单详情 |
| POST | `/group-orders/:id/assign` | 派发订单 |
| POST | `/group-orders/:id/process` | 履约专员处理 |
| POST | `/group-orders/:id/review` | 复核归档 |
| POST | `/group-orders/:id/return` | 退回补正 |
| POST | `/group-orders/:id/correct` | 补正材料 |
| POST | `/group-orders/batch` | 批量处理 |
| POST | `/group-orders/:id/notes` | 添加审计备注 |
| POST | `/group-orders/:id/attachments` | 添加附件 |
| GET | `/auth/users` | 获取可用用户列表 |
| POST | `/auth/login` | 模拟登录 |

### 请求头

所有接口需要携带以下请求头用于角色鉴权：

```
x-user-id: 用户ID
x-user-name: 用户名
x-user-role: 角色编码
```

## 测试场景

### 1. 正常流转
1. 团购登记员创建订单（待派发）
2. 审核主管派发给履约专员（处理中）
3. 履约专员录入订单凭证处理（处理中）
4. 城市经理复核归档（已关闭）

### 2. 缺材料
1. 订单派发后材料不完整
2. 复核人退回给团长运营补正
3. 团长运营补齐材料并提交
4. 履约专员重新处理

### 3. 超时/逾期
1. 设置订单截止日期在过去
2. 系统自动标记逾期并记录异常原因
3. 逾期订单无法批量推进，需单独处理
4. 详情页显示逾期责任人和补正动作

### 4. 退回补正/状态冲突
1. 履约专员处理中，复核人尝试退回
2. 如果状态冲突，保留原值但记录退回原因
3. 详情页显示异常原因和操作记录

## 后端校验

- **越权校验**：基于角色守卫 `RoleGuard` + `@Roles()` 装饰器
- **重复提交/版本校验**：每次操作校验 `version` 字段，冲突返回 409
- **状态冲突**：非法状态转换返回 409，保留原值并记录提示
- **必填证据**：履约处理需要订单凭证，复核需要履约凭证，缺失返回 400
- **批量拦截**：逾期订单逐条拦截，不整批放行，返回成功/失败明细
