# 展会主办方-月底集中处理展商申请系统

基于 **Qwik City + Python + Starlette** 构建的展会展商申请管理系统，支持多角色协作、工作流审批、批量处理、异常拦截等核心功能。

---

## 🚀 快速启动

### 端口配置
- **前端端口**: 3108
- **后端端口**: 8108
- **前端地址**: http://localhost:3108
- **后端地址**: http://localhost:8108

> 重要：前端请求地址、后端监听端口、CORS 白名单和启动命令统一使用上述端口，不写死其他端口。

### 方式一：一键启动（推荐）

**启动后端服务：**
```bash
cd backend
chmod +x start.sh
./start.sh
```

**启动前端服务（新终端）：**
```bash
cd frontend
chmod +x start.sh
./start.sh
```

### 方式二：手动启动

#### 后端启动
```bash
cd backend

# 创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 初始化数据库（自动创建表结构和演示数据）
python -m app.init_db

# 启动服务
uvicorn app.main:app --host 0.0.0.0 --port 8108 --reload
```

#### 前端启动
```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务
npm run dev
```

---

## 🔐 演示账号

| 角色 | 用户名 | 密码 | 职责 |
|------|--------|------|------|
| 展商登记员 | `registrar1` | `123456` | 发起申请、补正材料 |
| 展商审核主管 | `supervisor1` | `123456` | 资质审核、办理搭建 |
| 展会主办方复核负责人 | `leader1` | `123456` | 复核归档、展位确认、项目收口 |

---

## 📋 四类演示单据

系统预置了 4 条典型的展商申请，覆盖各种业务场景：

### 1. 正常流转单据
- **申请编号**: `EX202406120001`
- **公司名称**: 正常流转科技有限公司
- **当前状态**: 待审核
- **预警级别**: 正常
- **队列**: 搭建审核办理（展商审核主管）
- **说明**: 展商登记员已提交，待展商审核主管审核，流程正常

### 2. 缺材料单据
- **申请编号**: `EX202406120002`
- **公司名称**: 缺材料实业有限公司
- **当前状态**: 需补正
- **预警级别**: 正常
- **队列**: 展商服务补齐材料（展商登记员）
- **说明**: 审核主管发现缺少营业执照副本，已退回补正。补正原因：「缺少营业执照副本复印件」；需补充证据：「营业执照副本、法人授权委托书」

### 3. 超期逾期单据
- **申请编号**: `EX202406120003`
- **公司名称**: 临期逾期贸易有限公司
- **当前状态**: 待复核
- **预警级别**: 逾期 ⚠️
- **队列**: 项目负责人收口（主办方复核负责人）
- **说明**: 审核主管已通过，待主办方复核，但已逾期 1 天。责任人：主办方复核负责人

### 4. 状态冲突/退回补正单据
- **申请编号**: `EX202406120004`
- **公司名称**: 状态冲突电子有限公司
- **当前状态**: 待展位确认
- **预警级别**: 临期
- **队列**: 项目负责人收口（主办方复核负责人）
- **说明**: 曾被退回补正（缺少参展产品名录），补正后重新提交，复核已通过，现待展位确认。缺少展位确认证据，临期预警（剩余18小时）

---

## 🔧 异常样例与测试场景

### 1. 越权访问测试
- **场景**: 使用展商登记员账号尝试审核
- **操作**: 登录 `registrar1`，调用审核接口
- **预期结果**: 返回 `403 Permission Denied`，提示权限不足

### 2. 版本冲突测试
- **场景**: 两人同时打开同一条申请，后提交者被拦截
- **操作**:
  1. 打开申请详情（版本 v1）
  2. 另一个终端或页面修改该申请（版本变为 v2）
  3. 在第一个页面提交操作（仍携带 v1）
- **预期结果**: 返回 `VERSION_CONFLICT` 错误，提示「版本冲突，当前版本为 2，您的版本为 1」

### 3. 状态冲突测试
- **场景**: 对已审核通过的申请重复提交审核
- **操作**: 申请状态为「待复核」时，审核主管再次尝试审核
- **预期结果**: 返回 `INVALID_ACTION` 错误，提示操作在当前状态下不被允许

### 4. 缺少必填证据测试
- **场景**: 展位确认时不填写确认证据
- **操作**: 点击「确认展位」但不填写确认证据
- **预期结果**: 返回 `MISSING_BOOTH_EVIDENCE` 错误，提示「展位确认必须上传确认证据」

### 5. 退回补正缺原因测试
- **场景**: 退回补正但不填写补正原因
- **操作**: 点击「退回补正」但不填写原因
- **预期结果**: 返回 `MISSING_CORRECTION_REASON` 错误，提示「退回补正必须填写补正原因」

### 6. 拒绝缺意见测试
- **场景**: 拒绝申请但不填写退回意见
- **操作**: 点击「拒绝申请」但不填写意见
- **预期结果**: 返回 `MISSING_REJECT_REASON` 错误，提示「拒绝必须填写退回意见」

