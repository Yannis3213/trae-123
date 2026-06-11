# 客服呼叫中心 - 月底集中处理客服工单系统

客服工单流转系统，验证「客服工单能否带着版本冲突推进」。支持正常流转、缺材料、超时/逾期、退回补正/状态冲突四类场景。

## 技术栈

| 层 | 技术 | 端口 |
|---|---|---|
| 前端 | Vue 3 + Vite | 3004 |
| 后端 | Rust + Poem + poem-openapi | 8004 |
| 数据库 | SQLite（本地文件） | - |

**端口要求**：前端端口 3004、后端端口 8004 已同时写入前端请求地址（Vite proxy）、后端监听端口、CORS 白名单，请勿修改。

## 目录结构

```
.
├── frontend/                 # Vue 3 + Vite 前端
│   ├── src/
│   │   ├── api/index.js      # 后端 API 封装（请求地址统一走 /api → http://localhost:8004）
│   │   ├── stores/auth.js    # 登录态 & 角色切换（localStorage）
│   │   ├── router/index.js   # 路由：登录、工单列表、工单详情
│   │   ├── components/Header.vue   # 顶部栏（角色切换）
│   │   └── views/
│   │       ├── Login.vue            # 登录页
│   │       ├── TicketList.vue       # 工单列表（筛选/队列/预警/批量处理）
│   │       └── TicketDetail.vue     # 工单详情（附件/处理/退回/审计/异常）
│   ├── vite.config.js         # dev.port=3004, proxy /api → http://localhost:8004
│   └── package.json
├── backend/                  # Rust + Poem 后端
│   ├── src/
│   │   ├── main.rs           # 监听 0.0.0.0:8004，CORS 白名单 localhost:3004
│   │   ├── api.rs            # OpenAPI handlers（认证/工单/附件/审计/异常）
│   │   ├── db.rs             # SQLite 初始化/种子数据/全部数据访问层
│   │   ├── models.rs         # 角色、状态、优先级、工单、附件、处理记录等类型
│   │   └── error.rs          # 统一错误（越权/冲突/缺证据/版本冲突等）
│   ├── data/                 # SQLite 数据目录（启动后自动生成 cs_tickets.db）
│   └── Cargo.toml
└── README.md
```

## 启动步骤

### 1. 启动后端（端口 8004）

```bash
cd backend
cargo run
```

- 首次启动会自动创建 `backend/data/cs_tickets.db`，并执行建表 + 演示数据初始化。
- Swagger UI：http://localhost:8004/swagger
- OpenAPI spec：http://localhost:8004/openapi.json

### 2. 启动前端（端口 3004）

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3004 即可登录使用。

---

## SQLite 初始化说明

后端启动时自动执行：
1. 连接 `sqlite:./data/cs_tickets.db`（相对 backend 目录）。
2. 若表不存在则执行建表 SQL（users、tickets、attachments、processing_records、audit_remarks、exception_reasons）。
3. 若 users 表为空则写入 **6 个演示账号 + 4 条工单样例 + 异常原因 + 处理记录**。

需要重置数据库时，删除 `backend/data/cs_tickets.db` 再重启后端即可。

---

## 演示账号（密码均为 `123456`）

| 用户名 | 角色 | 岗位说明 | 可见队列 |
|---|---|---|---|
| `registrar` | 客服登记员 | 发起/补正工单 | 自己负责或当前处理的工单 |
| `agent` | 客服坐席 | 来电登记、回访关闭 | 自己负责或当前处理的工单 |
| `supervisor` | 客服审核主管 | 派单、签收、退回补正 | 来电登记/问题派单/异常回传 |
| `qa_supervisor` | 质检主管 | 质检签收 | 来电登记/问题派单/异常回传 |
| `reviewer` | 复核负责人 | 复核归档/退回 | 全部工单 |
| `cs_manager` | 客服经理 | 查看全局统计与异常 | 全部工单 |

> 登录后可在顶部右侧 **切换身份** 下拉框快速体验不同角色的视图差异与按钮差异。

