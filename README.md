# 证券营业部-月底集中处理适当性记录系统

## 系统概述

适当性记录管理系统，用于证券营业部月底集中处理客户适当性记录。系统按岗位拆分页面视角：理财顾问负责初始队列（待分派），合规专员负责处理中段（已转办），营业部经理负责最终意见（已回访）。

### 核心业务规则

- 客户适当性、风险测评、业务开通三项必须对齐，否则适当性记录无法推进
- 系统入口固定为「证券营业部-月底集中处理适当性记录系统」
- 三段状态：待分派 → 已转办 → 已回访
- 异常日志仅作为证据，不能替代详情页的真实处理结果
- 到期预警分为三队：正常、临期、逾期，不混合展示
- 节点超时算到责任人，逾期批量推进逐条拦截

## 技术栈

- 前端：Remix + React + TypeScript + Vite
- 后端：NestJS + TypeScript + better-sqlite3
- 数据库：SQLite（本地运行）
- 前端端口：3002
- 后端端口：8002

## 快速启动

### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

### 2. 启动服务

```bash
# 启动后端（端口 8002）
cd backend
npm run start:dev

# 启动前端（端口 3002）
cd frontend
npm run dev
```

### 3. 访问系统

打开浏览器访问 http://localhost:3002

### 4. SQLite 初始化

数据库文件位于 `backend/data/suitability.db`，首次启动时自动创建并填充种子数据。如需重置：

```bash
cd backend
rm -f data/suitability.db
npm run start:dev
```

## 演示账号

| 角色 | 用户名 | 密码 | 姓名 |
|------|--------|------|------|
| 理财顾问 | advisor1 | password123 | 理财顾问张三 |
| 合规专员 | compliance1 | password123 | 合规专员李四 |
| 营业部经理 | manager1 | password123 | 营业部经理王五 |

## 四类适当性记录单据

### 1. 正常流转（5条）

记录编号 SR-2024-001 ~ SR-2024-005，覆盖待分派、已转办、已回访三种状态，三项证据齐全，到期日充足。

| 编号 | 客户 | 业务类型 | 状态 | 到期状态 |
|------|------|---------|------|---------|
| SR-2024-001 | 王明 | 创业板开通 | 待分派 | 正常 |
| SR-2024-002 | 李华 | 融资融券 | 待分派 | 正常 |
| SR-2024-003 | 张伟 | 科创板开通 | 已转办 | 临期 |
| SR-2024-004 | 赵芳 | 期权交易 | 已转办 | 临期 |
| SR-2024-005 | 陈刚 | 北交所开通 | 已回访 | 正常 |

### 2. 缺材料（4条）

记录编号 SR-2024-006 ~ SR-2024-009，缺少一项或多项证据材料，无法推进转办。

| 编号 | 客户 | 业务类型 | 缺失材料 | 状态 |
|------|------|---------|---------|------|
| SR-2024-006 | 刘洋 | 创业板开通 | 适当性评估材料 | 待分派 |
| SR-2024-007 | 周敏 | 融资融券 | 风险揭示书 | 已转办 |
| SR-2024-008 | 吴强 | 科创板开通 | 三项均缺失 | 待分派 |
| SR-2024-009 | 郑丽 | 期权交易 | 风险评估报告 | 已转办 |

### 3. 超时/逾期（3条）

记录编号 SR-2024-010 ~ SR-2024-012，到期日已过或即将到期。

| 编号 | 客户 | 业务类型 | 到期状态 | 负责人 |
|------|------|---------|---------|--------|
| SR-2024-010 | 孙磊 | 北交所开通 | 临期 | 理财顾问张三 |
| SR-2024-011 | 何静 | 创业板开通 | 逾期 | 合规专员李四 |
| SR-2024-012 | 马超 | 融资融券 | 逾期 | 理财顾问张三 |

### 4. 退回补正/状态冲突（3条）

记录编号 SR-2024-013 ~ SR-2024-015，包含退回记录和已完成记录。

| 编号 | 客户 | 业务类型 | 异常原因 | 状态 |
|------|------|---------|---------|------|
| SR-2024-013 | 黄英 | 科创板开通 | 被退回修改：业务开通材料缺失 | 待分派 |
| SR-2024-014 | 许杰 | 期权交易 | 无（正常转办中） | 已转办 |
| SR-2024-015 | 林芳 | 北交所开通 | 无（已完成） | 已回访 |

## 异常样例

### 越权操作

```bash
# 理财顾问尝试转办（只有合规专员可以转办）
curl -X PUT http://localhost:8002/records/3/status \
  -H "Authorization: Bearer <advisor_token>" \
  -H "Content-Type: application/json" \
  -d '{"action":"transfer","assigned_to":3,"version":2}'
# 返回: 403 UNAUTHORIZED_ROLE: 只有合规专员可以转办记录
```

### 重复提交

```bash
# 对同一记录提交两次相同操作（版本冲突）
curl -X PUT http://localhost:8002/records/1/status \
  -H "Authorization: Bearer <advisor_token>" \
  -H "Content-Type: application/json" \
  -d '{"action":"assign","assigned_to":2,"version":1}'
# 第二次提交返回: 409 VERSION_CONFLICT: 记录已被其他人修改，请刷新后重试
```

### 状态冲突

```bash
# 对已转办记录执行分派操作
curl -X PUT http://localhost:8002/records/3/status \
  -H "Authorization: Bearer <advisor_token>" \
  -H "Content-Type: application/json" \
  -d '{"action":"assign","assigned_to":2,"version":2}'
# 返回: 400 INVALID_STATUS: 只有待分派状态的记录可以分派
```

