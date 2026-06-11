# SaaS客户成功团队-月底集中处理上线计划单系统

## 系统概述

面向 SaaS 客户成功团队的上线计划单闭环管理系统，实现：
- **客户成功经理**：建单、补齐材料
- **交付顾问**：办理、配置检查、验收
- **客户成功负责人**：复核、退回、归档收口

主链路状态流转：**草稿 → 待复核 → 已归档**

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端 | Angular 18 + Vite 5 + TypeScript 5 | ✅ |
| 后端 | Node.js + Fastify 4 | ✅ |
| 数据库 | 本地 SQLite（better-sqlite3） | ✅ |
| 状态管理 | BehaviorSubject + Services | ✅ |

## 端口约定（**全局统一，请勿修改**）

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 Vite Dev Server | **3003** | http://localhost:3003 |
| 后端 Fastify Server | **8003** | http://localhost:8003 |
| CORS 白名单 | http://localhost:3003, http://127.0.0.1:3003 | 硬编码 |
| 前端 API 代理 | /api → http://localhost:8003 | Vite Proxy |

## 快速启动

### 方式一：一键启动前后端（推荐）

```bash
# 1. 安装全部依赖
npm run install:all

# 2. 同时启动前后端（需要 concurrently）
npm run dev
```

### 方式二：分终端启动

```bash
# 终端 A - 启动后端（端口 8003）
cd backend
npm install
npm run dev

# 终端 B - 启动前端（端口 3003）
cd frontend
npm install
npm run dev
```

启动成功后访问：**http://localhost:3003**

## 模拟用户（通过页面右上角切换）

| 用户名 | 角色 | 角色编码 | 权限 |
|--------|------|----------|------|
| 张三 | 客户成功经理 | cs_manager | 建单、补齐、提交 |
| 王五 | 客户成功经理 | cs_manager | 建单、补齐、提交 |
| 李四 | 交付顾问 | delivery_consultant | 建单、配置、提交 |
| 赵六 | 交付顾问 | delivery_consultant | 建单、配置、提交 |
| 王总 | 客户成功负责人 | cs_lead | 退回、归档、全权限 |

## 预置测试数据（4 条典型场景）

| 单号 | 客户 | 场景 | 状态 | 到期 | 用于测试 |
|------|------|------|------|------|---------|
| LP-2026-0601 | 北京云端科技 | 正常流转 | 草稿 | +5天 | 建单→提交→复核→归档 |
| LP-2026-0602 | 上海智联网络 | 待复核（临期） | 待复核 | +1天 | 退回补正或归档 |
| LP-2026-0603 | 深圳创新智造 | **缺材料+已逾期** | 草稿 | -2天 | 批量拦截、详情补正 |
| LP-2026-0604 | 广州优享电商 | 已归档样例 | 已归档 | +10天 | 只读状态、审计轨迹 |

## 功能清单

### 🌐 前端页面

**1. 列表页（/）**
- 统计卡片：全部/草稿/待复核/已归档/已逾期/临期（点击快速筛选）
- 筛选器：状态、优先级、责任人、到期预警、关键词搜索
- 表格列：单号、客户、项目、优先级、截止日期、预警、状态、责任人、当前处理人、异常标签
- 批量操作：批量推进到待复核、批量归档（**逾期单据逐条拦截，留下异常原因**）
- 新建计划单弹窗
- 批量处理结果弹窗（逐条显示成功/失败原因）

**2. 详情页（/launch-plans/:id）**
- 头部：单号、状态、预警、操作按钮、元信息（版本号对比）
- 退回原因告警条、逾期告警条
- 主工作区：
  - 上线目标（富文本区）
  - 配置检查清单
  - 验收确认内容
  - 附件上传/删除
- 侧边栏：
  - 处理结果
  - 退回原因
  - 添加审计备注
  - 单据信息面板
  - 提交备注/证据说明
- 审计轨迹 Tab 页：
  - 处理记录（时间线）
  - 审计备注（时间线）
  - 异常日志（表格，仅证据）

### 🔌 后端 API （全部 /api/*）

