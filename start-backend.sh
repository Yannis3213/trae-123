#!/bin/bash

# 后端启动脚本 - 生鲜采购单管理系统
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/backend"

export FRONTEND_PORT="${FRONTEND_PORT:-8002}"
export BACKEND_PORT="${BACKEND_PORT:-8001}"

echo "========================================"
echo "  生鲜采购单管理系统 - 后端启动"
echo "========================================"
echo "  前端端口: $FRONTEND_PORT"
echo "  后端端口: $BACKEND_PORT"
echo "========================================"

if [ ! -d "venv" ]; then
  echo "[1/2] 创建 Python 虚拟环境..."
  python3 -m venv venv
fi

echo "[2/2] 激活环境并安装依赖..."
source venv/bin/activate
pip install -q -r requirements.txt

echo ""
echo "🚀 启动后端服务 (http://localhost:$BACKEND_PORT)..."
python -m backend.app.main
