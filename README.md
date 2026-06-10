# 酒店集团-月底集中处理住客订单系统

> 系统标题：**酒店集团-月底集中处理住客订单系统**
> 前端：Next.js 14 (App Router) · 后端：Node.js + Fastify · 数据：本地 SQLite（文件落盘）
> 流程三段式：**待分派 / 已转办 / 已回访** · 页面标签只出现这三个状态

---

## 一、岗位 / 角色配置

| 角色 | 账号 | 密码 | 职责 |
|------|------|------|------|
| 住客登记员 | `registrar` | `123456` | 发起住客订单登记 / 退回后补正提交 |
| 住客审核主管 | `supervisor` | `123456` | 办理审核、转办集团复核、或退回登记员补正 |
| 酒店集团复核负责人 | `reviewer` | `123456` | 复核通过（变为「已回访」）、或复核归档 |

> 前端右上角的「角色切换下拉」可模拟切换当前登录账号（演示用）；后端每个接口都通过请求头 `X-User-Id` 再次校验，**不能靠隐藏按钮绕过越权**。

---

## 二、统一端口配置（全工程共用，不要写死）

**端口只通过环境变量配置一次，以下 5 个地方都会自动同步：**

| 用途 | 环境变量 | 默认值 |
|------|----------|--------|
| 前端 dev server 端口 | `FRONTEND_PORT` | 3000 |
| 后端监听端口 | `BACKEND_PORT` | 4000 |
| 后端 CORS 白名单 `http://localhost:${FRONTEND_PORT}` | 同 `FRONTEND_PORT` | — |
| 前端 `next.config.mjs` 的 rewrites 代理到后端 | 同 `BACKEND_PORT` | — |
| README 启动命令说明 | 同环境变量 | — |

> 根目录 `.env.example` 已给出示例，如需修改端口，直接复制为 `.env` 并设置；macOS / Linux 可直接在命令前带环境变量。

---

## 三、目录结构

```
.
├── backend/                        # Fastify + SQLite 后端
│   ├── package.json
│   └── src/
│       ├── server.js               # Fastify 入口 + CORS + 路由注册
│       ├── config.js               # 端口 / 状态 / 证据规则常量
│       ├── db/init.js              # SQLite 建表 + 演示数据初始化
│       ├── utils/
│       │   ├── auth.js             # 角色 / 处理人 / 版本 / 状态 / 证据校验
│       │   └── helpers.js          # 审计轨迹、异常原因、版本号 bump
│       └── routes/
│           ├── users.js            # 登录 / 当前用户 / 用户列表
│           ├── orders.js           # 住客订单 CRUD、流转、批量推进
│           └── attachments.js      # 附件、处理记录、异常、审计备注
├── frontend/                       # Next.js 14 App Router 前端
│   ├── next.config.mjs             # /api/* 代理到后端 + 读取端口
│   ├── tsconfig.json
│   ├── lib/
│   │   ├── api.ts                  # fetch 封装，自动带 X-User-Id
│   │   ├── types.ts                # 完整 TypeScript 类型
│   │   └── format.tsx              # 时间 / 金额 / 状态徽章
│   ├── components/HeaderBar.tsx    # 顶部系统标题 + 角色切换
│   └── app/
│       ├── layout.tsx / globals.css
│       ├── page.tsx                # 首页：待分派 / 已转办 / 已回访 Tab 列表
│       ├── new/page.tsx            # 住客订单登记页
│       ├── batch/page.tsx          # 到期预警 + 批量推进（逐条返回结果）
│       └── orders/[id]/page.tsx    # 详情办理 + 审计轨迹 + 异常原因
├── data/hotel_orders.db            # SQLite 数据库（执行 init-db 后生成）
├── .env.example
└── package.json                    # 根工程聚合命令
```

---

## 四、启动步骤

> 以下命令中所有出现的 `FRONTEND_PORT=3000 BACKEND_PORT=4000` 都可以按需替换为其他端口；**不要改成写死其他端口，否则 CORS 白名单会拒绝跨域**。

