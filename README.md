# 街道办事处-月底集中处理帮扶申请系统

## 系统概述

本系统专注于帮扶申请在「困难帮扶」→「入户核实」→「救助确认」三个节点之间的流转，按岗位权限明确分工：
- **社区专干**：创建申请、补正材料、上传证据
- **街道科员**：处理申请、流转节点、退回补正
- **分管领导**：复核审批、最终确认、退回补正

页面标签仅保留「待接单」「已接单」「验收通过」，聚焦核心业务流程。退回补正的申请在「待接单」标签下展示，方便社区专干补正。

## 端口配置

> 前端端口、后端端口、CORS白名单、启动命令统一使用以下端口，请勿修改：

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 3106 | Solid.js + Vite |
| 后端 | 8106 | Python + Django Ninja |
| 数据库 | - | 项目内 SQLite |

前端请求地址通过 Vite 代理转发：`/api/*` → `http://localhost:8106/api/*`

## 技术栈

### 前端
- Solid.js 1.8
- Vite 5.3
- 原生 CSS

### 后端
- Python 3.11+
- Django 5.0
- Django Ninja 1.3
- django-cors-headers 4.4
- Pydantic 2.7

## 快速启动

### 1. 后端启动

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 数据库迁移（首次运行）
python manage.py makemigrations assistance
python manage.py migrate

# 初始化演示数据（首次运行）
python manage.py seed_data

# 启动服务（端口 8106）
python manage.py runserver 8106
```

### 2. 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务（端口 3106）
npm run dev
```

### 3. 访问系统

打开浏览器访问：`http://localhost:3106`

## 演示账号

所有演示账号密码统一为：`demo123456`

| 用户名 | 角色 | 权限 |
|--------|------|------|
| `community_worker` | 社区专干 | 创建申请、补正材料、上传证据 |
| `street_clerk` | 街道科员 | 接单、处理、流转、退回补正 |
| `leader` | 分管领导 | 接单、审批、复核、退回补正 |

> 登录页面提供快速登录按钮，点击即可切换角色体验。

## 四类演示单据

系统初始化后包含以下典型场景的演示数据，每条单据都有完整的处理记录链路：

| 单据编号 | 场景类型 | 当前节点 | 状态 | 说明 |
|----------|----------|----------|------|------|
| BZDEMO0001 | 正常流转 | 困难帮扶 | 待接单 | 材料齐全，可正常接单流转 |
| BZDEMO0002 | 缺材料 | 入户核实 | 已接单 | 缺少走访记录、照片证据；可退回补正或上传补正材料 |
| BZDEMO0003 | 超时逾期 | 救助确认 | 已接单 | 已逾期，审批被拦截；只能退回补正 |
| BZDEMO0004 | 退回补正 | 困难帮扶 | 退回补正 | 缺少困难证明，需社区专干上传材料后补正提交 |
| BZDEMO0005 | 临期预警 | 入户核实 | 待接单 | 材料齐全，即将到期 |
| BZDEMO0006 | 正常办理 | 困难帮扶 | 已接单 | 材料齐全，可正常处理或退回 |

## 业务流程

```
社区专干创建申请
    ↓
[困难帮扶节点] 待接单 → 街道科员接单 → 已接单
    ↓                                     ↓
材料齐全 → 处理流转               材料缺失/逾期 → 退回补正
    ↓                                     ↓
[入户核实节点] 待接单              社区专干上传补正材料 → 补正提交
    ↓                                     ↓
街道科员接单 → 已接单              回到待接单 → 街道科员重新接单
    ↓
材料齐全 → 核实流转 / 缺材料 → 退回补正
    ↓
[救助确认节点] 待接单
    ↓
分管领导接单 → 已接单
    ↓
材料齐全+未逾期 → 审批通过 → 验收通过（流程结束）
    或
逾期 → 只能退回补正（OVERDUE_BLOCKED）
    或
不予通过 → 流程结束
```

## 核心功能

