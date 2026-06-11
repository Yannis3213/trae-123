# 消防救援站 - 月底集中处理消防隐患单系统

消防救援站实际岗位协作场景下的消防隐患单集中处理系统，支持隐患单的新建、处理、复核全流程管理。

## 技术栈

- **前端**：Preact 10 + Vite 5
- **后端**：Go 1.21 + Chi v5
- **数据库**：SQLite（项目内本地文件）

## 端口约定

| 服务 | 端口 | 地址 |
|------|------|------|
| 前端 | 3108 | http://localhost:3108 |
| 后端 | 8108 | http://localhost:8108 |

前端请求地址、后端监听端口、CORS 白名单均共用以上端口配置。

## 角色与状态流转主链路

### 三种角色
1. **消防文员** (`fire_clerk`)：维护入口数据、新建隐患单、分派、转办
2. **防火监督员** (`fire_supervisor`)：核对过程、下发整改通知、复查、退回补正
3. **站点负责人** (`station_chief`)：确认结果、回访、销项归档

### 状态流转
```
草稿(draft) → 待分派(pending_assign) → 已分派(assigned)/已转办(transferred)
     → 整改中(rectifying) → 复查中(rechecking) → 已回访(revisited) → 已销项(closed)
                         ↘ 已退回(returned) ↗（可反复）
```

- 筛选条件保留：**待分派**、**已转办**、**已回访** 等全部状态
- 接口层校验：当前角色、当前处理人、状态、版本号、必填证据
- 拦截：越权、重复提交、状态冲突、旧版本提交、缺证据

## 快速启动

### 启动后端（端口 8108）

```bash
cd backend
go mod tidy
go run main.go
```

启动后数据库文件自动创建于 `backend/data/fire_hazard.db`，并自动生成 6 条示例隐患单数据。

### 启动前端（端口 3108）

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3108 即可使用。

### 一键启动（两个终端分别执行）

```bash
# 终端 1
cd backend && go mod tidy && go run main.go

# 终端 2
cd frontend && npm install && npm run dev
```

## 功能说明

### 主工作区
- **隐患上报**：标题、描述、位置、优先级、责任人、截止时间
- **整改通知**：整改要求、整改时限
- **复查销项**：复查结果、销项归档

### 列表页
- 露出字段：责任人、优先级、截止时间、当前处理人、异常标签
- 预警分组：正常 / 临期（3天内）/ 逾期
- 多条件筛选：状态、优先级、关键字搜索
- 复选框多选支持批量处理

### 详情页
- 附件材料、处理结果、退回原因、审计备注
- 办理操作：根据当前角色和状态显示可执行动作
- 审计轨迹（时间线）：完整处理记录
- 异常原因记录

### 批量处理
- 批量结果逐条列出成功/失败原因
- 执行前校验页面状态与后端记录一致性
- 状态冲突时保留原值并提示需要谁补正
- 逾期单据批量推进时逐条拦截，可回到详情补正

### 接口安全校验
- 版本号乐观锁：提交时对比版本，避免静默覆盖
- 状态机校验：只允许合法的状态流转路径
- 角色权限：每个状态流转只允许对应角色操作
- 必填证据：整改通知、复查结果、佐证材料按节点校验

## 目录结构

```
.
├── backend/
│   ├── main.go                    # 后端入口
│   ├── go.mod
│   ├── data/                      # SQLite 数据文件目录
│   └── internal/
│       ├── models/models.go       # 数据模型
│       ├── db/database.go         # 数据库初始化
│       ├── middleware/            # CORS、鉴权中间件
│       └── handlers/hazard.go     # API 处理逻辑
└── frontend/
    ├── package.json
    ├── vite.config.js             # 端口 3108 + 代理 8108
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── styles.css
        ├── types/index.js         # 状态、角色、优先级常量
        ├── api/index.js           # API 请求封装
        ├── utils/index.js         # 工具函数
        ├── store/index.js         # 全局状态
        ├── components/            # Header、StatsBar
        └── pages/                 # HazardList、HazardDetail、CreateModal、BatchProcessModal
```
