# 幼儿园月底集中处理晨检记录系统

## 技术栈

- **前端**: Preact 10 + Vite 5（端口 3003）
- **后端**: Node.js + Express 4（端口 8003）
- **数据库**: SQLite（better-sqlite3）
- **鉴权**: JWT

## 端口约定（全局共用）

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 Vite Dev Server | 3003 | http://localhost:3003 |
| 后端 Express API | 8003 | http://localhost:8003 |
| CORS 白名单 | http://localhost:3003 | 前端访问地址 |
| 前端 API_BASE | http://localhost:8003 | 后端请求地址 |

所有端口统一配置在：
- 前端 `frontend/src/api.js`（API_BASE）
- 前端 `frontend/vite.config.js`（server.port: 3003）
- 后端 `backend/server.js`（PORT=8003、CORS origin）

## 启动步骤

### 1. 初始化数据库并安装后端依赖

```bash
cd backend
npm install
npm run init-db    # 生成 data.db 并插入演示数据
```

### 2. 启动后端

```bash
cd backend
npm start          # 监听 http://localhost:8003
```

### 3. 安装前端依赖并启动

```bash
cd frontend
npm install
npm run dev        # 启动 Vite: http://localhost:3003
```

### 4. 访问系统

浏览器打开 http://localhost:3003

## SQLite 说明

数据库文件位于 `backend/data.db`，首次运行后端若 `data.db` 不存在会自动调用 `init-db.js` 初始化。
如需重置数据，删除 `backend/data.db` 后重新执行 `npm run init-db` 或重启后端即可。

数据表：`users`、`children`、`morning_check_records`、`attachments`、`processing_logs`、`audit_notes`。

## 演示账号

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 晨检登记员 | `registrar` | `123456` | 发起/补正晨检记录 |
| 晨检审核主管 | `supervisor` | `123456` | 接单审核、退回补正 |
| 幼儿园复核负责人（园长） | `principal` | `123456` | 复核归档 |

登录页提供快速登录按钮，点击即切换角色。

## 四类演示单据（首次启动已预置）

系统启动后可看到以下 6 条数据，覆盖 4 类典型场景：

| 单据 | 幼儿 | 状态 | 当前处理人 | 预警 | 说明 |
|------|------|------|-----------|------|------|
| ① | 小明（小一班） | 待接单 | 王主管（supervisor） | 正常 | **正常流转样例**：登记员已提交，等待主管接单 |
| ② | 小红（小一班） | 已接单 | 张园长（principal） | 临期 | **正常流转样例**：主管已接单，等待园长复核归档 |
| ③ | 小刚（小二班） | 退回登记员补正 | 李登记（registrar） | 正常 | **退回补正样例**：体温 37.5℃ 被主管退回，需补充医院诊断证明 |
| ④ | 小丽（小二班） | 待接单 | 王主管（supervisor） | **逾期** | **超时/逾期样例**：5 天前提交，已超过 3 天处理期限 |
| ⑤ | 小强（中一班） | 待登记 | 李登记（registrar） | 正常 | **异常入口样例**：轻微咳嗽，保健老师登记中（仅补正/退回，不可直接推进） |
| ⑥ | 小明（小一班） | 验收通过 | -（已归档） | 已归档 | **已完成样例**：全流程正常流转，已归档 |

## 异常入口

### 前端入口
- **新增异常记录**：登记员点击"新增晨检记录"，健康状态选择"异常"并填写异常类型/说明。
- **列表筛出异常**：列表中健康状态列显示红色"异常"标签，可结合"待补正"状态筛选。
- **详情异常提示**：异常记录详情页显示红色警告条，操作区仅出现"补正并提交"或"退回"，不出现"通过"按钮。

### 后端拦截
所有接口在提交时校验：
- 异常记录 `health_status = 'abnormal'` 时，`accept` / `verify` 一律被拒绝，仅允许 `correction_submit`（补正）或 `reject`（退回）。

## 状态流转（主链路，不可跳步）

