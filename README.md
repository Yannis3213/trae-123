# 保险代理公司-月底集中处理投保申请系统

前后端分离的保险投保申请月底集中处理管理系统。

## ⚠️ 端口约定（所有配置共用）

| 服务 | 端口 | 配置位置 |
|---|---|---|
| 前端 React + Vite | **3001** | `frontend/vite.config.js` (server.port & preview.port)、`backend/main.go` CORS 白名单、本 README 启动命令 |
| 后端 Go + Gin | **8001** | `backend/main.go` (Port 常量)、`frontend/vite.config.js` proxy.target |
| SQLite 数据文件 | - | `backend/data/insurance.db` (项目内本地文件) |

> CORS 白名单：`http://localhost:3001`、`http://127.0.0.1:3001`  
> 前端请求地址：`/api/*` → Vite 代理转发到 `http://localhost:8001/api/*`

---

## 🧱 技术栈

- **前端**：React 18 + Vite 5 + React Router 6 + Axios + Day.js
- **后端**：Go 1.21 + Gin 1.9 + GORM + SQLite (modernc.org/sqlite，纯 Go 无 CGO)
- **数据库**：SQLite（本地文件 `backend/data/insurance.db`，自动迁移并填充种子数据）

---

## 🚀 启动方式

### 一、启动后端（端口 8001）

```bash
cd backend

# 1. 下载依赖（首次）
go mod tidy

# 2. 编译 & 运行
go run main.go

# 或编译后执行
go build -o insurance_backend && ./insurance_backend
```

成功后会看到：
```
Backend server starting on http://localhost:8001
```

数据库自动创建在 `backend/data/insurance.db`，并写入 8 条种子数据（覆盖全部状态：待审核/待补正/审核通过/已同步/审核退回）。

---

### 二、启动前端（端口 3001）

```bash
cd frontend

# 1. 安装依赖（首次）
npm install

# 2. 开发模式运行
npm run dev
```

成功后访问：**http://localhost:3001**

生产预览：
```bash
npm run build
npm run preview    # 同样使用 3001 端口
```

---

### 三、同时启动（推荐：两个终端分别运行）

终端 1：
```bash
cd backend && go mod tidy && go run main.go
```

终端 2：
```bash
cd frontend && npm install && npm run dev
```

---

## 👥 角色与权限

通过右上角 **角色切换下拉框** 在三种身份间切换（无需登录，通过请求头 `X-Role` / `X-User-Id` / `X-User-Name` 识别）：

| 角色 | 请求头值 | 操作权限 |
|---|---|---|
| 客户经理 | `customer_manager` | 创建投保申请、补正资料、重新提交退回件 |
| 核保专员 | `underwriter` | 审核通过、退回补正 |
| 业务负责人 | `business_owner` | 同步出单、复核归档 |

---

## 🧭 业务模块

左侧导航栏对应三大业务区：

1. **📝 投保申请登记**（客户经理区）
   - 新建申请、补正附件、重新提交
   - 只看我创建 / 待我补正的申请
2. **✅ 过程核验**（核保专员区）
   - 处理状态为「待审核」的申请
   - 勾选必需证据类别后才能审核通过
3. **📁 复核归档**（业务负责人区）
   - 处理状态为「审核通过 / 已同步」的申请
   - 核对出单确认证据后同步出单 / 归档

其他模块：
- **📊 工作台**：全量统计 + 最近更新
- **⏰ 到期预警**：逾期 / 临期(3天内) / 正常 三队分列，支持按责任人筛选、逾期批量推进

---

## 📋 状态流转

```
(创建) → 待审核 → 审核通过 → 已同步 → 已归档
            ↓         ↓
         待补正    审核退回
            ↓
        (重新提交 → 待审核)
```

状态标签：`待审核`、`待补正`、`审核通过`、`已同步`、`已归档`、`审核退回`

---

## 🔐 后端接口校验规则

所有写操作接口均进行如下校验（前端会弹出具体错误信息）：

| 校验项 | 说明 |
|---|---|
| **角色权限** | 仅对应角色能执行对应操作，越权返回 403 |
| **当前处理人** | 必须匹配当前登录用户（核保专员→待审核、业务负责人→审核通过/已同步 除外） |
| **状态流转** | 不符合顺序的状态变更返回 400（如已同步的申请不能再退回待审核） |
| **版本号** | POST `/action` 必须携带当前 `version`，版本冲突返回 409 |
| **必填证据** | 审核通过 / 同步出单时，必须上传并勾选对应证据类别 |
| **重复提交** | 退回后的重新提交会校验状态，已审核通过的不能再提交 |
| **跨角色操作** | 客户经理不能审核、核保专员不能同步等 |
| **逾期滞留** | 截止日期已过的申请仍保留在对应列表，不会自动消失 |

### 批量处理（`POST /api/patrol-orders/batch-action`）
- 逐条校验、逐条返回成功 / 失败原因
- 最多 100 条 / 批
- 返回统计：总数 / 成功数 / 失败数 + 每条明细（含失败原因、新状态）

---

## 🗄️ 数据持久化（SQLite）

包含以下表，刷新后数据仍保留：

| 表 | 模型 | 作用 |
|---|---|---|
| patrol_orders | PatrolOrder | 投保申请主表（含版本号、异常原因、证据上传标记等） |
| attachments | Attachment | 附件（区分必需证据） |
| order_histories | OrderHistory | 完整办理历史（每步操作一条） |
| audit_notes | AuditNote | 审计备注 / 退回意见 / 补正说明 / 异常记录 |

---

## 🔗 核心 API

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/dashboard/stats` | 工作台统计 |
| GET | `/api/warnings` | 到期预警三队数据 |
| GET | `/api/patrol-orders` | 申请列表（支持 keyword/status/insurance_type/warning/only_mine 筛选、分页、排序） |
| GET | `/api/patrol-orders/:id` | 申请详情（含附件/历史/审计） |
| POST | `/api/patrol-orders` | 创建申请（客户经理） |
| PUT | `/api/patrol-orders/:id` | 修改申请 |
| POST | `/api/patrol-orders/:id/action` | 单条办理操作（含版本/角色/状态/证据校验） |
| POST | `/api/patrol-orders/batch-action` | 批量办理（逐条返回成功失败） |
| GET | `/api/patrol-orders/:id/history` | 办理历史 |
| GET / POST / DELETE | `/api/attachments[/:id]` | 附件管理 |

---

## 🧪 自测建议

### 页面侧（四种数据）
1. **正常流转**：客户经理新建 → 核保专员通过 → 业务负责人同步 → 归档
2. **缺材料**：在「待补正」状态下走补正附件 → 重新提交
3. **超时或逾期**：观察「⏰ 到期预警」页逾期队（种子数据已含）
4. **退回补正或状态冲突**：核保专员退回 → 客户经理重提 → 再次审核

### 接口侧（用 Postman 或 curl）
- 越权：用客户经理 header 调用审核通过
- 重复提交：对已审核通过的申请再次 submit
- 状态冲突：从「已同步」状态调用 approve
- 旧版本提交：传比当前 version 小 1 的 version 值
- 缺证据请求：approve / sync 时不传 required_evidence 或 不传附件

数据均持久化到 SQLite，可反复测试对比。
