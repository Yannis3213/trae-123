# 法务服务中心 - 月底集中处理法律咨询单系统

基于 **Astro + React Islands + Rust + Rocket + SQLite** 技术栈开发的法律咨询单管理系统。

## 系统架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   前端 (3003)   │────▶│   后端 (8003)   │────▶│  SQLite 数据库  │
│  Astro + React  │     │  Rust + Rocket  │     │  legal_service  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
          │                        │
          └────────────────────────┘
              /api 代理转发
```

## 端口配置

- **前端端口**: 3003
- **后端端口**: 8003
- **CORS白名单**: http://localhost:3003
- **前端API代理**: /api → http://localhost:8003

> ⚠️ 所有端口配置已在代码中统一，请勿修改其他端口。

## 快速启动

### 1. 环境要求

- Node.js >= 18
- Rust >= 1.75
- SQLite3
- cargo 工具链

### 2. 初始化数据库

```bash
# 方式一：使用初始化脚本
bash scripts/init_db.sh

# 方式二：手动执行
sqlite3 database/legal_service.db < database/schema.sql
sqlite3 database/legal_service.db < database/init_data.sql
```

数据库文件路径: `database/legal_service.db`

### 3. 启动后端服务

```bash
# 方式一：使用启动脚本
bash scripts/start_backend.sh

# 方式二：手动启动
cd backend
export ROCKET_PORT=8003
export JWT_SECRET="legal-service-jwt-secret-key-2024"
cargo run --release
```

后端服务地址: http://localhost:8003

### 4. 启动前端服务

```bash
# 方式一：使用启动脚本
bash scripts/start_frontend.sh

# 方式二：手动启动
cd frontend
npm install
npm run dev -- --port 3003
```

前端访问地址: http://localhost:3003

## 演示账号

所有账号密码均为: **123456**

| 用户名 | 角色 | 姓名 | 部门 | 职责 |
|--------|------|------|------|------|
| `registrar` | 法律咨询登记员 | 张三 | 法律咨询部 | 发起/补正咨询登记 |
| `supervisor` | 法律咨询审核主管 | 李四 | 法务服务中心 | 审核办理、案件分派 |
| `reviewer` | 法务服务中心复核负责人 | 王五 | 法务服务中心 | 复核归档 |
| `director` | 律所主任 | 赵六 | 律所 | 全局查看、复核前查看助理和律师记录 |
| `assistant` | 案件助理 | 孙七 | 律师团队 | 协助处理案件 |
| `lawyer` | 承办律师 | 周八 | 律师团队 | 承办案件、回访确认 |

## 四类演示单据

### 1. 正常流转 - LC2026060001
**状态**: 已归档 (archived)
**说明**: 完整的业务流程演示
- 咨询登记信息完整 ✓
- 案件分派信息完整 ✓
- 回访确认信息完整 ✓
- 状态流转: draft → pending_submit → submitted → assigned → completed → archived

### 2. 缺材料 - LC2026060002
**状态**: 待提交 (pending_submit)
**说明**: 信息不完整拦截演示
- 咨询登记: 缺少客户身份证号、银行流水证据 ✗
- 案件分派: 未分派 ✗
- 回访确认: 未回访 ✗
- 异常原因: 已记录在 exception_reasons 表
- 审计备注: 已记录拦截原因

### 3. 超时逾期 - LC2026060003
**状态**: 复核中 (reviewing)
**说明**: 截止日期预警演示
- 截止日期: 2026-06-05 (已逾期6天)
- 预警状态: 逾期 (overdue)
- 咨询登记: 完整 ✓
- 案件分派: 完整 ✓
- 回访确认: 已回访 ✓

### 4. 退回补正 - LC2026060004
**状态**: 已退回 (returned)
**说明**: 状态冲突和退回补正演示
- 咨询登记: 缺少股东身份证明、股权转让协议 ✗
- 异常原因: 状态冲突 + 信息不完整
- 处理记录: 包含退回操作和原因
- 状态按钮: 显示"重新提交"

## 异常样例

### 越权访问
```
场景: registrar 角色尝试访问 reviewer 队列的案件
拦截: 返回 403 Forbidden
记录: audit_notes 表记录越权尝试
```

### 重复提交
```
场景: 对已 submitted 状态的案件再次提交
拦截: 返回状态冲突错误
记录: exception_reasons 表记录重复提交原因
```

### 状态冲突
```
场景: 对 returned 状态的案件直接推进到 assigned
拦截: 返回状态流转不合法
记录: processing_records 表记录操作失败
```

### 旧版本提交
```
场景: 使用 version=2 提交当前 version=3 的案件
拦截: 返回版本冲突错误
记录: 要求刷新页面获取最新数据
```

### 缺证据请求
```
场景: 提交时缺少必要证据材料
拦截: 停在原队列，不推进
记录: exception_reasons 表记录缺证据清单
```

## 核心业务规则

### 1. 信息完整性检查
进入下一状态前，后端自动检查：
- **咨询登记**: 客户姓名、电话、身份证号、咨询类型、咨询内容、证据材料
- **案件分派**: 助理ID、律师ID、分派日期、分派说明
- **回访确认**: 回访方式、回访日期、回访内容、回访结果

**任一模块信息不完整 → 停在原队列 → 记录异常原因和审计备注**

### 2. 状态流转图
```
draft → pending_submit → submitted → reviewing → assigned → followup → completed → archived
         ↓              ↓           ↓           ↓          ↓
     returned ←→ resubmitted
