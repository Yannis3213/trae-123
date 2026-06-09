# 眼科诊所 - 月底集中处理配镜订单系统

月底眼镜订单集中处理系统，支持验光师→眼科医生→运营主管接力流转，带到期预警、批量处理、审计追溯、异常拦截等能力。

## 技术栈

| 端 | 技术 | 端口 |
| --- | --- | --- |
| 前端 | React 18 + Vite | **3003** |
| 后端 | Python 3.9+ / Django 4.2 / Django Ninja | **8003** |
| 数据库 | SQLite（项目内置 seed） | - |

**重要**：前端请求地址、后端监听端口、CORS 白名单统一使用 `3003`（前端）与 `8003`（后端）。

## 项目结构

```
.
├── backend/                # Django Ninja 后端
│   ├── config/             # Django settings/urls
│   ├── glasses_order/      # 核心业务 App（模型、API、Seed）
│   ├── media/              # 附件上传目录（运行时生成）
│   ├── db.sqlite3          # SQLite 数据库（首次 migrate+seed 后生成）
│   ├── requirements.txt
│   ├── manage.py
│   └── seed.py             # 测试数据初始化脚本
├── frontend/               # React + Vite 前端
│   ├── src/
│   │   ├── pages/          # Login / OrderList / OrderDetail
│   │   ├── components/     # BatchModal / ReviewModal / CorrectModal / CreateOrderModal
│   │   ├── api.js          # axios 封装
│   │   ├── App.jsx         # 路由 + AuthContext + 角色切换
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── vite.config.js      # 代理 /api → http://localhost:8003
│   └── package.json
└── README.md
```

## 快速启动

### 1. 启动后端（端口 8003）

```bash
cd backend

# 安装依赖
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 初始化数据库 + 迁移
python manage.py makemigrations glasses_order
python manage.py migrate

# 初始化 seed 数据（用户 / 订单 / 附件记录 / 处理记录 / 审计备注 / 异常原因）
python seed.py

# 启动（监听 8003）
python manage.py runserver 0.0.0.0:8003
```

后端 API 文档：http://localhost:8003/api/docs

### 2. 启动前端（端口 3003）

```bash
cd frontend

# 安装依赖
npm install

# 启动 dev 服务（3003，已内置 /api 代理到 8003）
npm run dev
```

前端访问地址：http://localhost:3003

## 测试账号（密码统一为 `123456`）

| 角色 | 用户名 | 姓名 |
| --- | --- | --- |
| 验光师 | `opt1` | 王验光 |
| 验光师 | `opt2` | 李验光 |
| 眼科医生 | `oph1` | 张眼科 |
| 眼科医生 | `oph2` | 刘眼科 |
| 运营主管 | `ops1` | 陈运营 |
| 运营主管 | `ops2` | 赵运营 |

页面顶部提供「模拟角色切换」，便于值班试跑。

## 核心流程

```
验光师 提交订单
   ↓ (状态：待审核)
眼科医生 审核通过 / 退回补正
   ↓ (状态：审核通过)
运营主管 同步到总部
   ↓ (状态：已同步)
  完成
```

## 页面标签（状态集合）

只出现以下三种对外标签 + 一个内部流转状态：

| 状态值 | 页面标签 | 可操作角色 |
| --- | --- | --- |
| `pending_review` | 待审核 | 眼科医生（审核通过/退回） |
| `review_approved` | 审核通过 | 运营主管（同步） |
| `synced` | 已同步 | —— |
| `returned_for_correction` | 退回补正（内部流转） | 验光师（补正后重提交） |

## 业务模块（三个模块联动状态/证据/异常）

1. **验光档案**：左右眼 S/C/A、视力、瞳距 PD、备注；必填缺项自动打标 `缺材料`
2. **镜片订购**：镜片类型/品牌/价格、镜架品牌/型号/价格、总价、供应商
3. **配镜订单登记**：业务人员、登记时间、收款方式、订金、交付方式、预计交货日期

## 到期预警（三队不混）

- **正常**：距离截止时间 > 2 天
- **临期**：距离截止时间 ≤ 2 天（黄色提醒）
- **逾期**：已超过截止时间（红色，定位到责任人 `current_handler`）

每个状态节点有独立截止时间：
- 待审核 → `review_due_at`（提交后 3 天）
- 审核通过 → `sync_due_at`（审核通过后 2 天）

## 接口层校验（后端守住底线）

批量 / 单个处理前统一执行：

| 校验项 | 说明 | 异常写入审计备注 |
| --- | --- | --- |
| 当前角色 | 状态与角色必须匹配 | `TYPE_PERMISSION_DENIED` |
| 当前处理人 | 必须是当前登录用户 | `TYPE_PERMISSION_DENIED` |
| 状态冲突 | 已同步订单禁止操作 | `TYPE_STATUS_CONFLICT` |
| 版本号 | 提交 `version` 必须等于当前 DB 版本 | `TYPE_VERSION_CONFLICT` |
| 必填证据 | 验光/镜片/登记三类附件至少各 1 份 | `TYPE_MISSING_ATTACHMENT` |
| 越权提交 | 跨角色操作直接 403 | `TYPE_PERMISSION_DENIED` |
| 重复提交 | 同版本二次提交被拦截（乐观锁 +1） | `TYPE_DUPLICATE_SUBMISSION` |

所有拦截异常统一写入 `exception_reason` + `audit_note`，详情页可完整追溯。

## 批量处理

- 列表页勾选订单 → 批量审核通过 / 批量退回补正 / 批量同步
- 结果逐条返回 `success` + 失败原因，前端逐条展示 ✅ / ❌
- 单条失败不影响其它订单（每条独立事务）

## 数据库表一览（SQLite）

- `glasses_order`：配镜订单主表（状态、版本、时间节点、责任人、缺项标记）
- `optometry_record`：验光档案（1:1）
- `lens_order`：镜片订购（1:1）
- `order_registration`：配镜订单登记（1:1）
- `attachment`：附件（1:N，按类别区分）
- `processing_record`：处理记录时间轴（每次状态流转留痕）
- `audit_note`：审计备注（拦截 / 补正 / 异常 / 操作）
- `exception_reason`：异常原因（缺项 / 冲突 / 越权 / 超时 等，支持已解决标记）
- `user_profile`：用户角色扩展（验光师 / 眼科医生 / 运营主管）

## 建议的值班试跑场景

1. **正常流转**：opt1 新建 → oph1 审核通过 → ops1 同步
2. **缺材料拦截**：opt2 提交缺 PD 的订单 → oph1 批量通过时被逐条拦截
3. **退回补正**：oph1 退回订单 → opt2 补正验光档案 + 上传附件 → 重新待审核
4. **版本冲突**：A、B 同时打开同一详情 → A 先操作 → B 提交被拦截（版本冲突）
5. **越权操作**：opt1 尝试用眼科医生接口审核 → 403 并写入审计
6. **逾期批量推进**：多笔临期/逾期订单 → 批量同步时对状态冲突逐条拦截
7. **刷新一致性**：操作后刷新列表 / 详情 / 统计 / 操作记录 → 全部一致

刷新页面不会丢状态，所有写入均在 SQLite 持久化。
