# 广告代理公司 - 月底集中处理创意需求单系统

## 系统概述

本系统为广告代理公司设计的创意需求单全流程管理平台，支持从需求登记、审核到归档的完整业务闭环。

## 技术栈

- **前端**: Remix + React + Tailwind CSS（端口 3005）
- **后端**: Rust + Axum（端口 8005）
- **数据库**: SQLite（本地文件 `creative_requests.db`）

## 快速启动

### 1. 启动后端

```bash
cd backend
cargo run
```

首次运行会自动：
- 创建 SQLite 数据库文件 `creative_requests.db`
- 初始化所有表结构（users、creative_requests、attachments、processing_records、audit_notes、exception_reasons）
- 插入演示数据（3 个用户 + 4 条创意需求单 + 处理记录/审计备注/异常原因）

后端服务将在 `http://localhost:8005` 启动。

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 `http://localhost:3005` 启动。

### 3. 访问系统

浏览器打开 `http://localhost:3005`

## 演示账号

| 用户名   | 角色                   | 姓名 | 权限说明                                     |
|----------|------------------------|------|----------------------------------------------|
| zhangsan | 创意需求登记员          | 张三 | 创建、提交、补正创意需求单                    |
| lisi     | 创意需求审核主管        | 李四 | 审核、通过、退回创意需求单                    |
| wangwu   | 广告代理公司复核负责人  | 王五 | 复核、归档、退回创意需求单                    |

在页面右上角的下拉框中切换用户角色。

## 演示数据

系统预置 4 条创意需求单，覆盖不同状态和到期预警：

| 编号       | 标题                     | 状态     | Brief状态 | 排期状态 | 到期预警 |
|------------|--------------------------|----------|-----------|----------|----------|
| CR-2024-001 | 夏季品牌推广创意需求      | 已提交   | 已接收    | 已排期   | 正常     |
| CR-2024-002 | 秋季新品发布创意需求      | 已退回   | 缺失      | 待处理   | 临期     |
| CR-2024-003 | 双十一大促创意需求        | 已审核   | 已接收    | 已排期   | 逾期     |
| CR-2024-004 | 年终答谢会创意需求        | 草稿     | 待处理    | 待处理   | 正常     |

每条需求单都附带了对应的处理记录、审计备注或异常原因。

## 状态流转

```
草稿(draft) → 待提交(pending_submit) → 已提交(submitted)
    ↑                                        ↓
    |                                  审核中(under_review)
    |                                   ↓           ↓
    └── 已退回(returned) ←────────── 退回        已审核(reviewed)
         ↓                                         ↓      ↓
    重新提交(resubmitted)                    退回    已归档(archived)
         ↓                                   ↓
    已提交(submitted)                 已退回(returned)
```

### 角色权限

- **创意需求登记员**：创建 → 提交（草稿/待提交/已退回 → 已提交/重新提交）、补正
- **创意需求审核主管**：开始审核（已提交/重新提交 → 审核中）、通过（审核中 → 已审核）、退回
- **广告代理公司复核负责人**：归档（已审核 → 已归档）、退回

### 后端校验规则

所有状态转换均需通过以下校验（即使绕过页面直调接口也会拦截）：

1. **角色校验**：当前角色必须匹配转换允许的角色
2. **状态校验**：当前状态必须是转换的起始状态
3. **版本校验**：提交的版本号必须与当前版本一致（乐观锁，防止旧版本提交）
4. **必填证据**：提交时 brief_status 不能为 missing；归档时 schedule_status 不能为 missing
5. **意见必填**：审核通过/退回操作必须填写意见
6. **批量逐条拦截**：批量处理逐条校验，逾期单据不能归档，返回逐条成功/失败原因
7. **异常只允许补正或退回**：不能悄悄推进异常需求单

## 业务模块

### Brief接收
- 状态：待处理 / 已接收 / 缺失
- Brief 缺失时，详情页显示红色警告，允许从详情页补正