---

## 四类异常样例（启动即存在）

| 样例 | 工单 ID | 标题 | 当前状态 | 异常标签 | 用途 |
|---|---|---|---|---|---|
| 🟢 正常流转 | `t_normal` | 【正常】客户咨询产品退换货流程 | 待签收 | - | 走通「待签收 → 来电登记 → 问题派单 → 回访关闭 → 已归档」全流程 |
| 🟡 缺材料 | `t_missing` | 【缺材料】客户退款申请缺少凭证 | 异常回传 | 缺材料 | 登记员上传附件后补正提交；或主管再次退回 |
| 🔴 逾期 | `t_overdue` | 【逾期】客户投诉物流超时未送达 | 问题派单 | 逾期、物流异常 | 截止时间已过 1 天，列表显示红色「逾期」标签，无法整批放行 |
| 🟠 退回补正/状态冲突 | `t_returned` | 【退回】质量问题工单被退回补正 | 异常回传 | 退回补正 | 已有退回记录，验证补正重提、版本冲突、重复提交校验 |

---

## 业务流程与按钮权限

主工作区围绕三个节点：**来电登记 → 问题派单 → 回访关闭**，状态值同时显示「待签收 / 异常回传 / 签收完成」。

```
待签收 ──登记员/坐席──▶ 来电登记
                            │
              ┌─主管/质检─┐ │ ┌──主管───┐
              ▼           │ │ ▼         ▼
         签收完成      问题派单      异常回传
              │           │ │           │
              └─复核──┐   │ │ └─登记员补正┘
                      ▼   │ │
                   已归档  │ │
                      ▲   │ │
                      └─复核(回访关闭)
                      └─主管退回(异常回传)
```

**后端校验点（提交时全部拦截）**：
1. **越权**：当前用户角色不在该状态的可操作角色列表中 → 403。
2. **处理人不匹配**：`current_handler_id != user.id` → 409 状态冲突。
3. **状态冲突**：当前状态到目标状态的流转路径不合法 → 409。
4. **版本冲突**：请求中的 `version != 工单.version` → 409 版本冲突。
5. **缺证据**：从异常回传/来电登记/问题派单推进时必须存在至少 1 个附件 → 422 缺少证据。
6. **重复提交**：由版本号 + 事务天然防止。
7. **批量处理逐条拦截**：不会整批放行，每条单独返回 `success: true/false + message`，失败的工单会保留在待处理列表。

**逾期或缺资料的工单**：始终保留在「待处理」列表中（统计接口亦计入 pending/exception），只有状态真正流转完成后才离开。

---

## 到期预警规则

列表中 `expiry_status` 字段由后端按 deadline 实时计算：

| 剩余时间 | 状态 | 样式 |
|---|---|---|
| ≥ 24 小时 | 正常 | 绿色 |
| 0 ~ 24 小时 | 临期 | 黄色 |
| < 0（已过截止时间） | 逾期 | 红色 |

节点超时会在列表与详情页同时突出显示「责任人」与「当前处理人」。

---

## 审计轨迹

所有状态流转、退回、备注、异常登记都会写入：
- `processing_records`：动作、from→to 状态、操作人、角色、备注
- `audit_remarks`：独立的审计备注（详情页 Tab 可新增）
- `exception_reasons`：异常类型、描述、报告人、是否解决

列表、详情、统计、操作记录全部围绕 `客服工单` 命名，刷新后数据一致。

---

## 相关文件

- 后端入口 [main.rs](backend/src/main.rs) （端口 8004 + CORS 白名单）
- 前端配置 [vite.config.js](frontend/vite.config.js) （端口 3004 + API 代理）
- 状态流转与校验 [db.rs](backend/src/db.rs)（`validate_transition` 函数）
- 批量处理逻辑 [db.rs](backend/src/db.rs)（`batch_process_tickets` 函数）
- 工单详情页 [TicketDetail.vue](frontend/src/views/TicketDetail.vue)
- 工单列表页 [TicketList.vue](frontend/src/views/TicketList.vue)
