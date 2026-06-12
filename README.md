# 家政服务平台 - 月底集中处理服务人员审核单系统

月底集中处理家政阿姨档案、资质和上岗信息的审核单系统，覆盖派单客服建单→服务督导推进→城市经理复核全流程。

## 技术栈

- 前端：Qwik City + TypeScript + Tailwind CSS
- 后端：Rust + Poem + SQLite
- 数据库：SQLite 本地文件 `backend/data/app.db`

## 端口契约（环境变量驱动）

前后端端口均通过环境变量配置，代码中不硬编码。默认值：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `BACKEND_PORT` | 10100 | 后端监听端口（TCP 合法范围 1–65535） |
| `FRONTEND_ORIGIN` | http://localhost:31010 | CORS 白名单 |
| `VITE_API_BASE_URL` | http://localhost:10100/api | 前端 API 基地址 |
| `VITE_PORT` | 31010 | 前端开发服务器端口 |

> 注意：端口号不能超过 65535，否则回退到默认值。如需修改端口，请在 `.env` 文件或运行环境中设置上述变量。

## 启动方式

### 1. 启动后端

```bash
cd backend
cargo run
```

后端会在 `0.0.0.0:10100` 启动（默认端口），首次运行自动在 `backend/data/` 目录创建 `app.db` 并写入演示数据。

如需自定义端口：
```bash
BACKEND_PORT=10100 FRONTEND_ORIGIN=http://localhost:31010 cargo run
```

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器在 `http://localhost:31010` 启动（默认端口）。API 基地址通过 `.env` 文件中的 `VITE_API_BASE_URL` 配置。

## SQLite 初始化

后端启动时自动完成：
- 创建 `users`、`audit_orders`、`nanny_profiles`、`qualification_reviews`、`on_duty_confirmations`、`audit_logs` 六张表
- 如果表为空，自动插入演示数据（3 个用户 + 6 条审核单）
- 数据库文件位置：`backend/data/app.db`（删除此文件可重新初始化）

## 演示账号

| 角色 | 用户名 | 密码 | 权限 |
|------|--------|------|------|
| 派单客服 | dispatcher | demo123 | 创建审核单、查看自己建单、撤回待处理单据 |
| 服务督导 | supervisor | demo123 | 推进审核单（补充阿姨档案/资质信息）、退回补正 |
| 城市经理 | manager | demo123 | 复核审核单、确认上岗、办结或退回、查看统计 |

## 六类演示单据

| 单据编号 | 类型 | 当前状态 | 到期日 | 特征 |
|----------|------|----------|--------|------|
| **AUD-2026-001** | 正常流转单 | 待处理 | 2026-07-15 | 信息完整，可走完待处理→处理中→复核中→办结全流程 |
| **AUD-2026-002** | 缺材料单 | 待处理 | 2026-07-10 | 阿姨档案缺少身份证号、资质缺少培训证、上岗缺少到岗日期，**办结时会被拦截**返回 ERR_MISSING_EVIDENCE |
| **AUD-2026-003** | 逾期单 | 处理中 | 2026-06-05 | 已过期 8 天，出现在逾期队列，当前处理人为服务督导 |
| **AUD-2026-004** | 退回补正单 | 待补正 | 2026-07-20 | 审计备注记录退回原因"资质材料不完整"，异常原因"健康证过期需更新" |
| **AUD-2026-005** | 临期+状态冲突单 | 复核中 | 2026-06-18 | 临期（距到期 5 天），非城市经理角色操作会返回 ERR_INVALID_STATUS |
| **AUD-2026-006** | 逾期+待处理单 | 待处理 | 2026-06-10 | 已过期 3 天，出现在逾期队列，逾期批量推进目标 |

## 异常入口测试

### 接口直接调用测试

