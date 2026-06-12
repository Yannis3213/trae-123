# 知识产权代理所-月底集中处理商标申请单系统

## 技术栈

- **前端**: Preact 10 + Vite 5
- **后端**: Go 1.21 + Chi v5
- **数据库**: SQLite (本地文件)
- **端口**: 前端 3105, 后端 8105

## 功能特性

### 角色权限
- **商标申请登记员（流程专员）**: 发起/补正申请单，只能创建和补正
- **商标申请审核主管（代理人）**: 办理申请单，只能处理
- **知识产权代理所复核负责人（所长）**: 复核归档，只能复核

### 业务模块
1. **商标申请**: 主业务模块，处理待分派、已转办、已回访状态
2. **材料补正**: 处理待补正、已退回状态的申请单
3. **递交通知**: 处理已转办、已回访、已归档状态的申请单

### 状态流转
```
待分派 (pending_assign)
    ↓ 分派
已转办 (transferred)
    ↓ 回访
已回访 (visited)
    ↓ 复核
已归档 (archived)

异常路径:
待分派 → 退回 → 待补正 (correction)
已转办 → 退回 → 待补正/已退回 (returned)
已回访 → 退回 → 待补正/已退回
待补正 → 补正 → 待分派
已退回 → 补正 → 待分派
```

### 核心功能
- ✅ 列表筛选（关键词、状态、预警）
- ✅ 角色切换（Header 选择器）
- ✅ 详情办理（分派、转办、回访、补正、退回、复核）
- ✅ 批量处理（批量分派、批量回访、批量复核、批量补正）
- ✅ 批量结果（逐条成功/失败原因）
- ✅ 到期预警（正常、临期≤3天、逾期）
- ✅ 节点超时责任人显示
- ✅ 上一处理人意见展示
- ✅ 附件材料展示
- ✅ 审计轨迹（完整操作记录）
- ✅ 异常原因记录
- ✅ 证据上传
- ✅ 乐观并发控制（版本号校验）
- ✅ 后端权限校验（角色、处理人、状态、版本、证据）

### 数据持久化
- 商标申请单 (trademark_applications)
- 附件 (attachments)
- 处理记录 (processing_records)
- 审计备注 (audit_remarks)
- 异常原因 (exception_reasons)

## 快速启动

### 1. 启动后端（端口 8105）

```bash
cd backend

# 首次安装依赖
go mod tidy

# 编译并启动
mkdir -p bin data
go build -o bin/server .
./bin/server
```

后端将在 `http://localhost:8105` 启动。

### 2. 启动前端（端口 3105）

```bash
cd frontend

# 首次安装依赖
npm install

# 开发模式启动
npm run dev
```

前端将在 `http://localhost:3105` 启动，API 请求自动代理到 `http://localhost:8105`。

## 端口配置说明

所有端口配置已统一，请勿修改：

| 配置项 | 端口 | 文件位置 |
|--------|------|----------|
| 前端开发服务器 | 3105 | `frontend/vite.config.js` |
| 前端预览服务器 | 3105 | `frontend/vite.config.js` |
| 后端监听端口 | 8105 | `backend/internal/config/config.go` |
| CORS 白名单 | 3105 | `backend/internal/middleware/cors.go` |
| 前端 API 代理目标 | 8105 | `frontend/vite.config.js` |

## 测试数据

系统内置 8 条测试申请单，覆盖四种场景：

| 申请单号 | 场景 | 状态 |
|----------|------|------|
| TM2026000001 | 正常流转 | 待分派（材料齐全） |
| TM2026000002 | 缺材料 | 待分派（缺材料） |
| TM2026000003 | 临期 | 已转办（2天后到期） |
| TM2026000004 | 逾期+缺证据 | 已转办（已逾期5天+缺证据） |
| TM2026000005 | 待补正 | 待补正 |
| TM2026000006 | 已回访待复核 | 已回访 |
| TM2026000007 | 已归档 | 已归档 |
| TM2026000008 | 已退回 | 已退回 |

## 测试用户

| 角色 | 用户ID | 姓名 | 密码 |
|------|--------|------|------|
| 商标申请登记员 | registrar | 李登记 | - |
| 商标申请审核主管 | agent | 王代理 | - |
| 知识产权代理所复核负责人 | director | 张所长 | - |

通过页面左侧的角色选择器切换角色。

## 测试场景