```

### 3. 队列按职责拆分
| 队列 | 可见角色 | 状态范围 |
|------|----------|----------|
| 登记队列 | registrar, supervisor, director | draft, pending_submit, returned |
| 分派队列 | supervisor, director | submitted, reviewing |
| 回访队列 | assistant, lawyer, supervisor, director | assigned, followup |
| 复核队列 | reviewer, director | completed |
| 归档队列 | reviewer, director | archived |

### 4. 到期预警规则
- **正常**: 距离截止日期 > 3 天
- **临期**: 距离截止日期 ≤ 3 天 且 > 0 天
- **逾期**: 已超过截止日期

## 数据库表结构

### 主要数据表

| 表名 | 说明 |
|------|------|
| `users` | 用户表（角色、权限） |
| `legal_cases` | 法律咨询单主表（状态、版本、优先级、截止时间） |
| `case_registration` | 咨询登记表 |
| `case_assignment` | 案件分派表 |
| `case_followup` | 回访确认表 |
| `attachments` | 附件表 |
| `processing_records` | 处理记录表（操作历史） |
| `audit_notes` | 审计备注表（追溯用） |
| `exception_reasons` | 异常原因表（拦截原因） |

### 数据查询示例

```sql
-- 查询法律咨询单列表
SELECT case_no, title, status, queue, priority, deadline FROM legal_cases;

-- 查询异常原因
SELECT * FROM exception_reasons WHERE case_id = 2;

-- 查询审计备注
SELECT * FROM audit_notes WHERE case_id = 4 ORDER BY created_at DESC;

-- 查询处理记录
SELECT * FROM processing_records WHERE case_id = 1 ORDER BY created_at;
```

## API 接口清单

### 认证接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me` | 获取当前用户 |
| GET | `/api/auth/roles` | 获取角色列表 |

### 法律咨询单接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/cases` | 列表（分页+筛选） |
| GET | `/api/cases/:id` | 详情 |
| POST | `/api/cases` | 创建 |
| PUT | `/api/cases/:id` | 更新 |
| POST | `/api/cases/action` | 状态操作 |
| POST | `/api/cases/batch` | 批量处理 |
| GET | `/api/cases/:id/records` | 处理记录 |

### 业务模块接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET/PUT | `/api/cases/:id/registration` | 咨询登记 |
| GET/PUT | `/api/cases/:id/assignment` | 案件分派 |
| GET/PUT | `/api/cases/:id/followup` | 回访确认 |

### 统计接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/statistics` | 统计数据 |

## 批量处理说明

### 批量操作流程
1. 列表页多选案件
2. 点击批量操作按钮（提交、重新提交、归档等）
3. 后端逐条处理并返回结果
4. 前端展示每条成功/失败原因

### 批量结果示例
```json
{
  "success": true,
  "data": [
    {
      "caseId": 1,
      "caseNo": "LC2026060001",
      "success": true,
      "message": "提交成功"
    },
    {
      "caseId": 2,
      "caseNo": "LC2026060002",
      "success": false,
      "message": "咨询登记信息不完整：缺少客户身份证号"
    },
    {
      "caseId": 4,
      "caseNo": "LC2026060004",
      "success": false,
      "message": "状态冲突：已退回案件需先补正再重新提交"
    }
  ]
}
```

