# 财务共享中心 - 月底集中处理报销申请系统

服务于财务共享中心真实处理台账的报销管理系统。覆盖报销专员提交 → 费用会计审核 → 财务经理复核 → 费用会计付款确认的完整链路。支持按「待确认/异常/已复查」分组统计，核心页面连续办理流程，批量结果逐条返回成功/失败原因。

---

## 技术栈

| 层 | 选型 | 端口 |
|----|------|------|
| **前端** | SolidStart + TypeScript + Axios + Day.js | **3002** |
| **后端** | Node.js + Koa + better-sqlite3 + JWT | **8002** |
| **数据库** | SQLite（本地文件，自动初始化） | — |

> ⚠️ 端口约定：**前端 3002 / 后端 8002** 已写死在前端 baseURL、后端监听端口、CORS 白名单、启动命令中。请勿修改端口。

---

## 一、快速启动

### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端（新开一个终端）
cd frontend
npm install
```

### 2. 启动后端

```bash
cd backend
npm run dev      # 开发模式（nodemon 自动重启）
# 或
npm start        # 生产模式
```

启动后会自动：
- 创建 `backend/data/reimbursement.db` SQLite 数据库文件
- 执行建表 SQL（6 张表：`users / reimbursement_applications / attachments / process_records / audit_notes / exception_reasons`）
- **幂等插入演示数据**（首次启动插入，之后不重复）

启动成功日志：
```
报销系统后端服务已启动
监听端口: 8002
服务地址: http://localhost:8002
健康检查: http://localhost:8002/health
```

### 3. 启动前端

```bash
cd frontend
npm run dev      # 开发模式
# 或
npm run build && npm start   # 生产模式
```

访问：**http://localhost:3002**

---

## 二、SQLite 初始化说明

### 自动初始化
后端首次启动时 `src/db/index.js` 会自动：
1. 读取 `src/db/schema.sql` 执行建表（全部 `IF NOT EXISTS`，幂等）
2. 检查 `users` 表行数，为 0 时自动插入演示数据
3. 输出初始化日志到控制台

### 手动重置数据
如需清空并重新初始化演示数据：

```bash
cd backend
rm -rf data/reimbursement.db*   # 删除 db 文件 + WAL/SHM
npm run dev                     # 重启自动重建
```

### 数据库结构

```
reimbursement.db
├── users                       用户表（3种角色）
├── reimbursement_applications  报销申请主表（含version乐观锁、is_overdue、payment_evidence）
├── attachments                 附件表（evidence_type 区分发票/收据/合同等）
├── process_records             处理流水（每次操作一条，含版本号、证据快照）
├── audit_notes                 审计备注
└── exception_reasons           异常原因（5 类 reason_code，支持 resolved 状态 + rectify_note）
```

---

## 三、演示账号

密码统一为 **`123456`**

| 账号 | 姓名 | 角色 | role 值 | 权限 |
|------|------|------|---------|------|
| `clerk01` | 张三 | 报销专员 | `reimbursement_clerk` | 提交申请、补正重提、查看已退回/已完成 |
| `accountant01` | 李四 | 费用会计 | `expense_accountant` | 审核(pending_review→verifying)、付款确认(confirming→completed)、标记异常、退回、拒绝 |
| `manager01` | 王五 | 财务经理 | `finance_manager` | 复核(verifying→confirming)、高风险金额审批、退回、拒绝、标记异常 |

登录页有三个角色快捷切换按钮，点击一键登录。

---

## 四、演示数据 & 四类可试异常单据

首次启动自动插入 **8 条报销申请**，覆盖 4 类异常场景：

### 1️⃣ 正常流转（2 条）

| 编号尾号 | 标题 | 当前状态 | 下一个处理人 | 说明 |
|---------|------|----------|-------------|------|
| ...001 | 北京出差差旅费报销 3500元 | `pending_review` 待审核 | 费用会计李四 | 附件齐全（高铁+酒店），可完整走完全流程 |
| ...002 | 客户招待餐费报销 1800元 | `verifying` 待复核 | 财务经理王五 | 含审计备注（招待对象），已通过审核待经理复核 |

> **完整流程试跑：** clerk01 提交（已完成）→ accountant01 审核（操作 review）→ manager01 复核（verify，必须填意见）→ accountant01 付款确认（confirm，必须填付款凭证号如 P20240615001）

### 2️⃣ 缺材料（2 条）

| 编号尾号 | 标题 | 当前状态 | 异常说明 |
|---------|------|----------|----------|
| ...003 | 上海出差报销 4200元（缺材料） | `exception` 异常 | 只有高铁票，**缺少酒店发票**。费用会计可退回补正(return) 或 解除异常(rectify 需由报销专员) |
| ...004 | 办公用品采购 560元（缺材料） | `returned` 已退回 | **0 个附件**。报销 clerk01 补正前需上传至少 1 个附件 + 填写补正说明（≥5字），否则后端拦截报错 |

### 3️⃣ 超时 / 逾期（2 条）

| 编号尾号 | 标题 | 当前状态 | 预警 |
|---------|------|----------|------|
| ...005 | 广州出差报销 5800元（逾期） | `pending_review` 待审核 | 🔴 **已逾期 7 天**（is_overdue=1）。尝试批量推进时逐条拦截，需先标记异常 timeout 或额外填写逾期说明（overdue_note ≥10字）才能付款确认 |
| ...006 | 团建活动报销 2200元（逾期） | `verifying` 待复核 | 🔴 **已逾期 7 天**。财务经理 verify 被拦截，不可直接推进，需先 exception 标记逾期 |

### 4️⃣ 退回补正 / 状态冲突（2 条）

| 编号尾号 | 标题 | 当前状态 | 异常说明 |
|---------|------|----------|----------|
| ...007 | 深圳出差报销 3200元（v2 重提） | `pending_review` 待审核 | 版本号=2，初次 v1 被退回（缺市内交通+酒店），v2 已补充 3 个附件并解决退回异常。已 resolved，可正常审核 |
| ...008 | 大额招待费 15800元（v2 风险） | `returned` 已退回 | 版本号=2，单笔超 1 万，被经理退回需补充 3 项材料，**仍有 2 条未解决异常**（state_conflict + returned_rectify）。clerk01 重提前需同时上传附件+填写补正说明，重提后版本号升至 3，费用会计 review 时需核实退回意见（comment≥5字） |

---

## 五、核心流程

```
报销专员(clerk01)     费用会计(accountant01)   财务经理(manager01)    费用会计(accountant01)
     │                      │                      │                      │
     ├─ submit ───────────►│                      │                      │
     │  (待审核)            │                      │                      │
     │                      ├─ review ───────────►│                      │
     │                      │  (待复核)            │                      │
     │                      │                      ├─ verify ───────────►│
     │                      │                      │  (待确认)            │
     │                      │                      │                      ├─ confirm ──► 完成
     │                      │                      │                      │  (付款凭证必填)
     │                      │                      │                      │
     ├─◄──── return / exception / reject ◄────────┤◄─────────────────────┤
     │  退回补正(version+1)  标记异常              拒绝                    │
     └─ rectify ───────────►│                      │                      │
        (补正说明≥5字)
