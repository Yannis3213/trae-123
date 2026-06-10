# 便利店连锁-月底集中处理补货申请系统

> 前端：Astro + React Islands  |  后端：Rust + Rocket + SQLite

第一屏即为「便利店连锁-月底集中处理补货申请系统」的待办队列与处理依据，
支持按岗位（补货登记员 / 补货审核主管 / 连锁复核负责人）拆分权限、列表筛选、
详情办理、批量处理、到期预警与完整审计轨迹。

---

## 目录结构

```
trae-123-4/
├── backend/           # Rust + Rocket + SQLite
│   ├── src/
│   │   ├── main.rs        # 入口，初始化 DB + 演示数据
│   │   ├── db.rs          # SQLite 连接池、建表
│   │   ├── models.rs      # 数据模型 / 枚举
│   │   ├── dao.rs         # 数据库访问层
│   │   ├── services.rs    # 业务逻辑、状态机、权限校验、批量处理
│   │   ├── routes.rs      # HTTP 路由 + CORS
│   │   └── errors.rs      # 统一错误与 HTTP 响应
│   ├── Cargo.toml
│   └── Rocket.toml
├── frontend/          # Astro + React Islands
│   ├── src/
│   │   ├── pages/index.astro
│   │   ├── layouts/BaseLayout.astro
│   │   ├── styles/global.css
│   │   ├── types/index.ts
│   │   ├── api/client.ts
│   │   ├── store/auth.ts         # zustand：登录 / 角色切换
│   │   ├── components/
│   │   │   ├── MainApp.tsx
│   │   │   ├── LoginView.tsx
│   │   │   ├── AppShell.tsx
│   │   │   ├── ApplicationList.tsx
│   │   │   ├── ApplicationDetail.tsx
│   │   │   └── BatchProcessPanel.tsx
│   │   └── App.tsx
│   ├── package.json
│   ├── astro.config.mjs
│   └── tsconfig.json
└── README.md
```

---

## 端口约定

| 组件 | 环境变量 | 默认值 |
| --- | --- | --- |
| 前端 Astro | `FRONTEND_PORT` | 4321 |
| 后端 Rocket | `BACKEND_PORT` | 8000 |

后端的 **CORS 白名单**、前端的 **请求地址**、**Rocket 监听端口**、
**Astro dev server 端口**以及本 README 的启动命令**共用这一组环境变量**，
不会写死其它端口。

> 示例：若需要前端 3000、后端 8080：
> ```bash
> export FRONTEND_PORT=3000
> export BACKEND_PORT=8080
> ```

---

## 一、后端启动（Rust + Rocket + SQLite）

### 1. 环境要求

- Rust 工具链 ≥ 1.75（`rustup update stable`）
- 无需单独安装 SQLite：rusqlite 使用 `bundled` 特性随 crate 编译

### 2. SQLite 初始化

**零额外操作**：后端首次启动时会自动：

1. 创建 `backend/data/replenishment.db`（也可用 `DB_PATH` 环境变量自定义路径）
2. 执行建表 DDL（`users`、`replenishment_applications`、`attachments`、
   `processing_records`、`audit_notes`、`exception_logs`）
3. 当 `users` 表为空时，自动插入演示账号和四类补货申请测试数据

> 想重置数据：删掉 `backend/data/replenishment.db` 再重启后端即可。

### 3. 运行

```bash
cd backend
export FRONTEND_PORT=4321    # CORS 白名单端口（必须和前端一致）
export BACKEND_PORT=8000     # Rocket 监听端口
export DB_PATH=data/replenishment.db
cargo run
```

启动后会打印：

```
=> Backend listening on port 8000
=> CORS allows frontend port 4321
🚀 Rocket has launched from http://0.0.0.0:8000
```

健康检查：

```bash
curl http://localhost:8000/api/health
# OK
```

---

## 二、前端启动（Astro + React Islands）

### 1. 环境要求

- Node.js ≥ 18.17
- npm / pnpm / yarn 任一

### 2. 安装依赖

```bash
cd frontend
npm install
```

### 3. 启动开发服务器

```bash
cd frontend
export FRONTEND_PORT=4321
export BACKEND_PORT=8000
npm run dev
```