### 缺证据

```bash
# 证据不全时尝试转办
curl -X PUT http://localhost:8002/records/7/status \
  -H "Authorization: Bearer <compliance_token>" \
  -H "Content-Type: application/json" \
  -d '{"action":"transfer","assigned_to":3,"version":2}'
# 返回: 400 MISSING_EVIDENCE: 三项材料（适当性凭证、风险评估、业务开通）必须齐全才能转办
```

### 非当前处理人

```bash
# 不是当前处理人尝试操作
curl -X PUT http://localhost:8002/records/3/status \
  -H "Authorization: Bearer <other_compliance_token>" \
  -H "Content-Type: application/json" \
  -d '{"action":"transfer","assigned_to":3,"version":2}'
# 返回: 403 NOT_ASSIGNED_HANDLER: 您不是该记录的当前处理人
```

## API 接口

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /auth/login | 登录 |
| GET | /auth/me | 获取当前用户 |
| GET | /auth/users | 获取用户列表 |

### 适当性记录

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /records | 列表（支持 status/expiry_status 筛选） |
| GET | /records/:id | 详情（含附件、处理记录、审计备注、异常原因） |
| POST | /records | 创建（理财顾问） |
| PUT | /records/:id/status | 状态变更（assign/transfer/review/return） |
| PUT | /records/:id/correction | 提交补正 |
| POST | /records/:id/attachments | 添加附件 |
| POST | /records/:id/audit-notes | 添加审计备注 |

### 批量处理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /batch/process | 批量状态处理 |
| POST | /batch/overdue-advance | 逾期批量推进 |

### 到期预警

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /expiry/summary | 汇总统计 |
| GET | /expiry/normal | 正常记录 |
| GET | /expiry/near-expiry | 临期记录 |
| GET | /expiry/overdue | 逾期记录（含负责人） |

### 审计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /audit/record/:id | 记录审计轨迹 |
| GET | /audit/stats | 统计数据 |

## 数据库表结构

### users - 用户表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| username | TEXT | 用户名（唯一） |
| password | TEXT | bcrypt 哈希密码 |
| name | TEXT | 姓名 |
| role | TEXT | 角色（financial_advisor/compliance_officer/branch_manager） |
| created_at | TEXT | 创建时间 |

### suitability_records - 适当性记录表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| record_no | TEXT | 记录编号（唯一） |
| client_name | TEXT | 客户姓名 |
| client_id_no | TEXT | 客户身份证号 |
| business_type | TEXT | 业务类型 |
| status | TEXT | 状态（pending_assign/transferred/visited） |
| expiry_status | TEXT | 到期状态（normal/near_expiry/overdue） |
| expiry_date | TEXT | 到期日期 |
| assigned_to | INTEGER | 指派给 |
| current_handler | INTEGER | 当前处理人 |
| version | INTEGER | 版本号（乐观锁） |
| has_suitability_evidence | INTEGER | 有适当性凭证 |
| has_risk_assessment | INTEGER | 有风险评估 |
| has_business_opening | INTEGER | 有业务开通 |
| exception_reason | TEXT | 异常原因 |
| created_by | INTEGER | 创建人 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### attachments - 附件表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| record_id | INTEGER | 关联记录 |
| file_name | TEXT | 文件名 |
| file_type | TEXT | 文件类型 |
| category | TEXT | 分类（suitability/risk_assessment/business_opening/correction/other） |
| uploaded_by | INTEGER | 上传人 |
| uploaded_at | TEXT | 上传时间 |

### processing_records - 处理记录表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| record_id | INTEGER | 关联记录 |
| action | TEXT | 操作类型 |
| from_status | TEXT | 原状态 |
| to_status | TEXT | 新状态 |
| handler_id | INTEGER | 操作人 |
| handler_role | TEXT | 操作人角色 |
| comment | TEXT | 备注 |
| created_at | TEXT | 操作时间 |

### audit_notes - 审计备注表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| record_id | INTEGER | 关联记录 |
| author_id | INTEGER | 作者 |
| content | TEXT | 内容 |
| created_at | TEXT | 创建时间 |

### exception_reasons - 异常原因表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| record_id | INTEGER | 关联记录 |
| reason_type | TEXT | 类型（missing_material/timeout/return_correction/status_conflict/other） |
| description | TEXT | 描述 |
| created_by | INTEGER | 创建人 |
| created_at | TEXT | 创建时间 |
| resolved | INTEGER | 是否已解决 |
| resolved_at | TEXT | 解决时间 |

## 端口配置

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 3002 | Remix 开发服务器 |
| 后端 | 8002 | NestJS API 服务器 |

CORS 白名单：`http://localhost:3002`

## 项目结构

```
trae-123-2/
├── backend/                    # NestJS 后端
│   ├── data/                   # SQLite 数据库文件
│   ├── src/
│   │   ├── main.ts            # 入口，端口 8002，CORS 配置
│   │   ├── app.module.ts      # 根模块
│   │   ├── auth/              # 认证模块
│   │   ├── records/           # 适当性记录模块
│   │   ├── batch/             # 批量处理模块
│   │   ├── expiry/            # 到期预警模块
│   │   ├── audit/             # 审计模块
│   │   ├── database/          # 数据库服务
│   │   └── common/            # 公共模块（守卫、装饰器、DTO）
│   └── package.json
├── frontend/                   # Remix 前端
│   ├── app/
│   │   ├── routes/            # 页面路由
│   │   ├── components/        # 公共组件
│   │   ├── utils/             # 工具函数
│   │   └── styles/            # 全局样式
│   └── package.json
└── README.md
```