```bash
# 1. 根目录安装依赖（也可以分别进 backend 和 frontend 目录 npm install）
cd backend  && npm install && cd ..
cd frontend && npm install && cd ..

# 2. 初始化 SQLite（建表 + 6 条演示订单 + 角色 + 附件 / 异常 / 审计记录）
#    数据库文件生成路径：backend/../data/hotel_orders.db
cd backend
BACKEND_PORT=4000 FRONTEND_PORT=3000 npm run init-db
cd ..

# 3a. 分两个终端启动（推荐）
# 终端 A：后端
cd backend
BACKEND_PORT=4000 FRONTEND_PORT=3000 npm run dev
# 终端 B：前端
cd frontend
FRONTEND_PORT=3000 BACKEND_PORT=4000 npm run dev

# 3b. 或者单终端一起启动（根目录）
npm install          # 安装 concurrently
FRONTEND_PORT=3000 BACKEND_PORT=4000 npm run dev

# 4. 浏览器访问前端
#    http://localhost:3000
# 后端健康检查
#    http://localhost:4000/api/health
# 后端运行时配置
#    http://localhost:4000/api/config  会回显前端端口、后端端口、CORS 白名单
```

---

## 五、SQLite 表说明

初始化后自动创建 6 张表，全部围绕住客订单命名，并能互相回写状态：

| 表名 | 说明 |
|------|------|
| `orders` | **住客订单主表**：状态 `pending/transferred/reviewed/archived`、当前处理人 / 当前环节角色、版本号（乐观锁）、处理期限 |
| `attachments` | **住客订单附件 / 证据**：身份证、入住登记单、押金收据、核验记录等；按 `evidence_type` 校验缺失 |
| `processing_records` | **住客订单处理记录**：每次状态 / 处理人 / 版本变更都会写入一条，含操作前后快照，用于审计轨迹时间线 |
| `audit_notes` | **住客订单审计备注**：普通 / 补正 / 异常 三类，详情页可见 |
| `exception_reasons` | **住客订单异常原因**：严重程度（低/中/高）、是否解决、解决人，退回补正时自动生成 |
| `users` | 用户 / 角色表 |

**跨表一致性保障：**
- 每次提交前后端校验：① 当前角色 ② 当前处理人 ③ 状态 ④ 版本号（乐观锁）⑤ 必填证据
- 任一不匹配都会返回明确 `code` + `message`，前端会用红色 Banner 展示，**不会静默覆盖或直接归档**。

---

## 六、业务模块（三块）与状态联动

页面业务区由三大模块组成，每一步都会带动状态、证据、异常原因的变化并回写 `orders.status`：

1. **住客订单登记**（住客登记员发起）
   - 提交后 `status = pending（待分派）`，`version = 1`
   - 校验缺「身份证 / 入住登记单」会被拦截
2. **过程核验**（住客审核主管办理，或退回登记员补正）
   - 转办 → `status = transferred（已转办）`，处理人切换为下一环节
   - 退回补正 → 仍是 `transferred`，但处理人切回登记员，`exception_reasons` 自动记录一条
   - 补正提交 → 仍是 `transferred`，处理人切回审核主管，原未解决异常自动标记解决
3. **复核归档**（酒店集团复核负责人）
   - 复核通过 → `status = reviewed（已回访）`，详情保留前厅接待 / 客房主管记录
   - 复核归档 → 后台 `status = archived`，订单从队列消失

---

## 七、四类异常样例（初始化数据已预置，可直接操作）

初始化的 6 条订单正好覆盖你会测试的四种场景：

### 🟢 样例 1：正常流转 —— 订单 G20250601001（陈正常）
- 当前：待分派 → 角色切到 `registrar` → 进入详情 → 转办 → 已转办
- 然后切 `supervisor` → 转办 → 集团复核（仍是已转办）
- 最后切 `reviewer` → 复核通过（已回访）→ 复核归档
- 关键点：每一步版本号 v1 → v2 → v3 → v4，版本不对会被拦截；审计轨迹可看到所有步骤。

### 🔴 样例 2：缺材料 —— 订单 G20250601002（赵缺材）
- 当前：已转办（审核主管环节）
- 先切 `registrar` 尝试转办 → 被拦截（不是当前处理人）
- 切 `supervisor` 进入详情 → 尝试转办集团复核 → 会报「缺少必填证据：deposit_slip / review_note」
- 先「上传证据」补齐押金收据 + 核验记录 → 再转办才放行
- 或者点「退回补正」登记异常，切回 `registrar` 看到处理人变成自己，补正材料后再提交

### 🟠 样例 3：超时 / 逾期 —— 订单 G20250601003（孙临期）、G20250601004（周逾期）
- 孙临期：**临期预警**，列表行高亮黄色，距截止不足 1 小时
- 周逾期：**已逾期 3 天**，列表行高亮红色
- 去「批量处理 / 到期预警」页面 → 选择逾期视图 → 勾选 → 「逾期批量推进」
- 每条都会返回成功或失败原因（如：非逾期跳过、无权限、缺证据等），不会静默通过
- 详情页保留办理期限、逾期天数、异常原因登记

