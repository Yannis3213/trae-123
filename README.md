# 制造工厂-月底集中处理生产工单系统

## 项目概述

面向制造工厂的月底集中处理生产工单系统，支持生产计划员补正、车间主任复核、厂务经理确认的三级审批流程。核心页面支持在生产排程、领料确认、完工报工之间连续办理生产工单。

## 技术栈

- **前端**: Nuxt 3 (Vue 3) + TypeScript
- **后端**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)，本地文件存储
- **前端端口**: 3005
- **后端端口**: 8005

## 角色说明

| 角色 | 说明 | 权限 |
|------|------|------|
| 生产计划员 (planner) | 张伟 / 刘芳 | 创建工单、生产排程、领料确认、完工报工、提交复核、退回补正后修改 |
| 车间主任 (workshop_director) | 李明 / 陈刚 | 复核通过、退回补正 |
| 厂务经理 (factory_manager) | 王强 | 最终确认办结 |

## 状态流转

```
待补正 (pending_correction)
    ↓ 生产计划员提交复核
复核中 (under_review)
    ↓ 车间主任复核通过
复核中 (under_review) - 流转给厂务经理
    ↓ 厂务经理确认
办结 (completed)
```

**页面标签只显示：待补正、复核中、办结**

## 项目结构

```
trae-123/
├── backend/                 # 后端项目
│   ├── src/
│   │   ├── config.js        # 配置文件（端口、CORS、角色、状态）
│   │   ├── server.js        # 服务入口
│   │   ├── db/
│   │   │   ├── database.js  # 数据库连接
│   │   │   └── init.js      # 数据库初始化
│   │   ├── middleware/
│   │   │   └── auth.js      # 角色认证中间件
│   │   ├── controllers/
│   │   │   ├── workorderController.js
│   │   │   ├── batchController.js
│   │   │   └── statisticsController.js
│   │   ├── routes/
│   │   │   └── api.js       # API 路由
│   │   └── utils/
│   │       └── workorderUtils.js
│   ├── data/                # SQLite 数据库文件目录
│   └── package.json
└── frontend/                # 前端项目
    ├── pages/
    │   ├── index.vue        # 工单列表页（三个标签页）
    │   └── workorder/
    │       └── [id].vue     # 工单详情页
    ├── composables/
    │   ├── useAuth.ts       # 角色状态管理
    │   └── useApi.ts        # API 请求封装
    ├── assets/css/
    │   └── main.css         # 全局样式
    ├── nuxt.config.ts
    └── package.json
```

## 快速开始

### 1. 启动后端服务

```bash
cd backend
npm install
npm run init-db   # 初始化数据库（可选，启动时会自动执行）
npm start         # 启动服务，端口 8005
```

后端启动后访问：http://localhost:8005/api/health

### 2. 启动前端服务

```bash
cd frontend
npm install
npm run dev       # 启动开发服务，端口 3005
```

前端启动后访问：http://localhost:3005

### 3. 默认账号

在页面右上角切换角色体验不同权限：

- **生产计划员** - 张伟
- **车间主任** - 李明
- **厂务经理** - 王强

## API 接口

### 工单接口

| 方法 | 路径 | 说明 | 角色 |
|------|------|------|------|
| GET | /api/workorders | 工单列表（支持筛选） | 全部 |
| GET | /api/workorders/:id | 工单详情 | 全部 |
| POST | /api/workorders | 创建工单 | 生产计划员 |
| POST | /api/workorders/:id/schedule | 生产排程 | 生产计划员 |
| POST | /api/workorders/:id/material | 领料确认 | 对应权限 |
| POST | /api/workorders/:id/completion | 完工报工 | 对应权限 |
| POST | /api/workorders/:id/submit | 提交复核 | 生产计划员 |
| POST | /api/workorders/:id/review/approve | 复核通过 | 车间主任 |
| POST | /api/workorders/:id/review/reject | 退回补正 | 车间主任 |
| POST | /api/workorders/:id/confirm | 确认办结 | 厂务经理 |
| POST | /api/workorders/:id/notes | 添加审计备注 | 全部 |

### 批量接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/batch/submit | 批量提交复核 |
| POST | /api/batch/review | 批量复核（通过/退回） |
| POST | /api/batch/confirm | 批量确认办结 |

批量接口返回格式：
```json
{
  "success": true,
  "data": {
    "total": 10,
    "success_count": 8,
    "fail_count": 2,
    "results": [
      { "id": "wo_001", "code": "WO-001", "success": true, "message": "提交成功" },
      { "id": "wo_002", "code": "WO-002", "success": false, "error": "缺少生产排程", "code": "MISSING_EVIDENCE", "missing": ["生产排程"] }
    ]
  }
}
```

### 统计预警接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/statistics | 统计概览 |
| GET | /api/warnings | 预警列表（正常/临期/逾期） |
| GET | /api/node-stats | 节点进度统计 |

## 接口校验规则

### 请求头

所有接口需要携带以下请求头：
- `X-User-Role`: 用户角色 (planner / workshop_director / factory_manager)
- `X-User-Name`: 用户名

### 校验项

1. **角色权限校验** - 越权操作直接拒绝
2. **当前处理人校验** - 非当前处理人不能操作
3. **状态机校验** - 状态冲突不能操作
4. **版本号校验** - 旧版本提交拒绝（乐观锁）
5. **必填证据校验** - 提交复核前必须有生产排程、领料确认、完工报工
6. **批量逐条校验** - 批量操作每条独立校验，逐条返回成功/失败原因

## 数据库表结构

### workorders (工单表)
- id, code, title, product_name, quantity, unit
- status, current_handler_role, current_handler, version
- deadline, planner, workshop_director, factory_manager
- production_schedule (JSON), material_issue (JSON), completion_report (JSON)
- created_at, updated_at, completed_at

### attachments (附件表)
- id, workorder_id, type, name, url, uploaded_by, uploaded_at

### processing_records (处理记录表)
- id, workorder_id, action, from_status, to_status
- operator_role, operator, remark, evidence (JSON)
- version_before, version_after, created_at

### audit_notes (审计备注表)
- id, workorder_id, content, author_role, author, created_at

### exceptions (异常表)
- id, workorder_id, type, reason, node
- responsible_role, responsible_person
- resolved, resolved_at, created_at

## 到期预警

- **正常**: 截止日期 > 3 天
- **临期**: 截止日期 ≤ 3 天
- **逾期**: 已超过截止日期

节点超时责任落到对应节点责任人：
- 生产排程 → 生产计划员
- 领料确认 → 车间主任
- 完工报工 → 车间主任
- 复核确认 → 厂务经理

## 测试场景建议

1. **正常流转**：生产计划员创建→排程→领料→报工→提交→车间主任复核→厂务经理确认
2. **缺材料**：没做完工报工就点提交复核
3. **退回补正**：车间主任退回，生产计划员修改后重新提交
4. **状态冲突**：两个人同时操作同一条工单
5. **版本冲突**：用旧版本号提交
6. **越权操作**：用车间主任角色尝试生产排程
7. **批量异常**：选中多个工单批量提交，部分缺材料部分正常
8. **逾期预警**：查看逾期工单列表和责任人
