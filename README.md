# 高校实验室-月底集中处理实验预约单系统

三角色闭环流程：**实验助教建单 → 实验室管理员核验 → 学院负责人复核归档**。

## 技术栈

| 层 | 技术 | 端口 |
|---|---|---|
| 前端 | SvelteKit + Vite | **3001** |
| 后端 | Python + Django + Django Ninja | **8001** |
| 数据库 | SQLite（项目内本地文件 `backend/db.sqlite3`） | — |

前后端请求地址、监听端口、CORS 白名单均已统一使用 `3001` 和 `8001`。

---

## 启动步骤

### 1. 后端（终端 1）

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 初始化 SQLite 数据库（自动建表）
python manage.py makemigrations lab_appointment
python manage.py migrate

# 导入演示数据（3 个账号 + 5 张预约单，覆盖 4 类异常）
python manage.py seed_demo_data

# 启动后端（端口 8001）
python manage.py runserver 0.0.0.0:8001
```

浏览器访问 <http://localhost:8001/api/docs> 可查看 Django Ninja 自动生成的 Swagger API 文档。

### 2. 前端（终端 2）

```bash
cd frontend
npm install
npm run dev            # 端口 3001
```

浏览器访问 <http://localhost:3001>。

---

## SQLite 初始化说明

数据库文件位于 `backend/db.sqlite3`。

```bash
# 建表
python manage.py makemigrations lab_appointment
python manage.py migrate

# 填充演示数据
python manage.py seed_demo_data

# 如需要重置数据库
rm -f backend/db.sqlite3
# 然后重新执行 makemigrations / migrate / seed_demo_data
```

保存的实体表：
- `user` — 账号与角色
- `lab_appointment` — 实验预约单（含状态、版本、责任人、截止时间）
- `attachment` — 证据附件
- `processing_record` — 处理记录（状态流转审计）
- `audit_note` — 审计备注
- `exception_reason` — 异常原因（材料/权限/时限/状态）

刷新页面后，列表、详情、统计、操作记录、状态保持一致。

---

## 演示账号

打开 <http://localhost:3001/login>，点击对应角色卡片即可登录（无需密码）。

| 用户名 | 姓名 | 角色 | 职责 |
|---|---|---|---|
| `ta01` | 王助教 | 实验助教 | 创建预约单、编辑草稿、提交复核、处理退回补正 |
| `admin01` | 李管理员 | 实验室管理员 | 核验过程、补充证据、退回或转交复核 |
| `dean01` | 张院长 | 学院负责人 | 最终复核、归档/退回、批量处理 |

可以在右上角点击 **"切换角色/退出"** 来切换身份。

---

## 四类异常测试单据

演示数据共 5 张预约单，可用于试出异常：

| 单号 | 标题 | 状态 | 异常场景 | 尝试操作 | 预期 |
|---|---|---|---|---|---|
| `LAB-NORMAL-001` | 有机化学实验-乙酸乙酯合成 | 待复核 | **正常流转** | 管理员核验 → 院长归档 | 全流程通过 ✅ |
| `LAB-MISSING-002` | 生物实验-细胞培养 | 草稿 | **缺材料**（耗材为空、未做安全确认） | 助教点 "提交复核" | 拦截：材料问题 ❌ |
| `LAB-OVERDUE-003` | 物理实验-光学干涉测量 | 待复核 | **超时/逾期** | 院长点 "复核归档" 或批量归档 | 拦截：时限问题 ❌；需先详情页补正 |
| `LAB-RETURNED-004` | 材料力学实验-拉伸试验 | 退回补正 | **退回补正/状态冲突** | 院长在未补正情况下再次直接归档 | 拦截：状态问题 ❌ |
| `LAB-ARCHIVED-005` | 已归档-分析化学滴定实验 | 已归档 | 参考单据 | 任何修改按钮 | 已归档不可编辑 ✅ |

> 批量处理：登录学院负责人 → 在列表中选中多张（可包含逾期单 `LAB-OVERDUE-003`）→ 点 "批量归档"。系统逐条拦截，返回成功/失败原因，**不会整批放行**。

---

## 业务模块

顶部侧栏对应三个业务区：

1. **预约单登记**（列表页 tab=草稿/退回）— 助教建单、编辑草稿、补充耗材与安全字段
2. **过程核验**（列表页 tab=待复核）— 管理员查看证据、补充附件、退回补正或转交
3. **复核归档**（列表页 tab=待复核）— 负责人核验意见与备注、批量/单条归档或退回

状态机：`草稿(DRAFT)` → `待复核(PENDING)` → `已归档(ARCHIVED)`，中间可 `退回补正(RETURNED)` 回到草稿状态。

---

## 后端校验机制（直接调 API 也会生效）

后端不信任前端按钮，每次提交都会校验：

| 校验项 | 说明 |
|---|---|
| 当前角色 | 只有对应角色可执行动作（助教提交、管理员核验、院长归档） |
| 当前处理人 | 非当前处理人即使角色正确也被拦截 |
| 状态 | 只允许在合法状态上执行对应操作（防状态冲突） |
| 版本 | 每次提交必须匹配 `version`，否则判定为旧版本/重复提交 |
| 必填证据 | 如安全确认、审计备注、处理意见等 |
| 越权/重复/旧版本/缺证据/状态冲突 | 返回结构化异常，区分材料/权限/时限/状态 |

逾期批量推进：逐条校验，失败单据在详情页留下补正动作和异常原因。

---

## 端口约定（全项目统一）

- 前端：`3001` — `frontend/vite.config.js` 已配置 `server.port = 3001`
- 后端：`8001` — 启动命令 `runserver 0.0.0.0:8001`
- 前端请求：通过 Vite 代理 `/api` → `http://localhost:8001`
- CORS 白名单：`http://localhost:3001` 和 `http://127.0.0.1:3001`
