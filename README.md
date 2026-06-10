# 光伏运维公司-月底集中处理电站巡检单系统

## 项目简介

面向光伏运维公司的月底集中处理电站巡检单系统，覆盖新增、查询、退回、复核四大核心操作。
围绕电站巡检单为中心，整合电站巡检、缺陷上报、消缺验收三个业务模块，支持状态流转、
证据留存、异常原因追溯、到期预警、批量处理与审计轨迹。

---

## 技术栈

| 层级 | 技术 | 端口 |
|------|------|------|
| 前端 | Qwik City 1.x + TypeScript + Tailwind CSS | **3001** |
| 后端 | Rust + Poem (OpenAPI) + Tokio | **8001** |
| 数据库 | SQLite 3 (本地文件持久化) | — |

> 端口约定（全局统一，请勿修改）：
> - 前端监听：`0.0.0.0:3001`
> - 后端监听：`0.0.0.0:8001`
> - 前端请求地址：`http://localhost:8001`
> - 后端 CORS 白名单：`http://localhost:3001`

---

## 项目结构

```
trae-123-1/
├── backend/
│   ├── Cargo.toml
│   ├── data/
│   │   ├── schema.sql          # 数据库建表脚本
│   │   ├── seed.sql            # 演示数据（四类单据 + 账号 + 电站）
│   │   └── patrol.db           # 运行时自动生成的 SQLite 文件
│   └── src/
│       ├── main.rs             # 服务入口、CORS、路由
│       ├── db.rs               # SQLite 连接 + 启动时自动初始化
│       ├── error.rs            # 统一错误（400/401/403/404/409/500）
│       ├── middleware.rs       # 权限校验 + 版本冲突校验
│       ├── models.rs           # DTO / 实体 / 到期预警计算
│       └── handlers/           # API 实现（auth/users/stations/patrol/defects/acceptance）
└── frontend/
    ├── package.json            # dev 脚本端口 3001
    ├── vite.config.ts          # server.port = 3001
    ├── tailwind.config.js
    └── src/
        ├── routes/
        │   ├── index.tsx           # 电站巡检列表（筛选/统计/批量）
        │   ├── layout.tsx          # 全局布局 + 角色/用户切换
        │   ├── patrol/[id]/index.tsx   # 巡检单详情（流程/模块/审计）
        │   ├── defects/index.tsx   # 缺陷上报（占位）
        │   └── acceptance/index.tsx    # 消缺验收（占位）
        └── utils/
            ├── api.ts              # fetch 封装（自动注入 X-User-ID/Role）
            ├── auth.ts             # 角色切换 + 权限判断
            └── types.ts            # 类型/常量/颜色映射
```

---

## 快速启动

### 前置要求

- **Rust** >= 1.70（带 cargo）
- **Node.js** >= 18.17（带 npm）

### 1. 启动后端（端口 8001）

```bash
cd backend

# 首次编译（下载依赖 + 编译，首次较慢）
cargo build

# 启动服务
cargo run
```

启动后访问：
- 服务健康：`http://localhost:8001`
- Swagger API 文档：`http://localhost:8001/api/docs`
- OpenAPI JSON：`http://localhost:8001/api/openapi.json`

> SQLite 初始化说明：后端启动时自动读取 `data/schema.sql` 建表，再执行 `data/seed.sql`
> 写入演示数据。数据库文件生成在 `data/patrol.db`（WAL 模式）。删除此文件即可重置数据库。

### 2. 启动前端（端口 3001）

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

启动后访问：`http://localhost:3001`

---

## 演示账号

所有账号密码均为角色拼音 + `123`。