### 🟡 样例 4：退回补正 / 状态冲突 —— 订单 G20250601006（郑补正）
- 当前：已转办，但处理人是 `registrar`（已退回补正），异常原因「签名缺失」
- 切 `registrar` → 进入详情，能看到异常原因、退回备注
- 点击「补正材料后重新提交」：
  - 若勾选证据不全 → 被拦截 `MISSING_EVIDENCE`
  - 若版本号与后端不一致（例如同时开两个页签提交）→ 被拦截 `VERSION_CONFLICT`
  - 若不是当前处理人角色 → 被拦截 `NOT_YOUR_HANDLER / ROLE_MISMATCH`
- 正确提交后处理人切回审核主管，未解决异常自动标记为已解决

---

## 八、后端拦截码速查（越权 / 异常均返回明确错误）

| code | 说明 | 触发场景 |
|------|------|----------|
| `MISSING_USER` | 请求未带 `X-User-Id` | 前端未登录时 |
| `INVALID_USER` | 用户不存在或已离职 | 账号被删除 |
| `PERMISSION_DENIED` | 越权：角色不匹配 | 登记员去点复核归档 |
| `NOT_YOUR_HANDLER` | 非当前指定处理人 | 主管去处理指派给登记员的补正单 |
| `ROLE_MISMATCH` | 当前处理环节与角色不符 | 复核负责人去做登记员转办 |
| `MISSING_VERSION` / `VERSION_CONFLICT` | 缺少版本 / 乐观锁冲突 | 双页签并发提交 |
| `STATUS_CONFLICT` | 非法状态流转 | 直接把「已回访」改回「待分派」 |
| `STATUS_SYNC_CONFLICT` | 队列刷新前页面状态与后端不一致 | 角色边界二次校验失败，避免静默覆盖 |
| `DUPLICATE_ACTION` | 重复提交同一动作 | 连点两次提交按钮 |
| `MISSING_EVIDENCE` | 证据缺失 | 登记没传身份证、主管没传押金单 |
| `BAD_EVIDENCE_TYPE` | 证据类型非法 | 不在 5 类之内 |
| `DUPLICATE_ORDER_NO` | 订单号重复 | 新建时 |
| `NOT_FOUND` | 订单不存在 | 详情 ID 错误 |
| `NOT_OVERDUE` / `ALREADY_ARCHIVED` / `CANNOT_PUSH` | 批量推进拦截 | 逐条返回 |

---

## 九、前端功能清单

- ✅ 顶部系统标题：**酒店集团-月底集中处理住客订单系统**
- ✅ 右上角角色切换（registrar / supervisor / reviewer），自动刷新列表与权限
- ✅ 首页三段 Tab：**待分派 / 已转办 / 已回访**，页面只出现这三个标签
- ✅ 列表筛选：关键字 / 紧急度 / 订单类型 / 我的或全量
- ✅ 临期 / 逾期行高亮与徽章；到期预警 3 栏队列（正常 / 临期 / 逾期）
- ✅ 详情办理：证据上传、异常原因、审计备注、处理记录时间线
- ✅ 值班经理复核前可见前厅接待 / 客房主管核查记录
- ✅ 批量处理：逾期批量推进 + 每条返回成功/失败原因（含拦截码）
- ✅ 队列刷新按钮：同步后端记录，防止静默覆盖
- ✅ 所有写操作弹框显示当前版本号，并提示拦截项

---

## 十、快速验收 Checklist

1. [ ] 打开首页能看到 3 段 Tab，每个 Tab 有订单计数
2. [ ] 切换右上角角色，按钮、详情处理动作会变化（不只是隐藏按钮，后端也会拦）
3. [ ] 新建订单 G20250601999 → 能在「待分派」看到 → 转办后进入「已转办」
4. [ ] 订单 G20250601002（赵缺材）点「转办集团复核」会报缺证据，补齐后能通过
5. [ ] 订单 G20250601006（郑补正）切登记员能看到异常原因，补正后处理人切回主管
6. [ ] 批量处理页选择 3 条逾期订单 → 推进，返回结果里每条有成功或失败原因
7. [ ] 开两个页签同时打开同一订单详情 → 其中一个先提交 → 另一个提交会报 `VERSION_CONFLICT`
8. [ ] 访问 `http://localhost:4000/api/config` 能看到前后端端口与 CORS 白名单一致
9. [ ] SQLite 文件真实存在于 `data/hotel_orders.db`，重启后数据、统计、审计记录一致
10. [ ] 详情页审计轨迹能看到所有操作时间线，含状态变化、处理人变化、版本变化、证据变化
