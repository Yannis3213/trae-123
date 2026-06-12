# 📋 企业培训公司 - 月底集中处理培训项目单系统

> 多角色责任链：**课程顾问 → 讲师运营 → 项目经理**，入口为「月底集中处理培训项目单」。
> 技术栈：**TanStack Start (前端 3106)** + **FastAPI (后端 8106)** + **SQLite (本地)**。

---

## 🚀 快速启动

端口统一约定（`.env` 文件、前端请求、后端监听、CORS 白名单、README 启动命令全部共用）：

| 组件 | 端口 |
| --- | --- |
| 前端 (TanStack Start) | **3106** |
| 后端 (FastAPI / Uvicorn) | **8106** |
| API Base | `http://localhost:8106` |

### ① 启动后端（FastAPI + SQLite）

```bash
cd backend

# 安装 Python 依赖
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 启动（首次启动自动：①创建 SQLite 表 ②插入演示账号 ③插入 8 条演示项目单）
python main.py

# 后端启动成功后：
#   - Swagger 文档： http://localhost:8106/docs
#   - 健康检查：     http://localhost:8106/api/health
#   - 数据库文件：   ./backend/training_projects.db
```

### ② 启动前端（TanStack Start / React）

```bash
cd frontend

# 安装 Node 依赖（推荐 Node ≥ 18）
npm install

# 启动开发服务器
npm run dev

# 前端访问：http://localhost:3106
```

### ③ 登录演示账号（密码均为 `123456`）

| 账号 | 角色 | 岗位名称 | 权限 |
| --- | --- | --- | --- |
| `consultant` | 课程顾问 | **培训项目登记员** | 创建/编辑/补正/提交审核/推进阶段 |
| `trainer_ops` | 讲师运营 | **培训项目审核主管** | 过程核对：审核通过 / 退回补正 |
| `project_mgr` | 项目经理 | **企业培训公司复核负责人** | 结果确认：复核通过同步 / 复核退回 / 归档 |

> 🔄 系统支持一键「切换角色」（导航栏 → 切换角色），无需反复登录。

---

## 🗄️ SQLite 初始化说明

1. 数据库文件路径：`backend/training_projects.db`
2. 首次启动后端时，`main.py` 的 `lifespan` 生命周期钩子会自动执行：
   - `models.init_db()`：通过 SQLAlchemy 创建全部 6 张表（若不存在）
   - `init_data.seed_demo_data(db)`：无账号时写入 3 个角色账号；无项目时写入 8 条演示项目单
3. 若需要**重置数据**，只需停止后端后删除 `backend/training_projects.db`，再次启动后端即可重新初始化。
4. 所有数据表均支持刷新后**列表/详情/统计/操作记录**保持一致（全部从 SQLite 读取）。

### 📐 数据模型（6 张表）

| 表 | 用途 | 关键字段 |
| --- | --- | --- |
| `users` | 用户（账号+角色） | `username`, `role` (registrar/auditor/reviewer), `password_hash` |
| `training_projects` | 培训项目单主体 | `project_no` 自动编号、`status`（8种状态）、`stage`（3种阶段）、`current_handler_role`、`current_handler_id`、**`version`（乐观锁）**、`deadline` |
| `attachments` | 附件材料 | `category`(demand/plan/contract/other)、`is_required` 必备证据标记、上传人 |
| `processing_records` | 处理记录（操作日志） | `action`、`from_status/to_status`、`version_at_action`、`evidence_checked` 证据核对 |
| `audit_notes` | 审计备注 | `note_type`(status_change/exception/supplement/deadline)，可追溯 |
| `exception_records` | 异常记录（拦截留痕） | `exception_type`(缺证据/逾期/状态冲突/版本冲突/越权/重复提交)、责任人 |

---

## 👥 四类演示数据（共 8 条，覆盖全部异常场景）

### 🔵 角色责任链测试场景

