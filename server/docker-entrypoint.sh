#!/bin/sh
# ============================================
# MSIA Docker 入口脚本
# 用于容器启动时执行初始化操作
# ============================================

set -e

echo "[Docker Entrypoint] 启动 MSIA 服务端..."

# 等待数据库就绪
echo "[Docker Entrypoint] 等待数据库连接..."
until nc -z -v -w30 db 5432 2>/dev/null; do
  echo "[Docker Entrypoint] 等待数据库服务就绪..."
  sleep 2
done
echo "[Docker Entrypoint] 数据库已就绪"

# 执行数据库迁移（仅在生产环境）
if [ "$NODE_ENV" = "production" ]; then
  echo "[Docker Entrypoint] 执行数据库迁移..."
  npx prisma migrate deploy
fi

# 启动应用
echo "[Docker Entrypoint] 启动应用服务..."
exec "$@"
