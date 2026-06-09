# 职业技能学校 - 月底集中处理学员报名单系统

一个完整的学员报名单审批流转系统，支持角色权限控制、工作流状态管理、证据校验、批量处理和异常拦截。

## 技术栈

- **前端**: Astro 4 + React Islands (React 18)
- **后端**: Go 1.21 + Gin
- **数据库**: SQLite（内置，无需额外安装）
- **认证**: JWT Token

## 端口配置（全局统一）

| 服务 | 端口 | 地址 |
|------|------|------|
| 前端 Astro | 3002 | http://localhost:3002 |
| 后端 Gin API | 8002 | http://localhost:8002 |

前端请求地址、后端监听端口、CORS 白名单均统一使用以上端口配置，**请勿修改**。

---

## 快速启动

### 1. 启动后端服务

```bash
cd backend
go mod download
go run main.go
```

后端启动后：
- 自动在 `backend/data/vocational_school.db` 创建 SQLite 数据库
- 自动执行 Seed 数据初始化（仅首次）
- 监听 `:8002` 端口，CORS 允许 `http://localhost:3002`

### 2. 启动前端服务

```bash
cd frontend
npm install
npm run dev
```

前端启动后访问：http://localhost:3002

---

## 演示账号

| 用户名 | 密码 | 姓名 | 角色 | 权限 |
|--------|------|------|------|------|
| `registrar` | `123456` | 李登记员 | 学员报名登记员 | 发起/补正报名单、分派给审核主管 |
| `auditor` | `123456` | 王审核主管 | 学员报名审核主管 | 审核通过、退回补正 |
| `reviewer` | `123456` | 张复核校长 | 职业技能学校复核负责人 | 复核归档 |

登录页面提供"快速登录"按钮，一键切换角色。页面右上角也可随时切换角色。

---

## 工作流状态

```
待分派 ──分派──▶ 已转办 ──审核通过──▶ 已回访 ──复核归档──▶ 完成
   │                 │
   └──退回补正───┘    └──退回补正───▶ 待分派（带补正标记）
```

三段状态说明：
- **待分派**: 学员报名登记员处理阶段（发起、补正、分派）
- **已转办**: 学员报名审核主管处理阶段（审核通过、退回补正）
- **已回访**: 职业技能学校复核负责人处理阶段（复核归档）

---

## 四类演示单据

系统预置了 4 种学员报名单，覆盖不同业务场景：

| 学员 | 专业 | 当前状态 | 当前处理人 | 场景说明 | 预警级别 |
|------|------|----------|------------|----------|----------|
| 赵正常 | 数控技术 | 待分派 | 李登记员 | **正常流转**：资料齐全、班级已分配、缴费已确认，可正常推进 | 正常 |
| 钱材料 | 电子商务 | 待分派 | 李登记员 | **缺材料**：缺少学历证明，推进时会被证据校验拦截，停原队列 | 临期 |
| 孙逾期 | 汽车维修 | 已转办 | 王审核主管 | **超时逾期**：审核节点已逾期1天，推进时会被时限校验拦截 | 逾期 |
| 周补正 | 会计电算化 | 待分派 | 李登记员 | **退回补正/状态冲突**：班级未分配、缴费未确认，已被审核主管退回 | 正常 |

### 孙逾期 - 详细异常

该单据在审核主管处已逾期，页面会高亮显示责任人「王审核主管」。
- 尝试批量推进时会被**逐条拦截**，不会整批放行
- 详情页「异常记录」区可见：`overdue - 审核节点逾期：超过审核时限1天未处理`

### 周补正 - 详细异常

该单据已被审核主管退回补正：
- 处理记录中可见红色「补正动作」标记和退回原因
- 详情页「异常记录」区可见：`return_correction - 退回补正：班级分配和缴费确认未完成`

---

## 核心架构设计

### 后端统一校验引擎

后端通过 `ActionConfig` 统一配置所有操作的校验规则，**分派/审核通过/退回补正/复核归档/补正**共用同一套 5 重拦截逻辑：

| 操作 | 必填角色 | 必填状态 | 证据校验 | 时限校验 | 目标状态 | 目标处理人 |
|------|----------|----------|----------|----------|----------|------------|
| assign（分派） | 登记员 | 待分派 | ✅ | ✅ | 已转办 | 审核主管 |
| audit_pass（审核通过） | 审核主管 | 已转办 | ✅ | ✅ | 已回访 | 复核负责人 |
| audit_reject（退回补正） | 审核主管 | 已转办 | ❌ | ❌ | 待分派 | 登记员 |
| review_archive（复核归档） | 复核负责人 | 已回访 | ✅ | ✅ | 已回访 | — |
| supplement（补正） | 登记员 | 待分派 | ❌ | ❌ | 待分派 | 登记员 |