| # | 项目 | 当前状态 | 当前阶段 | 到期情况 | 设计目的 |
| --- | --- | --- | --- | --- | --- |
| 1 | 新员工入职培训项目 | 草稿（课程顾问） | 合同确认 | 正常(+15天) | 正常流转起点（完整材料） |
| 2 | 管理层通用管理能力提升 | 待审核（讲师运营） | 方案报价 | **临期(+1天)** | 正常审核场景 + 临期预警 |
| 3 | 销售团队通用能力 | **退回补正**（课程顾问） | 需求 | **逾期(-1天)** | **缺材料** + **逾期**双异常拦截 |
| 4 | 技术团队通用项目 | **审核通过（待项目经理复核）** | 合同确认 | 正常(+7天) | 复核权限：仅项目经理能操作 |
| 5 | 大客户通用通用项目 | 已同步 | 合同确认 | 逾期(-3天) | 正常流转终点 + 项目经理归档 |
| 6 | 高层管理通用通用项目 | 草稿（课程顾问） | 方案报价 | **逾期(-5天)** | **缺材料 + 逾期**：后端拦住提交 |
| 7 | 百人通用通用项目 | **复核退回（讲师运营）** | 方案报价 | 临期(+2天) | 复核退回后讲师运营二次审核 |
| 8 | 通用通用培训项目 | 已归档 | 合同确认 | 逾期(-10天) | 最终归档状态，只读 |

### 🧪 闭环验证用例（复查清单）

#### ✅ 正常流转能过
1. 用 `consultant` 登录 → 打开 #1 新员工项目 → 点击"提交审核" → 状态变为「待审核」。
2. 切换到 `trainer_ops` → 打开同一项目 → 点击"审核通过" → 状态变为「审核通过」。
3. 切换到 `project_mgr` → 点击"复核通过并同步" → 状态变为「已同步」→ 点击"归档"。

#### ❌ 缺材料 / 逾期能停住
1. 用 `consultant` 打开 #3 销售团队项目（退回补正）→ 直接点"补正提交" → **报错：缺少必要材料**，异常进入审计备注。
2. 在 #6 草稿直接提交 → **同时触发缺材料 + 逾期**两条异常记录。

#### 🔄 退回补正与状态冲突
1. 讲师运营点 #2 的"退回补正" → 必须填退回原因才能执行 → 自动流转回课程顾问。
2. **直调接口测试**（绕开前端）：用已过期的 `version` 提交动作 → 后端返回 `版本冲突`，记录 `version_conflict` 异常。
3. 用非当前处理人账号办理 → 后端返回 `处理人不匹配`，记录 `permission_denied` 异常。

#### 📊 批量处理逐条拦截
1. 列表页多选含正常 + 异常的项目单 → 执行"批量审核通过" → 结果页逐条显示成功/失败及原因，失败的已写入审计备注。

---

## 🔒 后端校验清单（即使绕开页面直调接口也拦住）

| 校验维度 | 触发时机 | 异常类型 | 审计留痕 |
| --- | --- | --- | --- |
| 当前角色 | 每个动作 | `permission_denied` | ✅ |
| 当前处理人 | 审核/补正类动作 | `permission_denied` | ✅ |
| 状态机 | 每次流转 | `status_conflict` / `permission_denied` | ✅ |
| 版本（乐观锁） | 修改/动作 | `version_conflict` | ✅ |
| 必填证据 | 提交/审核/复核 | `missing_evidence` | ✅ |
| 截止日期 | 每次办理 | `overdue` | ✅ |
| 重复提交 / 已归档 | 状态校验 | `status_conflict` | ✅ |

---

## 📱 核心页面功能说明

### 1. 📊 工作台 `/`
- 整体统计（按角色自动筛选可见数据）
- 到期预警分布（正常/临期/逾期）
- 阶段分布（培训需求→方案报价→合同确认）
- 角色待办数量
- 责任链说明卡片

### 2. 📝 项目单列表 `/projects`
- **筛选**：状态/阶段/到期情况/关键词/只看我办理
- **批量处理**：按角色提供可用批量动作，结果逐条展示成功/失败原因
- **到期着色**：逾期红色、临期黄色、正常无色
- **分页**：每页 15 条，支持跳转

### 3. 🧾 项目单详情 `/projects/:id`（**连续办理主页面**）
- 顶部 4 格关键信息（阶段 / 状态 / 到期 / 当前处理人）
- **当前角色可用操作区**：只显示角色 + 当前状态允许的动作
  - 退回类动作强制填写退回原因
  - 每次操作记录版本号
