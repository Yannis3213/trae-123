# 货运物流公司-月底集中处理运输订单系统

## 一、项目概述
本系统实现运输订单的**登记 → 过程核验 → 复核归档**闭环管理，按岗位流转：客服专员补正材料 → 调度主管办理 → 运营经理收口。

- 状态：**待补正 → 复核中 → 办结**
- 前端：Angular 17 + Vite
- 后端：Python 3.10+ + Litestar 2.x + SQLAlchemy 2.x
- 数据库：本地 SQLite

---

## 二、端口约定（全局统一）
| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 3003 | 浏览器访问 `http://localhost:3003` |
| 后端 | 8003 | API 监听 `http://localhost:8003`，CORS 白名单仅放行 `http://localhost:3003` |

前端 Vite 代理 `/api` → `http://localhost:8003`。后端 CORS 配置和前端 `API_BASE` 均使用上述端口。

---

## 三、启动步骤

### 1. 后端启动

```bash
cd backend

# （推荐）创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate   # macOS/Linux

# 安装依赖
pip install -r requirements.txt

# 初始化 SQLite（首次必执行，会重建数据库并生成演示账号与演示单据）
python init_db.py

# 启动服务（端口 8003）
python main.py
# 或
uvicorn main:app --host 0.0.0.0 --port 8003 --reload
```

数据库文件位置：`backend/freight_orders.db`

