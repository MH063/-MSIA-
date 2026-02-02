#!/bin/bash
# ============================================
# MSIA Docker 部署脚本
# 一键部署医学生智能问诊辅助系统
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 是否安装
check_docker() {
  print_info "检查 Docker 环境..."
  if ! command -v docker &> /dev/null; then
    print_error "Docker 未安装，请先安装 Docker"
    exit 1
  fi
  if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
  fi
  print_info "Docker 环境检查通过"
}

# 检查环境变量
check_env() {
  print_info "检查环境变量配置..."
  if [ ! -f ".env" ]; then
    if [ -f ".env.docker" ]; then
      print_warn ".env 文件不存在，从 .env.docker 复制..."
      cp .env.docker .env
      print_warn "请编辑 .env 文件修改默认配置后再运行"
      exit 1
    else
      print_error "环境变量文件不存在"
      exit 1
    fi
  fi
  print_info "环境变量配置检查通过"
}

# 显示菜单
show_menu() {
  echo ""
  echo "========================================"
  echo "  MSIA Docker 部署工具"
  echo "  医学生智能问诊辅助系统"
  echo "========================================"
  echo ""
  echo "  1) 首次部署（构建并启动）"
  echo "  2) 启动服务"
  echo "  3) 停止服务"
  echo "  4) 重启服务"
  echo "  5) 查看状态"
  echo "  6) 查看日志"
  echo "  7) 更新部署"
  echo "  8) 完全重置（删除所有数据）"
  echo "  9) 备份数据库"
  echo "  0) 退出"
  echo ""
  echo "========================================"
}

# 首次部署
deploy_first() {
  print_info "开始首次部署..."
  docker-compose down -v 2>/dev/null || true
  docker-compose build --no-cache
  docker-compose up -d
  print_info "等待服务启动..."
  sleep 10
  print_info "执行数据库初始化..."
  docker-compose exec -T server sh -c 'npx prisma migrate deploy' || print_warn "数据库初始化可能需要手动执行"
  print_info "部署完成！"
  print_info "前端访问: http://localhost"
  print_info "API 访问: http://localhost:4000"
}

# 启动服务
start_services() {
  print_info "启动服务..."
  docker-compose up -d
  print_info "服务已启动"
}

# 停止服务
stop_services() {
  print_info "停止服务..."
  docker-compose down
  print_info "服务已停止"
}

# 重启服务
restart_services() {
  print_info "重启服务..."
  docker-compose restart
  print_info "服务已重启"
}

# 查看状态
show_status() {
  echo ""
  docker-compose ps
  echo ""
}

# 查看日志
show_logs() {
  echo ""
  echo "选择服务查看日志:"
  echo "  1) 全部服务"
  echo "  2) 后端服务 (server)"
  echo "  3) 前端服务 (client)"
  echo "  4) 数据库 (db)"
  echo ""
  read -p "请选择 [1-4]: " choice
  case $choice in
    1) docker-compose logs -f ;;
    2) docker-compose logs -f server ;;
    3) docker-compose logs -f client ;;
    4) docker-compose logs -f db ;;
    *) print_error "无效选择" ;;
  esac
}

# 更新部署
update_deploy() {
  print_info "更新部署..."
  docker-compose pull
  docker-compose build --no-cache
  docker-compose up -d
  print_info "更新完成"
}

# 完全重置
reset_all() {
  echo ""
  print_warn "警告: 这将删除所有数据，包括数据库！"
  read -p "确定要继续吗？(yes/no): " confirm
  if [ "$confirm" = "yes" ]; then
    print_info "执行完全重置..."
    docker-compose down -v
    docker system prune -f
    print_info "重置完成"
  else
    print_info "已取消"
  fi
}

# 备份数据库
backup_db() {
  print_info "备份数据库..."
  mkdir -p backups
  docker-compose exec -T db pg_dump -U postgres MSIA > "backups/msia_backup_$(date +%Y%m%d_%H%M%S).sql"
  print_info "备份完成"
}

# 主函数
main() {
  check_docker
  check_env

  while true; do
    show_menu
    read -p "请选择操作 [0-9]: " choice
    case $choice in
      1) deploy_first ;;
      2) start_services ;;
      3) stop_services ;;
      4) restart_services ;;
      5) show_status ;;
      6) show_logs ;;
      7) update_deploy ;;
      8) reset_all ;;
      9) backup_db ;;
      0) print_info "退出"; exit 0 ;;
      *) print_error "无效选择，请重试" ;;
    esac
    echo ""
    read -p "按回车键继续..."
  done
}

# 如果直接传参，执行对应功能
if [ $# -gt 0 ]; then
  case $1 in
    first) deploy_first ;;
    start) start_services ;;
    stop) stop_services ;;
    restart) restart_services ;;
    status) show_status ;;
    logs) docker-compose logs -f ;;
    update) update_deploy ;;
    reset) reset_all ;;
    backup) backup_db ;;
    *) echo "用法: $0 {first|start|stop|restart|status|logs|update|reset|backup}" ;;
  esac
else
  main
fi
