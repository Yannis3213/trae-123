#!/bin/bash

echo "=========================================="
echo " 月底集中处理开户申请系统 - 前端启动"
echo " 端口: 3002"
echo "=========================================="
echo ""

cd "$(dirname "$0")"

echo "启动前端开发服务器 (端口 3002)..."
echo "访问地址: http://localhost:3002"
echo "按 Ctrl+C 停止服务"
echo ""

npm run dev
