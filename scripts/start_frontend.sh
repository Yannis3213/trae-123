#!/bin/bash

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

cd "$FRONTEND_DIR"

echo "=========================================="
echo "法务服务中心 - 前端服务启动"
echo "端口: 3003"
echo "=========================================="
echo ""

if [ ! -d "node_modules" ]; then
    echo "首次启动，正在安装依赖..."
    npm install
fi

echo "启动前端开发服务器..."
npm run dev -- --port 3003
