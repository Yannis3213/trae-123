# 三甲医院医务部 - 会诊申请单月底集中处理系统

基于 **Astro + React Islands** 前端和 **Go Fiber + SQLite** 后端的会诊申请单月底集中处理系统。

## 端口约定（全局统一）

| 服务 | 端口 | 配置位置 |
|------|------|----------|
| 前端 Astro Dev Server | **3001** | `frontend/astro.config.mjs`, `frontend/package.json` scripts |
| 后端 Go Fiber | **8001** | `backend/internal/config/config.go` |
| 前端 API 请求地址 | http://localhost:8001/api | `frontend/.env`, `astro.config.mjs` vite define |
| 后端 CORS 白名单 | http://localhost:3001 | `backend/internal/config/config.go` |

## 启动方式

### 1. 启动后端（端口 8001）

```bash
cd backend
go mod tidy
go run ./cmd/server
```

首次启动时 SQLite 会自动：
- 在 `backend/data/consultation.db` 创建数据库文件
- 自动初始化所有数据表（users / consultations / attachments / process_records / abnormal_records / audit_notes）
- 自动灌入演示账号和四类演示单据

访问健康检查：http://localhost:8001/api/health

### 2. 启动前端（端口 3001）

```bash
cd frontend
npm install
npm run dev
```

访问：http://localhost:3001

## 演示账号

所有演示账号密码均为 `123456`：

| 用户名 | 角色 | 姓名 | 对应岗位 | 可见模块 |
|--------|------|------|----------|----------|
| `registrar1` | registrar | 张秘书 | 会诊申请登记员（科室秘书） | 登记、工作台、预警、台账 |
| `auditor1` | auditor | 李质控 | 会诊申请审核主管（质控医生） | 过程核验、工作台、预警、台账 |
| `reviewer1` | reviewer | 王主任 | 三甲医院医务部复核负责人 | 复核归档、工作台、预警、台账 |

登录页底部可一键切换填充。

## 四类演示单据（首次启动自动灌入）

用于覆盖穿透测试的四种典型场景：

| 病案号 | 患者 | 场景 | 当前状态 | 当前阶段 | 紧急度 | 可用于测试 |
|--------|------|------|----------|----------|--------|-----------|
| P001 | 张三 | 正常流转 | 待确认 | 登记阶段 | 正常 | 正常登记→提交→核验→复核→归档全流程 |
| P002 | 李四 | 缺材料异常 | 异常 | 核验阶段 | 临期 | 核验异常/退回补正、补正后重新提交 |
| P003 | 王五 | 超时/逾期 | 已复查 | 复核阶段 | 逾期 | 节点超时算责任、逾期批量推进逐条拦截 |
| P004 | 赵六 | 临期预警 | 待确认 | 核验阶段 | 临期 | 到期预警、临期提醒 |

## 三段状态定义

| 状态 Key | 显示 | 含义 |
|----------|------|------|
| `pending` | 待确认 | 初始状态或等待下一节点确认 |
| `abnormal` | 异常 | 缺少材料、证据不足、退回补正等 |
| `rechecked` | 已复查 | 质控已核验通过，待医务部复核 |
| `archived` | 已归档 | 医务部最终归档（终态，不可再修改） |

## 三个业务模块与责任链

```
[会诊申请登记员]  →  会诊申请单登记（Stage: registration）
        ↓ submit（必须提交证据，后端校验）
[会诊申请审核主管] →  过程核验（Stage: verification）
        ↓ verify_pass / verify_fail / return（异常必填原因）
[医务部复核负责人] →  复核归档（Stage: review）
        ↓ review_pass / archive（必须使用证据）
       归档完成
```

- **退回补正**：核验或复核阶段可退回到上一阶段，状态强制置为「异常」，必须填写原因
- **医务部主任复核前**：详情页可看到科室秘书、质控医生全部处理记录和异常原因
- **状态冲突**：后端按 version 乐观锁拦截，前端详情页显示当前版本并在提交时带上 expected_version

## 异常入口与处理规则

### 前端触发入口
1. 详情页 → 「核验异常」/「退回补正」/「复核退回」按钮
2. 列表页 → 批量处理 → 选择异常/退回动作
3. 登记阶段补正提交时可登记补正原因

### 后端强制规则
- 异常只能通过 **补正（correct）** 或 **退回（return）** 流程修复，不允许静默跳过
- 任何归档动作前必须状态为 `rechecked`（已复查）
- 任何处理动作必须使用 `evidence_used`（必须从已登记 evidence_list 中选择，后端逐条比对）
- 重复提交：同版本二次提交返回版本冲突
- 越权：当前角色与当前阶段不匹配返回 403

## 后端接口一览（基础路径 `/api`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/auth/login` | 公开 | 登录，返回 JWT |
| GET  | `/auth/me` | 已登录 | 当前用户信息 |
| GET  | `/statistics` | 已登录 | 统计概览 |
| POST | `/consultations` | registrar | 创建会诊申请单 |
| GET  | `/consultations` | 已登录 | 列表（按角色自动过滤），支持 status/stage/urgency/department/patient_id/keyword/is_archived |
| GET  | `/consultations/:id` | 已登录 | 详情（含处理记录、异常记录、附件、审计备注） |
| PUT  | `/consultations/:id?version=N` | registrar | 修改基本信息（乐观锁） |
| POST | `/consultations/:id/process` | 对应角色阶段 | 处理动作（submit/correct/verify_pass/verify_fail/return/review_pass/review_fail/archive），body 带 expected_version |
| POST | `/consultations/batch` | 对应角色阶段 | 批量处理，返回逐条成功/失败原因 |
| POST | `/consultations/:id/notes` | 已登录 | 添加审计备注 |
| POST | `/consultations/:id/attachments` | 已登录 | 添加附件登记 |
| GET  | `/ledger` | 已登录 | 会诊申请单台账（已归档，含排班/反馈核验状态） |
| GET  | `/warnings` | 已登录 | 到期预警（三列表：normal/warning/overdue） |
| GET  | `/health` | 公开 | 健康检查 |

## 穿透测试建议用例

1. **正常流转**：registrar1 登录 → 新建 P001 类型单据 → 提交审核 → 切 auditor1 → 核验通过 → 切 reviewer1 → 复核通过 → 归档 → 台账查看
2. **缺材料**：auditor1 对 P002 执行「核验异常」填写缺材料 → 切 registrar1，详情页看到异常记录 → 执行「补正提交」补充证据 → 重新流转
3. **超时/逾期**：打开到期预警页 → 逾期 Tab 看到 P003 → 列表批量勾选 → 批量推进（后端逐条拦截，核对版本、状态、权限）
4. **退回补正 + 状态冲突**：两个浏览器窗口用 auditor1 同时打开 P002 → 窗口A 执行退回 → 窗口B 仍点核验通过 → 返回版本冲突
5. **越权调用**：用 registrar1 的 token 直接调 `/consultations/batch` 执行 verify_pass → 返回 403
6. **缺证据请求**：调 process 接口不传 evidence_used → 返回「必须提供处理证据」
7. **旧版本提交**：expected_version 填小于当前 version → 返回「版本冲突」

## SQLite 持久化实体

- `consultations`：会诊申请单主表，含 version 乐观锁字段
- `process_records`：处理记录时间线，每条记录 from_status / to_status / handler / evidence_used / version
- `abnormal_records`：异常原因台账，含是否解决
- `attachments`：附件与证据类型登记
- `audit_notes`：审计备注
- `users`：用户与角色

所有表通过 `consultation_id` 关联，刷新页面后列表、详情、统计、操作记录保持一致。