| 用户名 | 密码 | 角色 | 姓名 | 区域 |
|--------|------|------|------|------|
| `admin` | `admin123` | admin | 系统管理员 | 总部 |
| `inspector01` | `ins123` | inspector（巡检员） | 张伟-巡检员 | 华北区 |
| `inspector02` | `ins123` | inspector（巡检员） | 李娜-巡检员 | 华东区 |
| `engineer01` | `eng123` | engineer（工程师） | 王强-运维工程师 | 华北区 |
| `engineer02` | `eng123` | engineer（工程师） | 赵敏-运维工程师 | 华东区 |
| `manager01` | `mgr123` | manager（区域负责人） | 陈刚-区域负责人 | 华北区 |
| `manager02` | `mgr123` | manager（区域负责人） | 刘洋-区域负责人 | 华东区 |

> 前端顶部可直接切换角色和用户，无需登录。请求头自动携带 `X-User-ID` 和 `X-User-Role`。

---

## 四类演示单据

| 单号 | 电站 | 状态 | 到期分级 | 说明（异常场景） |
|------|------|------|----------|------------------|
| **PO202606001** | 华北一号 | `pending_dispatch`（待派发） | 正常 | 新建的待派发巡检单，含 2 个缺陷，用于测试**正常流转**：巡检员提交 → 派发工程师 → 办理 → 复核 |
| **PO202606002** | 华北二号 | `in_progress`（处理中） | 临期 | 已被**退回补正**过一次（初次提交缺少逆变器温度数据，巡检员已补正），当前在工程师办理阶段。用于测试**退回补正 + 状态冲突** |
| **PO202606003** | 华东一号 | `in_progress`（处理中） | **逾期** | 消缺时限已逾期，5 个缺陷中有 2 个超期办理。用于测试**超时/逾期 + 批量关闭逾期单逐条拦截** |
| **PO202606004** | 华东二号 | `closed`（已关闭） | 正常 | 完整流转完成的参考单据：巡检 → 消缺 → 验收 → 复核关闭。用于对比查看正常闭环的审计轨迹和处理记录 |

---

## 异常入口与穿透测试用例

系统按「当前角色 + 当前处理人 + 状态 + 版本 + 必填证据」五层拦截。以下为推荐的穿透测试路径：

### 1. 正常流转
- 角色切到 `inspector01` → 打开 PO202606001 → 提交 → 切 `manager01` 派发 engineer01 → 切 `engineer01` 办理 → 切 `manager01` 复核通过 → 状态变为 closed

### 2. 缺材料拦截
- 新建巡检单（不填天气/温度/证据）→ 提交 → 返回 400，异常原因写入 `audit_trails`
- 接口直接调：`PUT /api/patrol-orders/1/submit` 不带 `patrol_evidence` → 400

### 3. 越权访问
- 切到 `engineer01`（工程师）→ 调 `PUT /api/patrol-orders/1/submit`（巡检员接口）→ 403
- 切 `inspector02`（不是 PO202606001 的巡检员）→ 调 submit → 403「只有该巡检单的巡检员可以提交」

### 4. 重复提交 / 版本冲突
- 打开 PO202606002 详情（version = 2）→ 同时开两个页面 → 第一个提交成功 → 第二个提交时 version 仍是旧值 → 返回 **409 Conflict**

### 5. 状态冲突
- PO202606004 已 closed → 调 `/process` → 状态校验不通过（通过权限 + 状态双重拦截）

### 6. 缺证据请求
- 工程师调 `PUT /api/patrol-orders/2/process`，`defect_evidences` 传空 → 400「办理失败: 缺少缺陷消缺证据」
- 区域负责人调 `POST /api/acceptance`，`evidence` 传空数组 → 400「验收失败: 缺少验收证据」

### 7. 缺陷上报超时
- 对 PO202606001 调 `POST /api/defects`，后端自动判断距 `patrol_date` 是否超过 24 小时 → 超时的话 `anomaly_reason` 自动写入审计

### 8. 批量结果逐条展示
- 列表勾选 PO202606002（正常）和 PO202606003（逾期但未到可关闭条件）→ 批量关闭逾期单 → 弹窗中逐条显示成功/失败原因

---

## 核心功能说明

### 到期预警（三队分层）
- **正常（绿）**：到期日 > 今天 + 3 天
- **临期（黄）**：到期日距今天 1~3 天
- **逾期（红）**：到期日 ≤ 今天

