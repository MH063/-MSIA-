# MSIA Docker 部署指南

## 医学生智能问诊辅助系统 - Docker 部署文档

本文档提供使用 Docker 部署 MSIA 系统的完整指南。

## 一、环境要求

- **Docker Engine**: >= 20.10
- **Docker Compose**: >= 2.0
- **内存**: 至少 2GB 可用内存
- **磁盘**: 至少 10GB 可用磁盘空间

## 二、项目结构

```
医学生智能问诊辅助系统（MSIA）/
├── docker-compose.yml              # Docker 编排配置
├── docker-compose.override.yml     # 开发环境覆盖配置
├── .env.docker                     # 环境变量模板
├── .dockerignore                   # Docker 构建忽略文件
├── deploy.sh                       # 一键部署脚本
├── build-client.sh                 # 前端构建脚本
├── build-server.sh                 # 后端构建脚本
├── client/
│   ├── Dockerfile                  # 前端镜像构建
│   └── nginx.conf                  # Nginx 配置
├── server/
│   ├── Dockerfile                  # 后端镜像构建
│   └── docker-entrypoint.sh        # 容器入口脚本
└── deploy/
    └── docker-deploy.md            # Docker 部署快速参考
```

## 三、快速部署

### 1. 准备工作

```bash
# 克隆项目
git clone <repository-url>
cd 医学生智能问诊辅助系统（MSIA）

# 配置环境变量
cp .env.docker .env

# 编辑 .env 文件，修改以下关键配置：
# - DB_PASSWORD: 数据库密码（生产环境务必修改）
# - OPERATOR_TOKEN: API 认证令牌
# - ALLOWED_ORIGINS: 允许的跨域来源
```

### 2. 执行部署

**方式一：使用部署脚本（推荐）**

```bash
chmod +x deploy.sh
./deploy.sh
```

**方式二：手动部署**

```bash
# 1. 构建前端生产镜像
cd client
docker build --target production -t msia-client-prod:latest .
cd ..

# 2. 构建后端生产镜像
cd server
docker build --target production -t msia-server-prod:latest .
cd ..

# 3. 启动服务
docker-compose up -d

# 4. 执行数据库迁移
docker-compose exec server npx prisma migrate deploy
```

### 3. 访问应用

- **前端界面**: http://localhost
- **后端 API**: http://localhost:4000
- **健康检查**: http://localhost:4000/health

## 四、服务架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Network                          │
│                   (msia_network)                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐         ┌─────────────┐         ┌────────┐ │
│  │   Nginx     │────────▶│   Express   │────────▶│PostgreSQL│
│  │  (Client)   │  :80    │  (Server)   │  :4000  │  (DB)   │
│  │             │         │             │         │ :5432   │
│  └─────────────┘         └─────────────┘         └────────┘ │
│       │                         │                           │
│       ▼                         ▼                           │
│  静态文件服务              API 服务                      数据存储
│  React 应用               Node.js + Prisma               PostgreSQL
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 五、常用命令

### 服务管理

| 命令 | 说明 |
|------|------|
| `docker-compose up -d` | 启动所有服务 |
| `docker-compose down` | 停止所有服务 |
| `docker-compose restart` | 重启所有服务 |
| `docker-compose ps` | 查看服务状态 |
| `docker-compose logs -f` | 查看所有日志 |
| `docker-compose logs -f server` | 查看后端日志 |
| `docker-compose logs -f client` | 查看前端日志 |
| `docker-compose logs -f db` | 查看数据库日志 |

### 数据库操作

```bash
# 执行数据库迁移
docker-compose exec server npx prisma migrate deploy

# 导入知识库数据
docker-compose exec server npx prisma db seed

# 进入数据库容器
docker-compose exec db psql -U postgres -d MSIA

# 备份数据库
docker-compose exec db pg_dump -U postgres MSIA > backup.sql

# 恢复数据库
docker-compose exec -T db psql -U postgres -d MSIA < backup.sql
```

## 六、环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `DB_USER` | postgres | 数据库用户名 |
| `DB_PASSWORD` | postgres | 数据库密码（**务必修改**） |
| `DB_NAME` | MSIA | 数据库名称 |
| `DB_PORT` | 5432 | 数据库端口 |
| `SERVER_PORT` | 4000 | 后端服务端口 |
| `CLIENT_PORT` | 80 | 前端服务端口 |
| `ALLOWED_ORIGINS` | http://localhost | 允许的跨域来源 |
| `OPERATOR_TOKEN` | dev-admin | API 认证令牌（**务必修改**） |

## 七、生产环境部署

### 1. 安全加固

```bash
# 1. 修改默认密码
# 编辑 .env 文件
DB_PASSWORD=your_strong_password_here
OPERATOR_TOKEN=your_secure_random_token

# 2. 使用 HTTPS
# 配置反向代理（Nginx/Traefik）处理 SSL

# 3. 限制端口暴露
# 数据库端口默认只暴露给容器网络，不要映射到主机
```

### 2. 数据持久化

数据通过 Docker Volumes 持久化：
- `postgres_data`: 数据库数据
- `uploads_data`: 上传文件

```bash
# 查看数据卷
docker volume ls

# 备份数据卷
docker run --rm -v msia_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz -C /data .
```

### 3. 监控与日志

```bash
# 查看资源使用
docker stats

# 查看日志
docker-compose logs -f --tail=100

# 设置日志轮转
# 在 docker-compose.yml 中添加:
# logging:
#   driver: "json-file"
#   options:
#     max-size: "10m"
#     max-file: "3"
```

## 八、故障排查

### 问题1：数据库连接失败

```bash
# 检查数据库状态
docker-compose exec db pg_isready -U postgres

# 查看数据库日志
docker-compose logs db

# 重置数据库（会丢失数据）
docker-compose down -v
docker-compose up -d
```

### 问题2：服务启动失败

```bash
# 查看详细日志
docker-compose logs --tail=100 server

# 检查端口占用
netstat -tlnp | grep -E ':(80|4000|5432)'

# 重建镜像
docker-compose build --no-cache
```

### 问题3：前端显示"服务不可用"

```bash
# 检查前端容器状态
docker-compose ps client

# 查看前端日志
docker-compose logs client

# 检查是否正确使用生产镜像
docker exec msia_client which nginx
# 应该输出 /usr/sbin/nginx，如果不是，说明使用了开发镜像
```

## 九、更新部署

```bash
# 拉取最新代码后
git pull

# 重新构建并部署
./deploy.sh

# 或者手动执行
# 1. 停止服务
docker-compose down

# 2. 重建镜像
docker-compose build --no-cache

# 3. 启动服务
docker-compose up -d

# 4. 执行迁移（如有需要）
docker-compose exec server npx prisma migrate deploy
```

## 十、卸载清理

```bash
# 停止并删除容器
docker-compose down

# 完全清理（包括数据卷）
docker-compose down -v

# 删除镜像
docker rmi msia-client-prod:latest msia-server-prod:latest

# 清理系统
docker system prune -f
```

## 十一、相关文档

- [项目术语表](./docs/TERMINOLOGY.md) - 统一术语和命名规范
- [生产部署指南](./deploy/README.md) - 手动部署到生产服务器
- [项目主文档](./README.md) - 项目介绍和快速开始

---

**注意**：首次部署前请务必修改 `.env` 文件中的默认密码和令牌！