### 7. 重复提交测试
- **场景**: 快速点击两次提交按钮
- **操作**: 连续点击提交
- **预期结果**: 第二次提交因版本号已更新被拦截

### 8. 逾期批量推进测试
- **场景**: 批量处理包含逾期申请的单据
- **操作**: 同时选中正常和逾期的申请进行批量通过
- **预期结果**: 正常申请成功，逾期申请被逐条拦截，返回错误码 `OVERDUE_BLOCKED`，详情页留下补正动作和异常原因

---

## 🏗️ 系统架构

### 技术栈
| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Qwik City | 高性能全栈框架 |
| 后端 | Starlette | 异步 Python Web 框架 |
| 数据库 | SQLite | 本地文件数据库 |
| 认证 | JWT | 无状态令牌认证 |
| 密码 | bcrypt | 安全密码哈希 |

### 目录结构
```
trae-123-8/
├── backend/                    # Python 后端
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py            # 应用入口
│   │   ├── config.py          # 配置
│   │   ├── database.py        # 数据库连接与表结构
│   │   ├── constants.py       # 常量（角色、状态、动作）
│   │   ├── schemas.py         # Pydantic 模型
│   │   ├── security.py        # 认证与密码
│   │   ├── middleware.py      # 中间件与状态流转校验
│   │   ├── services.py        # 业务逻辑层
│   │   ├── routes.py          # 路由定义
│   │   └── init_db.py         # 数据库初始化与演示数据
│   ├── data/
│   │   └── exhibitor.db       # SQLite 数据库（运行时生成）
│   ├── uploads/               # 附件上传目录
│   ├── requirements.txt
│   ├── .env
│   └── start.sh
├── frontend/                   # Qwik City 前端
│   ├── src/
│   │   ├── routes/
│   │   │   ├── layout.tsx     # 全局布局（路由守卫）
│   │   │   ├── index.tsx      # 列表页
│   │   │   ├── login/
│   │   │   │   └── index.tsx  # 登录页
│   │   │   └── applications/
│   │   │       └── [id]/
│   │   │           └── index.tsx  # 详情页
│   │   ├── components/
│   │   ├── services/
│   │   │   └── api.ts         # API 封装
│   │   ├── config/
│   │   │   └── index.ts       # 前端配置
│   │   ├── types/
│   │   │   └── index.ts       # TypeScript 类型
│   │   ├── root.tsx
│   │   ├── entry.dev.tsx
│   │   ├── entry.ssr.tsx
│   │   ├── entry.preview.tsx
│   │   └── global.css
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts         # 代理配置（/api → 8108）
│   └── start.sh
└── README.md
```

---

## 🔄 业务流程

### 岗位与队列职责
| 岗位 | 所属队列 | 职责 |
|------|----------|------|
| 展商登记员 | 展商服务补齐材料 | 发起申请、补正材料、重新提交 |
| 展商审核主管 | 搭建审核办理 | 资质审核、通过/退回/拒绝 |
| 展会主办方复核负责人 | 项目负责人收口 | 复核、展位确认、归档、同步 |

### 标准流程
```
创建申请 → 提交审核 → 审核通过 → 复核通过 → 展位确认 → 归档 → 同步
              ↓         ↓          ↓
          退回补正   拒绝    退回补正
              ↓         ↓
          补正重提    [终止]
```

### 预警机制
- **正常**: 处理期限 > 24 小时，绿色标识
- **临期**: 处理期限 ≤ 24 小时，黄色标识，显示责任人
- **逾期**: 已超过处理期限，红色标识，禁止批量整批放行，必须逐条处理并记录异常原因

---

## 📊 列表分组统计

列表页按以下三组统计展示：
| 分组 | 包含状态 |
|------|----------|
| **待审核** | 待审核、待复核、待展位确认、需补正 |
| **审核通过** | 审核通过、展位已确认、已归档 |
| **已同步** | 已同步 |

---

## 🔒 后端安全校验

每次状态流转前，后端会自动校验：

1. **角色权限**: 当前用户角色是否允许执行该操作
2. **处理人校验**: 当前用户是否为该申请的当前处理人
3. **状态流转**: 当前状态是否允许执行该操作
4. **版本校验**: 提交的版本号是否与数据库最新版本一致
5. **必填证据**: 特定操作是否提供了必填证据（如展位确认函、补正原因、退回意见）
6. **上一处理人校验**: 状态流转需记录上一处理人

校验失败时返回结构化错误：
```json
{
  "detail": "版本冲突，当前版本为 2，您的版本为 1",
  "error_code": "VERSION_CONFLICT"
}
```

---

## 📦 数据库表结构

SQLite 中包含以下表，所有操作记录可追溯：

### `users` - 用户表
- id, username, password_hash, role, name, created_at

### `exhibitor_applications` - 展商申请表
- id, application_no, company_name, contact_person, contact_phone, contact_email
- exhibition_type, booth_area, booth_preference
- **status** (当前状态), **queue** (所属队列), **current_handler** (当前处理人)
- **version** (乐观锁版本号), **is_overdue** (是否逾期), **warning_level** (预警级别)
- deadline, submitted_at, last_updated_at, created_by
- **booth_confirmation_evidence** (展位确认证据)
- sync_status

