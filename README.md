# 旅行社-月底集中处理旅游订单系统

基于 **Qwik City** 前端 + **Rust (Axum)** 后端 + **SQLite** 本地数据库的全栈旅游订单处理系统。

---

## 1. 端口配置（前后端共用）

所有端口配置统一通过环境变量 `FRONTEND_PORT` 和 `BACKEND_PORT` 控制，前后端配置文件、CORS 白名单、启动命令均读取同一组变量，**不写死其他端口**。

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `FRONTEND_PORT` | `5173` | Qwik City 前端开发/预览端口 |
| `BACKEND_PORT` | `3000` | Rust Axum 后端监听端口，也是前端请求 API 的端口 |

如需修改，**同时编辑**：
- 根目录 `.env`（项目级共享配置）
- `backend/.env`
- `frontend/.env`

---

## 2. 快速启动

### 2.1 启动后端（Rust + Axum + SQLite）

```bash
cd backend

# 首次运行会自动：
#   - 创建 SQLite 数据库文件 travel_agency.db
#   - 执行建表迁移
#   - 插入演示账号与示例订单
cargo run
```

后端服务启动在 `http://localhost:${BACKEND_PORT}`（默认 3000）。

### 2.2 启动前端（Qwik City）

```bash
cd frontend
npm install
npm run dev
```

前端启动在 `http://localhost:${FRONTEND_PORT}`（默认 5173）。

---

## 3. 演示账号

所有账号初始密码均为 `123456`（可通过 `backend/.env` 的 `DEMO_PASSWORD` 修改）。

| 用户名 | 角色 | 中文名称 | 主要职责 |
|--------|------|----------|----------|
| `registrar` | 旅游登记员 | 旅游登记员 | 发起/补正订单（草稿、待补正队列） |
| `auditor` | 旅游审核主管 | 旅游审核主管 | 过程核验（待审核、退回补正） |
| `reviewer` | 旅行社复核负责人 | 旅行社复核负责人 | 复核归档（待复核、已归档队列） |

**登录页已内置演示账号一键填充**。

---

## 4. SQLite 数据结构

数据库文件：`backend/travel_agency.db`（首次启动自动生成）

### 核心表

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `users` | 用户/账号 | `id`, `username`, `password_hash`, `role`, `display_name` |
| `tour_orders` | 旅游订单主表 | `id`, `order_no`, `status`, `version`, `current_handler`, `is_overdue`, `deadline`, `*_evidence`, `exception_reason`, `correction_note`, `created_by` |
| `attachments` | 附件/证据文件 | `id`, `order_id`, `file_name`, `evidence_type` (`route_quote`/`registration_confirm`/`tour_audit`), `uploaded_by` |
| `processing_records` | 处理记录（操作留痕） | `id`, `order_id`, `from_status`, `to_status`, `action`, `handler_*`, `note`, `exception_reason` |
| `audit_notes` | 审计备注 | `id`, `order_id`, `content`, `created_by` |

---

## 5. 四类示例订单（首次启动自动插入）

| 订单号 | 状态 | 说明 | 对应试用场景 |
|--------|------|------|--------------|
| `TO-20260610-001` | **草稿 (draft)** | 旅游登记员刚创建的北京五日游草稿 | 正常流转：草稿→提交审核→审核通过→复核归档 |
| `TO-20260610-002` | **待审核 (pending_audit)** | 上海苏杭七日游，含线路报价与报名确认证据 | 缺材料：出团审核证据缺失，审核时会拦截 |
| `TO-20260610-003` | **待补正 (pending_correction)** | 云南六日游，已逾期 1 天 | 超时/逾期：无法直接推进，需登记员补正 |
| `TO-20260610-004` | **待复核 (pending_review)** | 海南三亚五日游，三类证据齐全 | 退回补正或状态冲突：复核退回后回到待补正 |

---

## 6. 状态流转图（后端严格校验）

```
[草稿 draft]
      │  旅游登记员 + 线路报价证据
      ▼
[待审核 pending_audit]
      │                              │
      │ 审核主管 + 线路报价+报名确认 │ 审核主管（可退回，带异常原因）
      ▼                              ▼
[待复核 pending_review]        [待补正 pending_correction]
      │                              │
      │ 复核负责人 + 三类证据齐全     │ 复核负责人/审核主管（可退回）
      │                              │  旅游登记员补正后重新提交
      ▼                              ▼
[已归档 archived]  ◄─────────────────┘
```

每次状态变更，后端会校验：
1. **当前角色权限**（导游主管不能替运营负责人归档）
2. **状态流转合法**（不能跳环节，如草稿直接到归档）
3. **必填证据齐全**（如提交审核必须有线路报价证据）
4. **版本号一致**（防止重复提交/旧版本提交）
5. **是否逾期**（逾期订单禁止直接推进）

---

## 7. 权限与筛选规则

