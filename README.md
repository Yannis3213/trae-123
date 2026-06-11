# 体育场馆-月底集中处理场地订单系统

## 启动方式

```bash
# 启动后端（端口 8107）
cd backend
npm run start:dev

# 启动前端（端口 3107）
cd frontend
npm run dev
```

前端访问地址：http://localhost:3107
后端API地址：http://localhost:8107/api

## 端口配置

- 前端端口：3107
- 后端端口：8107
- CORS 白名单：http://localhost:3107
- 前端通过 Vite 代理 /api → http://localhost:8107

## 角色说明

| 角色 | 用户 | 说明 |
|------|------|------|
| 场地登记员 | 张伟（场馆前台） | 发起订单、补正材料 |
| 场地审核主管 | 李明（运营主管） | 审核办理、退回补正 |
| 体育场馆复核负责人 | 王芳（场馆经理） | 复核归档、到期预警 |

## 技术栈

- 前端：React + Vite + TypeScript + TailwindCSS + Zustand
- 后端：NestJS + TypeORM + better-sqlite3
- 数据库：SQLite
