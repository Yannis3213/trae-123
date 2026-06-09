# K12培训机构 · 月底集中处理课程服务单系统

React + Rsbuild（前端） + Python + Starlette（后端） + SQLite（本地数据库）。
前端端口 **3001**，后端端口 **8001**，二者配置、CORS 白名单、README 启动命令共用这一组端口。

---

## 目录结构

```
.
├── backend/                # Python + Starlette 后端
│   ├── main.py             # 应用入口、全部 API 与业务校验
│   ├── database.py         # SQLite 连接与表结构初始化
│   ├── seed_data.py        # 初始化演示数据
│   ├── requirements.txt
│   └── k12_service.db      # 首次初始化后生成的 SQLite 数据库文件
└── frontend/               # React + Rsbuild 前端
    ├── rsbuild.config.ts   # Rsbuild 配置（端口 3001，代理 /api 到 8001）
    ├── package.json
    ├── tsconfig.json
    ├── index.html
    └── src/
```

---

## 一、后端启动

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 1) 初始化数据库并写入演示数据（首次必跑；再次执行会重置为初始数据）
python3 seed_data.py

# 2) 启动后端（监听 0.0.0.0:8001）
python3 main.py
```

启动后后端监听：**http://localhost:8001**

后端 CORS 白名单已固定为：
- http://localhost:3001
- http://127.0.0.1:3001

### SQLite 初始化说明

- 数据库文件路径：`backend/k12_service.db`，由 `database.py:init_db()` 在首次启动时自动创建。
- 包含 6 张表：
  - `users` 用户
  - `service_orders` 课程服务单（含状态、版本、截止时间、异常原因、责任人等）
  - `attachments` 附件 / 证据材料
  - `processing_records` 处理记录 / 操作流水
  - `audit_notes` 审计备注
  - `correction_actions` 补正动作记录
- 执行 `python3 seed_data.py` 会清空并重新写入全部演示数据。

---

## 二、前端启动

```bash
cd frontend
npm install
npm run dev
```

启动后前端地址：**http://localhost:3001**

前端请求地址统一使用 `/api/*`，由 Rsbuild dev server 代理到 `http://localhost:8001/api/*`
（见 `frontend/rsbuild.config.ts` 的 `proxy` 与 `server.port` 配置）。

---

## 三、账号

三个演示角色，密码均为 `123456`：

| 账号 | 角色 | 姓名 | 可执行动作 |
| --- | --- | --- | --- |
| `jiaowu01`   | 教务老师   | 李教务   | 发起服务单、转办班主任、录入证据 |
| `banzhuren01`| 班主任     | 王班主任 | 完成回访并提交校长、退回补正、上传证据 |
| `xiaozhang01`| 校区校长   | 张校长   | 复核归档、退回补正 |

登录页提供快速切换按钮，点击账号名可一键填充。

---

## 四、四类演示数据（对应四条复查闭环）

`python3 seed_data.py` 会写入 7 张课程服务单，覆盖 4 类典型场景：

### 1️⃣ 正常流转（能过）

- **FW202506003 王小刚 · 高三语文阅读特训** — 已回访状态
  - 完整流程：教务创建 → 班主任上传课后反馈/回访记录/家长确认 → 班主任完成回访 → 校长复核归档
  - 已有 3 份证据，可使用 `xiaozhang01` 复核归档走完全流程。

- **FW202506002 李小红 · 高一英语强化班** — 已转办状态
  - 教务已上传课程排班并转办班主任；班主任登录后可上传剩余证据后提交校长确认。

### 2️⃣ 缺材料（要停住，不能悄悄放行）

- **FW202506004 赵小雅 · 小学五年级奥数班** — 待分派 · 课后反馈缺家长签字
  - 标记为异常，`exception_reason` 写明"课后反馈缺家长签字"；
  - 后端校验：`POST /api/orders/{id}/process` 转办班主任或回访时，如果证据 `课后反馈 / 回访记录 / 家长确认` 缺失，直接返回错误，单据继续留在待处理列表。

- **FW202506001 张小明 · 初三数学冲刺班** — 待分派
  - 无任何证据，尝试转办会因为缺少"课程排班"证据被拦截。

### 3️⃣ 超时或逾期（继续留在待处理列表，批量推进逐条拦截）

- **FW202506006 陈朵朵 · 初中英语口语班** — 待分派，**逾期 3 天**
  - `deadline` 已在 3 天前到期，到期预警标签为"逾期"；
  - 批量处理时，如果证据、角色、状态不满足，会被逐条拦下并返回失败原因。
- **FW202506005 刘小伟 · 高中物理竞赛班** — 已转办，**临期（6 小时内）**
  - 到期预警标签"临期"，用于月底台账统计。

### 4️⃣ 退回补正 / 状态冲突

- **FW202506007 孙浩然 · 高中物理竞赛班** — 已转办，异常原因"回访录音不清晰，需重新提交"
  - 已有一条补正记录（校长退回班主任重新录制回访录音），班主任上传新的证据后才能再次提交校长确认；
  - 后端使用 `version` 字段做乐观锁，前端若拿旧版本提交会被返回"版本冲突，单据已被他人处理，请刷新后重试"。

---

## 五、后端关键校验（即使绕开前端直调接口也会被拦）

| 校验 | 实现位置 | 拦截说明 |
| --- | --- | --- |
| 角色校验 | `main.py:_check_and_transition` 中的 `ROLE_TRANSITIONS` | 教务只能在"待分派"下转办；班主任只能在"已转办"下回访/退回；校长只能在"已回访"下归档/退回 |
| 当前处理人校验 | `_check_and_transition` | 非当前处理人不能办理（教务除外，其在"待分派"下可转办） |
| 状态顺序校验 | `ROLE_TRANSITIONS` 映射 | 不符合顺序的状态变更直接 400 |
| 版本校验（乐观锁） | `UPDATE ... WHERE id=? AND version=?` + `changes()` | 旧版本提交 → 返回版本冲突 |
| 必填证据校验 | `REQUIRED_EVIDENCE` | 转办需"课程排班"；回访需"课后反馈、回访记录、家长确认"，缺项不可放行 |
| 重复提交 | 状态与版本联合判断 | 同一状态再次提交被视为重复，被版本/状态校验拦 |
| 越权访问 | `require_auth` 中间件 | 未登录返回 401 |

批量接口 `POST /api/orders/batch` 对每张单据独立执行上述校验，返回逐条 `success` 与 `msg`。

---

## 六、月底台账重点：到期预警

列表页顶部 7 张卡片：

- 总数 / 待分派 / 已转办 / 已回访
- 到期预警 **正常 / 临期（≤24h） / 逾期** —— 三队独立计数，不会混在一起。

筛选栏"到期"下拉可分别过滤三队；节点超时在 `deadline_status = "overdue"` 时体现在处理人字段，批量推进逐条给出成功/失败原因。

详情页能看到：
- 补正动作（`correction_actions`）
- 异常原因（`exception_reason`，异常单据会显示红色标签）
- 处理记录、证据材料、审计备注

刷新后列表、详情、统计卡片、操作记录均从 SQLite 重新读取，保持一致。

---

## 七、端口一致性核对

| 配置点 | 文件 | 值 |
| --- | --- | --- |
| 前端 dev 端口 | `frontend/rsbuild.config.ts` → `server.port` | 3001 |
| 前端请求代理目标 | `frontend/rsbuild.config.ts` → `proxy./api.target` | http://localhost:8001 |
| 后端监听端口 | `backend/main.py` → `uvicorn.run(... port=BACKEND_PORT)` | 8001 |
| 后端 CORS 白名单 | `backend/main.py` → `CORSMiddleware.allow_origins` | http://localhost:3001 / http://127.0.0.1:3001 |
| README 启动命令 | 本文档 一、二节 | 3001 / 8001 |

全部一致，无写死其他端口。
