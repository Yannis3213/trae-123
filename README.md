# 新能源汽车充电站-月底集中处理设备巡检单系统

## 项目结构

```
├── backend/                # Python + FastAPI 后端
│   ├── main.py            # 应用入口
│   ├── database.py        # 数据库配置
│   ├── models.py          # SQLAlchemy 数据模型
│   ├── schemas.py         # Pydantic 请求/响应模式
│   ├── auth.py            # JWT 认证工具
│   ├── seed.py            # 演示数据种子
│   ├── requirements.txt   # Python 依赖
│   ├── .env               # 环境变量（端口、数据库）
│   └── routers/           # API 路由
│       ├── auth.py
│       ├── inspections.py
│       ├── charging_pile_inspections.py
│       ├── fault_reports.py
│       └── expiry_queue.py
├── frontend/              # Remix 前端
│   ├── app/
│   │   ├── root.tsx       # 主布局（导航、认证）
│   │   ├── routes/        # 页面路由
│   │   ├── components/    # 可复用组件
│   │   ├── utils/         # 工具函数（API、类型、认证）
│   │   └── styles/        # Tailwind CSS
│   ├── package.json
│   ├── vite.config.ts     # Vite 配置（API 代理）
│   ├── tailwind.config.ts
│   └── .env               # 环境变量（端口）
└── .trae/documents/       # PRD 和技术架构文档
```

## 环境变量

端口通过 `.env` 文件配置，前端和后端共用 `FRONTEND_PORT` 和 `BACKEND_PORT`：

- `backend/.env`:
  ```
  BACKEND_PORT=8000
  FRONTEND_PORT=3000
  DATABASE_URL=sqlite:///./data/inspection.db
  SECRET_KEY=dev-secret-key-change-in-production
  ```

- `frontend/.env`:
  ```
  FRONTEND_PORT=3000
  BACKEND_PORT=8000
  ```

前端请求地址（Vite 代理 `/api` → `http://localhost:BACKEND_PORT`）、后端监听端口、CORS 白名单均使用同一组端口配置。

## 快速启动

### 1. 安装后端依赖

```bash
cd backend
pip3 install -r requirements.txt
```

### 2. 启动后端

```bash
cd backend
python3 main.py
```

后端启动时自动完成 SQLite 初始化和演示数据导入。API 文档访问 `http://localhost:8000/docs`。

### 3. 安装前端依赖

```bash
cd frontend
npm install
```

### 4. 启动前端

```bash
cd frontend
npm run dev
```

访问 `http://localhost:3000`。

## SQLite 初始化

后端启动时自动执行：
1. 创建 `backend/data/inspection.db`（如不存在）
2. 建表（9 张表：users, inspections, charging_pile_inspections, fault_reports, attachments, processing_records, audit_remarks, correction_records, exception_reasons）
3. 插入演示数据（仅在数据库为空时）

如需重置数据库，删除 `backend/data/inspection.db` 后重启后端即可。

## 演示账号

| 用户 ID | 密码 | 角色 | 权限 |
|---------|------|------|------|
| `user_001` | `user_001` | 站点值班员 | 创建设备巡检单、补正缺项 |
| `user_002` | `user_002` | 运维工程师 | 处理设备巡检单 |
| `user_003` | `user_003` | 运营经理 | 复核设备巡检单 |

## 四类演示单据

1. **正常流转**：`充电桩A区日常巡检` — 已走完 创建→提交→处理→复核→完成 全流程
2. **缺材料异常**：`充电桩B区故障巡检` — 待处理状态，含 material 类型异常原因（缺少备件）
3. **逾期单据**：`充电桩C区月度巡检` — 待处理状态，截止日期已过，含 deadline 类型异常原因
4. **退回补正**：`充电桩D区专项巡检` — 重新提交状态，曾被运营经理退回，值班员补正后重新提交，含纠正记录和审计备注

## 异常入口

系统在以下场景会记录异常原因（material/permission/deadline/status）：

- **越权操作**：非对应角色提交处理结果 → 写 permission 异常
- **重复提交/状态冲突**：当前状态不允许该操作 → 写 status 异常
- **旧版本提交**：版本号不匹配（乐观锁冲突） → 写 status 异常
- **缺证据请求**：缺少必填字段（意见、退回原因等） → 写 material 异常
- **超时处理**：超过截止日期 → 写 deadline 异常

批量处理逐条给出成功/失败结果，失败项附带具体原因。

## 到期预警

到期预警队列按责任人计算节点超时，三色分区：

- 🟢 **正常**：截止日期 > 7 天
- 🟡 **临期**：截止日期 ≤ 7 天
- 🔴 **逾期**：截止日期已过

逾期批量推进逐条校验，只推进 pending_process 状态的逾期单，其余逐条给出拦截结果。
