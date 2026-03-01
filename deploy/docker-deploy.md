# MSIA Docker 部署指南

## 医学生智能问诊辅助系统 - Docker 部署说明

### 一、环境要求

- Docker Engine >= 20.10
- Docker Compose >= 2.0
- 至少 2GB 可用内存
- 至少 10GB 可用磁盘空间

### 二、快速开始

#### 1. 克隆项目并进入目录

```bash
cd 医学生智能问诊辅助系统（MSIA）
```

#### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.docker .env

# 编辑 .env 文件，修改必要配置
# 特别是 DB_PASSWORD 和 JWT_SECRET
```

#### 3. 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 4. 初始化数据库

```bash
# 执行数据库迁移
docker-compose exec server npx prisma migrate deploy

# 导入知识库数据（可选）
docker-compose exec server npx prisma db seed
```

#### 5. 访问应用

- 前端界面: http://localhost
- 后端 API: http://localhost:4000
- 健康检查: http://localhost:4000/health

### 三、常用命令

```bash
# 停止服务
docker-compose down

# 停止并删除数据卷（慎用）
docker-compose down -v

# 重启服务
docker-compose restart

# 查看特定服务日志
docker-compose logs -f server
docker-compose logs -f client
docker-compose logs -f db

# 进入容器内部
docker-compose exec server sh
docker-compose exec db psql -U postgres -d MSIA

# 重建镜像
docker-compose build --no-cache

# 更新部署
docker-compose pull
docker-compose up -d
```

### 四、开发环境

```bash
# 使用开发配置启动
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d

# 开发模式支持热重载
```

### 五、生产环境部署

#### 1. 修改环境变量

编辑 `.env` 文件：

```env
# 强密码（必须修改）
DB_PASSWORD=your_strong_password_here
JWT_SECRET=your_64_char_random_secret_key_here

# 禁用开发测试 Token
ENABLE_DEV_TOKENS=false

# 生产域名
ALLOWED_ORIGINS=https://your-domain.com
```

#### 2. 使用 HTTPS（推荐）

配置 Nginx 反向代理或负载均衡器处理 HTTPS。

#### 3. 数据备份

```bash
# 备份数据库
docker-compose exec db pg_dump -U postgres MSIA > backup.sql

# 恢复数据库
docker-compose exec -T db psql -U postgres -d MSIA < backup.sql
```

### 六、故障排查

#### 数据库连接失败

```bash
# 检查数据库状态
docker-compose exec db pg_isready -U postgres

# 查看数据库日志
docker-compose logs db
```

#### 服务启动失败

```bash
# 查看详细日志
docker-compose logs --tail=100 server

# 检查端口占用
netstat -tlnp | grep 4000
netstat -tlnp | grep 80
```

#### 认证失败

```bash
# 检查 JWT_SECRET 是否配置
docker-compose exec server env | grep JWT_SECRET

# 检查开发测试 Token 是否禁用
docker-compose exec server env | grep ENABLE_DEV_TOKENS

# 生产环境必须确保 ENABLE_DEV_TOKENS=false 或未设置
```

#### 重置环境

```bash
# 完全重置（会删除所有数据）
docker-compose down -v
docker-compose up -d
```

### 七、安全建议

1. **修改默认密码**: 务必修改 `DB_PASSWORD` 和 `JWT_SECRET`
2. **禁用测试 Token**: 生产环境设置 `ENABLE_DEV_TOKENS=false`
3. **使用 HTTPS**: 生产环境必须使用 HTTPS
4. **限制端口暴露**: 数据库端口默认只暴露给容器网络
5. **定期备份**: 设置定时任务备份数据库
6. **更新镜像**: 定期更新基础镜像以获取安全补丁

### 八、服务架构

```
┌─────────────┐
│   Nginx     │  ← 前端服务 (端口 80)
│  (Client)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Express   │  ← 后端 API (端口 4000)
│  (Server)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  PostgreSQL │  ← 数据库 (端口 5432)
│    (DB)     │
└─────────────┘
```

### 九、环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | ✅ |
| `JWT_SECRET` | JWT 密钥（64 位以上） | ✅ |
| `DB_PASSWORD` | 数据库密码 | ✅ |
| `ENABLE_DEV_TOKENS` | 开发测试 Token | ❌ |
| `ALLOWED_ORIGINS` | CORS 白名单 | ❌ |
| `ENCRYPTION_KEY` | 加密密钥（32 位） | ❌ |

### 十、相关文档

- [项目主文档](../README.md) - 项目介绍和快速开始
- [Docker 部署详细指南](../DOCKER_DEPLOY.md) - 完整 Docker 部署文档
- [生产部署指南](./README.md) - 生产环境部署
- [后端开发文档](../server/README.md) - 后端 API 说明

---

**版本**: v2.2  
**最后更新**: 2026年3月
