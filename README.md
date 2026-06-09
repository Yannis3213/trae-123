# 连锁药房-月底集中处理处方订单系统

面向连锁药房月底集中处理处方订单场景，用于拦截异常（越权、重复提交、状态冲突、旧版本、缺证据、缺料、逾期）的全栈应用。

- **前端**：Astro 4 + React Islands（端口 `3004`）
- **后端**：Node.js Koa 2（端口 `8004`）
- **数据库**：本地 SQLite（better-sqlite3）

---

## 一、端口约定（全局统一）

| 用途 | 端口 | 配置位置 |
|---|---|---|
| 前端 Astro 开发服务器 | **3004** | `frontend/astro.config.mjs`（`server.port`）、`frontend/package.json`（`--port 3004`） |
| 后端 Koa 监听端口 | **8004** | `backend/src/app.js`（`PORT = 8004`） |
| CORS 白名单 | `http://localhost:3004`、`http://127.0.0.1:3004` | `backend/src/app.js`（`CORS_WHITELIST`） |
| 前端 API 代理 | `/api` → `http://localhost:8004` | `frontend/astro.config.mjs`（`vite.server.proxy`）、`frontend/src/lib/api.ts`（`API_BASE = '/api'`） |

> ⚠️ 本项目所有端口、请求地址、CORS 白名单、启动命令均共用上述 `3004 / 8004` 组合，没有其它写死端口。

---

## 二、启动步骤

### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端（新开一个终端）
cd frontend
npm install
```

### 2. 初始化 SQLite 数据库（首次运行必做）

```bash
cd backend
npm run init-db
```

该命令会在 `backend/data/pharmacy.db` 生成数据库并填充演示数据（5 个账号、8 条覆盖四类业务场景的处方订单、附件、处理记录、审计备注、异常原因）。

> 若需要重置：删除 `backend/data/pharmacy.db` 后再执行 `npm run init-db` 即可。

### 3. 启动后端（终端 1）

```bash
cd backend
npm start
# 输出包含：
# 🚀 后端服务已启动
# 📍 监听端口: 8004
# 🔗 API 地址: http://localhost:8004
# ✅ CORS 白名单: http://localhost:3004, http://127.0.0.1:3004
```

### 4. 启动前端（终端 2）

```bash
cd frontend
npm start
# Vite 会在 http://localhost:3004 提供 Astro 开发服务
```

浏览器访问：**http://localhost:3004**

---

## 三、演示账号

系统通过 `X-User-Id` 请求头标识当前用户，登录页选择账号后自动写入 localStorage。

| 账号 username | 姓名 | 角色 role | 权限范围 |
|---|---|---|---|
| `clerk_wang` | 王店员 | 门店店员（store_clerk） | 朝阳大药房（总店）建单、补正退回单据 |
| `clerk_li`   | 李店员 | 门店店员（store_clerk） | 朝阳大药房（分店）建单、补正退回单据 |
| `pharmacist_zhang` | 张药师 | 执业药师（pharmacist） | 总店处方订单核验、推进状态 |
| `pharmacist_chen`  | 陈药师 | 执业药师（pharmacist） | 分店处方订单核验、推进状态 |
| `manager_zhao`     | 赵经理 | 区域经理（area_manager） | 华东区域复核归档、异常拦截、退回补正 |

> 前端登录页下拉框包含所有演示账号，直接选择即可登录。

---

## 四、四类处方订单样例

数据库初始化时预置了 8 条处方订单，覆盖您要验证的 4 类场景。

| # | 订单号 | 患者 | 状态 | 角色 & 当前处理人 | 典型场景 |
|---|---|---|---|---|---|
| ① 正常流转 | `RX20260601001` | 张三 | `待签收`（pending_sign） | 张药师（执业药师） | 新建 → 执业药师签收 → 区域经理复核归档 |
| ② 缺料 | `RX20260601002` | 李四 | `缺料`（material_shortage） | 赵经理（区域经理） | 执业药师核验发现阿莫西林库存不足，标记缺料并流转至区域经理 |
| ③ 超时/逾期 | `RX20260601003` | 王五 | `逾期`（overdue） | 陈药师（执业药师，责任人） | 已超期 8 小时，节点超时自动关联责任人：陈药师 |
| ④ 退回补正 / 状态冲突 | `RX20260601004` | 赵六 | `退回补正`（returned_correction） | 王店员（门店店员） | 区域经理复核发现处方模糊、身份证号辨认不清，退回门店补正 |

另外还有 4 条用于辅助验证的单据：`RX20260601005`（已签收归档）、`RX20260601006`（分店待签收）、`RX20260601007`（异常回传）、`RX20260601008`（刚建单，72 小时到期）。

---

## 五、七类异常拦截（接口级）

后端所有状态变更接口均在 **权限 + 处理人 + 状态 + 版本 + 必填证据** 五层校验后才允许修改，任一不满足都会保留原值并提示具体原因。

| 异常类型 | error_code | 触发方式 | 返回示例 |
|---|---|---|---|
| 越权操作 | `unauthorized` | 用 `clerk_wang` 请求 `pharmacist_zhang` 作为处理人的订单 `/orders/:id/status` | `400 { error_code:'unauthorized', message:'越权操作：角色[store_clerk]非当前处理人不可查看该计划单，当前处理人为张药师' }` |
| 重复提交 | `duplicate_submit` | 对已是 `signed` 的订单再次请求 `to_status=signed`（非区域经理） | `400 { error_code:'duplicate_submit', message:'重复提交：订单已是「签收完成」状态，无需重复处理' }` |
| 状态冲突 | `state_conflict` | 用执业药师尝试将 `signed` 改为 `pending_sign` | `400 { error_code:'state_conflict', message:'状态冲突：当前状态为「signed」，角色「pharmacist」不可变更为「pending_sign」' }` |
| 旧版本提交 | `old_version` | 订单版本已是 v3，仍用 `version:1` 请求 | `400 / 409 { error_code:'old_version', message:'旧版本提交：当前版本为 v3，您提交的是 v1，请刷新后重试' }` |
| 缺证据 | `missing_evidence` | 执业药师签收时，订单还没有处方单 / 签收确认单 | `400 { error_code:'missing_evidence', message:'缺少必需证据：sign_off', missing:['sign_off'] }` |
| 缺料 | `material_shortage` | 执业药师主动选择 to_status=material_shortage，填入异常说明 | 系统会在 `abnormal_reasons` 表登记一条缺料异常，责任人 = 处理人 |
| 逾期 | `overdue` | 执业药师标记 to_status=overdue，或到期预警中 `warningLevel=overdue` | 节点超时自动关联责任人（当前处理人），异常登记 |

直接打接口测试时，请在请求头带上 `X-User-Id: <用户id>`，如：

```bash
# 用张药师（执业药师）查看订单列表
curl -H "X-User-Id: u_pharmacist_zhang" http://localhost:8004/api/orders

