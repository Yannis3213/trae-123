# 水产养殖基地 - 月底集中处理水质检测单系统

## 技术栈

- **前端**: SvelteKit + TypeScript + TailwindCSS，端口 3002
- **后端**: Rust + Poem 框架，端口 8002
- **数据库**: SQLite（项目内文件 `backend/data.db`）

## 启动方式

### 后端

```bash
cd backend
cargo run
```

服务启动在 http://localhost:8002

### 前端

```bash
cd frontend
npm install
npm run dev
```

服务启动在 http://localhost:3002

## 角色说明

| 角色 | 用户名 | 权限 |
|------|--------|------|
| 塘口管理员 | 张三 | 登记检测单、提交审核、补正提交 |
| 水质工程师 | 李工 | 核验通过、退回 |
| 基地负责人 | 王主任 | 确认同步、退回 |

## 状态流转

```
待审核 → 审核中 → 审核通过 → 已同步
                ↘ 待补正 → 待审核（补正后重新提交）
         审核通过 → 待补正（退回）
```
