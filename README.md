# 售电公司 - 月底集中处理售电合同单系统

围绕**责任链（客户经理→交易专员→风控经理）**，围绕**售电合同单**命名的列表/详情/批量/审计四件套，连续办理、状态回写、证据留痕、到期预警的全栈演示项目。

---

## 技术栈

| 层 | 技术 | 端口 | 监听地址 |
|---|---|---|---|
| 前端 | Solid.js + Vite | **3004** | http://localhost:3004 |
| 后端 | Python + Litestar | **8004** | http://localhost:8004 |
| 数据库 | SQLite（项目本地文件） | - | backend/data/electric_contracts.db |
| 跨域白名单 | http://localhost:3004 | - | 后端 CORS 配置与后端监听端口一致 |

> **端口约定**：前端请求地址、后端监听端口、CORS 白名单、README 启动命令**共用 3004 / 8004**，不写死其他端口。

---

## 目录结构

```
trae-123-4/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py            # Litestar 入口 + 全部路由 + CORS(3004) + 端口(8004)
│   │   ├── config.py          # settings.BACKEND_PORT=8004 / FRONTEND_PORT=3004
│   │   ├── db.py              # SQLite 连接 + 建表脚本
│   │   ├── workflow.py        # 责任链状态机 + 权限/版本/证据/材料校验
│   │   ├── repository.py      # 数据访问层 + 异常/审计/处理记录写入
│   │   └── schemas.py         # Pydantic 输入输出模型
│   ├── data/
│   │   └── electric_contracts.db   # SQLite 数据文件（seed 后产生）
│   ├── requirements.txt
│   └── seed.py                # 演示数据初始化
├── frontend/
│   ├── index.html
│   ├── vite.config.js         # Vite 端口 3004 + /api 代理到 8004
│   ├── package.json
│   └── src/
│       ├── main.jsx           # 路由入口
│       ├── App.jsx            # 布局 + 侧边栏 + 顶栏角色切换
│       ├── styles.css         # 全局样式
│       ├── store/
│       │   └── auth.jsx       # API 封装 + 登录/切换角色上下文
│       ├── components/
│       │   ├── BatchModal.jsx
│       │   ├── CreateContractModal.jsx
│       │   └── PatchModal.jsx
│       └── pages/
│           ├── Login.jsx
│           ├── Contracts.jsx          # 列表 + 筛选 + 批量入口
│           ├── ContractDetail.jsx     # 详情 7 个页签 + 办理操作区
│           ├── BatchResult.jsx        # 批量结果（逐条原因）
│           ├── Warnings.jsx           # 到期预警（正常/临期/逾期三队）
│           ├── Customers.jsx          # 业务区 - 用电客户
│           └── Pricing.jsx            # 业务区 - 报价测算
└── README.md
```

---

## 🚀 启动步骤（**严格使用 3004 / 8004 端口**）

### 1. 初始化后端

```bash
# (1) 进入后端目录，创建虚拟环境并安装依赖
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# (2) 初始化 SQLite + 插入 4 类演示单据 + 演示账号
python seed.py

# (3) 启动后端（监听 0.0.0.0:8004，CORS 白名单为 http://localhost:3004）
uvicorn app.main:app --host 0.0.0.0 --port 8004 --reload
```

✅ 启动后访问 http://localhost:8004/api/health 应返回：
```json
{"success": true, "service": "electric-contract-backend", "port": 8004}
```

---

### 2. 初始化前端

```bash
# 新开一个终端，进入前端目录
cd frontend
npm install
npm run dev          # 监听 0.0.0.0:3004
```

✅ 浏览器打开 http://localhost:3004 进入登录页。

---

## 👥 演示账号（登录页支持快速登录按钮）

| 用户名 | 密码 | 姓名 | 角色 | 流程职责 |
|---|---|---|---|---|
| `custmgr01` | `123456` | 张伟 | **客户经理** | 补齐材料、提交/重新提交 |
| `trade01` | `123456` | 李娜 | **交易专员** | 办理审核（待审核→待复核/已退回） |
| `risk01` | `123456` | 王强 | **风控经理** | 收口复核（待复核→已完成/重新提交） |
| `admin` | `admin` | 系统管理员 | admin | 查询用，无流程办理权限 |

> 页面顶栏有**角色切换按钮组**（张伟 / 李娜 / 王强），点击即可来回切换角色，无需重新登录。

---

## 📋 四类演示单据（seed.py 初始化完成）

### 1️⃣ 正常流转 - `HT2026CASE001` 京东方光电年度购售电合同
- **客户**：京东方光电科技有限公司（资料齐全）
- **报价**：已关联 PRC202601，已核准
- **当前位置**：风控经理 王强 待复核（V3）
- **状态**：`待复核` / `环节: risk_manager`
- **办理历史**：客户经理提交 → 交易专员审核通过 → **风控待复核**
- **演示用**：切到王强，做「复核完成」→ 合同变为 `已完成`，流程闭环。

