# ============================================
# MSIA Docker 部署 Makefile
# 医学生智能问诊辅助系统
# ============================================

.PHONY: help build up down restart logs status clean deploy backup

# 默认目标
help:
	@echo "========================================"
	@echo "  MSIA Docker 部署工具"
	@echo "  医学生智能问诊辅助系统"
	@echo "========================================"
	@echo ""
	@echo "可用命令:"
	@echo "  make build     - 构建 Docker 镜像"
	@echo "  make up        - 启动所有服务"
	@echo "  make down      - 停止所有服务"
	@echo "  make restart   - 重启所有服务"
	@echo "  make logs      - 查看日志"
	@echo "  make status    - 查看服务状态"
	@echo "  make deploy    - 完整部署（构建+启动+初始化）"
	@echo "  make backup    - 备份数据库"
	@echo "  make clean     - 清理容器和卷（慎用）"
	@echo "  make update    - 更新部署"
	@echo ""

# 构建镜像
build:
	docker-compose build --no-cache

# 启动服务
up:
	docker-compose up -d

# 停止服务
down:
	docker-compose down

# 重启服务
restart:
	docker-compose restart

# 查看日志
logs:
	docker-compose logs -f

# 查看状态
status:
	docker-compose ps

# 完整部署
deploy:
	@echo "开始部署 MSIA..."
	docker-compose down -v 2>/dev/null || true
	docker-compose build --no-cache
	docker-compose up -d
	@echo "等待服务启动..."
	@sleep 10
	@echo "执行数据库迁移..."
	docker-compose exec -T server sh -c 'npx prisma migrate deploy' || echo "迁移可能需要手动执行"
	@echo "部署完成!"
	@echo "前端: http://localhost"
	@echo "API: http://localhost:4000"

# 更新部署
update:
	docker-compose pull
	docker-compose build --no-cache
	docker-compose up -d

# 备份数据库
backup:
	@mkdir -p backups
	@docker-compose exec -T db pg_dump -U postgres MSIA > backups/msia_backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "备份完成"

# 清理（慎用）
clean:
	@echo "警告: 这将删除所有容器和数据卷!"
	@read -p "确定要继续吗? (yes/no): " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		docker-compose down -v; \
		docker system prune -f; \
		echo "清理完成"; \
	else \
		echo "已取消"; \
	fi

# 开发模式
dev:
	docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d

# 查看后端日志
logs-server:
	docker-compose logs -f server

# 查看前端日志
logs-client:
	docker-compose logs -f client

# 查看数据库日志
logs-db:
	docker-compose logs -f db

# 进入后端容器
shell-server:
	docker-compose exec server sh

# 进入数据库
shell-db:
	docker-compose exec db psql -U postgres -d MSIA
