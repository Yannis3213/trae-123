# 产业园物业-月底集中处理企业报修单系统

## 技术栈
- 前端: Next.js 14 App Router + TypeScript + Tailwind CSS + Zustand (端口 31010)
- 后端: Python Starlette + Uvicorn (端口 8101)
- 数据库: SQLite

## 启动命令

```bash
# 启动后端
cd backend
pip3 install -r requirements.txt
python3 run.py

# 启动前端 (新终端)
cd frontend
npm install
npm run dev
```

## 端口说明
- 前端: http://localhost:31010
- 后端: http://localhost:8101
- CORS 白名单: http://localhost:31010

> 注: 用户指定后端端口 81010，但 TCP 端口上限为 65535，因此使用 8101 替代。

## 功能模块
1. **报修单登记**: 企业客服创建和提交报修单
2. **过程核验**: 工程主管处理、核验报修单
3. **复核归档**: 园区经理复核、归档报修单
4. **报修单台账**: 全量报修单列表，按诉求筛选
5. **到期预警**: 正常/临期/逾期分组
6. **批量处理**: 批量推进/退回，逐条返回结果

## 角色权限
| 角色 | 权限 |
|------|------|
| 企业客服 | 登记、提交、重新提交 |
| 工程主管 | 受理处理、核验、退回 |
| 园区经理 | 复核、归档、退回 |

## 状态流转
待提交 → 待受理 → 处理中 → 待复核 → 待归档 → 已归档
任意环节可退回 → 已退回 → 重新提交 → 待受理