访问 <http://localhost:4321> 即可。

### 4. 生产构建

```bash
cd frontend
export FRONTEND_PORT=4321
export BACKEND_PORT=8000
npm run build
npm run preview
```

---

## 三、演示账号

首次启动后端时会自动写入以下账号，登录时直接输入「用户名」即可，无需密码。

| 用户名 | 显示名 | 角色 | 职责 |
| --- | --- | --- | --- |
| `store_manager_wang` | 王店长 | 店长（store_manager） | 发起补货申请、异常退回时补正 |
| `operations_supervisor_li` | 李督导 | 营运督导（operations_supervisor） | 店长提交后第一签：签收 / 退回补正 |
| `hq_ops_zhang` | 张运营 | 总部运营（headquarters_operations） | 营运督导后第二签：完成确认 / 退回 |
| `registrar_chen` | 陈登记员 | 补货登记员（replenishment_registrar） | 辅助发起与补正 |
| `auditor_zhao` | 赵审核 | 补货审核主管（replenishment_auditor） | 补正后复核 |
| `review_lead_sun` | 孙复核 | 便利店连锁复核负责人（chain_review_lead） | 签收完成后最终复核归档 |

登录页底部提供了**一键快速切换按钮**，便于演示不同角色视角。

---

## 四、四类补货申请演示数据

| 单号 | 门店 | 标题 | 状态 | 当前处理人 | 重点测试场景 |
| --- | --- | --- | --- | --- | --- |
| RP-2026-06-001 | 朝阳便利店 | 日常月底补货申请 | **待签收（pending_signature）** | 李督导 | ✅ **正常流转**：督导签收 → 总部完成 → 复核归档 |
| RP-2026-06-002 | 海淀便利店 | 临期饮料促销后紧急补货 | **异常回传（exception_returned）** + 已逾期 | 王店长 | ❌ **缺材料 + 超时/逾期**：需补正 + 不能批量放行，必须逐条处理 |
| RP-2026-06-003 | 西城便利店 | 新开门店首月补货 | **草稿（draft）** | 王店长 | 🧾 初始提交 / 补正流程 |
| RP-2026-06-004 | 东城便利店 | 夏季冷饮专项补货 | **签收完成（signature_complete）** | 孙复核 | 📦 最终复核归档路径 |

> 单据 RP-2026-06-002 已经逾期，在批量处理面板中会被自动拦截，
> 只能进入详情页留下**补正动作 + 异常原因**后继续流转。

---

## 五、核心业务规则（后端强制校验）

即使绕过页面直接调接口，后端也会**凭当前角色、当前处理人、状态、版本、必填证据**拦住：

| 拦截类型 | 触发条件 | HTTP 状态码 |
| --- | --- | --- |
| 越权 | 操作人 ≠ `current_handler`，或角色无权执行该动作 | 403 |
| 重复提交 | 状态已变更为终态（archived）再操作 | 409 |
| 状态冲突 | 动作与当前状态不匹配（如对 draft 执行 archive） | 409 |
| 旧版本提交 | 请求体 `current_version` ≠ DB 当前版本（乐观锁） | 409，附带期望版本 |
| 缺证据请求 | `sign/complete/archive` 未填 result、`return` 未填 return_reason、`correct` 无附件 | 400 |
| 批量逾期放行 | 批量处理中任一条已逾期：该条单独失败、其它正常处理 | 200（逐单反馈） |

**异常日志只作为证据，不能替代详情页的真实处理结果**（`exception_logs` 与
`processing_records` 分表存储，UI 中也以不同分区展示）。

---

## 六、前端页面

### 1. 第一屏：待办队列 + 处理依据

- 顶部蓝色标题栏：「便利店连锁-月底集中处理补货申请系统」+ 当前用户 + **角色切换下拉**
- 左侧导航：
  - 📋 补货申请列表（带待办数量徽标）
  - ⚡ 批量处理
  - 处理依据说明（店长→督导→总部运营→复核归档）
- 右侧主工作区：列表页默认展示「我的待办」，可切换查看全部

### 2. 补货申请列表

