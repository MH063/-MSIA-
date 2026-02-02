#!/bin/bash
# ============================================
# MSIA 数据库备份脚本
# ============================================

set -e

# 配置
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_NAME="${DB_NAME:-MSIA}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 生成备份文件名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/msia_backup_$TIMESTAMP.sql"

echo "========================================"
echo "MSIA 数据库备份"
echo "========================================"
echo "备份时间: $(date)"
echo "备份文件: $BACKUP_FILE"
echo ""

# 执行备份
echo "[1/3] 执行数据库备份..."
if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"; then
  echo "  ✓ 备份成功"
else
  echo "  ✗ 备份失败"
  exit 1
fi

# 压缩备份
echo "[2/3] 压缩备份文件..."
gzip "$BACKUP_FILE"
echo "  ✓ 压缩完成: ${BACKUP_FILE}.gz"

# 清理旧备份
echo "[3/3] 清理过期备份（${RETENTION_DAYS}天前）..."
find "$BACKUP_DIR" -name "msia_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "  ✓ 清理完成"

echo ""
echo "========================================"
echo "备份完成"
echo "文件大小: $(du -h ${BACKUP_FILE}.gz | cut -f1)"
echo "========================================"