```
待登记 pending_registration
        ↓（登记员补正提交，补齐证据）
待接单 pending_review
        ↓（主管接单通过）               ↖（主管退回）
已接单 accepted                        退回登记员补正 pending_registrar_correction
        ↓（园长复核归档）                      ↓（登记员补正后回提）
验收通过 verified（归档）            退回主管补正 pending_supervisor_correction
        ↑（园长退回）                                 ↓（主管补正后回提）
```

**关键约束**：
- 保健老师（登记员）不能替园长归档。
- 班主任/登记员不能跳过主管审核直接送园长。
- 角色只能处理分配给自己的状态节点。

## 权限校验矩阵

| 校验项 | 说明 |
|--------|------|
| 角色权限 | 接口级中间件 `roleMiddleware`，例如 `POST /api/records` 仅 `registrar` |
| 当前处理人 | 仅 `record.current_handler === user.username` 允许处理 |
| 状态匹配 | 每种 `action` 仅接受有限的 `previous_status` |
| 版本乐观锁 | `POST /api/records/:id/handle` 必须携带 `version`，与 DB 不一致返回 409 |
| 必填证据 | 提交/补正时必含 `registration`（晨检登记）和 `child_profile`（幼儿档案）；异常记录额外必含 `abnormal_notice`（异常通知） |
| 退回必填意见 | `action = reject` 必传 `reject_reason` |
| 补正必填原因 | `action = correction_submit` 必传 `correction_reason` |
| 异常不可推进 | 异常记录只允许补正/退回，不允许 accept/verify |

## 批量处理

主管可批量"接单通过"、园长可批量"复核归档"。

**逐条拦截规则**（不会整批放行）：
- 非当前处理人 → 失败
- 状态不匹配 → 失败
- 异常记录 → 失败（需逐条详情补正）
- 已逾期 → 失败（显示责任人，需逐条详情处理）
- 已归档 → 失败

返回结果包含 `summary`（成功/失败计数）和 `results[]`（每条的 id、success、原因、新状态），前端逐条展示。

## 到期预警

每条记录创建/流转时 deadline 设为 `datetime('now', '+3 days')`，前端显示三档：
- 🟢 **正常**：截止日 > 1 天
- 🟡 **临期**：0 < 剩余 ≤ 1 天
- 🔴 **逾期**：已过截止时间，节点显示责任人角色+账号

批量处理中逾期记录会被逐条拦截并提示责任人。

## 审计与持久化

- `processing_logs` 记录每次操作的动作、前后状态、操作人角色、备注、退回意见、补正原因、证据摘要、时间戳。
- `audit_notes` 独立保存审计备注。
- 刷新页面后列表、详情、统计、操作记录全部从 SQLite 读取，数据一致。

## 穿透测试场景（供验证）

| 场景 | 预期 |
|------|------|
| 正常流转：registrar → supervisor → principal | 状态依次 pending_review → accepted → verified，版本递增，操作日志完整 |
| 缺材料：登记员提交时不上传附件 | 后端返回 400，提示"缺少晨检登记表证据/缺少幼儿档案证据" |
| 超时/逾期：④号单据批量通过 | 该条被拦截，提示"已逾期，当前责任人..."，其他正常 |
| 退回补正或状态冲突：主管退回后登记员用旧 version 提交 | 返回 409"版本冲突" |
| 越权：registrar 直接 verify 已接单记录 | 返回 403"当前角色无权限" |
| 重复提交：同一 version 连续提交两次 | 第二次 409 拦截 |
| 异常推进：⑤号异常记录点 accept | 返回 400"异常记录只能补正或退回" |

## 主要接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录，返回 token + user |
| GET | `/api/auth/me` | 当前用户信息 |
| GET | `/api/records` | 列表（按角色自动过滤）+ stats |
| GET | `/api/records/:id` | 详情（含 child、attachments、logs、audit_notes） |
| POST | `/api/records` | 登记员创建晨检记录 |
| POST | `/api/records/:id/handle` | 处理（accept / reject / correction_submit / verify） |
| POST | `/api/records/batch` | 批量处理（逐条返回结果） |
| GET | `/api/children` | 幼儿档案列表 |
| GET | `/api/stats/summary` | 统计汇总 |
| GET | `/api/constants` | 状态、角色、附件类型常量 |