- 四个 Tab：
  1. **📋 基本信息与办理**：可编辑字段（仅课程顾问在草稿/退回补正状态可改）
  2. **📎 附件材料**：分必备/普通、分阶段分类
  3. **📝 处理记录**：时间轴 + 状态/阶段流转 + 证据核对说明
  4. **🔍 审计备注与异常**：状态变更、补正记录、异常记录（含越权、版本冲突、缺证据、逾期）

### 4. ➕ 新建项目单 `/projects/new`
- 仅课程顾问可访问
- 三阶段可视化选择（培训需求 / 方案报价 / 合同确认）
- 基础信息 + 需求描述 + 方案说明 + 报价 + 合同

### 5. ⏰ 到期预警看板 `/deadline`
- **三队列分开展示**：正常 / 临期 / 逾期，绝不混在一起
- **按责任归属标注**：课程顾问 / 讲师运营 / 项目经理
- **逾期批量推进**：逐条拦截，失败的异常原因可追溯
- 逾期天数 / 剩余天数直观显示

### 6. 🔄 角色切换 `/switch-role`
- 一键切换账号角色，无需输入密码

---

## 🧭 状态流转图（责任链）

```
【课程顾问】
   ├─ 创建(草稿)
   ├─ 编辑草稿
   ├─ 提交审核 ─────┐
   └─ 补正提交 ─────┤
                   ▼
             【讲师运营】
               待审核
               ├─ 审核通过 ─────┐
               └─ 退回补正 ──► 【课程顾问】补正
                               ▼
                        【项目经理】
                          审核通过
                          ├─ 复核通过并同步 ──► 已同步 ──► 归档
                          └─ 复核退回 ───────► 【讲师运营】二次审核
```

---

## 🔧 后端 CORS 白名单配置

自动包含：
```
http://localhost:3106
http://127.0.0.1:3106
http://localhost:3000   (兼容通用开发端口)
```

后端从 `.env` 读取 `FRONTEND_PORT=3106`、`BACKEND_PORT=8106`，前端请求地址、后端监听端口、CORS 白名单全部联动。

---

## 📚 相关文件结构

```
trae-123-6/
├── .env                             # 端口配置：FRONTEND_PORT=3106, BACKEND_PORT=8106
├── README.md                        # 本文档
├── backend/
│   ├── main.py                      # FastAPI 入口（8106端口）
│   ├── models.py                    # SQLAlchemy 数据模型 + get_db
│   ├── schemas.py                   # Pydantic 请求/响应结构
│   ├── auth_service.py              # 认证、密码哈希、Token 会话
│   ├── project_service.py           # 核心业务：权限/状态/版本/证据/异常
│   ├── init_data.py                 # 演示数据（3账号 + 8项目 + 历史记录）
│   ├── requirements.txt
│   └── routers/
│       ├── auth.py                  # /api/auth/*
│       └── projects.py              # /api/projects/*（含批量、附件）
└── frontend/
    ├── package.json                 # npm run dev 默认 --port 3106
    ├── app.config.ts                # 前端端口 3106 + API 地址
    ├── tailwind.config.js / postcss.config.js
    └── app/
        ├── api.ts                   # API 客户端 + 常量
        ├── styles.css               # Tailwind + 组件样式
        ├── router.ts
        ├── routeTree.gen.ts         # TanStack Router 路由树
        ├── entry-client.tsx / entry-server.tsx / ssg.ts
        └── routes/
            ├── __root.tsx           # 根布局（导航+登录态）
            ├── index.tsx            # 工作台
            ├── login.tsx            # 登录页
            ├── switch-role.tsx      # 角色切换
            ├── projects.tsx         # 列表+筛选+批量
            ├── projects.$id.tsx     # 详情+办理+审计
            ├── projects.new.tsx     # 新建
            └── deadline.tsx         # 到期预警看板
```

---

**复查路径推荐**：登录 `consultant` → 创建测试单 → `trainer_ops` 审核 → `project_mgr` 复核同步 → `/deadline` 看逾期队列 → 列表批量操作 → 详情审计备注核对异常留痕 ✅