- 筛选：关键字（单号 / 标题 / 描述）、状态、优先级、是否只看我的、一键刷新
- 展示字段：单据号、门店、标题、责任人、当前处理人、优先级、状态、截止时间、预警、异常标签、办理按钮
- 到期预警分三级：**正常（绿）/ 临近截止 24h（橙）/ 已逾期（红）**
- 顶部统计卡片：总数、待处理、临近截止、已逾期

### 3. 补货申请详情

包含五大部分，全部围绕同一补货申请命名，状态一致：

1. **基本信息网格**：标题、状态、描述、优先级、责任人、当前处理人、截止时间、版本号、异常标签
2. **附件（办理证据）**：文件名、上传人、上传时间
3. **办理操作区**：
   - 非当前处理人 / 已归档：显示无权提示
   - 当前处理人：按状态展示可行动作按钮（submit / sign / complete / return / correct / recheck / archive）
   - 弹出必填项：办理结果 / 退回原因
4. **审计备注**：追加备注（仅作留痕）
5. **处理记录（审计轨迹）时间线**：状态流转、结果、退回原因、操作人、时间
6. **异常日志（证据）**：强调"仅作证据，不替代真实处理结果"

### 4. 批量处理面板

- 顶部：动作选择 + 批量结果 + 执行按钮
- 已逾期单据**自动禁用勾选框**并在顶部红色提示需逐条处理
- 提交后展示**逐单结果**：✅ 成功 / ❌ 失败（附失败原因）

---

## 七、复查闭环（验证用例）

| # | 用例 | 预期 |
| --- | --- | --- |
| 1 | 正常流转：王店长提交草稿 → 李督导签收 → 张运营完成 → 孙复核归档 | 每一步状态正确回写、处理记录完整、版本号递增 |
| 2 | 缺材料：李督导退回 RP-2026-06-002（未填退回原因） | 后端拒绝 400「退回原因不能为空」，状态不变 |
| 3 | 超时/逾期：批量处理 RP-2026-06-002（已逾期） | 该条单独失败，提示"已逾期，禁止批量推进"，异常日志入库 |
| 4 | 退回补正：王店长对异常回传单据补正后重新提交 | 状态 → correction_pending，标签更新，版本号 +1 |
| 5 | 状态冲突：孙复核对 draft 执行 archive | 后端拒绝 409「不支持的状态流转」 |
| 6 | 旧版本提交：页面打开详情后，另一窗口先办结，当前窗口再提交 | 后端拒绝 409「VersionConflict」，返回期望版本号 |
| 7 | 越权：陈登记员尝试签收李督导的单据 | 后端拒绝 403「无权执行」 |
| 8 | 刷新一致性：办理后刷新，列表 / 详情 / 统计 / 处理记录状态一致 | 全部一致（回查 DB 实时渲染） |

---

## 八、技术要点

### Rust 后端

- **Rocket 0.5**：类型安全路由、`FromRequest` 实现 JWT-less Token 鉴权
- **rusqlite + bundled**：无需系统 SQLite，自带编译；`chrono` 日期、`r2d2` 连接池
- **thiserror + Responder**：业务错误统一映射 HTTP 状态码
- **乐观锁**：每次更新校验 `version`，成功后 `version += 1`
- **CORS**：`rocket_cors`，允许的源基于 `FRONTEND_PORT` 动态构造

### Astro + React 前端

- **Astro 4**：零 JS 默认，仅 `<MainApp client:load />` 作为单一 React Island 挂载
- **zustand**：登录态、所有用户列表、角色切换
- **axios**：统一注入 `Authorization` 头与错误日志
- **纯 CSS**：`global.css` 中集中定义，不依赖 UI 库，轻量可维护

---

## 九、常见问题

**Q: 修改了端口，CORS 报错？**
A: 同时重启前后端，并确保两端 `FRONTEND_PORT`、`BACKEND_PORT` 环境变量一致。

**Q: 角色切换后待办列表没变化？**
A: 列表默认勾选"只看我的待办"，切换角色后自动按新用户重新查询。若仍不刷新，点右上角 🔄 刷新按钮。

**Q: 想彻底重置所有数据？**
A:
```bash
rm -f backend/data/replenishment.db
# 重启后端即可自动重建并灌入演示数据
```
