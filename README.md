# 🐾 宠物医院 - 月底集中处理宠物就诊单系统

专为前台护士、兽医师、院长月底集中处理宠物就诊单设计的全栈系统。覆盖就诊单登记、过程核验、复核归档全流程，支持角色权限、状态流转、到期预警、批量处理、异常溯源等核心能力。

## 🚀 端口约定（全局共用）

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端（Astro） | **3109** | 前端开发/预览地址：http://localhost:3109 |
| 后端（Express） | **8109** | 后端 API 基础地址：http://localhost:8109/api |
| SQLite | - | 本地文件：`backend/data/hospital.db` |

> 前端请求地址、后端监听端口、CORS 白名单、启动命令均使用以上端口，**无其它硬编码端口**。

## 🏗️ 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Astro 4 + React Islands（client:load） |
| 后端 | Node.js + Express 4 |
| 数据库 | SQLite（better-sqlite3，本地文件） |
| 认证 | Header 传参（X-User-Id + X-Role），配合 bcrypt 密码校验 |
| 文件上传 | multer，存储至 `backend/uploads/` |

## 📦 快速启动

### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端（新开一个终端）
cd ../frontend
npm install
```

### 2. 初始化 SQLite 数据库（首次使用必执行）

```bash
cd backend
npm run init-db
```

脚本会完成：
- 创建 `users`、`visit_orders`、`attachments`、`processing_records`、`audit_notes` 五张表
- 创建 3 个演示账号
- 预置 7 条涵盖四类典型场景的宠物就诊单
- 预置附件、处理记录、审计备注样例

### 3. 启动服务

```bash
# 终端 1：后端（监听 8109）
cd backend
npm start

# 终端 2：前端（监听 3109）
cd frontend
npm start
```

浏览器访问 http://localhost:3109

## 👤 演示账号（密码统一：123456）

| 角色 | 用户名 | 姓名 | 权限范围 |
|------|--------|------|----------|
| 前台护士 | `nurse01` | 李护士 | 新建就诊单、分派兽医师、完成回访、编辑信息、批量分派 |
| 兽医师 | `doctor01` | 王医师 | 接诊处理、转办、提交回访、提交复核、批量操作（仅限分派给自己的单据） |
| 院长 | `director01` | 张院长 | 全部数据可见、复核归档、退回补正、审计备注、批量复核/退回 |

## 📋 四类宠物就诊单演示样例

数据库初始化后自动生成以下单据，覆盖用户提到的 4 类测试场景：

| 单号 | 宠物 | 场景类别 | 当前状态 | 说明 |
|------|------|----------|----------|------|
| **V202606001** | 豆豆（金毛） | 🟢 正常流转 | 待分派 | 无异常，护士新建后待分派给兽医师 |
| **V202606006** | 花花（布偶） | 🟢 正常流转 | 处理中 | 兽医师正在接诊处理，可转办或安排回访 |
| **V202606004** | 小白（田园猫） | 🟢 正常流转 | 已回访 | 已完成诊后回访，待提交复核 |
| **V202606003** | 旺财（拉布拉多） | 🔴 缺材料异常 | 已转办 | 初诊后缺少 X 光影像资料，标记为"材料问题"异常 |
| **V202606002** | 咪咪（英短） | 🔴 超时逾期 | 已分派 | 截止时间已过 1 天，标记为"时限问题"，责任人王医师 |
| **V202606005** | 胖胖（柯基） | 🔴 超时逾期 | 复核中 | 待院长复核但已逾期，含完整诊疗和回访记录 |
| **V202606007** | 黑妞（德牧） | 🔴 退回补正/状态冲突 | 退回补正 | 院长复核后因"复诊记录缺失、药浴执行记录不完整"退回，标记为材料异常 |

## 🔄 状态流转主链路

```
待分派(pending_assign)
    ↓ 护士分派
已分派(assigned)
    ↓ 兽医师接诊
处理中(processing)
    ├─ 转办（材料不全）→ 已转办(transferred) → 补材料后回到处理中
    └─ 完成治疗 → 待回访(follow_up_scheduled)
                        ↓ 护士回访
                   已回访(followed_up)
                        ↓ 兽医师提交
                   复核中(reviewing)
                        ├─ 院长通过 → 已归档(archived) ✅
                        └─ 院长退回 → 退回补正(returned_for_correction)
                                          ↓ 补正
                                     补正中(reprocessing)
                                          ↓ 再提交复核
                                     复核中(reviewing)