### 2️⃣ 缺材料 - `HT2026CASE002` 美的集团北京工厂两年期购售电合同
- **问题点**：未关联报价测算、客户联系电话为空
- **当前位置**：客户经理 张伟 待提交
- **状态**：`待提交`
- **后端拦截**：点击提交会触发 `E_MISSING_MATERIAL`，异常类型=材料问题，写明缺项
- **演示用**：进入详情 → 从「用电客户/报价测算」页签或补正按钮补正 → 再提交

### 3️⃣ 超时/逾期 - `HT2026CASE003` 物美北京大区月度购售电合同
- **截止日期**：5 天前（已逾期）
- **责任人**：交易专员 李娜
- **当前位置**：交易专员 待审核
- **预警**：到期预警页 → 🔴 逾期队列，写明「已逾期 5 天，责任人李娜」
- **异常**：exception_records 表有 `E_DEADLINE_OVERDUE` 记录
- **演示用**：批量推进时，若无证据/角色不匹配仍会被单条拦截

### 4️⃣ 退回补正 / 状态冲突 - `HT2026CASE004` 比亚迪三年期战略购售电合同
- **历史**：风控经理驳回（V4），原因「合同期限条款表述不清晰，第 3 条第 2 款与附件不一致」
- **当前位置**：客户经理 重新提交
- **状态**：`重新提交`
- **详情里可见**：上一处理人意见（风控的退回意见）、风控退回附件、处理记录里的风控驳回、异常原因里的 `E_STATUS_ACTION_INVALID` 状态冲突
- **演示用**：客户经理补正 → 再提交 → 直接进入风控待复核（跳过交易专员）

---

## ⚠️ 异常样例（可在 SQLite `exception_records` 表查询）

| 合同单 | exception_type | exception_code | message | 触发方式 |
|---|---|---|---|---|
| HT2026CASE003 | **时限问题** | `E_DEADLINE_OVERDUE` | 合同单已逾期 5 天未完成交易专员审核 | 截止日早于今天自动判定 |
| HT2026CASE002 | **材料问题** | `E_MISSING_MATERIAL` | 提交前检测缺项：用电客户/报价测算缺项 | 客户经理提交缺材料的合同 |
| HT2026CASE004 | **状态问题** | `E_STATUS_ACTION_INVALID` | 风控阶段检测到状态冲突：期限条款与附件不一致 | 风控基于条款不一致驳回 |
| 任意 | **权限问题** | `E_ROLE_STAGE_MISMATCH` | 当前角色为客户经理，不能在交易专员环节操作 | 角色和环节不一致时操作 |
| 任意 | **权限问题** | `E_HANDLER_MISMATCH` | 当前处理人与登录用户不一致，越权操作已拦截 | 非指定处理人尝试办理 |
| 任意 | **状态问题** | `E_VERSION_OLD` | 提交的版本已过期，请刷新后重试 | 用旧版本号重复提交 |
| 任意 | **材料问题** | `E_EVIDENCE_MISSING` | 缺少必填证据：contract_scan / customer_authorization 等 | 未勾选必备证据就提交 |
| 任意 | **权限问题** | `E_TRADE_UNHANDLED` | 进入下一步前确认交易专员是否已处理 | approve 动作角色非交易专员 |
| 任意 | **权限问题** | `E_RISK_NO_PERMISSION` | 风控经理需具备复核权限：当前角色不具备 | finalize 动作角色非风控经理 |

---

## 🔐 后端拦截逻辑（绕开页面直调接口仍生效）

每次进入 `/api/contracts/process` 或 `/api/contracts/batch` 之前，后端依次执行：

1. **当前角色 X-User-Id** → 查用户表，确认角色存在
2. **角色 vs 环节** → `check_role_access`：客户经理只能在 customer_manager 环节操作，越权直接抛 `权限问题`
3. **当前处理人匹配** → `check_handler_match`：sale_contracts.current_handler_id 必须等于当前登录用户（退回/驳回动作除外）
4. **版本号一致** → `check_version`：请求 body 的 `version` 必须等于数据库的 `version`，拦截重复提交/旧版本提交
5. **状态 → 动作合法性** → `check_status_transition`：只有 STATUS_FLOW 里定义的迁移被允许，否则抛 `状态问题`
6. **必填证据** → `check_evidence`：按 `REQUIRED_EVIDENCE[stage][action]` 校验，缺项抛 `材料问题`
7. **客户 / 报价完整** → `check_customer_complete / check_pricing_complete`：缺项在 submit / resubmit 动作前拦截
8. **交易专员处理确认** → approve 动作必须由 role=trade_specialist 发起
9. **风控复核权限** → finalize 动作必须由 role=risk_manager 发起
10. **异常写入** → 任一校验不通过都写入 `exception_records`（含 exception_type/code/message/detail_json）

