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
# - JWT_SECRET: JWT 密钥（生产环境必须配置）
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

## 五、环境变量

### 必需变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://postgres:pass@db:5432/MSIA` |
| `JWT_SECRET` | JWT 密钥（生产环境必须） | 64 位随机字符串 |

### 安全相关变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DB_PASSWORD` | 数据库密码 | postgres |
| `ENABLE_DEV_TOKENS` | 开发测试 Token | false |
| `ALLOWED_ORIGINS` | CORS 白名单 | http://localhost |
| `ENCRYPTION_KEY` | 数据加密密钥（32 位） | - |

### 登录安全变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `LOGIN_MAX_FAILS_DOCTOR` | 医生登录失败锁定次数 | 5 |
| `LOGIN_MAX_FAILS_ADMIN` | 管理员登录失败锁定次数 | 3 |
| `LOGIN_LOCK_MS_DOCTOR` | 医生锁定时间（毫秒） | 300000 |
| `LOGIN_LOCK_MS_ADMIN` | 管理员锁定时间（毫秒） | 600000 |

## 六、常用命令

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

## 七、生产环境部署

### 1. 安全加固

```bash
# 1. 修改默认密码
# 编辑 .env 文件
DB_PASSWORD=your_strong_password_here
JWT_SECRET=your_64_char_random_secret_key_here

# 2. 禁用开发测试 Token
ENABLE_DEV_TOKENS=false

# 3. 配置 CORS 白名单
ALLOWED_ORIGINS=https://your-domain.com

# 4. 使用 HTTPS
# 配置反向代理（Nginx/Traefik）处理 SSL
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

### 问题4：认证失败

```bash
# 检查 JWT_SECRET 是否配置
docker-compose exec server env | grep JWT_SECRET

# 检查开发测试 Token 是否启用
docker-compose exec server env | grep ENABLE_DEV_TOKENS

# 生产环境确保 ENABLE_DEV_TOKENS 未设置或为 false
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

## 十一、安全最佳实践

### 认证安全

1. **生产环境必须配置 JWT_SECRET**
   - 使用 64 位以上随机字符串
   - 生成方式: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

2. **禁用开发测试 Token**
   - 生产环境不设置 `ENABLE_DEV_TOKENS` 或设置为 `false`

3. **使用强密码**
   - 数据库密码
   - JWT 密钥
   - 加密密钥

### 网络安全

1. **配置 CORS 白名单**
   - 仅允许可信域名
   - 生产环境使用 HTTPS 域名

2. **限制端口暴露**
   - 数据库端口默认只暴露给容器网络
   - 不要将 5432 端口映射到主机

3. **使用 HTTPS**
   - 配置 Nginx 反向代理
   - 申请 SSL 证书

### 数据安全

1. **定期备份**
   - 数据库每日备份
   - 配置文件备份

2. **监控日志**
   - 检查异常登录
   - 监控 API 调用

## 十二、相关文档

- [项目术语表](./docs/TERMINOLOGY.md) - 统一术语和命名规范
- [生产部署指南](./deploy/README.md) - 手动部署到生产服务器
- [项目主文档](./README.md) - 项目介绍和快速开始
- [后端开发文档](./server/README.md) - 后端 API 说明
- [前端开发文档](./client/README.md) - 前端开发说明

---

**注意**：首次部署前请务必修改 `.env` 文件中的默认密码和密钥！

**版本**: v2.2  
**最后更新**: 2026年3月
