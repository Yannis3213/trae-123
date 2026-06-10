# 冷链物流仓-月底集中处理冷链入库单系统

围绕入库预约运转的冷链入库单集中处理系统，核心流程：入库预约 → 温区分配 → 上架确认，角色按顺序流转：仓管员建单 → 温控主管推进 → 仓储经理复核。

## 技术栈

- 前端：SvelteKit（端口 3004）
- 后端：Go + Gin 框架（端口 8004）
- 数据库：SQLite（本地文件 `coldchain.db`）

## 快速启动

### 1. 启动后端

```bash
cd backend
go mod tidy
go build -o coldchain .
./coldchain
```

后端启动后监听 `http://localhost:8004`，SQLite 数据库文件自动在当前目录生成 `coldchain.db`。

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端启动后访问 `http://localhost:3004`。

### SQLite 初始化

数据库在首次启动后端时自动初始化：
- 自动创建所有表（users, applications, attachments, processing_records, audit_notes, exception_reasons）
- 自动插入演示种子数据（仅在表为空时）
- 如需重置数据，删除 `coldchain.db` 文件后重启后端即可

## 演示账号

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 仓管员 | warehouse_clerk | clerk123 | 张三，创建入库单、提交审核、修正补正 |
| 温控主管 | temp_supervisor | temp123 | 李四，分配温区、推进/退回 |
| 仓储经理 | warehouse_manager | manager123 | 王五，复核通过/退回补正 |

## 四类可试异常的冷链入库单

### 1. 正常流转
- **CC-2026-001**（冷冻牛排）：已完成全流程（草稿→待温控→复核中→办结）
- **CC-2026-002**（冰鲜三文鱼）：复核中，等待仓储经理确认
- **CC-2026-003**（冷藏蔬菜）：待温控分配，等待温控主管操作

### 2. 缺材料（missing_material）
- **CC-2026-004**（速冻水饺）：待补正，被温控主管退回，原因为"缺少产品质检报告"
- **CC-2026-005**（冷鲜牛奶）：草稿状态，可尝试提交但品名/到期日为空时会触发 EVIDENCE_MISSING

### 3. 超时或逾期（timeout）
- **CC-2026-006**（冷冻虾仁）：预计到期日已过，逾期状态，待温控分配
- **CC-2026-009**（速冻汤圆）：草稿且预计到期日已过，超时未提交

### 4. 退回补正或状态冲突（returned / status_conflict）
- **CC-2026-007**（冷藏水果）：待补正，被仓储经理退回，原因为"温度区间与产品不匹配"
- **CC-2026-011**（冰鲜金枪鱼）：待补正，被温控主管退回，原因为"入库预约时间已过"

### 异常测试方法

| 异常场景 | 测试方式 |
|----------|----------|
| 跨角色操作 | 用仓管员账号尝试温控主管操作 → ROLE_FORBIDDEN |
| 重复提交 | 对同一单据连续点击两次 → DUPLICATE_SUBMIT |
| 状态冲突 | 对已办结单据执行操作 → STATUS_CONFLICT |
| 版本冲突 | 两个窗口同时操作同一单据 → VERSION_CONFLICT |
| 缺证据 | 不填温区就点分配 → EVIDENCE_MISSING |
| 越权操作 | 非创建人提交 → CROSS_ROLE |

## 核心工作流

```
仓管员建单(草稿) → 仓管员提交(待温控分配) → 温控主管分配温区(复核中) → 仓储经理复核(办结)
                                            ↓                        ↓
                                     温控主管退回(待补正)      仓储经理退回(待补正)
                                            ↓                        ↓
                                     仓管员修正并重新提交 → 回到待温控分配
```

## 端口配置

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 3004 | SvelteKit dev server |
| 后端 | 8004 | Go Gin HTTP server |

- 前端请求地址：`http://localhost:8004`
- 后端监听端口：`:8004`
- CORS 白名单：`http://localhost:3004`

## 项目结构

```
├── backend/
│   ├── main.go              # 入口，路由注册，端口8004
│   ├── go.mod
│   ├── models/
│   │   └── models.go        # 数据模型定义
│   ├── database/
│   │   └── init.go          # SQLite初始化、建表、种子数据
│   ├── middleware/
│   │   ├── cors.go          # CORS白名单(localhost:3004)
│   │   └── auth.go          # 角色认证中间件
│   └── handlers/
│       ├── auth.go          # 登录、切换角色
│       ├── application.go   # 入库单CRUD、状态流转、校验
│       ├── batch.go         # 批量处理、超期推进
│       └── stats.go         # 统计摘要、到期预警
├── frontend/
│   ├── package.json
│   ├── svelte.config.js
│   ├── vite.config.ts       # Vite配置，/api代理到8004
│   └── src/
│       ├── lib/
│       │   ├── api.ts       # API客户端
│       │   ├── types.ts     # TypeScript类型定义
│       │   └── stores.ts    # Svelte状态管理
│       └── routes/
│           ├── +layout.svelte         # 主布局、导航、角色切换
│           ├── +page.svelte           # 登录页
│           ├── applications/
│           │   ├── +page.svelte       # 入库单列表
│           │   └── [id]/+page.svelte  # 入库单详情（核心页面）
│           ├── batch/+page.svelte     # 批量处理
│           └── warnings/+page.svelte  # 到期预警
└── README.md
```