| 方法 | 路径 | 说明 | 校验 |
|------|------|------|------|
| GET | /api/launch-plans | 列表（支持 status/priority/owner/warning/keyword） | 登录 |
| GET | /api/launch-plans/stats | 统计 | 登录 |
| GET | /api/launch-plans/:id | 详情（含附件/记录/审计/异常） | 登录 |
| POST | /api/launch-plans | 创建 | 角色=CS经理/交付顾问, 必填字段 |
| PUT | /api/launch-plans/:id | 修改 | **版本校验、当前处理人、归档不可改** |
| POST | /api/launch-plans/:id/submit | 提交到待复核 | **版本、状态、必填证据、附件/证据二选一、处理人** |
| POST | /api/launch-plans/:id/reject | 退回 | 角色=负责人、版本、状态、原因≥5字 |
| POST | /api/launch-plans/:id/archive | 归档 | 角色=负责人、版本、验收≥10字、结果≥5字 |
| POST | /api/launch-plans/batch-advance | 批量推进 | **逾期拦截、材料检查、逐条结果** |
| POST | /api/launch-plans/:id/attachments | 上传附件 | 归档不可传 |
| DELETE | /api/attachments/:id | 删除附件 | 仅本人/负责人 |
| POST | /api/launch-plans/:id/audit-notes | 追加审计备注 | 全员 |
| GET | /api/users | 用户列表 | 登录 |
| GET | /api/me | 当前用户 | 登录 |

**认证方式**：HTTP Header 模拟登录
```
X-User-Name: 张三
X-User-Role: cs_manager （可选，强制角色，用于越权测试）
```

### ✅ 后端核心校验逻辑

1. **版本冲突（409）**：每次写操作必须传 `version`，与后端不一致时拒绝并记录异常日志
2. **越权（403）**：
   - 创建：仅 CS经理 / 交付顾问
   - 退回 / 归档：仅客户成功负责人
   - 修改：当前处理人 或 负责人是本人的CS经理 或 cs_lead
3. **状态校验（400）**：不符合状态机的动作直接拒绝
4. **证据校验（400）**：
   - 提交：上线目标≥10字、配置清单≥10字、附件≥1个或有证据说明
   - 归档：验收确认≥10字、处理结果≥5字
5. **逾期拦截（批量）**：逾期单据无法批量推进，记录异常+处理记录，详情留痕
6. **异常日志**：所有冲突、缺失、拦截事件记录到 `exception_logs` 表，仅作为证据，不替代真实处理结果

### 🗄️ SQLite 表结构（位于 backend/data/launch-plans.db）

| 表 | 用途 | 关键字段 |
|----|------|---------|
| launch_plans | 上线计划单主表 | id, plan_no, status, version, deadline_warning 实时计算 |
| attachments | 附件 | launch_plan_id, file_path, uploaded_by |
| process_records | 处理记录（时间线） | action, from_status, to_status, operator_role, evidence |
| audit_notes | 审计备注 | author, author_role, note |
| exception_logs | 异常日志（证据） | type, detail, operator |

## 测试场景（用户验收清单）

### 📱 页面侧测试

| # | 场景 | 操作路径 | 期望结果 |
|---|------|---------|---------|
| 1 | 角色切换联动 | 右上角切换王总→张三 | 列表按钮、详情按钮、当前处理人高亮变化 |
| 2 | 筛选联动 | 状态+优先级+责任人组合筛选 | 列表、总数、统计卡片一致 |
| 3 | 详情办理 | 编辑→保存→提交 | 状态变更、处理记录追加、版本号+1 |
| 4 | 批量处理 | 勾选 LP-001 + LP-003（逾期）→批量推进 | LP-001成功，LP-003逾期拦截并在详情留痕 |
| 5 | 批量结果弹窗 | 执行上面操作 | 逐条显示成功/失败原因 |
| 6 | 刷新后一致 | 操作后刷新页面 | 列表、详情、统计、记录全部一致 |

### 🔌 接口侧测试（curl 示例）