### 2. 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器（端口 3003）
npm run dev
```

浏览器访问：<http://localhost:3003>

---

## 四、演示账号

| 角色 | 用户名 | 密码 | 职责 |
|------|--------|------|------|
| 客服专员 | `kefu` | `123456` | 补齐材料（运输委托字段和委托单证据），提交至复核 |
| 调度主管 | `diaodu` | `123456` | 车辆调度、签收回单核验，提交至办结 |
| 运营经理 | `yunying` | `123456` | 收口归档、退回补正、最终办结 |

登录页可直接点击对应账号**一键登录**。

---

## 五、四类演示单据（init_db 自动生成）

| 订单号 | 初始状态 | 场景 | 可做何用 |
|---------|----------|------|----------|
| YT20240601001 | 待补正 | **正常流转** | 客服专员补充委托信息 → 调度主管派车 → 运营经理办结（全链路贯通测试 |
| YT20240601002 | 复核中 | **正常流转-复核中** | 已上传运输委托单，调度主管直接核验后提交运营经理 |
| YT20240601003 | 待补正（已逾期） | **超时逾期** | 截止时间已过 1 天，缺少签收回单；含异常原因记录 |
| YT20240601004 | 待补正 | **缺材料/退回补正** | 运输委托单信息不完整，已记录材料问题和状态问题异常 |

---

## 六、异常入口与测试样例

系统在**材料、权限、时限、状态**四类异常，均会写入 `exception_reasons` 表并在详情页展示。

| 异常类型 | 触发方式 | 预期表现 |
|----------|----------|----------|
| **材料问题** | 提交时未上传对应证据（待补正需「运输委托单」，复核中办结需「车辆调度单+签收回单」双证据） | 返回「材料问题：缺少必要证据 XXX」，前端红框提示 |
| **权限问题** | 用错误角色操作（如运营经理修改待补正订单）；或非当前处理人越权办理 | 返回「权限问题：当前角色无权处理」，异常记录含节点超时责任人 |
| **时限问题** | 截止时间已过仍提交；批量推进逾期订单 | 返回「时限问题：订单已逾期」并在列表标红，写入异常原因 |
| **状态问题** | 已办结订单重复提交；`expected_version` 与当前 `version` 不匹配；非法 `action` | 返回「状态问题：版本冲突/已办结不可重复提交」，异常记录含 `node_handler` |

### 核心拦截规则
1. **办结前强制双证据**：复核中状态提交至办结时，必须同时有「车辆调度单」和「签收回单」两份证据
2. **批量处理逐条拦截**：批量推进时服务端逐条执行，每条独立返回成功/失败原因，失败项可直接跳转详情补正
3. **乐观锁防重**：每次提交需携带 `expected_version`，与数据库 `version` 比对，不一致则拦截
4. **处理人强校验**：仅当前处理人可操作，越权操作全部写入 `exception_reasons` 表，含 `node_handler` 字段追溯责任人

### 后端接口拦截场景（可直接 curl 测试）：

```bash
# 1. 登录（拿 token）
TOKEN=$(curl -s -X POST http://localhost:8003/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"kefu","password":"123456"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. 越权（用 kefu token 尝试操作 YT20240601002，该单处理人是李调度）
curl -X POST http://localhost:8003/api/orders/2/action \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"action":"通过","expected_version":1}'

# 3. 缺证据（待补正状态提交，缺少运输委托单）
curl -X POST http://localhost:8003/api/orders/1/action \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"action":"通过"}'

# 4. 版本冲突（故意用旧版本号）
curl -X POST http://localhost:8003/api/orders/1/action \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"action":"通过","expected_version":999}'
```

---

## 七、前端页面

1. **登录页**：三角色一键登录，登录后状态贯穿所有页面
2. **订单列表**（运输订单登记 / 过程核验 / 复核归档 三个入口）：
   - 筛选：责任人、优先级、截止时间、状态
   - 当前处理人识别：「我是处理人」的订单行绿色高亮，处理人列显示「（我）」标签
   - 操作权限：非处理人仅可查看，禁用勾选和办理按钮
   - 批量处理：仅可勾选自己是处理人的订单，执行后逐条返回成功/失败原因，失败项可跳转详情补正
3. **订单详情**：
   - 运输委托、车辆调度、签收回单**分区展示**，按角色+当前处理人自动切换「可编辑 / 可核验 / 只读」
   - 证据必填校验：提交前前端检查缺失证据，红框提示
   - 退回补正必须填写原因，否则拦截
   - 证据附件、处理记录时间线、异常原因卡片（按材料/权限/时限/状态分类展示）
   - 操作按钮：保存修改、仅核验、退回补正、提交下一环节（按权限动态显隐）
4. **到期预警**：
   - 正常 / 临期（3 天内）/ 逾期 三组统计卡片
   - 当前处理人识别：仅可勾选自己是处理人的未办结订单
   - 批量推进逐条拦截，结果表格展示，失败项可直接「去补正」跳转详情

---

## 八、数据库表结构

SQLite 文件：`backend/freight_orders.db`

| 表名 | 说明 |
|------|------|
| `users` | 用户（演示账号） |
| `transport_orders` | 运输订单主表（含版本号 version、当前处理人、状态、逾期标记、版本乐观锁） |
| `attachments` | 证据附件（运输委托单/车辆调度单/签收回单/其他四类） |
| `processing_records` | 处理记录（动作、操作人、前后状态、证据摘要、时间线） |
| `audit_notes` | 审计备注 |
| `exception_reasons` | 异常原因（材料/权限/时限/状态四类，含 node_handler 字段追溯节点责任人，是否已处理标记） |

刷新页面后，列表、详情、统计、操作记录均从 SQLite 实时读取。

---

## 九、关键文件索引

### 后端
- [main.py](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/backend/main.py) — Litestar 入口，CORS 配置
- [config.py](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/backend/config.py) — 端口 8003 / 3003 统一配置
- [models.py](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/backend/models.py) — SQLAlchemy 数据模型
- [schemas.py](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/backend/models.py) — Pydantic 入参出参
- [services.py](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/backend/services.py) — 订单业务逻辑（状态流转、权限校验、证据校验、版本乐观锁、批量处理）
- [routes.py](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/backend/routes.py) — HTTP API 路由
- [auth.py](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/backend/auth.py) — JWT 签发与密码哈希
- [dependencies.py](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/backend/dependencies.py) — 认证依赖与角色守卫
- [init_db.py](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/backend/init_db.py) — 建表 + 演示账号 + 四类演示单据

### 前端
- [vite.config.ts](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/frontend/vite.config.ts) — Vite 端口 3003 及 `/api` 代理
- [app.component.ts](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/frontend/src/app/app.component.ts) — 根组件、导航、角色切换
- [app.routes.ts](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/frontend/src/app/app.routes.ts) — 路由配置
- [services/auth.service.ts](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/frontend/src/app/services/auth.service.ts) — 登录状态管理
- [services/order.service.ts](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/frontend/src/app/services/order.service.ts) — 订单 API 封装
- [pages/login/login.component.ts](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/frontend/src/app/pages/login/login.component.ts) — 登录页（三角色快速登录）
- [pages/order-list/order-list.component.ts](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/frontend/src/app/pages/order-list/order-list.component.ts) — 订单列表 + 筛选 + 批量处理
- [pages/order-detail/order-detail.component.ts](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/frontend/src/app/pages/order-detail/order-detail.component.ts) — 订单详情（三分区可编辑/可核验/只读 + 异常弹窗）
- [pages/warnings/warnings.component.ts](file:///Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-3/frontend/src/app/pages/warnings/warnings.component.ts) — 到期预警（正常/临期/逾期分组 + 批量推进）
