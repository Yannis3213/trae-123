# 🥬 生鲜采购单管理系统

生鲜超市-月底集中处理生鲜采购单系统。前端使用 Fresh（Deno + Preact），后端使用 Python Litestar + SQLite，按岗位分离权限与流程。

---

## 🚀 快速开始

### 1. 环境准备

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| Python | ≥ 3.10 | 后端运行时 |
| Deno | ≥ 1.40 | 前端 Fresh 运行时 |
| 端口 | FRONTEND_PORT / BACKEND_PORT | 前后端共享同一组端口变量 |

安装 Deno：
```bash
# macOS
brew install deno
# 或参考 https://docs.deno.com/runtime/manual/getting_started/installation
```

### 2. 端口配置

前后端 **共用一组环境变量**，不要在代码里写死其他端口。

```bash
# 复制 .env 示例
cp .env.example .env
# .env 内容：
# FRONTEND_PORT=8002
# BACKEND_PORT=8001
```

启动命令、前端请求地址、后端监听端口、CORS 白名单全部读取这组变量。

### 3. 一键启动

两个终端分别启动：

**后端**（自动建库 + seed + 启动 uvicorn）：
```bash
chmod +x start-backend.sh && ./start-backend.sh
# 后端地址: http://localhost:${BACKEND_PORT}
```

**前端**：
```bash
chmod +x start-frontend.sh && ./start-frontend.sh
# 前端地址: http://localhost:${FRONTEND_PORT}
```

或手动启动：
```bash
# 后端
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
export FRONTEND_PORT=8002 BACKEND_PORT=8001
python -m backend.app.main

# 前端（另一个终端）
cd frontend
export FRONTEND_PORT=8002 BACKEND_PORT=8001
deno task start
```

---

## 🔑 演示账号

| 账号 | 密码 | 角色 | 姓名 | 门店 |
|------|------|------|------|------|
| `registrar1` | `registrar123` | 生鲜采购登记员 | 张登记员 | 生鲜超市-朝阳店 |
| `registrar2` | `registrar123` | 生鲜采购登记员 | 李采购员 | 生鲜超市-海淀店 |
| `supervisor1` | `supervisor123` | 生鲜采购审核主管 | 王主管 | 生鲜超市-朝阳店 |
| `supervisor2` | `supervisor123` | 生鲜采购审核主管 | 赵门店经理 | 生鲜超市-海淀店 |
| `reviewer1` | `reviewer123` | 生鲜超市复核负责人 | 陈区域督导 | 生鲜超市-区域总部 |

登录页可点击演示账号卡片一键登录。

---

## 📋 四类测试单据（Seed 自动植入）

启动后数据库 `backend/fresh_purchase.db` 自动建表并写入以下样例：

| 单号 | 标题 | 类型 | 当前状态 | 说明 |
|------|------|------|---------|------|
| FPO-2026-0001 | 6月新鲜蔬菜批量采购 | 🟢 正常流转 | 待派发 | 登记员建单，报价材料齐全，可正常派发→处理→关闭 |
| FPO-2026-0002 | 进口水果采购-榴莲山竹 | 🟡 缺材料 | 待派发 | 供应商报价材料缺失，状态流转时会被拦截 |
| FPO-2026-0003 | 冷鲜肉品月度采购 | 🔴 超时/逾期 | 处理中 | 已超过约定到货日期，缺少到货验收凭证 |
| FPO-2026-0004 | 水产海鲜补货采购 | ↩️ 退回补正 / 状态冲突 | 待派发 | 主管已退回，含退回原因与异常标签 |
| FPO-2026-0005 | 日常干货补货 | ✅ 正常流转已关闭 | 已关闭 | 全流程完成的归档样例 |
| FPO-2026-0006 | 端午特色粽子礼盒采购 | 🟢 正常流转 | 处理中 | 正在主管处理阶段，临期预警 |

> **刷新后保持一致**：刷新列表、详情、统计、操作记录时结果应一致，数据全部写入 SQLite。

---

## 🧩 岗位与权限模型

### 角色 → 动作映射

| 角色 | 动作 | 可推进的状态流转 |
|------|------|----------------|
| **生鲜采购登记员** (registrar) | 发起采购单、补正、派发 | 待派发 → 处理中 |
| **生鲜采购审核主管** (supervisor) | 办理、推进、退回补正 | 处理中 → 已关闭 / 处理中 → 待派发（退回） |
| **生鲜超市复核负责人** (reviewer) | 复核、归档 | 待派发 → 处理中、处理中 → 已关闭 |

### 列表/详情/批量/审计轨迹均按角色过滤

