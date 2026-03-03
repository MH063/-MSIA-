#!/bin/bash
# ============================================
# MSIA 服务器优化配置脚本
# 医学生智能问诊辅助系统 - 2核2GB服务器优化
# ============================================

set -e

echo "============================================"
echo "MSIA 服务器优化配置脚本"
echo "============================================"

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo "请使用 sudo 运行此脚本"
    exit 1
fi

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# ============================================
# 1. 配置 Swap 分区
# ============================================
configure_swap() {
    echo ""
    echo ">>> 配置 Swap 分区..."
    
    SWAP_FILE="/swapfile"
    SWAP_SIZE="2G"
    
    if [ -f "$SWAP_FILE" ]; then
        print_warning "Swap 文件已存在，跳过创建"
    else
        print_status "创建 Swap 文件 ($SWAP_SIZE)..."
        fallocate -l $SWAP_SIZE $SWAP_FILE || dd if=/dev/zero of=$SWAP_FILE bs=1M count=2048 status=progress
        
        print_status "设置 Swap 文件权限..."
        chmod 600 $SWAP_FILE
        
        print_status "格式化 Swap 文件..."
        mkswap $SWAP_FILE
        
        print_status "启用 Swap..."
        swapon $SWAP_FILE
        
        print_status "添加到 fstab..."
        if ! grep -q "$SWAP_FILE" /etc/fstab; then
            echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
        fi
    fi
    
    print_status "Swap 配置完成"
    free -h
}

# ============================================
# 2. 配置系统内核参数
# ============================================
configure_kernel() {
    echo ""
    echo ">>> 配置系统内核参数..."
    
    SYSCTL_CONF="/etc/sysctl.d/99-msia.conf"
    
    cat > $SYSCTL_CONF << 'EOF'
# MSIA 系统优化配置

# 内存管理
vm.swappiness=10
vm.dirty_ratio=15
vm.dirty_background_ratio=5
vm.overcommit_memory=1
vm.max_map_count=262144

# 网络优化
net.core.somaxconn=65535
net.core.netdev_max_backlog=65535
net.ipv4.tcp_max_syn_backlog=65535
net.ipv4.tcp_tw_reuse=1
net.ipv4.tcp_fin_timeout=30
net.ipv4.tcp_keepalive_time=1200
net.ipv4.tcp_keepalive_intvl=30
net.ipv4.tcp_keepalive_probes=3
net.ipv4.ip_local_port_range=1024 65535

# 文件描述符
fs.file-max=65535
fs.nr_open=65535

# 连接跟踪
net.netfilter.nf_conntrack_max=65536
EOF

    print_status "应用内核参数..."
    sysctl -p $SYSCTL_CONF
    
    print_status "内核参数配置完成"
}

# ============================================
# 3. 配置文件描述符限制
# ============================================
configure_limits() {
    echo ""
    echo ">>> 配置文件描述符限制..."
    
    LIMITS_CONF="/etc/security/limits.d/99-msia.conf"
    
    cat > $LIMITS_CONF << 'EOF'
# MSIA 文件描述符限制
* soft nofile 65535
* hard nofile 65535
* soft nproc 65535
* hard nproc 65535
root soft nofile 65535
root hard nofile 65535
root soft nproc 65535
root hard nproc 65535
EOF

    print_status "文件描述符限制配置完成"
}

# ============================================
# 4. 配置 Docker
# ============================================
configure_docker() {
    echo ""
    echo ">>> 配置 Docker..."
    
    DAEMON_JSON="/etc/docker/daemon.json"
    
    if [ ! -f "$DAEMON_JSON" ]; then
        cat > $DAEMON_JSON << 'EOF'
{
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    },
    "storage-driver": "overlay2",
    "live-restore": true,
    "default-ulimits": {
        "nofile": {
            "Name": "nofile",
            "Hard": 65535,
            "Soft": 65535
        }
    }
}
EOF
        print_status "Docker 配置已创建"
    else
        print_warning "Docker 配置已存在，跳过"
    fi
    
    print_status "重启 Docker 服务..."
    systemctl restart docker
    
    print_status "Docker 配置完成"
}

# ============================================
# 5. 清理系统
# ============================================
cleanup_system() {
    echo ""
    echo ">>> 清理系统..."
    
    print_status "清理 apt 缓存..."
    apt-get clean
    
    print_status "清理 Docker 未使用资源..."
    docker system prune -f
    
    print_status "系统清理完成"
}

# ============================================
# 6. 显示系统状态
# ============================================
show_status() {
    echo ""
    echo "============================================"
    echo "系统状态"
    echo "============================================"
    
    echo ""
    echo ">>> 内存状态:"
    free -h
    
    echo ""
    echo ">>> Swap 状态:"
    swapon --show
    
    echo ""
    echo ">>> 磁盘状态:"
    df -h /
    
    echo ""
    echo ">>> Docker 容器状态:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    echo ">>> 系统负载:"
    uptime
}

# ============================================
# 主函数
# ============================================
main() {
    echo ""
    echo "开始优化服务器配置..."
    
    configure_swap
    configure_kernel
    configure_limits
    configure_docker
    cleanup_system
    show_status
    
    echo ""
    echo "============================================"
    echo -e "${GREEN}服务器优化配置完成！${NC}"
    echo "============================================"
}

# 运行主函数
main
