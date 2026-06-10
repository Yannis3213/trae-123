#!/bin/bash

echo "=========================================="
echo " 月底集中处理开户申请系统 - 一键启动"
echo " 前端: 3002  后端: 8002"
echo "=========================================="
echo ""

cd "$(dirname "$0")"

trap "kill 0" EXIT

echo "→ 启动后端..."
cd backend
if [ ! -d "data" ] || [ ! -f "data/bank.db" ]; then
  echo "  首次启动，初始化数据库..."
  python3 seed.py
fi
uvicorn main:app --host 0.0.0.0 --port 8002 --reload &
BACKEND_PID=$!

cd ../frontend

echo "→ 启动前端..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=========================================="
echo "  系统已启动！"
echo "  前端: http://localhost:3002"
echo "  后端: http://localhost:8002"
echo "  按 Ctrl+C 停止所有服务"
echo "=========================================="
echo ""

wait
