#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== 农业合作社-种植任务系统 安装 ==="

echo ""
echo "[1/4] 安装后端依赖..."
cd "$PROJECT_ROOT/backend"
npm install

echo ""
echo "[2/4] 安装前端依赖..."
cd "$PROJECT_ROOT/frontend"
npm install

echo ""
echo "[3/4] 初始化 SQLite 数据库并导入演示数据..."
cd "$PROJECT_ROOT/backend"
npx ts-node src/seed.ts

echo ""
echo "[4/4] 安装完成!"
echo ""
echo "启动方式:"
echo "  后端: cd backend && npm run start:dev"
echo "  前端: cd frontend && npm run dev"
echo ""
echo "访问地址:"
echo "  前端: http://localhost:3001"
echo "  后端: http://localhost:8001/api"