列表顶部三张卡片分别统计三队数量，列表行背景按分级着色，筛选栏可按到期分级过滤。

### 处理顺序（三步流程）
详情页左侧时间线按以下顺序高亮当前步骤：
1. **站点巡检员补齐材料** → 2. **运维工程师办理** → 3. **区域负责人收口**

每步显示处理人、状态、意见、附件、开始/完成时间、异常原因、补正备注。

### 上一处理人意见与审计备注
- 每次退回/办理/复核的意见和附件保存在 `patrol_orders.previous_opinion` / `previous_attachment`，详情页独立区块展示
- 所有异常拦截自动写入 `audit_remark` / `anomaly_reason`，详情页「审计备注」区块可见
- 完整操作历史在底部「审计轨迹」时间倒序展示

### 电站巡检 / 缺陷上报 缺项补正
在详情页的「电站巡检」和「缺陷上报」Tab 中，若当前处理人为巡检员且状态允许，
可点击「编辑补正」按钮补充材料，补正记录写入 `process_records.correction_note`。

### 权限校验矩阵

| 操作 | 允许角色 | 额外条件 |
|------|----------|----------|
| 新建巡检单 | inspector, admin | — |
| 提交巡检材料 | inspector, admin | 必须是该单的 inspector_id |
| 派发工程师 | manager, admin | — |
| 办理消缺 | engineer, admin | 必须是该单的 engineer_id |
| 退回补正 | engineer, manager, admin | 状态为 in_progress |
| 复核 | manager, admin | 状态为 reviewing |
| 批量办理 | engineer, admin | 逐条校验处理人 |
| 批量关闭逾期单 | manager, admin | 逐条校验已逾期 + 版本 |
| 消缺验收 | manager, admin | evidence 必填 |

---

## 后端接口清单

### Auth
- `POST /api/auth/login` — 登录

### 基础数据
- `GET /api/users` — 用户列表
- `GET /api/stations` — 电站列表

### 巡检单核心
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/patrol-orders` | 列表（筛选+分页+到期分组统计）|
| GET | `/api/patrol-orders/:id` | 详情（含缺陷/附件/处理记录）|
| POST | `/api/patrol-orders` | 新建 |
| PUT | `/api/patrol-orders/:id` | 更新（含补正）|
| PUT | `/api/patrol-orders/:id/submit` | 巡检员提交（校验材料完整度）|
| PUT | `/api/patrol-orders/:id/dispatch` | 派发工程师 |
| PUT | `/api/patrol-orders/:id/process` | 工程师办理（校验缺陷证据）|
| PUT | `/api/patrol-orders/:id/return` | 退回补正 |
| PUT | `/api/patrol-orders/:id/review` | 区域负责人复核 |
| POST | `/api/patrol-orders/batch-process` | 批量办理（逐条返回成功/失败）|
| POST | `/api/patrol-orders/batch-close` | 批量关闭逾期单（逐条拦截）|
| GET | `/api/patrol-orders/:id/audit-trails` | 审计轨迹 |

### 缺陷上报
- `POST /api/defects` — 新建（校验距巡检开始 ≤ 24 小时）
- `PUT /api/defects/:id` — 更新

### 消缺验收
- `POST /api/acceptance` — 验收（校验 evidence 非空）

---

## 持久化说明

SQLite 数据库 `backend/data/patrol.db` 持久化以下表：
- `patrol_orders` — 电站巡检单（状态、版本、到期分级、前处理人意见、审计备注、异常原因）
- `defect_reports` — 缺陷上报（严重度、上报时限、证据、异常原因）
- `acceptance_records` — 消缺验收
- `attachments` — 附件
- `audit_trails` — 审计轨迹（所有状态变更 + 异常拦截自动写入）
- `process_records` — 三步处理记录（含补正动作和异常原因）
- `users`, `stations` — 基础数据

刷新页面后列表、详情、统计、操作记录均从此库读取，数据对得上。