```

### 后端关键拦截逻辑

| 场景 | 拦截方式 | 错误信息示例 |
|------|----------|-------------|
| **付款确认缺付款凭证** | `confirm` 操作检查 `payment_evidence` ≥5字 | "付款确认必须填写付款凭证/流水号，缺付款记录时报销申请不得放行" |
| **逾期申请悄悄放行** | `confirm` 且 `is_overdue=1` 时额外要求 `overdue_note` ≥10字 | "逾期申请付款确认需额外填写逾期说明（overdue_note不少于10字），不可悄悄放行" |
| **复核跳过审核** | `verify` 操作检查必须有上一条 `review` 记录 | "缺少上一处理人（费用会计）的审核结果，不可越级复核" |
| **版本冲突** | 提交 `version` 必须等于数据库当前 `version` | "版本冲突，当前版本: 2，提交版本: 1，请刷新后重试" |
| **越权操作** | 操作角色必须匹配 `current_handler_role`，且非本人提交的才可审核 | "越权操作：当前处理人不是您" / "状态冲突：不能复核自己提交的申请" |
| **退回重提无补正** | `rectify` 必须有 ≥1 附件 + comment ≥5字 | "补正重提必须填写补正说明（不少于5字）" |
| **重提后有未解决异常** | v>1 审核时检查未解决 exception | "复核失败：存在2条未解决的异常原因，请先处理补正或退回" |
| **缺附件强推** | review 时若 attachment_count=0 拦截 | "缺证据：该申请无任何附件凭证，需退回或标记异常" |
| **逾期批量推进** | 批量逐条处理，逾期 + verify 单条失败，不影响其他 | 批量结果中每条分别标成功/失败原因 |

### 批量处理

```
批量接口: POST /api/applications/batch-process
Body: { items: [{id, action, comment, version, reason_code?, payment_evidence?, overdue_note?}] }

