# 新闻采编中心 - 月底集中处理选题单系统

选题申报 → 采访安排 → 稿件提交 全流程闭环管理。围绕「选题单」为核心，串联列表、详情、批量处理三条线，按角色实现权限控制、流转校验、证据核验与审计轨迹。

## 系统架构

| 层级 | 技术栈 | 端口 | 说明 |
| --- | --- | --- | --- |
| 前端 | **Angular 17 + Vite** + Angular Material | **3106** | 端口写死在 `frontend/vite.config.ts` 和 README |
| 后端 | **Rust + Poem** + SQLx (SQLite) | **8106** | 端口写死在 `backend/src/main.rs` 和 CORS 白名单 |
| 数据库 | **SQLite** | — | 文件位于 `backend/data/news.db`，首次启动自动建表+seed |

> ⚠️ **端口硬约束**：前端 `3106`、后端 `8106`。所有涉及端口的配置（`vite.config.ts` 的 `server.port` / `proxy`、`main.rs` 的监听端口与 CORS origin、以及本 README）均共用这组端口，不要修改为其它值。

---

## 一、快速启动

### 0. 环境准备

- Rust ≥ 1.75（`rustc --version`）
- Node.js ≥ 18（`node --version`）
- npm / pnpm / yarn 任选

### 1. 后端启动（端口 8106）

```bash
cd backend
cargo run
# 或生产模式：cargo run --release
```

- 首次启动会自动创建 `backend/data/` 目录及 `news.db`
- 自动建表（users / topics / attachments / process_records / audit_logs）
- 自动插入 **3 个演示账号 + 5 条选题单（覆盖 4 类演示场景） + 若干证据附件与处理记录**
- 成功后在 `http://localhost:8106/health` 可看到：
  ```json
  { "status": "ok", "service": "news-editorial-backend", "port": 8106 }
  ```

> 环境变量可选：`DATABASE_URL=sqlite:./data/news.db`、`BACKEND_PORT=8106`（不推荐修改）

### 2. 前端启动（端口 3106）

```bash
cd frontend
npm install        # 首次
npm run dev        # 启动：http://localhost:3106
```

Vite 已配置 `/api` 与 `/health` 代理到 `http://localhost:8106`。

### 3. 一键启动（可选）

根目录两个终端分别：

```bash
# 终端 1
cd backend && cargo run
# 终端 2
cd frontend && npm install && npm run dev
```

浏览器打开 http://localhost:3106 即可。

---

## 二、SQLite 初始化与重置

### 自动初始化
首次 `cargo run` 会执行：
1. `CREATE TABLE IF NOT EXISTS` 建 5 张核心表 + 6 个索引
2. `COUNT(*)` 判断是否为空，空库则插入 seed 数据（3 用户 + 5 题单 + 附件 + 处理记录）

### 重置演示数据

```bash
# 删除数据库文件（所有数据丢失）后重启后端即可重新 seed
rm -f backend/data/news.db
cd backend && cargo run
```

### 核心表结构

```
users              用户与角色
  └─ id, username, password, role(registrar|auditor|reviewer), display_name

topics             选题单主表（含乐观锁 version）
  └─ id, title, description, source, priority, category, status
     applicant_id/name, current_handler_id/name
     interview_deadline, submission_deadline, version

attachments        证据附件
  └─ attachment_type ∈ {选题申报, 采访安排, 稿件提交, 补充证据}

process_records    流转处理记录（每次状态变更写一条，审计使用）
audit_logs         细粒度审计轨迹（创建/查看/修改/附件/批量）
```

---

## 三、演示账号（密码 = 账号名 + `123`）

登录页也提供了**快速选择**下拉框与账号卡片，一键填。