| 角色 | 可见状态筛选 | 可操作状态 |
|------|-------------|------------|
| 旅游登记员 | `草稿`、`待补正` | 创建草稿、提交审核、补正后重新提交 |
| 旅游审核主管 | `待审核`、`待补正` | 审核通过、退回补正（带异常原因） |
| 旅行社复核负责人 | `待复核`、`已归档` | 复核归档、退回补正（带异常原因） |

列表筛选条件始终包含：`草稿`、`待复核`、`已归档` 等状态值。

---

## 8. 到期预警队列

详情页与工作台顶部以颜色区分预警状态：

| 标签 | 条件 | 颜色 |
|------|------|------|
| 正常 | 未逾期且 deadline > 24h | 绿色 |
| 临期 | 未逾期且 deadline ≤ 24h | 橙色 |
| 逾期 | `is_overdue = 1` | 红色 |

节点超时按**责任人**计算，逾期订单会继续停留在当前处理人的待处理列表，直至补正后提交。

---

## 9. 核心后端 API

所有 API（除 `/api/auth/login`）需携带 `Authorization: Bearer <token>` 请求头。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录，返回 JWT |
| GET | `/api/auth/me` | 获取当前用户信息 |
| GET | `/api/orders` | 订单列表（按角色自动过滤，支持 `status`/`overdue`/`search`/`page`/`page_size`） |
| POST | `/api/orders` | 新建订单（登记员） |
| GET | `/api/orders/:id` | 订单详情 |
| PUT | `/api/orders/:id` | 修改订单信息/证据（版本号校验） |
| PUT | `/api/orders/:id/status` | **状态变更**（角色+状态+证据+版本四重校验） |
| POST | `/api/orders/batch` | 批量处理（逐条返回成功/失败原因） |
| POST | `/api/orders/:id/attachments` | 上传附件证据 |
| GET | `/api/orders/:id/attachments` | 附件列表 |
| GET | `/api/orders/:id/records` | 处理记录（时间线） |
| POST | `/api/orders/:id/records` | 添加处理记录 |
| POST | `/api/orders/:id/audit` | 添加审计备注（审核/复核角色） |
| GET | `/api/orders/:id/audit` | 审计备注列表 |
| GET | `/api/dashboard/stats` | 工作台统计（按角色隔离） |

### 状态变更请求体示例

```json
{
  "target_status": "pending_review",
  "version": 2,
  "note": "审核通过，材料齐全",
  "route_quote_evidence": true,
  "registration_confirm_evidence": true,
  "tour_audit_evidence": false
}
```

### 错误响应结构

```json
{
  "error": "缺少必要证据: tour_audit_evidence",
  "code": "MISSING_EVIDENCE"
}
```

常见错误码：`AUTH_ERROR`、`AUTHORIZATION_ERROR`、`VALIDATION_ERROR`、`STATE_CONFLICT`、`VERSION_CONFLICT`、`MISSING_EVIDENCE`、`NOT_FOUND`。

---

## 10. 试用场景覆盖

登录后按以下路径试用四类场景：

1. **正常流转**：登录 `registrar` → 打开"草稿"订单 → 提交审核 → 登录 `auditor` → 审核通过 → 登录 `reviewer` → 复核归档
2. **缺材料**：登录 `auditor` → 打开待审核订单 → 尝试直接通过 → 后端拦截并返回 `MISSING_EVIDENCE`
3. **超时/逾期**：登录 `registrar` → 查看待补正中的"云南六日游"（已逾期）→ 无法直接提交；补正后可推进
4. **退回补正/状态冲突**：登录 `reviewer` → 对待复核订单执行"退回补正"→ 订单回到待补正队列；同一版本号重复提交会触发 `VERSION_CONFLICT`

---

## 11. 目录结构

```
.
├── backend/              # Rust + Axum 后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── db.rs         # SQLite 连接、迁移、种子数据
│   │   ├── models.rs     # 数据模型、请求/响应结构
│   │   ├── auth.rs       # JWT 认证、权限提取
│   │   ├── services.rs   # 状态流转规则、权限校验
│   │   ├── error.rs      # 统一错误类型
│   │   └── handlers/     # API 路由处理
│   ├── Cargo.toml
│   └── .env
├── frontend/             # Qwik City 前端
│   ├── src/
│   │   ├── components/   # AppLayout 等通用组件
│   │   ├── routes/       # 基于文件的路由
│   │   │   ├── login/
│   │   │   ├── dashboard/
│   │   │   └── orders/
│   │   ├── types/        # 前端类型定义
│   │   ├── utils/        # API 客户端
│   │   ├── root.tsx
│   │   ├── layout.tsx    # 全局布局 + 登录拦截
│   │   └── global.css
│   ├── index.html
│   ├── vite.config.ts    # 读取 FRONTEND_PORT / BACKEND_PORT
│   ├── package.json
│   └── .env
└── README.md
```