### 1. 列表筛选
- 按状态标签筛选：待接单（含退回补正）、已接单、验收通过
- 高级筛选：节点、预警状态、社区、关键词搜索
- 支持多条件组合查询
- 列表行内操作：退回补正、补正入口

### 2. 详情办理
- 完整展示申请信息、附件材料、处理记录、审计备注、异常原因
- 缺少必填材料时高亮提示，并提供材料上传入口
- 根据角色和状态显示可执行操作
- 退回补正必须填写原因
- 提交处理结果时实时校验权限
- 办理后同步刷新列表

### 3. 补正材料
- 社区专干可在详情页上传补正材料
- 列表页提供补正弹窗，支持批量添加材料后一次性提交
- 上传后自动更新缺失材料列表
- 补正提交后申请回到「待接单」状态

### 4. 退回补正
- 街道科员和分管领导均可退回申请
- 退回时必须填写原因，系统自动记录审计备注
- 逾期申请禁止直接审批/推进，只能退回补正
- 退回后处理人回退到社区专干

### 5. 异常处置
- 所有异常（越权、缺材料、逾期拦截等）记录到数据库
- 详情页展示异常原因，红色高亮未解决的异常
- 异常入口可回到详情补正动作
- 逾期批量推进时逐条拦截并记录

### 6. 批量处理
- 街道科员和分管领导支持批量操作
- 批量结果逐条返回成功/失败原因
- 逾期申请在批量处理时被拦截
- 批量退回补正必须填写原因

### 7. 到期预警
- **正常**：截止时间 > 24小时
- **临期**：截止时间 ≤ 24小时
- **逾期**：已超过截止时间
- 预警状态自动更新，超时责任落到当前处理人
- 逾期申请禁止直接推进，只能退回补正

## 异常入口与测试场景

### 前端测试路径

1. **正常流转测试**
   - 登录 `street_clerk` → 待接单列表 → BZDEMO0001 → 接单 → 处理流转
   - 登录 `leader` → 待接单列表 → 接单 → 审批通过

2. **缺材料 → 退回补正 → 补正 → 重新流转**
   - 登录 `street_clerk` → 已接单列表 → BZDEMO0002 → 点击「退回补正」
   - 填写退回原因 → 确认退回
   - 切换到 `community_worker` → 待接单列表 → 找到退回的申请 → 点击「补正」
   - 添加走访记录、照片证据 → 提交补正
   - 切换回 `street_clerk` → 重新接单并处理

3. **逾期 → 审批被拦截 → 退回补正**
   - 登录 `leader` → BZDEMO0003 → 尝试审批 → 被拦截（OVERDUE_BLOCKED）
   - 点击「退回补正」→ 填写原因 → 退回成功
   - 查看异常记录：红色高亮显示逾期拦截日志

4. **退回补正 → 上传材料 → 补正提交**
   - 登录 `community_worker` → BZDEMO0004
   - 缺少困难证明材料高亮提示 → 点击「上传补正材料」
   - 上传困难证明 → 缺失材料清空
   - 执行「补正提交」→ 状态回到待接单

5. **角色切换测试**
   - 顶部角色下拉框可快速切换角色
   - 列表数据自动按角色权限过滤

6. **批量处理测试**
   - 登录 `street_clerk` → 待接单列表 → 多选单据 → 批量接单
   - 查看每条结果的成功/失败原因
   - 批量退回补正必须填写原因

### 接口安全测试（直接调用 API）

使用以下方式测试后端安全校验：