| 角色（权限层级） | 账号 | 密码 | 显示名 | 核心操作权限 |
| --- | --- | --- | --- | --- |
| **选题登记员**（发起/补正） | `zhuli` | `zhuli123` | 采编助理-张明 | 新建选题申报、修改本人题单、退回补正时重新提交、上传「选题申报」证据 |
| **选题审核主管**（办理） | `bianji` | `bianji123` | 责任编辑-李华 | 派发领取、进度更新、退回补正、上传「采访安排」「稿件提交」、提交复核 |
| **新闻采编中心复核负责人**（复核归档） | `zongbian` | `zongbian123` | 总编室-王芳 | 复核全单、更新进度、退回、关闭、归档、重开、查看所有题单 |

> 🎯 顶部工具栏「切换角色」下拉框 **无需重新登录** 即可一键切换，方便测试接力流转。

---

## 四、四类演示单据（穿透测试建议）

启动后自动 seed，覆盖你要的**正常/缺材料/逾期/退回冲突**四大场景：

| # | 标题关键字 | 初始状态 | 当前处理人 | 预警 | 对应测试场景 |
| --- | --- | --- | --- | --- | --- |
| 🔵 1 | **地铁四号线开通一周年** | `待派发` | 空 | 正常 | **正常全链路流转**：登记员建单 → 责任编辑派发 → 上传采访/稿件 → 提交复核 → 总编室关闭 → 归档 |
| 🟠 2 | **乡村振兴示范村采访** | `处理中` | 责任编辑-李华 | 🔴 **采访已逾期** | **超时/逾期拦截**：批量派发/关闭会逐条失败 OVERDUE_BLOCKED；详情页可手动操作并留补正记录 |
| 🔴 3 | **智慧教育平台推广** | `退回补正` | 采编助理-张明 | 🟡 临期 | **退回补正/缺材料**：退回意见包含「缺少试点学校名单」；登记员补正后重新提交需指定审核主管 |
| 🟣 4 | **2024 年度经济发展成就** | `处理中` | 总编室-王芳 | 🔴 **稿件已逾期** | **状态冲突、版本冲突、越权测试**：已含三类齐全证据；提交旧 version 会触发 VERSION_CONFLICT；非处理人操作会触发 FORBIDDEN |
| —  | 文化遗产保护与活化 | `已关闭` | — | 正常 | （辅助）验证关闭后不可编辑、不可删附件、总编室可归档/重开 |

---

## 五、闭环流程说明

```
    [选题登记员]
        │  新建选题（带申报附件）
        ▼
   ┌───────────┐   派发领取（审核主管）
   │  待派发    │──────────────────────────┐
   └───────────┘                           ▼
         ▲                          ┌───────────┐
         │  重新提交（补正后）       │  处理中    │ ◄────┐
         │  指定下一审核主管        └───────────┘      │
         │                                │            │
   ┌───────────┐                    上传采访/稿件      │
   │ 退回补正  │◄────────退回补正    提交复核          │ 进度更新
   └───────────┘   审核主管/总编室     │               │
                                     ▼               │
                              （流转至总编室仍为"处理中"）
                                     │
                            审核通过：关闭（需三类证据齐全）
                                     │
                                     ▼
                              ┌───────────┐
                              │  已关闭    │── 归档 ──► 已归档
                              └───────────┘◄── 重开 ──┘
```

三个核心环节的**证据链**在提交复核/关闭时**后端强制核验**：
- **选题申报**：登记员上传申报表、领导批示、线索材料
- **采访安排**：审核主管上传行程表、联系人、采访提纲
- **稿件提交**：审核主管上传初稿/成稿、图文资料

缺失任意一类 → `VALIDATION_FAILED`，明确返回缺哪类。

---

## 六、异常入口 & 后端防御矩阵

### 6.1 前端「异常测试」页
导航栏「🐛 异常测试」入口内置 **6 组共 17 个可点击运行的测试用例**：
- 🚫 越权访问（3 条）：登记员提交复核 / 非处理人退回 / 登记员关单
- ⚡ 状态冲突（3 条）：已关闭派发 / 待派发直接关 / 退回缺处理人
- 🔄 版本冲突（3 条）：旧版本 process / 重复点击 / 旧版本 update
- 📎 证据核验（3 条）：缺稿件提复核 / 空处理意见 / 空标题新建
- 📚 批量异常（3 条）：逾期批量拦截 / 空 ids / 空 opinion
- 🎟️ 授权类（2 条）：无 token 访问 / 不存在 id