> **退回补正和补正动作不拦截证据和时限**：因为退回补正的业务语义就是因证据不全才退回，若仍校验证据会形成死锁。

### 5 重拦截顺序（统一执行）

所有操作（无论页面操作还是绕开页面直调 API）都按以下顺序校验，任一失败立即终止：

1. **版本冲突拦截**：请求 `version` 必须等于数据库当前版本 → HTTP 409
2. **处理人权限拦截**：当前用户必须是 `current_handler` 或匹配 `current_handler_role` → HTTP 403
3. **角色权限拦截**：当前角色必须匹配该操作的 `RequiredRole` → HTTP 403
4. **状态冲突拦截**：当前单据状态必须匹配该操作的 `RequiredStatus` → HTTP 400
5. **证据+时限拦截**（按需）：三项证据齐全 + 节点未逾期 → HTTP 400

### 异常持久化机制

异常记录写入使用**独立事务**（直接用主连接 `database.DB`，不参与业务事务）：

```
校验失败 → recordExceptionPersistence() 独立写入 exception_records → 返回错误 → 业务事务 Rollback
                                                                    ↓
                                                        异常记录不丢失！
```

即使后续业务事务回滚，异常记录已持久化，刷新页面后在详情页「异常记录」区可见。

### 前端数据互相回写机制

通过顶层 `globalRefreshCounter` + React `key` 变化实现组件强制重挂载，确保四个区域互相回写：

```
详情处理成功
    ↓
onProcessed() → triggerRefresh() → globalRefreshCounter++
    ↓
列表 key 变化 → 重挂载 → 重新拉取数据
侧栏证据摘要 key 变化 → 重挂载 → 重新拉取数据
批量结果区 key 变化 → 重挂载 → 刷新
    ↓
列表/详情/证据摘要/批量结果 全部同步最新数据
```

另外：
- **批量处理后**：自动调用 `refreshAll()` 刷新列表、统计和侧栏
- **角色切换后**：重新获取 token + 全局 counter 递增，所有组件按新角色可见范围重新拉取

---

## 异常拦截规则

后端在进入下一步操作前会进行多重校验，异常时停原队列并同步记录到页面和接口：

### 1. 越权拦截
- 校验条件：当前用户不是 `current_handler` 且角色不匹配 `current_handler_role`
- 错误返回：`权限不足，您不是当前处理人`（HTTP 403）
- 异常记录：`permission_denied`

### 2. 重复提交 / 版本冲突
- 校验条件：请求 `version` 与数据库当前版本不一致
- 错误返回：`版本冲突，当前数据已更新，请刷新后重试`（HTTP 409）
- 异常记录：`version_conflict`

### 3. 状态冲突
- 校验条件：当前状态不支持目标操作（如已回访状态不能再分派）
- 错误返回：`状态冲突：当前状态不是xxx`（HTTP 400）
- 异常记录：`status_conflict`

### 4. 缺证据拦截（关键校验）
进入下一步前必须校验三项证据，缺任何一项都停原队列：

| 证据项 | 校验字段 | 错误信息 | 异常类型 |
|--------|----------|----------|----------|
| 报名资料 | `materials_complete` + 附件数量≥4 | 报名资料不完整，缺少必要材料 | `missing_evidence` |
| 班级分配 | `class_assigned` | 班级未分配，请先完成班级分配 | `missing_evidence` |
| 缴费确认 | `payment_confirmed` | 缴费未确认，请先确认缴费 | `missing_evidence` |

### 5. 节点超时拦截
按当前角色校验对应节点时限：
- 登记员 → 校验 `assignment_deadline`
- 审核主管 → 校验 `audit_deadline`
- 复核负责人 → 校验 `review_deadline`

超过时限时返回：`分派/审核/复核节点已逾期`（HTTP 400），异常类型 `overdue`

### 6. 批量处理拦截
批量操作**不会整批放行**，逐条独立校验：
- 每条结果包含 `success` 布尔值和 `reason` 失败原因
- 失败的单据停原队列，成功的单据流转至下一节点
- 批量结果表格在页面上清晰展示每条的成功/失败原因

---

## 到期预警规则

| 级别 | 显示颜色 | 触发条件 | 责任人显示 |
|------|----------|----------|------------|
| 正常 (normal) | 蓝色 | 距离截止 > 2 天 | 正常显示 |
| 临期 (warning) | 黄色 | 距离截止 ≤ 2 天 | 正常显示 |
| 逾期 (overdue) | 红色 | 已超过截止时间 | 高亮显示「⚠ 超时：责任人姓名」 |

