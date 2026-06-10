#!/bin/bash

echo "=========================================="
echo " 月底集中处理开户申请系统 - 后端启动"
echo " 端口: 8002"
echo "=========================================="
echo ""

cd "$(dirname "$0")"

if [ ! -d "data" ] || [ ! -f "data/bank.db" ]; then
  echo "首次启动，正在初始化数据库..."
  python3 seed.py
  echo "数据库初始化完成！"
  echo ""
fi

echo "启动后端服务 (端口 8002)..."
echo "API 地址: http://localhost:8002"
echo "按 Ctrl+C 停止服务"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8002 --reload