### 创意排期
- 状态：待处理 / 已排期 / 缺失
- 排期缺失时，详情页显示红色警告，允许从详情页补正

### 创意需求单登记
- 完整的需求单表单，包含标题、客户、品牌、活动、描述、截止日期等字段

## 到期预警

| 级别   | 条件              | 颜色   | 节点超时显示   |
|--------|-------------------|--------|----------------|
| 正常   | 截止日期 > 3 天   | 绿色   | -              |
| 临期   | 截止日期 0-3 天   | 黄色   | 当前处理人     |
| 逾期   | 截止日期已过      | 红色   | 当前处理人     |

逾期批量推进不能整批放行，逐条拦截后需在详情页留下补正动作和异常原因。

## API 接口

所有接口需要 `X-User-Id` 请求头（值为用户名：zhangsan/lisi/wangwu）。

| 方法   | 路径                                      | 说明               |
|--------|-------------------------------------------|---------------------|
| POST   | /api/auth/login                           | 登录               |
| GET    | /api/auth/me                              | 当前用户信息       |
| GET    | /api/creative-requests                    | 需求单列表         |
| GET    | /api/creative-requests/{id}               | 需求单详情         |
| POST   | /api/creative-requests                    | 创建需求单         |
| PUT    | /api/creative-requests/{id}               | 更新需求单         |
| POST   | /api/creative-requests/{id}/submit        | 提交需求单         |
| POST   | /api/creative-requests/{id}/review        | 审核需求单         |
| POST   | /api/creative-requests/{id}/supplement    | 补正需求单         |
| POST   | /api/creative-requests/batch              | 批量处理           |
| GET    | /api/creative-requests/{id}/attachments   | 附件列表           |
| POST   | /api/creative-requests/{id}/attachments   | 上传附件           |
| DELETE | /api/attachments/{id}                     | 删除附件           |
| GET    | /api/creative-requests/{id}/audit-trail   | 审计轨迹           |
| POST   | /api/creative-requests/{id}/audit-notes   | 添加审计备注       |
| GET    | /api/statistics                           | 统计数据           |

## CORS 配置

后端 CORS 白名单：`http://localhost:3005`

## 项目结构

```
├── backend/
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs              # 服务器入口、路由配置
│       ├── db.rs                # SQLite 连接池、Schema、种子数据
│       ├── models.rs            # 数据模型、枚举、请求/响应结构
│       ├── error.rs             # 错误类型定义
│       ├── middleware.rs         # 认证中间件、角色校验
│       └── handlers/
│           ├── mod.rs
│           ├── auth.rs          # 登录、用户信息
│           ├── creative_requests.rs  # 需求单 CRUD、状态流转、批量处理
│           ├── attachments.rs   # 附件上传/列表/删除
│           ├── audit.rs         # 审计轨迹、备注
│           └── statistics.rs    # 统计数据
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── app/
│       ├── root.tsx             # 全局布局、导航、角色切换
│       ├── entry.client.tsx
│       ├── entry.server.tsx
│       ├── tailwind.css
│       ├── components/
│       │   ├── AttachmentList.tsx
│       │   ├── AuditTrail.tsx
│       │   ├── BatchProcessor.tsx
│       │   ├── DeadlineWarning.tsx
│       │   ├── RoleSwitcher.tsx
│       │   └── StatusBadge.tsx
│       ├── routes/
│       │   ├── _index.tsx             # 统计概览
│       │   ├── creative-requests.tsx       # 创意需求单布局（转发Outlet Context）
│       │   ├── creative-requests._index.tsx  # 工作台列表
│       │   ├── creative-requests.$id.tsx     # 需求单详情
│       │   ├── creative-requests.new.tsx     # 新建需求单
│       │   └── batch-results.tsx       # 批量处理
│       └── utils/
│           ├── api.ts           # API 客户端
│           └── status.ts        # 状态/角色/权限工具
└── README.md
```