每个用例点击运行后实时显示「✅ 符合预期 / ❌ 未拦截 + 实际错误码+消息」。

### 6.2 直接调接口时的后端防御

直接 `curl` / Postman 调用时，后端做**多层拦截**，不依赖前端隐藏按钮：

| 防御维度 | 校验点 | 错误码 | 典型触发 |
| --- | --- | --- | --- |
| **角色层** | 按路由要求的角色判断 | `FORBIDDEN` | 登记员调用 submit_review；总编室以外调用 archive |
| **处理人层** | 仅当前 `current_handler_id` 可办理本人题单 | `FORBIDDEN` | 非处理人对他人名下处理中题单执行退回/关闭 |
| **状态机层** | 每种 action 限定可执行的源状态 | `STATE_CONFLICT` | 已关闭题单派发；待派发直接关闭 |
| **乐观锁层** | 请求 `version` 必须 == 当前 DB version | `VERSION_CONFLICT` | 重复点击、多标签页操作、过期提交 |
| **必填证据层** | submit_review / close 前 3 类附件计数 | `VALIDATION_FAILED` | 缺采访安排就提交复核 |
| **必填字段层** | 处理意见 opinion 非空；责任人有效 | `VALIDATION_FAILED` | 空 opinion 批量；重新提交不指定审核主管 |
| **逾期批量层** | 批量 dispatch/close 时逐条拦截逾期 | `OVERDUE_BLOCKED`（批量结果内） | 含逾期条目的批量关闭 |
| **鉴权层** | Authorization 缺失 / 过期 / 非法 token | `UNAUTHORIZED` | 不带头调 /api/topics |
| **存在性层** | id 查不到 → 404 | `NOT_FOUND` | GET /api/topics/000... |
| **附件操作层** | 仅上传人可删；已关/已归档不可删 | `FORBIDDEN` / `STATE_CONFLICT` | 删除他人附件 |

所有错误响应均为统一 JSON 结构：
```json
{ "code": "VERSION_CONFLICT", "message": "版本冲突: 当前=2,提交=1，请刷新后重试", "detail": null }
```

### 6.3 curl 示例（验证越权 / 状态冲突）
```bash
# 1. 登记员登录拿 token
TOKEN=$(curl -s -X POST http://localhost:8106/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"zhuli","password":"zhuli123"}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).token))')

# 2. 越权：登记员尝试关闭（预期 FORBIDDEN）
curl -X POST http://localhost:8106/api/topics/<任意topic-id>/process \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"action":"close","opinion":"越权关","version":1}'
```

---

## 七、到期预警规则

每条题单在列表 / 详情展示预警徽标，以**最严格的截止时间**（优先 `submission_deadline`，若无则 `interview_deadline`）判断：

| 级别 | 条件 | 徽标色 | 详情与批量行为 |
| --- | --- | --- | --- |
| 🟢 正常 | 距截止 > 48h | 绿色 | 正常流转 |
| 🟡 临期 | 距截止 ≤ 48h 且未过 | 橙色 | 提示，不拦截 |
| 🔴 逾期 | 已过截止 | 红色 | 详情页显责任人「⚠ 责任人节点超时」；**批量派发/关闭逐条 OVERDUE_BLOCKED 拦截**，不能整批放行 |

> 批量处理页会在操作配置区显式提示「本批逾期 N 条，将逐条拦截」，执行后明细单独列出原因并提供「前往详情补正」链接，详情处理时审计备注与异常原因会自动写入处理记录。

---

## 八、接口速览

