# 软件外包项目组 - 月底集中处理需求交付单系统

## 项目概述

面向软件外包项目组的需求交付单集中处理系统，支持多角色协同办理需求交付单的全流程：需求确认 → 排期评估 → 交付验收 → 复核 → 归档。

## 端口约定

| 服务 | 端口 | 地址 |
|------|------|------|
| 前端（React + Vite） | 3002 | http://localhost:3002 |
| 后端（Django Ninja） | 8002 | http://localhost:8002 |

前端请求地址、后端监听端口、CORS 白名单统一使用以上端口。

## 技术栈

- **前端**：React 18 + Vite 5 + Ant Design 5 + React Router 6 + Axios + Day.js
- **后端**：Python 3.9+ + Django 4.2 + Django Ninja + SQLite

## 目录结构

```
trae-123-2/
├── backend/                 # Django Ninja 后端
│   ├── manage.py            # 默认监听 0.0.0.0:8002
│   ├── requirements.txt
│   ├── app/                 # Django 项目配置
│   │   ├── settings.py      # CORS 白名单: http://localhost:3002
│   │   └── urls.py
│   └── api/                 # 业务模块
│       ├── models.py        # 数据模型
│       ├── schemas.py       # Pydantic Schema
│       ├── api.py           # REST API
│       ├── permissions.py   # 角色权限
│       ├── utils.py         # 状态机/版本/证据校验
│       └── seed.py          # 演示数据初始化
├── frontend/                # React + Vite 前端
│   ├── package.json
│   ├── vite.config.js       # 端口 3002，代理 /api → :8002
│   └── src/
│       ├── api.js           # Axios 配置（baseURL: http://localhost:8002/api）
│       ├── context/         # AuthContext
│       ├── components/      # 业务组件
│       ├── pages/           # 页面
│       ├── utils/           # 常量和工具函数
│       └── styles/          # 全局样式
└── README.md
```

## 快速启动

### 一、后端启动（端口 8002）

```bash
cd backend

# 1. 安装依赖
pip3 install -r requirements.txt

# 2. 生成数据库迁移
python3 manage.py makemigrations api

# 3. 执行迁移（创建 SQLite 数据库 db.sqlite3）
python3 manage.py migrate

# 4. 初始化演示数据（6个账号 + 4类演示单据 + 异常样例）
python3 api/seed.py

# 5. 启动服务（默认监听 0.0.0.0:8002）
python3 manage.py
# 或显式指定：python3 manage.py runserver 0.0.0.0:8002
```

启动后可访问：
- API 文档（Swagger）：http://localhost:8002/api/docs
- 健康检查：http://localhost:8002/api/orders

### 二、前端启动（端口 3002）

```bash
cd frontend

# 1. 安装依赖
npm install

# 2. 启动开发服务器（端口 3002）
npm run dev
```

启动后访问：http://localhost:3002

## 演示账号（密码均为 test123456）

| 用户名 | 角色 | 权限说明 |
|--------|------|----------|
| `project_assistant` | 项目助理 | 建单、交付验收提交 |
| `delivery_registrar` | 需求交付登记员 | 发起/补正需求确认 |
| `dev_lead` | 开发负责人 | 推进、排期评估提交 |
| `audit_supervisor` | 需求交付审核主管 | 办理审核、推进、批量核验 |
| `delivery_manager` | 交付经理 | 复核、推进、归档 |
| `review_leader` | 软件外包项目组复核负责人 | 复核归档 |

## 角色权限与流程

```
项目助理/登记员 建单 → [待核验]
    ↓
登记员 提交需求确认 → [需求确认待审核]
    ↓
审核主管 审核需求确认
    ├─ 通过 → [需求确认已审核] → 开发负责人 提交排期评估 → [排期评估待审核]
    │                                    ↓
    │                              审核主管 审核排期评估
    │                                  ├─ 通过 → [排期评估已审核] → 项目助理 提交交付验收 → [交付验收待审核]
    │                                  │                                        ↓
    │                                  │                                  审核主管 审核交付验收
    │                                  │                                      ├─ 通过 → [待复核] → 复核负责人/交付经理 复核 → [复核完成] → 交付经理 归档 → [已归档]
    │                                  │                                      └─ 驳回 → [核验失败] + 异常原因（停原队列补正）
    │                                  └─ 驳回 → [核验失败] + 异常原因
    └─ 驳回 → [核验失败] + 异常原因
```

## 四类演示单据

| 单据编号 | 类型 | 当前状态 | 说明 |
|----------|------|----------|------|
| XQJF202606010001 | 正常流转 | 待复核 | 三大模块齐全，等待复核负责人复核 |
| XQJF202606010002 | 缺材料 | 待核验 | 新建单据，需求确认截止日临近（2天） |
| XQJF202606010003 | 超时逾期 | 核验失败 | 排期评估缺少资源分配方案，已逾期2天，责任人：开发负责人 |
| XQJF202606010004 | 退回补正/状态冲突 | 排期评估已审核 | 需求确认和排期各被驳回1次后补正通过，当前等待交付验收 |

