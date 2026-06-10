# 景区运营公司 - 月底集中处理团队预约单系统

景区运营公司一线口径的团队预约单处理系统，支持三角色三段式流转、三模块证据留痕、到期预警队列和批量处理。

## 技术栈

- **前端**: React 18 + Vite 5 + React Router 6
- **后端**: Python 3 + Flask 3 + SQLAlchemy
- **数据库**: SQLite（本地文件 `backend/team_booking.db`）
- **端口配置**:
  - 前端: `5173` (FRONTEND_PORT)
  - 后端: `5000` (BACKEND_PORT)

## 目录结构

```
trae-123-3/
├── backend/                    # Flask 后端
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py          # 配置（端口、状态流转、角色权限）
│   │   ├── models.py          # 数据模型
│   │   ├── routes.py          # API 路由
│   │   ├── seed.py            # 初始化演示数据
│   │   └── utils.py           # 工具函数
│   ├── requirements.txt
│   ├── .env.example
│   └── run.py                 # 启动入口
└── frontend/                   # React 前端
    ├── src/
    │   ├── api/index.js       # axios 封装
    │   ├── context/AppContext.jsx  # 全局状态
    │   ├── components/Layout.jsx   # 布局+角色切换
    │   ├── pages/
    │   │   ├── Dashboard.jsx       # 首页说明
    │   │   ├── BookingList.jsx     # 预约单列表+批量处理
    │   │   ├── BookingDetail.jsx   # 预约单详情+办理
    │   │   └── WarningQueue.jsx    # 到期预警队列
    │   ├── styles/index.css
    │   ├── App.jsx
    │   └── main.jsx
    ├── index.html
    ├── package.json
    └── vite.config.js
```

## 角色与权限

| 角色 | 标识 | 能做什么 |
|------|------|----------|
| 现场调度 | dispatcher | 创建预约单、编辑团队预约/入园统计、处理待审核单据、批量处理、退回补正、重新提交 |
| 票务专员 | ticketing | 编辑票务核销、处理待审核单据 |
| 景区经理 | manager | 复核审核通过单据、归档、退回补正、逾期批量推进 |

## 状态流转

```
待审核 → 审核通过 → 已同步
   ↓         ↓
退回补正 →（补正后）待审核
```

- `待审核`: 现场调度/票务专员处理
- `审核通过`: 景区经理复核
- `已同步`: 归档完成
- `退回补正`: 现场调度补正后可重新提交

## 快速启动

### 1. 启动后端

```bash
cd backend

# （可选）配置端口
cp .env.example .env

# 安装依赖
pip install -r requirements.txt

# 启动（端口 5000）
python run.py
```

启动后会自动创建 SQLite 数据库并导入 8 条演示数据。

### 2. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动（端口 5173）
npm run dev
```

### 3. 访问系统

打开浏览器访问: http://localhost:5173

## 演示数据说明

系统初始化 8 张预约单覆盖四种场景：

| 单号 | 场景 | 状态 | 紧急度 | 说明 |
|------|------|------|--------|------|
| TB202606100001 | 正常流转 | 待审核 | 正常 | 三模块齐全，待现场调度处理 |
| TB202606100002 | 正常流转 | 审核通过 | 正常 | 三模块齐全，待景区经理复核 |
| TB202606100003 | 正常流转 | 已同步 | 正常 | 已完成归档 |
| TB202606100004 | 缺材料 | 待审核 | 正常 | 缺少票务核销模块 |
| TB202606100005 | 临期预警 | 待审核 | 临期 | 距截止不足4小时 |
| TB202606100006 | 超时逾期 | 待审核 | 逾期 | 已超过处理期限 |
| TB202606100007 | 退回补正（缺材料）| 退回补正 | 正常 | 缺少票务核销+入园统计 |
| TB202606100008 | 退回补正（状态冲突）| 退回补正 | 逾期 | 核销与入园时间线冲突 |

## 核心校验规则（后端）

1. **角色校验**: 通过 `X-User-Role` 请求头判断权限
2. **当前处理人校验**: `current_role` 必须匹配当前登录角色
3. **状态校验**: 按角色-状态映射表判断是否可处理
4. **版本校验**: 请求带 `version` 必须与数据库一致，否则返回 409 状态冲突
5. **必填证据校验**: 退回重新提交时检查三模块是否完整
6. **状态冲突保护**: 冲突时保留原值，不覆盖他人处理结果

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/bookings | 获取预约单列表（支持 status/urgency 过滤）|
| GET | /api/bookings/:id | 获取预约单详情（含三模块、附件、处理记录、审计备注、异常原因）|
| POST | /api/bookings | 现场调度创建预约单 |
| POST | /api/bookings/:id/process | 处理预约单（推进状态）|
| POST | /api/bookings/:id/return | 退回补正 |
| POST | /api/bookings/:id/resubmit | 补正后重新提交 |
| PUT | /api/bookings/:id/module | 更新三模块信息 |
| POST | /api/bookings/batch-process | 批量处理/退回/逾期推进 |
| POST | /api/bookings/:id/notes | 添加审计备注 |
| GET | /api/statistics/dashboard | 看板统计数据 |

### 请求头

```
X-User-Role: dispatcher|ticketing|manager
X-User-Name: 显示用户名
```

## CORS 配置

后端已配置 CORS 白名单，仅允许 `http://localhost:5173` 和 `http://127.0.0.1:5173` 访问，与前端端口共用配置。
