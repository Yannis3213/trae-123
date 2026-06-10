#!/bin/bash

# 前端启动脚本 - 生鲜采购单管理系统
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/frontend"

export FRONTEND_PORT="${FRONTEND_PORT:-8002}"
export BACKEND_PORT="${BACKEND_PORT:-8001}"

echo "========================================"
echo "  生鲜采购单管理系统 - 前端启动"
echo "========================================"
echo "  前端端口: $FRONTEND_PORT"
echo "  后端端口: $BACKEND_PORT"
echo "========================================"

echo ""
echo "🍋 使用 Fresh (Deno) 启动前端服务..."
echo "   若尚未安装 Deno: https://docs.deno.com/runtime/manual/getting_started/installation"
echo ""

deno task start
