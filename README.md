# 中医馆 - 月底集中处理处方流转单系统

## 技术栈

- **前端**: [Fresh](https://fresh.deno.dev/) (Deno + Preact)
  - 端口: **3003**
  - 地址: http://localhost:3003
- **后端**: Go + [Chi](https://github.com/go-chi/chi) + SQLite
  - 端口: **8003**
  - 地址: http://localhost:8003/api
  - SQLite 本地文件: `backend/data/prescription_flow.db`

> 前端请求地址、后端监听端口、CORS 白名单均已统一配置为上述端口。

---

## 快速启动

### 前置要求

- [Go](https://go.dev/) 1.21+
- [Deno](https://deno.land/) 1.40+

### 1. 启动后端

```bash
cd backend
go mod tidy
go run ./cmd/server
```

后端启动后监听 `http://localhost:8003`，自动初始化 SQLite 数据库并预置测试数据。

### 2. 启动前端（新开一个终端）

```bash
cd frontend
deno task start
```

前端启动后访问 http://localhost:3003

---

## 预置测试账号

| 用户名 | 姓名 | 角色 | 说明 |
|---|---|---|---|
| `registrar01` | 张登记 | 处方流转登记员 | 发起/补正处方流转单 |
| `supervisor01` | 李审核 | 处方流转审核主管 | 审核处方流转单 |
| `archivist01` | 王复核 | 中医馆复核负责人 | 复核归档 |
| `assistant01` | 赵助理 | 接诊助理 | 补齐材料 |
| `physician01` | 钱医师 | 坐诊医师 | 办理处方 |
| `pharmacist01` | 孙药房 | 药房管理员 | 收口归档 |

可在页面顶部的「当前角色」下拉框中切换身份进行测试。

---

## 核心业务规则

### 状态流转

```
draft(草稿) / returned(已退回) / abnormal(异常)
        ↓  登记员/助理 提交或补正
to_confirm(待确认)
        ↓  审核主管/医师 审批
processing(办理中)
        ↓  医师 办理完成
recheck(待复查)
        ↓  复核负责人/药房 归档
archived(已归档)
```

### 关键规则

1. **资料不齐停留原队列**：处方开具、煎药配送信息不齐全时，处方流转单停留在异常队列（`abnormal`），需要接诊助理或登记员补正。
2. **列表分组统计**：首页按「待确认」「异常」「已复查」三组分开展示。
3. **到期预警三队列**：到期预警分为「正常」「临期」「逾期」三色显示，不混在一起。
4. **越权/状态/版本校验**：后端强制校验当前角色、当前处理人、状态、版本号、必填证据，不仅仅靠隐藏按钮。
5. **批量处理逐条反馈**：批量操作结果逐条显示成功/失败及原因。
6. **审计轨迹**：详情页显示完整的处理记录时间线、异常/补正记录。
7. **SQLite 持久化**：所有处方流转单、附件、处理记录、审计备注、异常原因均持久化到本地 SQLite，刷新页面后列表、详情、统计、操作记录保持一致。

---

## 主要接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/users` | 获取用户列表 |
| GET | `/api/statistics` | 统计数据 |
| GET | `/api/flows` | 处方流转单列表（支持 status/urgency/role/operator 查询参数） |
| POST | `/api/flows` | 登记处方流转单 |
| GET | `/api/flows/{id}` | 处方流转单详情（含处理记录、异常原因） |
| POST | `/api/flows/{id}/process` | 处理处方流转单 |
| POST | `/api/flows/batch` | 批量处理 |
| GET | `/api/flows/{id}/records` | 处理记录 |
| GET | `/api/flows/{id}/abnormal` | 异常/补正记录 |

### 接口请求头

- `X-User`: 用户名（如 `registrar01`）
- `X-Role`: 角色（如 `registrar`）
- `X-Name`: 姓名（可选）

### 处理请求体示例 (POST /api/flows/{id}/process)

```json
{
  "action": "approve",
  "operator": "supervisor01",
  "operator_role": "review_supervisor",
  "remark": "材料齐全，审批通过",
  "evidence": "APPROVAL-20260601-001",
  "version": 1
}
```

`action` 可选值：`submit` / `resubmit` / `approve` / `process` / `return` / `correct` / `supplement` / `archive`

### 接口校验项

- ✅ 当前角色是否有权处理该状态
- ✅ 当前用户是否为该单据处理人
- ✅ 版本号是否匹配（防重复提交、防旧版本提交）
- ✅ 证据材料是否必填
- ✅ 退回操作是否填写退回原因
- ✅ 资料是否齐全（提交/补正场景）
- ✅ 是否超期未处理