### 页面侧测试
1. **角色切换**: 切换不同角色，查看列表和操作按钮变化
2. **列表筛选**: 关键词搜索、状态筛选、预警筛选
3. **详情办理**: 进入详情页，执行分派、转办、回访、补正、退回、复核等操作
4. **批量处理**: 多选申请单，执行批量操作，查看批量结果
5. **数据一致性**: 刷新页面，确认列表、详情、统计、操作记录保持一致

### 接口侧测试（可使用 curl）

#### 1. 越权测试
```bash
# agent 角色尝试执行只有 registrar 才能做的分派操作
curl -X POST http://localhost:8105/api/applications/1/assign \
  -H "X-User-Role: agent" \
  -H "Content-Type: application/json" \
  -d '{"version": 1}'
```

#### 2. 重复提交/状态冲突测试
```bash
# 对已转办的申请单再次分派
curl -X POST http://localhost:8105/api/applications/3/assign \
  -H "X-User-Role: registrar" \
  -H "Content-Type: application/json" \
  -d '{"version": 1}'
```

#### 3. 旧版本提交测试
```bash
# 使用旧版本号提交
curl -X POST http://localhost:8105/api/applications/1/assign \
  -H "X-User-Role: registrar" \
  -H "X-If-Match: 0" \
  -H "Content-Type: application/json" \
  -d '{"version": 0}'
```

#### 4. 缺证据请求测试
```bash
# 对缺证据的申请单执行回访
curl -X POST http://localhost:8105/api/applications/4/visit \
  -H "X-User-Role: agent" \
  -H "Content-Type: application/json" \
  -d '{"version": 1, "opinion": "回访完成"}'
```

#### 5. 非当前处理人操作测试
```bash
# 使用非当前处理人角色操作
curl -X POST http://localhost:8105/api/applications/3/visit \
  -H "X-User-Role: registrar" \
  -H "Content-Type: application/json" \
  -d '{"version": 1}'
```

## API 接口

### 商标申请单
- `GET /api/applications` - 列表（支持 keyword/status/warning/module 筛选，分页）
- `POST /api/applications` - 创建申请单
- `GET /api/applications/{id}` - 详情（含附件、异常原因）
- `PUT /api/applications/{id}` - 更新（版本校验）
- `POST /api/applications/{id}/assign` - 分派（版本校验）
- `POST /api/applications/{id}/transfer` - 转办（版本校验）
- `POST /api/applications/{id}/visit` - 回访（版本校验，需证据完整）
- `POST /api/applications/{id}/correct` - 补正（版本校验）
- `POST /api/applications/{id}/return` - 退回（版本校验）
- `POST /api/applications/{id}/review` - 复核归档（版本校验，需材料和证据完整）
- `GET /api/applications/{id}/audit` - 审计轨迹
- `POST /api/applications/{id}/evidence` - 上传证据
- `GET /api/applications/stats` - 统计数据

### 材料补正
- `GET /api/corrections` - 材料补正列表
- `POST /api/corrections/{id}/submit` - 提交补正材料

### 递交通知
- `GET /api/notifications` - 递交通知列表
- `POST /api/notifications/{id}/submit` - 提交递交通知

### 批量处理
- `POST /api/batch/process` - 批量处理（assign/visit/review/correct）
- `POST /api/batch/advance` - 批量推进逾期申请

### 角色/用户
- `GET /api/roles` - 角色列表
- `GET /api/me` - 当前用户信息
- `POST /api/switch-role` - 切换角色

## 请求头约定

- `X-User-Role`: 当前用户角色（registrar/agent/director）
- `X-If-Match` / `X-Version`: 版本号，用于乐观并发控制

## 数据库文件位置

`backend/data/trademark.db`

删除该文件后重启后端会重新创建并初始化种子数据。

## 生产构建

### 前端
```bash
cd frontend
npm run build
# 输出到 frontend/dist
```

### 后端
```bash
cd backend
CGO_ENABLED=1 go build -o bin/server .
./bin/server
```

## 目录结构

```
.
├── backend/
│   ├── main.go
│   ├── go.mod
│   ├── go.sum
│   ├── bin/
│   │   └── server          # 编译后的二进制
│   ├── data/
│   │   └── trademark.db    # SQLite 数据库
│   └── internal/
│       ├── config/         # 配置管理
│       ├── models/         # 数据模型
│       ├── database/       # 数据库层
│       ├── middleware/     # 中间件
│       └── handlers/       # 处理器
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js          # API 封装
│       ├── store.js        # 状态管理
│       ├── styles.css      # 样式
│       ├── utils/
│       │   └── format.js   # 格式化工具
│       ├── components/     # 通用组件
│       └── pages/          # 页面组件
└── README.md
```
