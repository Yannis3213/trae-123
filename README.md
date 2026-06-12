# 家政服务平台 - 月底集中处理服务人员审核单系统

月底集中处理家政阿姨档案、资质和上岗信息的审核单系统，覆盖派单客服建单→服务督导推进→城市经理复核全流程。

## 技术栈

- 前端：Qwik City + TypeScript + Tailwind CSS（端口 31010）
- 后端：Rust + Poem + SQLite（端口 8101）
- 数据库：SQLite 本地文件 `backend/data/app.db`

## 启动方式

### 1. 启动后端

```bash
cd backend
cargo run
```

后端会在 `0.0.0.0:8101` 启动，首次运行自动在 `backend/data/` 目录创建 `app.db` 并写入演示数据。

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器在 `http://localhost:31010` 启动。

## SQLite 初始化

后端启动时自动完成：
- 创建 `users`、`audit_orders`、`nanny_profiles`、`qualification_reviews`、`on_duty_confirmations`、`audit_logs` 六张表
- 如果表为空，自动插入演示数据（3 个用户 + 4 条审核单）
- 数据库文件位置：`backend/data/app.db`（删除此文件可重新初始化）

## 演示账号

| 角色 | 用户名 | 密码 | 权限 |
|------|--------|------|------|
| 派单客服 | dispatcher | demo123 | 创建审核单、查看自己建单、撤回待处理单据 |
| 服务督导 | supervisor | demo123 | 推进审核单（补充阿姨档案/资质信息）、退回补正 |
| 城市经理 | manager | demo123 | 复核审核单、确认上岗、办结或退回、查看统计 |

## 四类演示单据

1. **AUD-2026-001（正常流转单）**：信息完整，可从待处理→处理中→复核中→办结
2. **AUD-2026-002（缺材料单）**：阿姨档案缺少身份证号，推进时被拦截返回 ERR_MISSING_EVIDENCE
3. **AUD-2026-003（逾期单）**：到期日 2026-06-05（已过期），出现在逾期队列，当前处理人为服务督导
4. **AUD-2026-004（退回补正单）**：状态为待补正，审计备注记录了退回原因"资质材料不完整"

## 异常入口测试

### 接口直接调用测试

```bash
# 登录获取 Token
TOKEN=$(curl -s http://localhost:8101/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"supervisor","password":"demo123"}' | jq -r '.token')

# 越权测试：派单客服尝试复核
DISPATCHER_TOKEN=$(curl -s http://localhost:8101/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dispatcher","password":"demo123"}' | jq -r '.token')
curl -s http://localhost:8101/api/audits/a1/process \
  -H "Authorization: Bearer $DISPATCHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"advance","version":1,"comment":"越权测试"}'
# 返回 ERR_FORBIDDEN

# 状态冲突测试：对已处理单据重复操作
curl -s http://localhost:8101/api/audits/a3/process \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"advance","version":1,"comment":"版本冲突测试"}'
# 返回 ERR_VERSION_CONFLICT（版本号不匹配）

# 缺证据测试：尝试办结信息不完整的单据
MANAGER_TOKEN=$(curl -s http://localhost:8101/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager","password":"demo123"}' | jq -r '.token')
curl -s http://localhost:8101/api/audits/a1/process \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"complete","version":1,"comment":"缺证据测试"}'
# 返回 ERR_INVALID_STATUS（状态不是 reviewing）

# 批量处理
curl -s http://localhost:8101/api/audits/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"advance","audit_ids":["a1","a2"],"comment":"批量测试"}'
# 逐条返回成功/失败原因
```

### 前端操作测试

1. **角色切换**：列表页右上角下拉切换角色，不同角色看到不同队列和操作按钮
2. **列表筛选**：按状态/到期筛选，正常/临期/逾期标签颜色区分
3. **详情办理**：进入审核单详情，按角色显示操作按钮，提交时服务端校验
4. **批量处理**：勾选多条审核单，执行批量操作，结果弹窗逐条显示成功/失败
5. **到期预警**：三列看板（正常/临期/逾期），逾期批量推进逐条拦截

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/auth/login | POST | 登录 |
| /api/audits | GET | 审核单列表（status/expiry_status/role_queue/page/page_size） |
| /api/audits | POST | 创建审核单（仅派单客服） |
| /api/audits/:id | GET | 审核单详情（含三模块+审计备注） |
| /api/audits/:id/process | POST | 处理审核单（advance/return_correction/review_pass/complete） |
| /api/audits/:id/withdraw | POST | 撤回审核单（仅派单客服，仅待处理状态） |
| /api/audits/batch | POST | 批量处理，逐条返回结果 |
| /api/audits/expiry | GET | 到期预警（normal/expiring_soon/overdue 三队列） |
| /api/dashboard/stats | GET | 统计数据 |

## 错误码

| 错误码 | 含义 |
|--------|------|
| ERR_UNAUTHORIZED | 未授权（Token 无效或缺失） |
| ERR_FORBIDDEN | 权限不足（角色不匹配） |
| ERR_NOT_FOUND | 审核单不存在 |
| ERR_VERSION_CONFLICT | 版本冲突（数据已被他人修改） |
| ERR_MISSING_EVIDENCE | 缺少必填证据（阿姨档案/资质审核/上岗确认） |
| ERR_INVALID_STATUS | 状态不允许此操作 |
| ERR_NOT_HANDLER | 当前用户不是处理人 |
| ERR_BAD_REQUEST | 参数错误 |
