#!/bin/bash

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

cd "$BACKEND_DIR"

echo "=========================================="
echo "法务服务中心 - 后端服务启动"
echo "端口: 8003"
echo "=========================================="
echo ""

export ROCKET_PORT=8003
export JWT_SECRET="legal-service-jwt-secret-key-2024"

if [ ! -d "target" ]; then
    echo "首次启动，正在编译..."
    cargo build --release
fi

echo "启动后端服务..."
cargo run --release