```

### 三类状态按钮

| 状态按钮 | 触发角色 | 说明 |
|----------|----------|------|
| 待分派 → 已分派 | 前台护士 | 分派给指定兽医师 |
| 已分派 → 已转办 → 已回访 | 兽医师 | 中段处理，含"转办"节点处理缺材料 |
| 已回访 → 复核中 → 已归档 | 院长 | 最终复核意见，可归档或退回补正 |

## 🛡️ 权限与状态校验

后端在每次状态变更时强制拦截以下情况，并返回明确的 `exception_type`：

| 拦截场景 | HTTP 状态 | exception_type | 说明 |
|----------|-----------|----------------|------|
| 重复提交 | 409 | status | 基于版本号 version 校验，旧版本提交失败 |
| 跨角色操作 | 403 | permission | 如护士不能归档、兽医师不能复核他人单据 |
| 不符合状态顺序 | 400 | status | 如从"待分派"直接跳到"已回访" |
| 越权访问非责任单据 | 403 | permission | 兽医师只能查看分派给自己的单据 |
| 缺少必填证据 | 400 | material | 如安排回访缺少诊断记录/治疗方案/处方单 |
| 节点超时/逾期 | 400 | timeline | 截止时间已过自动标记 |

## 🧪 直接打接口测试示例

后端通过请求头 `X-User-Id` 和 `X-Role` 识别当前角色与用户，便于直接用 curl / Postman 测试。

### 示例 1：正常登录

```bash
curl -X POST http://localhost:8109/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"nurse01","password":"123456"}'
```

### 示例 2：以兽医师身份获取就诊单列表

```bash
curl http://localhost:8109/api/visits \
  -H "X-User-Id: 2" \
  -H "X-Role: doctor"
```

### 示例 3：模拟版本冲突（提交旧版本）

```bash
curl -X POST http://localhost:8109/api/visits/1/transition \
  -H "X-User-Id: 1" \
  -H "X-Role: nurse" \
  -H "Content-Type: application/json" \
  -d '{"action":"assign","version":999,"assignee_id":2}'
```

预期返回：`exception_type: "status"`，提示版本冲突。

### 示例 4：越权操作（护士尝试归档）

```bash
curl -X POST http://localhost:8109/api/visits/5/transition \
  -H "X-User-Id: 1" \
  -H "X-Role: nurse" \
  -H "Content-Type: application/json" \
  -d '{"action":"archive","version":5}'
```

预期返回：`exception_type: "permission"`，提示角色无权。

### 示例 5：批量处理

```bash
curl -X POST http://localhost:8109/api/visits/batch \
  -H "X-User-Id: 1" \
  -H "X-Role: nurse" \
  -H "Content-Type: application/json" \
  -d '{"ids":[1,2,3],"action":"assign","payload":{"assignee_id":2}}'
```

返回结果中逐条给出每条的 `success`、`message`、`exceptionType`。

## 🗂️ 项目结构

```
trae-123-9/
├── backend/
│   ├── index.js               # 入口（监听 8109，CORS 白名单 3109）
│   ├── package.json
│   ├── database/
│   │   ├── index.js           # SQLite 连接
│   │   └── init.js            # 数据库初始化脚本
│   ├── data/hospital.db       # SQLite 数据文件（init-db 后生成）
│   ├── uploads/               # 附件目录
│   ├── middleware/
│   │   ├── auth.js            # 角色/责任人权限中间件
│   │   ├── errorHandler.js    # 统一错误响应
│   │   └── validator.js       # 参数校验
│   ├── utils/
│   │   └── statusFlow.js      # 状态流转引擎（核心）
│   └── routes/
│       ├── auth.js            # 登录 / 用户
│       ├── visits.js          # 就诊单 CRUD + 状态流转 + 批量
│       ├── attachments.js     # 附件上传下载
│       ├── records.js         # 处理记录
│       ├── audit.js           # 审计备注
│       └── stats.js           # 统计 / 到期预警
└── frontend/
    ├── package.json
    ├── astro.config.mjs       # 端口 3109
    ├── tsconfig.json
    └── src/
        ├── lib/
        │   ├── api.js         # API 调用（BASE: 8109）
        │   └── auth.js        # 权限判断/格式化
        ├── styles/global.css
        ├── layouts/Layout.astro
        ├── pages/
        │   ├── login.astro
        │   ├── index.astro         # 就诊单列表
        │   ├── records.astro       # 处理记录
        │   └── detail/[id].astro   # 就诊单详情
        └── components/        # React Islands（client:load）
            ├── LoginForm.jsx
            ├── AppShell.jsx
            ├── VisitList.jsx       # 列表筛选 + 批量处理 + 到期预警
            ├── VisitDetail.jsx     # 详情办理 + 附件 + 补正/异常
            ├── CreateOrderModal.jsx
            ├── BatchModal.jsx
            ├── ActionModal.jsx
            └── RecordsView.jsx
```

## 🎯 月底重点功能

- **到期预警三队分栏**：列表顶部统计卡片区分 `正常 / 临期(24h内) / 逾期`，列表筛选也支持按到期情况过滤
- **节点超时算到责任人**：`/api/stats` 返回的 `byHandler` 中含每位兽医师的 `overdue_count`
- **逾期批量推进逐条拦截**：批量处理时即使部分单据因状态/权限/材料失败，其它单据仍会正常执行，返回结果逐条标注成功/失败原因
- **详情补正与异常原因**：退回补正的单据在详情顶部红色展示异常原因，处理记录时间轴完整记录补正动作与证据变化
- **刷新后状态一致**：所有数据均持久化至 SQLite，刷新列表、详情、统计、操作记录后状态完全一致