```bash
# 越权访问（使用 community_worker 账号处理 street_clerk 权限的单据）
curl -X POST http://localhost:8106/api/applications/process \
  -u community_worker:demo123456 \
  -H "Content-Type: application/json" \
  -d '{"application_id": 1, "version": 2, "action": "accept"}'

# 逾期审批拦截（逾期申请禁止直接审批）
curl -X POST http://localhost:8106/api/applications/process \
  -u leader:demo123456 \
  -H "Content-Type: application/json" \
  -d '{"application_id": 3, "version": 7, "action": "approve"}'

# 逾期退回补正（逾期申请允许退回）
curl -X POST http://localhost:8106/api/applications/process \
  -u leader:demo123456 \
  -H "Content-Type: application/json" \
  -d '{"application_id": 3, "version": 7, "action": "return", "comment": "逾期退回补正"}'

# 补正材料上传
curl -X POST http://localhost:8106/api/applications/attachments \
  -u community_worker:demo123456 \
  -H "Content-Type: application/json" \
  -d '{"application_id": 4, "file_name": "困难证明.pdf", "evidence_type": "difficulty_proof", "is_required": true}'

# 补正提交
curl -X POST http://localhost:8106/api/applications/process \
  -u community_worker:demo123456 \
  -H "Content-Type: application/json" \
  -d '{"application_id": 4, "version": 4, "action": "correct", "comment": "补正材料已上传"}'

# 查询异常日志
curl http://localhost:8106/api/applications/3/exceptions \
  -u leader:demo123456

# 状态冲突（对已接单的单据再次执行接单）
curl -X POST http://localhost:8106/api/applications/process \
  -u street_clerk:demo123456 \
  -H "Content-Type: application/json" \
  -d '{"application_id": 6, "version": 3, "action": "accept"}'

# 旧版本提交（使用过期的 version 号）
curl -X POST http://localhost:8106/api/applications/process \
  -u street_clerk:demo123456 \
  -H "Content-Type: application/json" \
  -d '{"application_id": 1, "version": 1, "action": "process"}'

# 缺证据请求（流转缺少必填材料的单据）
curl -X POST http://localhost:8106/api/applications/process \
  -u street_clerk:demo123456 \
  -H "Content-Type: application/json" \
  -d '{"application_id": 2, "version": 3, "action": "process"}'
```

## 权限校验规则

后端在提交处理结果时按以下顺序校验：

1. **版本校验**：提交的 version 必须与当前数据库版本一致
2. **权限校验**：当前角色在当前节点是否允许执行该操作
3. **处理人校验**：当前用户是否为该申请的处理人
4. **状态校验**：当前状态是否允许执行该操作
5. **逾期校验**：逾期申请禁止直接推进/审批，只能退回补正
6. **证据校验**：流转到下一节点时必填证据是否齐全（退回操作不检查证据）
7. **防重复提交**：5秒内相同操作视为重复提交

## 数据库表结构

SQLite 数据库文件：`backend/db.sqlite3`

主要数据表：

| 表名 | 说明 |
|------|------|
| `assistance_application` | 帮扶申请主表 |
| `attachment` | 附件材料表（含补正材料） |
| `processing_record` | 处理记录表（含退回/补正操作记录） |
| `audit_note` | 审计备注表（含退回原因、补正记录、材料上传记录） |
| `exception_log` | 异常日志表（含逾期拦截记录） |
| `user_profile` | 用户角色扩展表 |

## 持久化保证

- 所有操作均写入数据库，刷新页面数据一致
- 处理记录完整保留操作轨迹（含退回、补正、材料上传）
- 审计备注记录退回原因、补正动作、材料上传
- 异常日志持久化逾期拦截等异常，便于问题追溯
- 补正材料持久化到附件表，刷新后仍可查看
- 版本号递增，防止并发冲突

## 注意事项

1. 通知、统计、导出功能已按要求屏蔽，调用对应接口会返回「功能暂未开放」
2. 核心流程聚焦于三个节点之间的连续办理
3. 退回补正是闭环：退回 → 补正 → 重新流转
4. 逾期申请只能退回补正，不能直接推进或审批
5. 所有端口配置统一，请勿修改 `3106` 和 `8106`
6. CORS 白名单仅允许 `http://localhost:3106` 访问
7. 如需重置数据：删除 `backend/db.sqlite3` 后重新执行 `migrate` 和 `seed_data`
