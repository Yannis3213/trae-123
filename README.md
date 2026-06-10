# 汽车4S店-月底集中处理维修工单系统

> 预约进厂驱动的汽车4S店维修工单处理工作台，支持多角色接力处理、状态流转、证据核验、批量处理。

## 🚀 快速启动

### 端口配置
系统使用以下统一端口（配置在根目录 `.env` 文件中）：
- **前端端口**: 4200
- **后端端口**: 3000

> ⚠️ 所有端口配置、CORS白名单、API请求地址均使用这组端口，请勿修改为其他值。

### 环境要求
- Go 1.21+
- Node.js 18+
- SQLite3 (项目内本地文件，无需额外安装)

### 启动步骤

#### 1. 启动后端服务
```bash
cd backend
go mod tidy
go run cmd/server/main.go
```

后端服务启动后：
- API 地址: http://localhost:3000/api
- 数据库自动初始化: `backend/data/workshop.db`
- 演示数据自动插入

#### 2. 启动前端服务
```bash
cd frontend
npm install
npm start
```

前端服务启动后：
- 访问地址: http://localhost:4200
- API 请求通过 Vite 代理转发到后端

## 🔐 演示账号

系统预置三个角色的演示账号，密码均为 `123456`：

| 用户名     | 角色               | 岗位描述                     | 可处理状态       |
|------------|--------------------|------------------------------|------------------|
| registrar  | 维修登记员         | 发起/补正维修工单           | 草稿、待补正     |
| supervisor | 维修审核主管       | 过程核验、审核办理           | 待审核           |
| manager    | 复核负责人         | 最终复核、归档               | 复核中           |

> 💡 前端顶部导航栏支持快速角色切换，方便测试角色接力流程。

## 📋 四类演示工单

系统启动时自动插入4种典型场景的演示工单：

### 1. 正常流转工单
- **工单号**: WO20240601001
- **客户**: 陈先生 (宝马530Li)
- **当前状态**: 复核中 (pending_review)
- **当前处理人**: 王经理 (复核负责人)
- **说明**: 正常保养工单，已通过审核，等待最终复核归档

### 2. 缺材料工单
- **工单号**: WO20240601002
- **客户**: 刘女士 (奔驰E300)
- **当前状态**: 待审核 (pending_audit)
- **当前处理人**: 李主管 (维修审核主管)
- **异常类型**: 缺少材料 (missing_materials)
- **说明**: 刹车片更换工单，缺少检测报告和报价单，临期预警

### 3. 超时逾期工单
- **工单号**: WO20240601003
- **客户**: 赵先生 (奥迪A6L)
- **当前状态**: 待补正 (correction)
- **当前处理人**: 张登记 (维修登记员)
- **异常类型**: 逾期 (overdue)
- **说明**: 发动机大修工单，已逾期2天，配件未到货

### 4. 退回补正工单
- **工单号**: WO20240601004
- **客户**: 孙先生 (丰田凯美瑞)
- **当前状态**: 待补正 (correction)
- **当前处理人**: 张登记 (维修登记员)
- **异常类型**: 退回补正 (correction)
- **说明**: 空调检修工单，因缺少检测照片被退回，需补正后重新提交

## 🔄 业务流程

### 状态流转图
```
草稿 (draft)
    ↓ submit (登记员)
待审核 (pending_audit)
    ├─↓ approve (主管)
    │  复核中 (pending_review)
    │      ├─↓ archive (经理)
    │      │  办结 (completed)
    │      └─↓ send_back (经理)
    │         待补正 (correction)
    └─↓ reject (主管)
       待补正 (correction)
           ↓ resubmit (登记员)
       待审核 (pending_audit)
```

### 状态流转规则