## SQLite 数据模型

| 表 | 说明 |
|----|------|
| `api_user` | 用户表（含角色字段） |
| `api_requirementdeliveryorder` | 需求交付单主表（含状态、版本、三大模块状态和证据、截止日期等） |
| `api_attachment` | 附件表（分模块存储） |
| `api_processingrecord` | 处理记录表（完整状态流转审计） |
| `api_auditnote` | 审计备注表 |
| `api_exceptionreason` | 异常原因表（含模块类型、原因、处理人、解决状态） |

## 核心校验机制

### 状态变更权限判断
状态变更时自动按当前角色判断是否有权操作对应状态的单据，越权返回 403。

### 版本控制（乐观锁）
每次更新订单 `version` 自增 +1，提交时校验前端传入的 `version` 是否与数据库一致，不一致返回 409（版本冲突），防止重复提交和旧版本覆盖。

### 证据校验
三大模块提交时自动检查必填证据字段：
- **需求确认**：`confirmation_document`（确认文档）、`stakeholder_signature`（干系人签字）
- **排期评估**：`schedule_plan`（排期计划）、`resource_allocation`（资源分配）
- **交付验收**：`delivery_report`（交付报告）、`acceptance_certificate`（验收证书）

缺少必填证据返回 400（`缺少必填证据字段: xxx`）。

### 异常拦截
审核驳回或状态冲突时：
1. 订单状态回退到「核验失败」
2. 对应模块状态标记为「异常」
3. 在异常原因表中写入原因和责任人
4. 处理记录完整留痕
5. 订单停留在原队列等待补正

### 批量处理
批量推进/核验时逐条处理，返回每条的成功/失败结果及原因，不会整批放行。

## 到期预警

| 级别 | 条件 | 颜色 | 显示 |
|------|------|------|------|
| 正常 | 剩余 > 3 天 | 绿色 | 正常 |
| 临期 | 剩余 ≤ 3 天 | 黄色 | 临期 |
| 逾期 | 剩余 < 0 天 | 红色 | 逾期 |

各节点（需求确认、排期评估、交付验收）独立计算预警，显示对应责任人。

## 主要 API 接口

所有接口需在 Header 中携带 `Authorization: Bearer {token}`。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 登录 |
| GET | `/api/me` | 当前用户信息 |
| GET | `/api/orders` | 订单列表（支持 status/role/handler_id/clue 筛选） |
| GET | `/api/orders/{id}` | 订单详情（含证据、附件、记录、异常、备注） |
| POST | `/api/orders` | 创建订单 |
| GET | `/api/orders/{id}/allowed-actions` | 当前用户可执行操作 |
| POST | `/api/orders/{id}/requirement/submit` | 需求确认提交 |
| POST | `/api/orders/{id}/requirement/audit` | 需求确认审核（通过/驳回） |
| POST | `/api/orders/{id}/schedule/submit` | 排期评估提交 |
| POST | `/api/orders/{id}/schedule/audit` | 排期评估审核 |
| POST | `/api/orders/{id}/delivery/submit` | 交付验收提交 |
| POST | `/api/orders/{id}/delivery/audit` | 交付验收审核 |
| POST | `/api/orders/{id}/review` | 复核 |
| POST | `/api/orders/{id}/archive` | 归档 |
| POST | `/api/orders/batch-process` | 批量处理（推进/核验），逐条返回结果 |
| GET | `/api/statistics` | 统计数据 |
| GET | `/api/deadline-warnings` | 到期预警列表 |
| GET | `/api/users` | 用户列表 |
| GET | `/api/docs` | Swagger 交互式文档 |

## 异常样例说明

在演示数据中：
1. **缺材料**（单据 0002）：提交需求确认时不填证据字段，将触发「缺少必填证据字段」错误
2. **超时逾期**（单据 0003）：排期评估截止日已过2天，列表中显示红色「逾期」标签
3. **退回补正**（单据 0004）：需求确认和排期评估各有一条已解决的异常原因记录
4. **版本冲突**：打开同一单据两个窗口，在A窗口提交后再在B窗口提交，会触发 409 版本冲突
5. **越权操作**：使用登记员账号尝试审核，返回 403 权限不足

## 刷新后一致性验证

所有操作均通过数据库事务保证原子性，刷新页面后：
- 列表状态、数量、筛选结果一致
- 详情页三大模块状态、证据、处理记录一致
- 工作台统计数字和到期预警一致
- 操作记录时间线完整可追溯
