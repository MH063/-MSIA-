#!/bin/bash
# ============================================
# MSIA 数据库初始化脚本
# 用于 Docker 环境中初始化数据库
# ============================================

set -e

echo "========================================"
echo "MSIA 数据库初始化"
echo "========================================"

# 检查环境变量
if [ -z "$DATABASE_URL" ]; then
  echo "错误: DATABASE_URL 环境变量未设置"
  exit 1
fi

# 等待数据库就绪
echo "[1/4] 等待 PostgreSQL 就绪..."
until pg_isready -h "${DB_HOST:-db}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" > /dev/null 2>&1; do
  echo "  等待数据库连接..."
  sleep 2
done
echo "  ✓ 数据库已就绪"

# 执行迁移
echo "[2/4] 执行数据库迁移..."
cd /app
npx prisma migrate deploy
echo "  ✓ 迁移完成"

# 生成 Prisma 客户端
echo "[3/4] 生成 Prisma 客户端..."
npx prisma generate
echo "  ✓ 客户端生成完成"

# 可选：导入种子数据
echo "[4/4] 检查知识库数据..."
if [ -f "./src/scripts/seed.ts" ]; then
  echo "  发现种子数据脚本，执行导入..."
  npx ts-node ./src/scripts/seed.ts || echo "  ! 种子数据导入失败（非致命错误）"
else
  echo "  - 跳过种子数据导入"
fi

echo ""
echo "========================================"
echo "数据库初始化完成"
echo "========================================"
