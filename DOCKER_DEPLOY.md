# MSIA Docker 部署完整指南

## 医学生智能问诊辅助系统 - Docker 部署文档

### 一、项目概述

本项目是医学生智能问诊辅助系统（MSIA），包含以下组件：
- **前端（Client）**：React + Vite + TypeScript
- **后端（Server）**：Node.js + Express + Prisma + PostgreSQL
- **数据库（DB）**：PostgreSQL 16

### 二、Docker 文件结构

```
医学生智能问诊辅助系统（MSIA）/
├── docker-compose.yml              # 主编排文件
├── docker-compose.override.yml     # 开发环境覆盖配置
├── .env.docker                     # Docker 环境变量模板
├── .dockerignore                   # Docker 构建忽略文件
├── Makefile                        # 快捷命令
├── DOCKER_DEPLOY.md               # 本文件
├── client/
│   ├── Dockerfile                  # 前端镜像构建
│   └── nginx.conf                  # Nginx 容器配置
├── server/
│   ├── Dockerfile                  # 后端镜像构建
│   ├── docker-entrypoint.sh        # 容器入口脚本
│   └── .env.docker                 # 后端环境变量
├── scripts/
│   ├── deploy.sh                   # 部署脚本
│   ├── init-db.sh                  # 数据库初始化
│   └── backup.sh                   # 数据库备份
└── deploy/
    └── docker-deploy.md            # 详细部署说明
```

### 三、快速部署步骤

#### 1. 环境准备

确保已安装：
- Docker Engine >= 20.10
- Docker Compose >= 2.0

#### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.docker .env

# 编辑 .env 文件，修改以下关键配置：
# - DB_PASSWORD: 数据库密码（生产环境务必修改）
# - OPERATOR_TOKEN: API 认证令牌
# - ALLOWED_ORIGINS: 允许的跨域来源
```

#### 3. 启动服务

**方式一：使用 Make 命令（推荐）**

```bash
# 完整部署（构建+启动+初始化）
make deploy

# 或分步执行
make build    # 构建镜像
make up       # 启动服务
```

**方式二：使用脚本**

```bash
# 给脚本执行权限
chmod +x scripts/deploy.sh

# 运行部署脚本
./scripts/deploy.sh
```

**方式三：使用 Docker Compose 命令**

```bash
# 构建并启动
docker-compose up -d --build

# 执行数据库迁移
docker-compose exec server npx prisma migrate deploy
```

#### 4. 访问应用

- **前端界面**：http://localhost
- **后端 API**：http://localhost:4000
- **健康检查**：http://localhost:4000/health

### 四、常用命令

#### 服务管理

```bash
# 查看所有命令
make help

# 启动服务
make up
# 或: docker-compose up -d

# 停止服务
make down
# 或: docker-compose down

# 重启服务
make restart

# 查看状态
make status
# 或: docker-compose ps
```

#### 日志查看

```bash
# 查看所有日志
make logs

# 查看后端日志
make logs-server

# 查看前端日志
make logs-client

# 查看数据库日志
make logs-db
```

#### 数据库操作

```bash
# 备份数据库
make backup

# 进入数据库容器
make shell-db

# 手动执行迁移
docker-compose exec server npx prisma migrate deploy
```

### 五、服务架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Docker Network                        │
│                      (msia_network)                         │
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

### 六、环境变量说明

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| DB_USER | postgres | 数据库用户名 |
| DB_PASSWORD | msia_secure_password_2024 | 数据库密码（**务必修改**） |
| DB_NAME | MSIA | 数据库名称 |
| DB_PORT | 5432 | 数据库端口 |
| SERVER_PORT | 4000 | 后端服务端口 |
| CLIENT_PORT | 80 | 前端服务端口 |
| ALLOWED_ORIGINS | http://localhost | 允许的跨域来源 |
| OPERATOR_TOKEN | msia_docker_token... | API 认证令牌（**务必修改**） |

### 七、生产环境部署建议

#### 1. 安全加固

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

#### 2. 数据持久化

数据通过 Docker Volumes 持久化：
- `postgres_data`: 数据库数据
- `uploads_data`: 上传文件

```bash
# 查看数据卷
docker volume ls

# 备份数据卷
docker run --rm -v msia_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz -C /data .
```

#### 3. 监控与日志

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

### 八、故障排查

#### 问题1：数据库连接失败

```bash
# 检查数据库状态
docker-compose exec db pg_isready -U postgres

# 查看数据库日志
docker-compose logs db

# 重置数据库（会丢失数据）
docker-compose down -v
docker-compose up -d
```

#### 问题2：服务启动失败

```bash
# 查看详细日志
docker-compose logs --tail=100 server

# 检查端口占用
netstat -tlnp | grep -E ':(80|4000|5432)'

# 重建镜像
docker-compose build --no-cache
```

#### 问题3：迁移失败

```bash
# 手动执行迁移
docker-compose exec server npx prisma migrate deploy

# 重置迁移（开发环境）
docker-compose exec server npx prisma migrate reset
```

### 九、更新部署

```bash
# 拉取最新代码后

# 方式一：使用 Make
make update

# 方式二：手动
# 1. 拉取更新
git pull

# 2. 重建镜像
docker-compose build --no-cache

# 3. 重启服务
docker-compose up -d

# 4. 执行迁移（如有需要）
docker-compose exec server npx prisma migrate deploy
```

### 十、开发模式

```bash
# 使用开发配置启动（支持热重载）
make dev
# 或
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d

# 开发模式特点：
# - 后端支持代码热重载
# - 前端使用 Vite 开发服务器
# - 数据库显示所有查询日志
```

### 十一、卸载清理

```bash
# 停止并删除容器
make down

# 完全清理（包括数据卷）
make clean

# 或手动执行
docker-compose down -v
docker system prune -f
```

### 十二、联系与支持

如有问题，请查看：
- 详细部署文档：[deploy/docker-deploy.md](deploy/docker-deploy.md)
- 项目文档：[医学生智能问诊辅助系统 - 项目开发文档]

---

**注意**：首次部署前请务必修改 `.env` 文件中的默认密码和令牌！