| 操作       | 起始状态   | 目标状态   | 执行角色   | 必填证据                                                                 |
|------------|------------|------------|------------|--------------------------------------------------------------------------|
| 提交审核   | draft      | pending_audit | registrar  | 工单登记表、车辆检测清单                                                |
| 审核通过   | pending_audit | pending_review | supervisor | 检测报告、维修报价单、配件确认单                                        |
| 退回补正   | pending_audit | correction | supervisor | 无（需填写异常原因）                                                    |
| 重新提交   | correction | pending_audit | registrar  | 工单登记表、车辆检测清单                                                |
| 复核归档   | pending_review | completed | manager    | 终检报告、派修单、客户确认单                                            |
| 退回补正   | pending_review | correction | manager    | 无（需填写异常原因）                                                    |

## ❌ 异常样例与拦截规则

后端在进入下一步前会严格校验，异常请求会被拦截：

### 1. 越权访问拦截
```
场景: 登记员尝试处理待审核状态的工单
错误: 403 Forbidden - 权限不足，无法执行此操作
```

### 2. 当前处理人不匹配拦截
```
场景: 非当前处理人尝试操作工单
错误: 403 Forbidden - 当前处理人不匹配
```

### 3. 状态冲突拦截
```
场景: 工单状态已变更，但前端提交旧状态操作
错误: 400 Bad Request - 状态无效
```

### 4. 版本冲突拦截
```
场景: 多人同时操作同一工单，版本号不匹配
错误: 409 Conflict - 版本冲突，请刷新后重试
```

### 5. 缺少证据拦截
```
场景: 提交审核时缺少工单登记表
错误: 400 Bad Request - 缺少必填证据附件: 缺少 工单登记表 类型证据
```

### 6. 重复提交拦截
```
场景: 同一版本号重复提交
错误: 409 Conflict - 版本冲突，请刷新后重试
```

### 7. 批量处理拦截
批量处理时逐条校验，返回每条的成功/失败原因：
```json
{
  "total": 3,
  "success": 1,
  "failed": 2,
  "results": [
    { "id": 1, "success": true, "message": "处理成功" },
    { "id": 2, "success": false, "message": "缺少必填证据附件: 缺少 检测报告 类型证据" },
    { "id": 3, "success": false, "message": "当前处理人不匹配" }
  ]
}
```

## 🗄️ 数据库结构

SQLite 数据库文件位置: `backend/data/workshop.db`

### 核心数据表

| 表名              | 说明                     |
|-------------------|--------------------------|
| users             | 用户表（角色、密码）     |
| work_orders       | 维修工单主表             |
| attachments       | 证据附件表               |
| processing_logs   | 处理记录表（操作日志）   |
| audit_notes       | 审计备注表               |
| exception_records | 异常记录表               |

### 可查询数据
- ✅ 维修工单完整信息（状态、处理人、版本号）
- ✅ 证据附件列表（类型、上传人、时间）
- ✅ 处理记录（操作人、动作、状态变更、备注）
- ✅ 审计备注（审核意见）
- ✅ 异常原因（类型、原因、解决情况）

### 预警级别自动计算
系统每次查询时自动更新预警级别：
- **正常 (normal)**: 预计完成时间 > 1天
- **临期 (near_due)**: 预计完成时间 ≤ 1天
- **逾期 (overdue)**: 预计完成时间 < 当前时间

## 📱 前端功能模块

### 1. 维修工单登记 (`/registration`)
- 新建维修工单
- 待补正工单队列
- 批量重新提交审核

### 2. 过程核验 (`/verification`)
- 待审核工单队列
- 审核通过/退回补正
- 批量处理

### 3. 复核归档 (`/review`)
- 复核中工单队列
- 复核归档/退回补正
- 批量处理

### 4. 到期预警队列 (`/warning`)
- 正常/临期/逾期分类展示
- 按预警级别排序
- 责任人计算

### 5. 工单台账 (`/ledger`)
- 全量工单查询
- 按预约进厂线索筛选
- 派修、交车回访状态追踪
- 统计概览（总数、各状态数量）