## 项目结构

```
trae-123-3/
├── backend/                    # Rust 后端
│   ├── src/
│   │   ├── auth/              # 认证模块
│   │   ├── db/                # 数据库模块
│   │   ├── routes/            # API 路由
│   │   ├── main.rs            # 入口文件
│   │   └── utils.rs           # 工具函数
│   └── Cargo.toml
├── frontend/                   # Astro 前端
│   ├── src/
│   │   ├── components/        # React 组件
│   │   ├── pages/             # 页面路由
│   │   ├── api/               # API 调用
│   │   └── utils/             # 工具函数
│   ├── astro.config.mjs       # Astro 配置（端口3003）
│   └── package.json
├── database/                   # 数据库
│   ├── schema.sql             # 表结构
│   ├── init_data.sql          # 演示数据
│   └── legal_service.db       # 数据库文件
├── scripts/                    # 脚本
│   ├── init_db.sh             # 数据库初始化
│   ├── start_backend.sh       # 后端启动
│   └── start_frontend.sh      # 前端启动
└── README.md
```

## 前端页面说明

### 登录页 `/`
- 用户名密码登录
- 记住我选项

### 控制台 `/dashboard`
- 统计卡片：总数、各状态数量、预警统计
- 快捷操作区（按角色显示）
- 预警列表（临期、逾期）

### 案件列表 `/cases`
- 筛选：责任人、优先级、截止时间、状态
- 列表表格：案号、标题、状态、队列、优先级、截止时间、预警、操作
- 批量选择和批量操作
- 分页

### 案件详情 `/cases/:id`
- 基本信息卡片
- 状态操作按钮区（待提交、已退回、重新提交）
- 业务区 Tab：
  - 咨询登记（可编辑/可核验）
  - 案件分派（可编辑/可核验）
  - 回访确认（可编辑/可核验）
- 辅助区 Tab：
  - 处理记录时间线
  - 附件列表
  - 审计备注
  - 异常原因

## 操作演示流程

### 正常流程演示
1. 使用 `registrar` 登录
2. 查看 LC2026060001 详情 → 完整的处理记录
3. 新建咨询单 → 填写登记信息 → 提交
4. 切换 `supervisor` 登录 → 审核 → 分派
5. 切换 `lawyer` 登录 → 处理 → 回访
6. 切换 `reviewer` 登录 → 复核归档

### 异常拦截演示
1. 使用 `registrar` 登录
2. 查看 LC2026060002 → 显示"缺材料"状态
3. 尝试提交 → 被拦截 → 查看异常原因
4. 补全信息 → 重新提交

### 角色切换演示
1. 依次登录6个账号
2. 观察侧边栏菜单变化
3. 观察列表数据范围变化
4. 观察详情页操作按钮变化

### 批量处理演示
1. 使用 `registrar` 登录
2. 列表页多选 LC2026060002 和 LC2026060004
3. 点击"批量提交"
4. 查看结果：LC2026060002 失败（缺材料），LC2026060004 失败（状态冲突）
5. 补正后重新批量提交

## 常见问题

### 1. 数据库初始化失败
```bash
# 检查 sqlite3 是否已安装
sqlite3 --version

# 手动创建数据库
mkdir -p database
sqlite3 database/legal_service.db "VACUUM;"
```

### 2. 后端编译失败
```bash
cd backend
rustup update
cargo clean
cargo build --release
```

### 3. 前端依赖安装失败
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### 4. CORS 跨域问题
确保：
- 后端运行在 8003 端口
- 前端运行在 3003 端口
- 访问地址使用 http://localhost:3003

## 开发说明

### 后端代码规范
- 使用 Rust 2021 Edition
- 错误处理使用 `anyhow` 和 `thiserror`
- 数据库操作使用 `rusqlite`
- 线程安全使用 `parking_lot`

### 前端代码规范
- 使用 TypeScript 严格模式
- React Islands 模式
- Ant Design 组件库
- API 路径统一使用 `/api` 前缀

## License

MIT
