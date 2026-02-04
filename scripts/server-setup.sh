#!/bin/bash
# 服务器初始化脚本
# 修复Docker权限并准备部署环境

echo "=== MSIA服务器初始化 ==="

# 检查是否在docker组
if groups | grep -q '\bdocker\b'; then
    echo "✅ 用户已在docker组"
else
    echo "⚠️ 用户不在docker组，需要sudo权限添加..."
    echo "请手动执行: sudo usermod -aG docker \$USER"
    echo "然后重新登录或执行: newgrp docker"
fi

# 检查Docker状态
echo ""
echo "=== Docker状态 ==="
if command -v docker &> /dev/null; then
    echo "✅ Docker已安装: $(docker --version)"
else
    echo "❌ Docker未安装"
    exit 1
fi

# 检查Docker Compose
echo ""
echo "=== Docker Compose状态 ==="
if command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose已安装: $(docker-compose --version)"
elif docker compose version &> /dev/null; then
    echo "✅ Docker Compose插件已安装: $(docker compose version)"
else
    echo "⚠️ Docker Compose未安装"
fi

# 创建部署目录
echo ""
echo "=== 创建部署目录 ==="
DEPLOY_DIR="$HOME/msia-deploy"
mkdir -p "$DEPLOY_DIR"
echo "✅ 部署目录: $DEPLOY_DIR"

# 显示系统资源
echo ""
echo "=== 系统资源 ==="
echo "磁盘空间:"
df -h | grep -E '(Filesystem|/dev/vda|/dev/sda)'
echo ""
echo "内存:"
free -h

echo ""
echo "=== 初始化完成 ==="
echo "部署目录: $DEPLOY_DIR"