```bash
# 正常获取列表（张三 CS经理）
curl -H "X-User-Name: 张三" http://localhost:8003/api/launch-plans

# 越权测试：用张三（CS经理）尝试退回
curl -X POST -H "X-User-Name: 张三" -H "Content-Type: application/json" \
  -d '{"version":1,"reject_reason":"越权测试"}' \
  http://localhost:8003/api/launch-plans/plan-002/reject
# 期望：403，返回"仅客户成功负责人有权退回"

# 版本冲突测试：提交后再用旧版本修改
curl -X PUT -H "X-User-Name: 张三" -H "Content-Type: application/json" \
  -d '{"version":1,"customer_name":"测试版本冲突"}' \
  http://localhost:8003/api/launch-plans/plan-001
# 期望：409，exception_logs 记录 version_conflict

# 缺证据测试：提交时配置检查为空
# 先清掉 plan-001 的 config_checklist 再提交
curl -X POST -H "X-User-Name: 张三" -H "Content-Type: application/json" \
  -d '{"version":1}' \
  http://localhost:8003/api/launch-plans/plan-003/submit
# 期望：400，"提交前请补齐材料：配置检查清单"

# 重复提交测试：已归档单据尝试再次提交
curl -X POST -H "X-User-Name: 王总" -H "Content-Type: application/json" \
  -d '{"version":1}' \
  http://localhost:8003/api/launch-plans/plan-004/submit
# 期望：400，当前状态为"已归档"，不能提交审核

# 旧版本提交（模拟用户页面未刷新）
curl -X POST -H "X-User-Name: 李四" -H "Content-Type: application/json" \
  -d '{"version":1}' \
  http://localhost:8003/api/launch-plans/plan-001/submit
# 修改后再用 version=1 提交，期望 409
```

## 目录结构

```
trae-123-3/
├── package.json              # 根配置（workspace）
├── README.md
├── backend/
│   ├── package.json
│   ├── data/launch-plans.db  # SQLite 自动生成
│   ├── uploads/              # 附件自动生成
│   └── src/
│       ├── server.js         # Fastify 启动（端口 8003）
│       ├── db.js             # SQLite 初始化 + 种子数据
│       ├── middleware.js     # 角色/状态/预警/异常日志工具
│       └── routes/launch-plans.js  # 全部 API
└── frontend/
    ├── package.json
    ├── vite.config.ts        # Vite 配置（端口 3003，代理 /api）
    ├── tsconfig.json
    ├── angular.json
    ├── index.html
    └── src/
        ├── main.ts
        ├── styles.css
        ├── polyfills.ts
        └── app/
            ├── app.module.ts
            ├── app.component.ts
            ├── models/launch-plan.ts
            ├── services/
            │   ├── auth.service.ts
            │   ├── launch-plan.service.ts
            │   └── toast.service.ts
            └── components/
                ├── launch-plan-list/
                ├── launch-plan-detail/
                ├── create-plan-modal/
                ├── batch-result-modal/
                ├── reject-modal/
                ├── archive-modal/
                └── audit-timeline/
```

## 到期预警规则

| 状态 | 条件 | 标签 | 说明 |
|------|------|------|------|
| 正常 | 已归档 或 距离截止 > 2天 | 正常 | |
| 临期 | 距离截止 ≤ 2天 且 > 0天 | ⏰ 临期 | 状态卡黄色 |
| 逾期 | 距离截止 < 0天 且 未归档 | 🚨 已逾期 | **批量拦截**，必须详情页处理 |

逾期批量推进时，系统会：
1. 为该单据写入 `exception_logs`（type=overdue_blocked）
2. 为该单据写入 `process_records`（action=overdue_blocked，含责任人+截止日期）
3. 在批量结果中以 **失败原因** 形式展示
4. 用户需进入详情页处理补正后手动提交

## 接口规则 - 退回重新提交

当页面版本 ≠ 后端版本时（用户打开详情后被他人修改）：
1. 保存/提交时弹 **确认框** 提示用户
2. 若用户确认继续，后端比对 version 返回 **409 版本冲突**
3. 前端提示刷新重试，**避免静默覆盖**
4. 已归档单据 **禁止任何写操作**（400错误）
5. 异常日志仅作为审计证据，详情页的处理记录才是真实处理结果

## 许可证

内部系统使用