---

## 📊 SQLite 可查询 5 张核心表

```sql
-- 合同单主表（状态/版本/当前环节/上一处理人意见）
SELECT * FROM sale_contracts;

-- 附件列表（各环节上传的文件）
SELECT * FROM attachments;

-- 处理记录 / 审计轨迹（每一步动作 + 证据 + 版本）
SELECT * FROM processing_records ORDER BY id DESC;

-- 审计备注
SELECT * FROM audit_notes;

-- 异常原因（4 类异常：材料 / 权限 / 时限 / 状态）
SELECT * FROM exception_records ORDER BY id DESC;
```

刷新页面后：**列表、详情页签、顶部统计、到期预警、操作记录** 都查询同一张 SQLite，数据严格一致。

---

## 📦 批量结果（逐条说明成功/失败原因）

1. 在合同单列表勾选多个 → 点击 📦 批量处理
2. 选择动作 + 勾选证据 → 开始批量处理
3. 弹窗里逐条展示结果，例如：
   - `HT2026CASE001 ✅ 成功：待复核 → 已完成`
   - `HT2026CASE003 ❌ 失败/拦截：[时限问题|E_DEADLINE_OVERDUE] 合同单已逾期...`
4. 点「查看批量结果页」跳转 `/batch-result`，可以按成功/失败筛选，点「查看详情」进合同详情。
5. 逾期批量推进：后端**逐单拦截**，不会因为其他单据正常就自动推进逾期单。

---

## ⏰ 到期预警（正常 / 临期 / 逾期 三队不混）

- 🟢 **正常**：距离截止 > 3 天
- 🟡 **临期**：距离截止 ≤ 3 天
- 🔴 **逾期**：已过截止日（显示逾期天数，节点超时算到**具体责任人**）

页面支持两种分组：
- **按预警等级** → 三队分别在三张卡片里，不会混在一起
- **按责任人** → 按客户经理 / 交易专员 / 风控经理分组考核

---

## 🧩 业务区三模块联动

| 模块 | 入口 | 作用 | 联动 |
|---|---|---|---|
| 用电客户 | 侧边栏「👥 用电客户」 | 维护客户基础资料（5项必填） | 合同详情缺项时可从详情直接补正 |
| 报价测算 | 侧边栏「📊 报价测算」 | 维护电价/期限/预计电量/金额 | 合同关联报价后才能提交 |
| 售电合同单登记 | 侧边栏「📝 售电合同单登记」 | 合同登记 + 状态/证据/版本/审计 | 前两者完整后可推进 |

---

## 🗺️ 三段状态

```
客户经理阶段                  交易专员阶段              风控经理阶段
─────────────                ─────────────            ─────────────
待提交 ──提交──▶ 待审核 ──审核通过──▶ 待复核 ──复核完成──▶ 已完成
   ▲                │                      │
   │                │                      │
 重新提交 ◀──驳回── 已退回 ◀──审核退回      重新提交 ◀──复核驳回
   ▲                                                │
   └──────────────────── 重新提交 ──────────────────┘
                        (直接进入待复核，跳过交易)
```

> 所有状态迁移在 `backend/app/workflow.py` 的 `STATUS_FLOW` / `next_stage_after` 中集中定义。

---

## 🔗 主要 API（后端监听 8004，前端通过 /api 代理）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | 登录，返回 X-User-Id 对应 user 对象 |
| GET  | `/api/auth/users` | 用户列表（供角色切换用） |
| GET / PUT | `/api/customers[/:id]` | 用电客户列表 / 详情 / 更新 |
| GET / PUT | `/api/pricing[/:id]` | 报价测算列表 / 详情 / 更新 |
| GET | `/api/contracts` | 合同单列表（支持 status/stage/warning_level/keyword） |
| GET | `/api/contracts/stats` | 顶部统计（按状态 / 预警三队计数） |
| GET | `/api/contracts/overdue-responsibles` | 到期预警列表（含责任人） |
| GET | `/api/contracts/:id` | 详情（含 7 页签全部数据 + 缺项诊断） |
| POST | `/api/contracts` | 新登记合同单 |
| POST | `/api/contracts/process` | 单条办理（触发全部 10 项拦截） |
| POST | `/api/contracts/batch` | 批量办理（逐条拦截 + 返回逐条原因） |
| POST | `/api/contracts/:id/attachments` | 上传附件元信息 |

---

祝月底集中办理顺利！⚡
