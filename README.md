# 燃气服务公司-月底集中处理安检工单系统

## 项目结构

```
├── backend/          # 后端 Node + Hono + SQLite
│   ├── src/index.ts  # 主入口（API路由 + 数据库 + 业务逻辑）
│   ├── data/         # SQLite 数据库文件（自动生成）
│   └── package.json
├── frontend/         # 前端 SvelteKit + TailwindCSS
│   ├── src/
│   │   ├── lib/      # 共享库（API客户端、类型、状态管理）
│   │   └── routes/   # 页面路由
│   └── package.json
└── .trae/documents/  # 产品需求和技术架构文档
```

## 端口配置

| 服务 | 端口 |
|------|------|
| 前端 SvelteKit | 3004 |
| 后端 Hono API | 8004 |

## 启动方式

### 1. 安装后端依赖并启动

```bash
cd backend
npm install
npm run dev
```

后端将在 http://localhost:8004 启动，首次启动自动创建 SQLite 数据库和种子数据。

### 2. 安装前端依赖并启动

```bash
cd frontend
npm install
npm run dev
```

前端将在 http://localhost:3004 启动。

## 角色说明

| 角色 | 姓名 | 权限 |
|------|------|------|
| 客服坐席 | 坐席-张三 | 创建/提交安检工单 |
| 安检主管 | 主管-李四 | 审核推进/驳回 |
| 运营负责人 | 负责人-王五 | 确认办结/退回整改 |

## 业务流程

客服坐席提交入户安检 → 安检主管审核推进隐患整改 → 运营负责人确认办结

任何环节可退回补正，补正后重新流转。