统计栏实时显示三个级别的单据数量。

---

## 核心功能

### 列表页（第一屏）
- **主队列**：学员报名单表格，支持按状态、预警级别筛选
- **证据摘要侧栏**：右侧实时展示当前选中单据的报名资料、班级分配、缴费确认状态
- **批量处理**：勾选多条单据后执行批量分派/批量审核通过，结果逐条展示
- **统计卡片**：全部单据、待分派、已转办、已回访、到期预警分布

### 详情页
- **处理流程时间线**：按顺序展示每一步处理记录，清晰可见流转顺序
- **校务负责人复核前**：可见招生顾问（登记员）和教务主管（审核主管）的全部记录
- **补正动作标记**：退回补正类操作显示红色标记
- **证据校验面板**：三项证据实时校验结果，不通过无法进入下一步
- **办理操作区**：根据当前角色和状态显示可执行按钮，非当前处理人禁止操作
- **异常记录区**：展示所有历史异常及其触发人、原因、是否已解决
- **审计备注**：所有角色均可添加备注，永久留痕

### 角色切换
- 页面右上角可快速切换三个角色，切换后自动刷新数据
- 列表、详情、操作按钮均根据当前角色动态变化

---

## 数据库表结构

SQLite 位于 `backend/data/vocational_school.db`，包含以下 6 张表：

| 表名 | 说明 |
|------|------|
| `users` | 用户账号（3 个演示账号） |
| `student_applications` | 学员报名单主表（含状态、处理人、版本、三项证据标记、时限、预警级别） |
| `attachments` | 报名资料附件（身份证、学历证明、照片、报名表等） |
| `processing_records` | 处理流水记录（每一步流转、版本号、是否补正动作） |
| `audit_notes` | 审计备注（所有角色可添加） |
| `exception_records` | 异常记录（越权、缺证据、逾期、版本冲突、退回补正等） |

可使用 SQLite 客户端（如 DB Browser for SQLite）打开查看数据，刷新页面后列表、详情、统计、操作记录保持一致。

---

## SQLite 数据重置

如需重新初始化演示数据：

```bash
cd backend
rm -rf data
go run main.go
```

---

## API 接口列表

所有接口（除登录外）需在请求头携带：`Authorization: Bearer <token>`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 登录，获取 token |
| GET | `/api/me` | 获取当前用户信息 |
| GET | `/api/users` | 获取所有用户列表（用于角色切换） |
| GET | `/api/applications` | 获取报名单列表，支持 `?status=` 和 `?urgency=` 筛选 |
| GET | `/api/applications/:id` | 获取报名单详情（含附件、记录、备注、异常、证据摘要） |
| POST | `/api/applications/:id/process` | 办理单据，参数：`{ action, remark, version }` |
| POST | `/api/applications/batch` | 批量处理，参数：`{ ids: [], action, remark }` |
| POST | `/api/applications/:id/notes` | 添加审计备注 |
| GET | `/api/statistics` | 获取统计数据 |

### process 接口的 action 取值

| action | 角色 | 触发状态 | 说明 |
|--------|------|----------|------|
| `assign` | registrar | 待分派 | 分派至审核主管 |
| `audit_pass` | auditor | 已转办 | 审核通过至复核 |
| `audit_reject` | auditor | 已转办 | 退回补正至登记员 |
| `review_archive` | reviewer | 已回访 | 复核归档 |
| `supplement` | registrar | 待分派 | 补正材料标记 |

---

## 异常样例（绕开页面调接口时的测试）

使用 curl 或 Postman 测试后端拦截：

```bash
# 1. 登录获取 token
TOKEN=$(curl -s -X POST http://localhost:8002/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"registrar","password":"123456"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# 2. 测试版本冲突（传入错误的 version）
curl -X POST http://localhost:8002/api/applications/<id>/process \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"assign","version":999,"remark":""}'
# 返回: {"error":"版本冲突，当前数据已更新，请刷新后重试","success":false}

# 3. 测试缺材料（钱材料的单据）
curl -X POST http://localhost:8002/api/applications/<钱材料的id>/process \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"assign","version":1,"remark":""}'
# 返回: {"error":"报名资料不完整，缺少必要材料","success":false}

# 4. 测试越权（用登记员 token 操作审核主管的单据）
curl -X POST http://localhost:8002/api/applications/<孙逾期的id>/process \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"audit_pass","version":2,"remark":""}'
# 返回: {"error":"权限不足，您不是当前处理人","success":false}
```

所有异常都会同步写入 `exception_records` 表，可在详情页「异常记录」区查看。