- **登记员** 只能看到自己创建或当前处理、以及本门店待派发的单据；
- **主管** 只能看到本门店单据；
- **复核负责人** 可以看到所有单据。

### 后端状态变更时的权限校验（接口层拦截）

后端 `/orders/{id}/transition` 和 `/orders/batch` 在变更状态时会校验：

1. **角色权限**：当前角色是否允许该状态流转；
2. **版本冲突**：请求体 `expected_version` 必须等于数据库最新 `version`，防止重复提交 / 旧版本提交；
3. **当前处理人**：单据当前处理人与登录角色匹配；
4. **必填证据**：
   - 待派发 → 处理中：必须勾选「供应商报价材料齐全」，且报价内容长度≥10；
   - 处理中 → 已关闭：必须勾选「采购下单凭证齐全」+「到货验收凭证齐全」，且内容完整；
5. **截止时间**：关闭时若当前时间 > deadline 且未标记逾期，则拒绝；
6. **越权/状态冲突**：已关闭单据禁止再变更。

> 直接打接口即可验证以上拦截：使用非当前角色、错误版本号、缺证据的请求体会返回 400/401。

---

## 🔄 流程与状态

```
  [采购员 / 登记员建单]
           │
           ▼
     ┌─────────────┐
     │  待派发      │  ←── 主管退回补正回到这里
     └──────┬──────┘
            │ 登记员派发（校验报价材料）
            ▼
     ┌─────────────┐
     │  处理中      │  主管：采购下单、到货验收
     └──────┬──────┘
            │
     ┌──────┴──────┐
     ▼             ▼
  主管复核归档   主管退回补正
   (证据齐全)     (留下异常原因)
     │
     ▼
  已关闭 (归档)
```

**状态写死枚举**：`待派发 pending_dispatch` / `处理中 processing` / `已关闭 closed`。

---

## 📊 到期预警（列表页顶部 + 预警列）

| 级别 | 判定 | 颜色 |
|------|------|------|
| 🟢 正常 | 截止时间 > 24 小时 | 绿 |
| 🟡 临期 | 剩余 ≤ 24 小时 | 黄 |
| 🔴 逾期 | 当前时间 > 截止时间 | 红 |

- 列表顶部展示预警统计条；
- **逾期单据** 行底色变红，并在详情、处理记录、审计备注中留下责任人和处理轨迹；
- **批量推进** 时对逾期或缺材料单据 **逐条拦截**，不会整批放行，每条结果单独返回成功/失败原因，并在详情留下补正动作和异常原因。

---

## 📦 主工作区三要素

详情页按业务分三块：

1. **🏭 供应商报价**：报价内容 + 材料齐全标记 + 附件
2. **📝 采购下单**：下单详情 + 凭证齐全标记
3. **✅ 到货验收**：验收情况 + 凭证齐全标记

三块下方分别展示：**附件列表、处理记录（时间线）、审计备注**。

列表页列字段：单号、标题/供应商、门店/品类、**责任人**、**优先级**、**截止时间**、状态、预警、**当前处理人**、**异常标签**、操作。

---

## 🗄️ SQLite 数据表

文件位置：`backend/fresh_purchase.db`（首次启动自动创建 + seed）

| 表 | 说明 |
|----|------|
| `users` | 用户账号、角色、门店、密码哈希 |
| `fresh_purchase_orders` | 生鲜采购单主表：状态、版本、三要素内容、证据标记、异常/退回原因、预警级别 |
| `attachments` | 附件（文件名、分类、上传者、描述） |
| `processing_records` | 处理记录/审计轨迹：每次状态变更、编辑、批量操作，含动作、前后状态、处理人角色、结果、异常原因、核验证据 |
| `audit_notes` | 审计备注：人工备注、逾期预警、退回补正说明等 |

所有表都通过 `order_id` 关联到生鲜采购单，删除单据时级联删除。

---

## 🔌 核心后端 API

全部接口前缀 `http://localhost:${BACKEND_PORT}`，JWT Bearer Token 鉴权。

| Method | Path | 说明 |
|--------|------|------|
| POST | `/auth/login` | 登录，返回 `{ access_token, user }` |
| GET | `/auth/me` | 获取当前登录用户 |
| GET | `/orders` | 列表（按角色过滤，支持 status/priority/warning_level/has_exception/store/keyword/only_mine/page/page_size） |
| GET | `/orders/stats` | 仪表盘统计 |
| GET | `/orders/{id}` | 详情（含附件、处理记录、审计备注） |
| POST | `/orders` | 新建采购单（登记员/复核负责人） |
| PUT | `/orders/{id}` | 编辑补正（版本自动 +1） |
| POST | `/orders/{id}/transition` | **状态流转**（校验角色/版本/证据/截止时间） |
| POST | `/orders/batch` | **批量处理**（逐条校验，逐条返回成功/失败原因） |
| GET | `/orders/{id}/records` | 处理记录 |
| POST | `/orders/{id}/audit-notes` | 添加审计备注 |
| GET | `/health` | 健康检查 |

