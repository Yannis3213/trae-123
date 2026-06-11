#!/bin/bash

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATABASE_DIR="$PROJECT_ROOT/database"
DATABASE_FILE="$DATABASE_DIR/legal_service.db"
SCHEMA_FILE="$DATABASE_DIR/schema.sql"
DATA_FILE="$DATABASE_DIR/init_data.sql"

echo "=========================================="
echo "法务服务中心 - 数据库初始化脚本"
echo "=========================================="
echo ""

mkdir -p "$DATABASE_DIR"

if [ -f "$DATABASE_FILE" ]; then
    read -p "数据库文件已存在，是否删除重建? (y/N): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        echo "删除旧数据库..."
        rm -f "$DATABASE_FILE"
    else
        echo "取消初始化。"
        exit 0
    fi
fi

echo ""
echo "创建数据库: $DATABASE_FILE"
sqlite3 "$DATABASE_FILE" < "$SCHEMA_FILE"
echo "✓ 数据库表结构创建完成"

echo ""
echo "导入初始化数据..."
sqlite3 "$DATABASE_FILE" < "$DATA_FILE"
echo "✓ 演示数据导入完成"

echo ""
echo "=========================================="
echo "数据库初始化完成！"
echo "数据库文件: $DATABASE_FILE"
echo ""
echo "演示账号 (密码均为 123456):"
echo "  registrar  - 法律咨询登记员 (张三)"
echo "  supervisor - 法律咨询审核主管 (李四)"
echo "  reviewer   - 法务服务中心复核负责人 (王五)"
echo "  director   - 律所主任 (赵六)"
echo "  assistant  - 案件助理 (孙七)"
echo "  lawyer     - 承办律师 (周八)"
echo ""
echo "四类演示单据:"
echo "  LC2026060001 - 正常流转（已完成归档）"
echo "  LC2026060002 - 缺材料（缺少身份证号和银行流水）"
echo "  LC2026060003 - 超时逾期（已超过截止日期）"
echo "  LC2026060004 - 退回补正（缺少股东身份证明）"
echo "=========================================="

echo ""
echo "数据库内容预览:"
sqlite3 "$DATABASE_FILE" ".headers on" ".mode column" "SELECT case_no, title, status, queue, priority FROM legal_cases ORDER BY id;"