```bash
# 登录获取 Token（端口 10100）
TOKEN=$(curl -s http://localhost:10100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"supervisor","password":"demo123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# 越权测试：派单客服尝试推进审核单
DISPATCHER_TOKEN=$(curl -s http://localhost:10100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dispatcher","password":"demo123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s http://localhost:10100/api/audits/a1/process \
  -H "Authorization: Bearer $DISPATCHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"advance","version":1,"comment":"越权测试"}'
# 返回 ERR_FORBIDDEN：当前角色无权限执行此操作

# 版本冲突测试：用旧版本号提交
curl -s http://localhost:10100/api/audits/a3/process \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"advance","version":1,"comment":"版本冲突测试"}'
# 返回 ERR_VERSION_CONFLICT：版本号不匹配，数据已被他人修改

# 缺证据测试：尝试办结信息不完整的 AUD-2026-002（真实缺材料单）
MANAGER_TOKEN=$(curl -s http://localhost:10100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager","password":"demo123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# 先让 supervisor 把 a2 推进到处理中、再到复核中
curl -s http://localhost:10100/api/audits/a2/process \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"advance","version":1,"comment":"受理"}'
curl -s http://localhost:10100/api/audits/a2/process \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"advance","version":2,"comment":"提交复核"}'

# 现在 manager 尝试办结 a2（缺 id_card/training_cert/on_duty_date 等）
curl -s http://localhost:10100/api/audits/a2/process \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"complete","version":3,"comment":"尝试办结缺材料单"}'
# 返回 ERR_MISSING_EVIDENCE，列出缺失字段：
# nanny_profile.id_card, qualification_review.training_cert, on_duty_confirmation.on_duty_date, on_duty_confirmation.service_area

# 补充材料后再办结
curl -s http://localhost:10100/api/audits/a2/process \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action":"complete","version":3,"comment":"补充材料后办结",
    "nanny_profile":{
      "name":"李小芳","id_card":"110101199909092345",
      "phone":"13800002222","service_type":"月嫂","work_experience":"3年月嫂经验"
    },
    "qualification_review":{
      "health_cert":"HC-2026-002","health_cert_expiry":"2027-03-01",
      "training_cert":"TC-2026-002","training_cert_expiry":"2027-04-01",
      "background_check":"BC-2026-002","background_check_result":"pass"
    },
    "on_duty_confirmation":{
      "on_duty_date":"2026-06-15","service_area":"朝阳区",
      "contract_no":"CT-2026-002","confirmation_status":"confirmed"
    }
  }'
# 返回 success:true，状态变为 completed

# 批量处理（端口 10100）
curl -s http://localhost:10100/api/audits/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"advance","audit_ids":["a4","a5"],"comment":"批量推进"}'
# 逐条返回成功/失败原因，a4(待补正→处理中)成功，a5(复核中)失败返回 ERR_INVALID_STATUS

# 逾期批量推进（supervisor 对逾期队列执行 advance）
# 混合状态的逾期单会逐条拦截：reviewing 状态返回 ERR_INVALID_STATUS"当前状态为复核中，服务督导无法推进，需城市经理处理"
# pending/processing/correction_needed 状态可正常推进
# 失败项不改状态、版本和审计日志，仅成功项写入操作记录
```

### 前端操作测试

1. **角色切换**：列表页右上角下拉切换角色，不同角色看到不同队列和操作按钮
2. **列表筛选**：按状态/到期筛选，正常/临期/逾期标签颜色区分
3. **详情办理**：进入审核单详情，按角色显示操作按钮，提交时服务端校验
4. **批量处理**：勾选多条审核单，执行批量操作，结果弹窗逐条显示成功/失败
5. **到期预警**：三列看板（正常/临期/逾期），逾期批量推进逐条拦截，失败项显示错误码和原因（ERR_INVALID_STATUS + 具体状态说明），成功项刷新队列
6. **审计时间线**：详情页右侧展示操作人姓名/角色/动作/异常原因

## API 端点（http://localhost:10100）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 登录 |
| `/api/audits` | GET | 审核单列表（status/expiry_status/role_queue/page/page_size） |
| `/api/audits` | POST | 创建审核单（仅派单客服） |
| `/api/audits/:id` | GET | 审核单详情（含三模块+审计备注） |
| `/api/audits/:id/process` | POST | 处理审核单（advance/return_correction/review_pass/complete） |
| `/api/audits/:id/withdraw` | POST | 撤回审核单（仅派单客服，仅待处理状态） |
| `/api/audits/batch` | POST | 批量处理，逐条返回结果 |
| `/api/audits/expiry` | GET | 到期预警（normal/expiring_soon/overdue 三队列） |
| `/api/dashboard/stats` | GET | 统计数据 |

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

## 环境变量配置文件

后端 `backend/.env`：
```
BACKEND_PORT=10100
FRONTEND_ORIGIN=http://localhost:31010
```

前端 `frontend/.env`：
```
VITE_API_BASE_URL=http://localhost:10100/api
VITE_PORT=31010
```