> API Schema：启动后端后打开 `http://localhost:${BACKEND_PORT}/schema` 查看 Swagger。

### 直接打接口验证示例

```bash
# 登录获取 token
TOKEN=$(curl -s -X POST http://localhost:8001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"registrar1","password":"registrar123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

# 查看列表
curl -H "Authorization: Bearer $TOKEN" http://localhost:8001/orders

# 尝试用旧版本提交状态流转（应被拦截）
curl -X POST http://localhost:8001/orders/1/transition \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"target_status":"processing","expected_version":999,"action":"派发处理"}'
```

---

## 🧪 试用验证清单

按用户需求准备的四类场景都已 seed：

1. ✅ **正常流转**：FPO-2026-0001 → 登记员派发 → 主管处理 → 复核归档，各角色列表/详情/批量结果同步变化；
2. ✅ **缺材料**：FPO-2026-0002 → 尝试派发会被后端拦截，停留在待处理列表，返回缺少报价材料；
3. ✅ **超时/逾期**：FPO-2026-0003 → 列表标红、责任人显示，尝试关闭提示逾期；
4. ✅ **退回补正 / 状态冲突**：FPO-2026-0004 → 含退回原因、异常标签、审计备注，旧版本号提交被拦截。

**批量处理**：勾选上述不同单据一起推进 → 成功/失败原因逐条显示，详情留有痕迹。

---

## 📁 目录结构

```
.
├── backend/                    # Python Litestar + SQLite
│   ├── app/
│   │   ├── main.py             # 应用入口
│   │   ├── config.py           # 配置（读取 FRONTEND_PORT / BACKEND_PORT）
│   │   ├── database.py         # SQLAlchemy 引擎 & Session
│   │   ├── models.py           # 数据模型
│   │   ├── schemas.py          # Pydantic schema
│   │   ├── auth.py             # JWT + 密码哈希
│   │   ├── permissions.py      # 权限/状态校验/处理记录
│   │   ├── seed.py             # 数据库初始化与种子数据
│   │   └── routers/
│   │       ├── auth.py         # 登录/鉴权路由
│   │       └── orders.py       # 采购单 CRUD、流转、批量
│   └── requirements.txt
├── frontend/                   # Fresh (Deno + Preact)
│   ├── dev.ts / main.ts        # Fresh 入口
│   ├── fresh.config.ts         # 读取 FRONTEND_PORT
│   ├── fresh.gen.ts            # 自动生成的路由/Island 清单
│   ├── utils/
│   │   ├── types.ts            # TS 类型 + 枚举文案
│   │   ├── api.ts              # fetch 封装（读 BACKEND_PORT 拼 API_BASE）
│   │   └── store.ts            # Preact Signals 全局状态
│   ├── islands/                # 交互组件
│   │   ├── LoginIsland.tsx
│   │   ├── OrderListIsland.tsx
│   │   ├── OrderDetailIsland.tsx
│   │   ├── BatchProcessIsland.tsx
│   │   └── CreateOrderIsland.tsx
│   ├── routes/                 # 页面路由
│   │   ├── _layout.tsx         # 头部导航布局
│   │   ├── login.tsx
│   │   ├── index.tsx           # 列表
│   │   ├── create.tsx
│   │   ├── batch.tsx
│   │   └── orders/[id].tsx     # 详情
│   ├── components/
│   │   └── App.tsx
│   └── static/styles.css
├── start-backend.sh
├── start-frontend.sh
├── .env.example
└── README.md
```

---

## ⚙️ 端口一致性说明

**所有读取端口的位置都用同一组环境变量，禁止写死其他端口**：

| 位置 | 变量 | 用途 |
|------|------|------|
| `backend/app/config.py` | `BACKEND_PORT`、`FRONTEND_PORT` | uvicorn 监听端口 + CORS 白名单 |
| `backend/app/main.py` | `BACKEND_PORT` | 启动端口 |
| `frontend/fresh.config.ts` | `FRONTEND_PORT` | Fresh 监听端口 |
| `frontend/utils/api.ts` | `BACKEND_PORT` | 前端请求地址 `http://localhost:${BACKEND_PORT}` |
| `start-backend.sh` / `start-frontend.sh` | 两者 | Shell 启动时 export |

修改端口只需在 `.env` 或启动时设置环境变量即可。