# 越权测试：用王店员（门店店员）推进已归属张药师的订单
curl -X POST http://localhost:8004/api/orders/<订单id>/status \
  -H "X-User-Id: u_clerk_wang" \
  -H "Content-Type: application/json" \
  -d '{"to_status":"signed","version":1}'
# → 返回 400 error_code=unauthorized，状态保留原值
```

---

## 六、业务区 & 角色视角

系统左侧菜单按当前角色动态切换，确保「岗位拆开」：

| 角色 | 菜单 | 说明 |
|---|---|---|
| 门店店员 | 处方订单登记、到期预警、操作记录 | 建单（登记患者信息 + 处方 + 证据），补正被退回的单据后重新提交「待签收」 |
| 执业药师 | 过程核验、到期预警、异常原因、操作记录 | 对待签收 / 异常回传订单进行核验：正常签收、异常回传、缺料、逾期或退回补正；处理后前端刷新队列 |
| 区域经理 | 复核归档、到期预警、异常原因、审计轨迹 | 对已处理订单复核归档（签收完成→签收完成），对缺料/逾期/异常回传做退回补正或正常签收；详情可见完整补正动作、异常原因、审计轨迹 |

流转状态机（核心）：`待签收 → 异常回传 → 签收完成 / 退回补正 → 待签收 ...`，中间可在执业药师、区域经理处分别打标 `缺料 / 逾期`。

---

## 七、到期预警 & 月底集中处理

顶部「到期预警」页面按三个时间队列分组展示，不混在一起：

- **正常（绿色）**：到期时间距现在 > 24 小时
- **临期（黄色）**：到期时间距现在 ≤ 24 小时
- **逾期（红色）**：已超过 due_at

点击顶部卡片可按队列筛选。每条逾期订单自动带出 **责任人** = 当前处理人（按后端 `handler_name`）。批量推进时后端逐条拦截，成功/失败在前端按条目给出原因。

---

## 八、SQLite 数据表

| 表 | 说明 |
|---|---|
| `users` | 用户账号、角色、所属门店/区域 |
| `prescription_orders` | 处方订单主表，含状态、版本、当前处理人、到期时间、异常原因、补正要求 |
| `attachments` | 证据附件（处方单、身份证明、签收确认等） |
| `processing_records` | 状态流转记录（时间线），每条都有 from/to 状态、处理人、版本 |
| `audit_notes` | 审计轨迹：查看、创建、状态变更、批量、上传、复核、退回补正 |
| `abnormal_reasons` | 异常原因登记：类型、说明、责任人、登记人、是否解决 |

所有页面刷新后，列表、详情、统计、操作记录均从同一份 SQLite 读取，保证前后一致。

---

## 九、常用 API

所有 API 均位于 `http://localhost:8004/api/*`，前端 Vite 代理 `/api/*` → `http://localhost:8004/api/*`。

| Method | Path | 说明 |
|---|---|---|
| POST | `/auth/login` | 登录，`{ username }` → 返回用户信息 + token |
| GET  | `/auth/me` | 获取当前用户（需 `X-User-Id`） |
| GET  | `/auth/users` | 全部用户列表 |
| GET  | `/orders?status=&warning=&keyword=&onlyMine=` | 处方订单列表（按权限过滤） |
| GET  | `/orders/statistics` | 状态维度 + 预警维度 + 待我处理 统计 |
| GET  | `/orders/:id` | 详情（含附件、处理记录、审计、异常） |
| POST | `/orders` | 门店店员创建订单 |
| POST | `/orders/:id/status` | 推进状态（带 version、异常原因、补正要求） |
| POST | `/orders/batch` | 批量处理，`{ ids, to_status, version_map, note }` → 返回每条结果 |
| POST | `/orders/:id/attachments` | 补充证据 |
| GET  | `/audit` | 审计轨迹 |
| GET  | `/audit/abnormal` | 异常登记列表 |
| GET  | `/dict` | 字典：角色、状态、异常类型、预警等级、当前角色允许的状态转换 |