### 通用功能
- 🔍 筛选: 状态（待补正/复核中/办结等）、预约进厂线索、预警级别、车牌号
- 👤 角色切换: 顶部快速切换不同角色账号
- 📝 详情页: 完整信息展示、证据清单、处理记录、审计备注、办理操作
- 📦 批量处理: 全选/多选、批量操作、逐条结果展示

## 🔌 API 接口列表

### 认证接口
```
POST /api/auth/login          # 登录
```

### 工单接口
```
GET    /api/workorders              # 获取工单列表
POST   /api/workorders              # 创建工单
POST   /api/workorders/batch        # 批量处理
GET    /api/workorders/:id          # 获取工单详情
POST   /api/workorders/:id/process  # 处理工单
POST   /api/workorders/:id/notes    # 添加审计备注
```

### 统计接口
```
GET    /api/statistics        # 获取统计数据
GET    /api/user/me           # 获取当前用户信息
```

### 接口请求示例
```bash
# 登录获取token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"registrar","password":"123456"}'

# 获取工单列表（需携带token）
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/workorders?status=correction&page=1&page_size=20"

# 处理工单
curl -X POST http://localhost:3000/api/workorders/1/process \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"action":"resubmit","remark":"已补充材料","version":1}'
```

## 🎯 测试场景建议

### 角色接力测试
1. 登录 `registrar` → 查看待补正工单 → 进详情办理 → 重新提交
2. 切换角色到 `supervisor` → 查看待审核工单 → 审核通过
3. 切换角色到 `manager` → 查看复核中工单 → 复核归档
4. 验证台账中工单状态变为"办结"

### 批量处理测试
1. 选择多个工单 → 批量操作 → 查看逐条结果
2. 故意包含缺少证据的工单 → 验证失败原因展示

### 异常拦截测试
1. 绕开页面直接调用接口 → 使用错误角色token → 验证403拦截
2. 使用旧版本号提交 → 验证409版本冲突拦截
3. 缺少必填证据时提交 → 验证400缺少证据拦截

### 列表筛选测试
1. 筛选"待补正"状态 → 验证只显示待补正工单
2. 筛选"复核中"状态 → 验证只显示复核中工单
3. 筛选"办结"状态 → 验证只显示办结工单
4. 按预约进厂线索搜索 → 验证模糊搜索

## 📁 项目结构

```
.
├── .env                      # 环境配置（端口、数据库路径）
├── README.md
├── backend/
│   ├── go.mod
│   ├── data/                 # SQLite数据库目录
│   │   └── workshop.db
│   ├── cmd/
│   │   └── server/
│   │       └── main.go       # 后端入口
│   └── internal/
│       ├── config/           # 配置加载
│       ├── database/         # 数据库连接与初始化
│       ├── models/           # 数据模型
│       ├── handlers/         # API处理器
│       ├── middleware/       # 中间件（认证、CORS）
│       ├── services/         # 业务逻辑层
│       └── utils/            # 工具函数
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.ts
        ├── polyfills.ts
        └── app/
            ├── app.module.ts
            ├── components/   # 页面组件
            ├── services/     # 前端服务
            ├── models/       # TypeScript类型
            ├── guards/       # 路由守卫
            └── interceptors/ # HTTP拦截器
```

## 🔒 安全特性

1. **JWT 认证**: 所有接口需携带 Bearer Token
2. **角色权限控制**: 基于角色的接口访问控制
3. **当前处理人校验**: 只有当前处理人才能操作工单
4. **乐观锁版本控制**: 防止并发修改冲突
5. **必填证据校验**: 状态流转前核验证据完整性
6. **CORS 白名单**: 仅允许前端域名访问
7. **密码加密**: bcrypt 加密存储用户密码

## 🛠️ 技术栈

| 层   | 技术栈                          |
|------|---------------------------------|
| 前端 | Angular 17 + Vite + TypeScript |
| 后端 | Go 1.21 + Chi 框架             |
| 数据库 | SQLite 3 (本地文件)          |
| 认证 | JWT (HS256)                    |
| 密码加密 | bcrypt                       |