| Method | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/login` | 登录，返回 `{token, user}` |
| GET | `/api/auth/me` | 取当前用户 |
| GET | `/api/users` | 用户列表（角色切换用） |
| GET / POST | `/api/topics` | 列表（支持 status/category/priority/keyword/warning/page/page_size） / 新建 |
| GET / PUT | `/api/topics/:id` | 详情 / 更新基本信息（带 version） |
| POST | `/api/topics/:id/process` | 办理（dispatch/return/progress/submit_review/close/archive/reopen + version 校验） |
| POST / DELETE | `/api/topics/:id/attachments[/:aid]` | 上传 / 删除附件（按角色+类型+上传人校验） |
| POST | `/api/topics/batch/process` | 批量办理（逐条返回 success + error_code + error_message + new_status） |
| GET | `/api/statistics` | 顶部看板统计（by_status + warning 三级 + my_pending） |
| GET | `/health` | 健康检查 |

---

## 九、目录结构

```
trae-123-6/
├── backend/
│   ├── Cargo.toml
│   ├── data/                    ← SQLite 文件目录
│   │   └── news.db              ← 首次启动自动生成
│   └── src/
│       ├── main.rs              ← 路由、CORS(3106白名单)、端口8106
│       ├── models.rs            ← 数据模型 + AppError
│       ├── db.rs                ← 建表 + seed 数据
│       ├── auth.rs              ← Token 编解码 + 角色校验
│       └── handlers.rs          ← 所有 API 处理逻辑
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts           ← 端口 3106 + /api 代理到 8106
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts / app.config.ts / app.routes.ts / app.component.ts
│       └── app/
│           ├── models/index.ts
│           ├── services/api.service.ts       ← Auth / User / Topic
│           └── pages/
│               ├── login.page.ts             ← 登录（演示账号下拉）
│               ├── layout.page.ts            ← 布局（角色切换、导航、统计）
│               ├── forbidden.page.ts         ← 403
│               ├── topic-list.page.ts        ← 列表（筛选、勾选、预警）
│               ├── topic-new.page.ts         ← 新建选题
│               ├── topic-detail.page.ts      ← 详情（Tab: 办理/附件/记录/审计）
│               ├── topic-batch.page.ts       ← 批量（逐条失败原因）
│               └── exception-demo.page.ts    ← 🧪 17 个异常用例
└── README.md
```

---

## 十、穿透测试建议清单（对照你的测试计划）

- ✅ **正常流转**：地铁四号线 → 责任编辑派发（自领或指定）→ 上传采访/稿件 → 提交复核 → 总编室关闭 → 归档。刷新列表/详情/统计操作记录对得上。
- ✅ **缺材料**：智慧教育平台（退回补正状态）→ 登记员补正标题并重新提交审核主管 → 责任编辑若没补证据直接提复核会被拦住；补完后顺利提交。
- ✅ **超时/逾期**：乡村振兴示范村 → 勾选到批量 → 执行批量派发/关闭 → 看明细中 OVERDUE_BLOCKED → 前往详情手动操作，处理意见填逾期原因，审计轨迹显示补正动作与异常原因。
- ✅ **退回补正 / 状态冲突**：对「已关闭」的文化遗产保护题单尝试派发，STATE_CONFLICT；尝试用过期 version 更新经济发展题单，VERSION_CONFLICT。
- ✅ **越权 / 接口直接调用**：参考 6.3 curl 用例，分别用三角色 token 越权操作关闭、归档、提交复核，都能被明确错误码拦住。
- ✅ **角色切换 / 列表筛选 / 详情办理 / 批量处理**：顶栏「切换角色」下拉可免登录切换，列表 5 个筛选项 + 预警筛选正常，详情 4 个 Tab 正常回写，批量结果逐条显成功/失败原因。

> 所有业务数据（选题单、附件、处理记录、审计备注、异常原因）均 SQLite 持久化，后端重启 / 前端刷新后数据一致。

---

祝测试顺利！📰
