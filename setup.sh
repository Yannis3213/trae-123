#!/bin/bash
set -e

echo "=== 安装后端依赖 ==="
cd "$(dirname "$0")/backend"
npm install
echo "=== 后端依赖安装完成 ==="

echo "=== 安装前端依赖 ==="
cd "$(dirname "$0")/frontend"
npm install
echo "=== 前端依赖安装完成 ==="

echo ""
echo "=== 全部依赖安装完成 ==="
echo "请分别在两个终端窗口启动服务："
echo "  后端: cd backend && npm run dev"
echo "  前端: cd frontend && npm run dev"
echo ""
echo "后端 API: http://localhost:8004"
echo "前端页面: http://localhost:3004"
