# 建筑施工项目部 - 月底集中处理分包进场单系统

## 端口配置

| 服务 | 端口 |
|------|------|
| 前端 (React + Vite) | **3002** |
| 后端 (Go + Echo) | **8002** |

前端 Vite 代理将 `/api` 请求转发到 `http://localhost:8002`，后端 CORS 白名单包含 `http://localhost:3002`。

## 快速启动

### 后端

```bash
cd backend
go mod tidy
go run main.go
```

服务启动后监听 `:8002`，首次运行自动初始化 SQLite 数据库 `subcontractor.db` 并写入种子数据。

### 前端

```bash
cd frontend
npm install
npm run dev
```

访问 `http://localhost:3002`。

## SQLite 初始化

后端首次启动时自动完成：
- 创建 `users`、`subcontractor_entries`、`attachments`、`processing_records`、`audit_notes`、`exception_logs` 六张表
- 插入 3 个演示用户、18 条分包进场单（覆盖五类场景）、附件、处理记录、审计备注和异常日志

如需重置：删除 `backend/subcontractor.db` 后重启后端。

## 演示账号

| 用户名 | 密码 | 角色 | 姓名 |
|--------|------|------|------|
| `ziliaoyuan` | `123456` | 资料员 | 张资料 |
| `shigongfzr` | `123456` | 施工负责人 | 李施工 |
| `xiangmujl` | `123456` | 项目经理 | 王项目 |

## 业务流转

```
资料员(创建/重新提交) → 待审核 → 施工负责人(审核/退回) → 审核通过 → 项目经理(确认/退回) → 已同步
                     ↑                                          |
                     └──────────── 退回补正 ←───────────────────┘
```

- **资料员**：创建分包进场单（状态 → 待审核），退回后可重新提交
- **施工负责人**：审核待审核单（→ 审核通过）或退回（→ 已退回，退回至资料员）
- **项目经理**：确认审核通过单（→ 已同步）或退回（→ 已退回，退回至施工负责人）

## 五类分包进场单

### 1. 正常流转
- 江西建工集团、中铁十五局、华厦建设公司
- 材料齐全、时间充裕，可正常审核通过 → 确认同步

### 2. 缺材料
- 湖南建达工程、中建三局、龙元建设集团
- 标记 `missing_materials` 异常标签
- 审核时后端拦截：必须先上传附件材料才能审核通过

### 3. 超时或逾期
- 上海建工集团、浙江宏信建设、广州工程局
- 截止时间已过，标记 `overdue` 异常标签
- 批量处理时逐条拦截逾期单，需到详情页补正

### 4. 退回补正
- 北京城建集团（退回至资料员）、四川路桥集团（退回至施工负责人）
- 标记 `returned` 异常标签，含退回原因
- 资料员/施工负责人可重新提交

### 5. 状态冲突
- 江苏华建（版本冲突：数据库版本 v2，前端携带 v1 提交触发冲突）
- 陕西建工（状态冲突：当前状态已同步，不可重复审核）
- 安徽路桥（越权测试：资料员角色审核触发越权异常）
- 用于测试乐观锁、状态机校验、权限拦截机制

## 异常样例

| 异常类型 | 触发场景 | 后端行为 |
|----------|----------|----------|
| `missing_materials` | 审核时无附件 | 返回 400，写入 exception_logs |
| `status_conflict` | 版本不一致/状态不匹配 | 返回 409/400，写入 exception_logs |
| `unauthorized_advance` | 非当前角色处理 | 返回 403，写入 exception_logs |
| `overdue` | 逾期单据审核/批量处理 | 返回 400，写入 exception_logs |

## API 接口

### 认证
- `POST /api/login` — 登录
- `POST /api/logout` — 退出
- `GET /api/me` — 当前用户

### 分包进场单
- `GET /api/entries` — 列表（支持 status/priority/category/overdue_group 筛选）
- `GET /api/entries/:id` — 详情（含附件、处理记录、审计备注、异常）
- `POST /api/entries` — 创建（资料员）
- `PUT /api/entries/:id/process` — 处理（审核/确认/退回/重新提交）
- `POST /api/entries/batch-process` — 批量处理
- `GET /api/entries/stats` — 统计

### 附件
- `GET /api/entries/:id/attachments` — 附件列表
- `POST /api/entries/:id/attachments` — 上传附件

### 审计
- `GET /api/entries/:id/audit-trail` — 审计轨迹
- `POST /api/entries/:id/audit-notes` — 添加审计备注

### 异常
- `GET /api/exceptions` — 异常列表
- `GET /api/entries/:id/exceptions` — 单据异常
- `PUT /api/exceptions/:id/resolve` — 标记异常已解决

### 其他
- `GET /api/users` — 用户列表

## 到期预警

列表和统计页按到期状态分组：
- **正常**：截止时间 > 72 小时
- **临期**：截止时间 ≤ 72 小时且未过期
- **逾期**：截止时间已过

逾期单据在批量处理时逐条拦截，需在详情页补正后再推进。

## 权限校验

后端对每个操作执行以下校验：
1. **角色校验**：仅对应角色可执行对应操作
2. **当前处理人校验**：根据 status 和 current_handler_role 判断
3. **状态校验**：操作必须匹配当前状态
4. **版本校验**：提交版本必须与数据库版本一致
5. **必填证据校验**：审核通过需要附件、退回需要原因
6. **逾期拦截**：逾期单据不可直接审核/批量处理