### `attachments` - 附件表
- id, application_id, file_name, file_path, file_type, file_size, uploaded_by, uploaded_at

### `processing_records` - 处理记录表
- id, application_id, action, from_status, to_status
- handler, handler_role, comment
- **correction_reason** (补正原因), **reject_reason** (退回意见)
- **evidence_required** (需补充证据)
- **previous_handler** (上一处理人), version, created_at

### `audit_notes` - 审计备注表
- id, application_id, note, created_by, created_at

### `batch_operations` - 批量操作表
- id, batch_no, operation_type, operator, operator_role
- total_count, success_count, fail_count, created_at

### `batch_results` - 批量结果明细表
- id, batch_id, application_id, success, error_code, error_message

---

## 🛠️ 后端 API 接口

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me` | 获取当前用户 |

### 申请管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/applications` | 申请列表（支持筛选、分页） |
| POST | `/api/applications` | 创建申请 |
| GET | `/api/applications/:id` | 申请详情（含处理记录、附件、备注） |
| POST | `/api/applications/:id/action` | 执行状态流转操作 |
| POST | `/api/applications/:id/notes` | 添加审计备注 |

### 批量处理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/batch/action` | 批量处理，逐条返回成功/失败原因 |

### 统计与常量
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/statistics` | 获取当前用户队列统计 |
| GET | `/api/constants` | 获取常量枚举 |

### 健康检查
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 服务健康检查 |

---

## ✅ 操作指南

### 角色切换测试
1. 打开 http://localhost:3108
2. 使用不同账号登录，观察列表内容和可用操作按钮的变化
3. 展商登记员：只能看到「展商服务补齐材料」队列的申请
4. 审核主管：只能看到「搭建审核办理」队列的申请
5. 复核负责人：可看到「搭建审核办理」和「项目负责人收口」两个队列

### 列表筛选测试
1. 点击顶部「待审核」「审核通过」「已同步」标签切换分组
2. 使用关键词搜索框（申请编号/公司名称/联系人）
3. 按预警级别筛选（正常/临期/逾期）
4. 按状态精确筛选

### 进详情办理测试
1. 点击列表中某条申请的「办理」按钮
2. 查看基本信息、处理记录时间线、审计备注、附件
3. 根据当前状态执行可用操作（提交、审核通过、退回补正等）
4. 确认处理后版本号递增，处理记录正确写入

### 批量处理测试
1. 在列表中勾选多条申请
2. 点击批量操作按钮（批量审核通过、批量退回补正等）
3. 填写必填字段（退回补正需原因，拒绝需意见，确认展位需证据）
4. 确认后查看逐条处理结果，成功/失败分别标记，失败项显示错误码和原因
5. 逾期申请会被单独拦截，不会整批放行

### 绕开页面调接口测试
使用 curl 或 Postman 直接调用接口，验证后端拦截机制：

```bash
# 1. 登录获取 token
curl -X POST http://localhost:8108/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"registrar1","password":"123456"}'

# 2. 尝试越权操作（用登记员的 token 调用审核接口）
curl -X POST http://localhost:8108/api/applications/1/action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "application_id": 1,
    "action": "approve_audit",
    "version": 1
  }'

# 预期返回 400 错误，提示 PERMISSION_DENIED
```

---

## 📝 数据一致性说明

系统通过以下机制保证数据一致性：

1. **事务保证**: 每个操作使用数据库事务，处理记录和状态更新同时成功/失败
2. **乐观锁**: 通过 version 字段防止并发修改冲突
3. **操作日志**: 所有状态变更完整记录在 processing_records 表
4. **审计追踪**: 所有操作（含备注）可追溯，处理记录展示完整时间线
5. **刷新验证**: 列表、详情、统计、操作记录刷新后数据完全一致

---

## ⚙️ 配置说明

所有端口配置统一管理：

| 文件 | 配置项 | 值 |
|------|--------|-----|
| `backend/.env` | BACKEND_PORT | 8108 |
| `backend/.env` | FRONTEND_PORT | 3108 |
| `backend/app/main.py` | CORS 白名单 | http://localhost:3108 |
| `backend/start.sh` | 启动端口 | 8108 |
| `frontend/vite.config.ts` | dev server 端口 | 3108 |
| `frontend/vite.config.ts` | API 代理目标 | http://localhost:8108 |
| `frontend/src/config/index.ts` | backendUrl | http://localhost:8108 |
| `frontend/start.sh` | 启动命令 | --port 3108 |
| `README.md` | 启动命令说明 | 3108 / 8108 |

---

## 🐛 常见问题

### 1. 后端启动提示端口被占用
```bash
lsof -ti:8108 | xargs kill -9
```

### 2. 前端启动提示端口被占用
```bash
lsof -ti:3108 | xargs kill -9
```

### 3. 重新初始化数据库
```bash
cd backend
rm -f data/exhibitor.db
python -m app.init_db
```

### 4. 虚拟环境相关
```bash
cd backend
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