响应: {
  total: 5, success_count: 3, fail_count: 2,
  results: [
    { id: 1, success: true,  message: "操作成功", action: "review", to_status: "verifying" },
    { id: 2, success: false, message: "版本冲突，当前版本: 2，提交版本: 1，请刷新后重试", action: "review" },
    ...
  ]
}
```

前端「批量处理中心」选中申请后，可用操作取交集，结果逐条展示成功/失败原因，支持按「待确认/异常」Tab 筛选。

---

## 六、API 清单

所有接口（除 `/health` 和 `/api/auth/login` 外）需在 Header 携带 `Authorization: Bearer <token>`。

统一响应格式：`{ code: 0, data: {...}, message: "ok" }`，`code≠0` 表示失败。

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 健康检查（无需登录） |
| `POST` | `/api/auth/login` | 登录，返回 `{ token, user }` |
| `GET` | `/api/auth/me` | 获取当前用户 |
| `GET` | `/api/applications?status=` | 按当前角色查待办列表 + statistics 分组统计 + overdue + has_exception 计数 |
| `GET` | `/api/applications/:id` | 详情（含 attachments + process_records + exceptions + audit_notes） |
| `POST` | `/api/applications/:id/process` | **核心流转接口**：action/submit/review/verify/confirm/return/reject/exception/rectify，校验角色/处理人/状态机/版本号/证据/付款凭证/逾期说明 |
| `POST` | `/api/applications/batch-process` | 批量处理，items 逐条执行，返回每条 success + message |

---

## 七、目录结构

```
.
├── backend/
│   ├── package.json
│   ├── data/                          # SQLite 文件存放处（自动创建）
│   │   └── reimbursement.db
│   └── src/
│       ├── app.js                     # Koa 入口，监听 8002
│       ├── config.js                  # 端口/JWT/CORS 白名单（http://localhost:3002）
│       ├── db/
│       │   ├── index.js               # SQLite 连接 + 幂等建表 + 演示数据
│       │   └── schema.sql             # 6 张表 DDL
│       ├── middleware/
│       │   ├── auth.js                # JWT 校验
│       │   ├── role.js                # 角色白名单
│       │   └── validation.js          # 参数 schema 校验
│       ├── routes/
│       │   ├── index.js               # 路由聚合
│       │   ├── auth.js                # 登录
│       │   └── applications.js        # 申请 CRUD + 流转 + 批量
│       ├── services/
│       │   └── applicationService.js  # 状态机 + 事务 + 所有拦截规则
│       └── utils/
│           └── response.js            # 统一 {code, data, message}
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts                 # server.port = 3002
│   ├── app.config.ts                  # SolidStart 配置，port 3002
│   ├── tsconfig.json
│   ├── app/routes/
│   │   ├── index.tsx                  # 根路由，重定向
│   │   ├── login.tsx                  # 登录页（3 个角色快捷按钮）
│   │   ├── batch.tsx                  # 批量处理中心
│   │   └── applications/
│   │       ├── index.tsx              # 列表页（3 统计卡 + Tab 分组 + 筛选）
│   │       └── [id].tsx               # 详情办理页（连续办理核心）
│   └── src/
│       ├── App.tsx + entry-client + entry-server
│       ├── app.css                    # 全局样式（管理后台风格）
│       ├── api/
│       │   ├── client.ts              # Axios baseURL=http://localhost:8002/api
│       │   ├── auth.ts
│       │   └── applications.ts
│       ├── components/                # Layout/StatusBadge/WarningTag/FormModal/Timeline/BatchResult/AttachmentsList
│       ├── store/auth.ts              # 用户登录态 + localStorage
│       ├── types/index.ts             # snake_case 类型定义
│       └── utils/{status,role}.ts     # 状态流转 + 角色工具
│
└── README.md
```

---

## 八、使用建议（演示流程）

### 场景 A：完整走通一个正常流程
1. 登录 **accountant01 李四**，打开 `BX...001` 详情 → 点「审核」填意见 → 状态变为 `verifying`
2. 切换 **manager01 王五** → 打开同一条 → 点「复核」填意见（≥3字）→ `confirming`
3. 切换 **accountant01 李四** → 打开同一条 → 点「付款确认」填写 **付款凭证 = P20240600123** → `completed`
4. 回到列表，状态归入「已复查」分组

### 场景 B：演示逾期拦截
1. 登录 **manager01**，打开 `BX...006`（逾期 7 天的团建报销）
2. 直接点「复核」→ **被拦截**："该申请已逾期，请先标记异常并说明逾期原因"
3. 点「标记异常」→ 选 reason_code = `timeout`，填写逾期原因
4. 再试其他操作，或走批量：同时选中 005 + 006 一起批量 verify，结果中 005/006 会逐条失败并显示原因

### 场景 C：演示退回补正拦截
1. 登录 **clerk01**，打开 `BX...004`（办公用品 0 附件退回）
2. 点「补正重提」不填写内容直接提交 → **被拦截**："补正重提必须填写补正说明" / "退回重提前请至少上传一个附件凭证"

### 场景 D：演示批量处理 8 条混合结果
1. 登录 **accountant01** → 批量处理中心
2. 切到「待确认」Tab → **全选** → 点「批量审核」
3. 观察结果：001（待审核成功→verifying）、007（成功→verifying）、005（逾期但状态待审核可审核成功）、003（exception状态不支持review，失败）、002（verifying状态不支持review，失败）、006（verifying状态，失败）等，**逐条显示成功/失败原因**

---

© 财务共享中心报销系统
