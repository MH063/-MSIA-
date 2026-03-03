# MSIA 服务器部署指南

## 服务器要求

- **最低配置**: 2核CPU + 2GB内存 + 40GB磁盘
- **推荐配置**: 4核CPU + 8GB内存 + 100GB磁盘
- **操作系统**: Ubuntu 20.04/22.04 LTS 或 CentOS 7/8

---

## 快速部署

### 1. 克隆项目

```bash
git clone https://github.com/MH063/-MSIA-.git
cd -MSIA-
```

### 2. 运行服务器优化脚本（首次部署）

```bash
chmod +x deploy/optimize-server.sh
sudo ./deploy/optimize-server.sh
```

此脚本将自动配置：
- ✅ 2GB Swap 分区
- ✅ 系统内核参数优化
- ✅ 文件描述符限制
- ✅ Docker 日志配置
- ✅ 系统清理

### 3. 配置环境变量

```bash
cp .env.example .env
nano .env
```

修改以下关键配置：
```env
# 数据库配置
DB_USER=msia_user
DB_PASSWORD=your_secure_password
DB_NAME=MSIA

# JWT 密钥（生产环境必须修改）
JWT_SECRET=your_jwt_secret_here

# 操作员 Token
OPERATOR_TOKEN=your_operator_token_here

# 允许的域名
ALLOWED_ORIGINS=http://your-domain.com,http://your-ip
```

### 4. 启动服务

```bash
docker-compose up -d
```

### 5. 检查服务状态

```bash
docker-compose ps
docker stats --no-stream
```

---

## 资源分配（2核2GB服务器）

| 服务 | CPU限制 | 内存限制 | 说明 |
|------|---------|----------|------|
| PostgreSQL | 0.5核 | 512MB | 数据库服务 |
| Redis | 0.25核 | 384MB | 缓存服务 |
| 后端API | 0.75核 | 768MB | Node.js服务 |
| 前端Nginx | 0.25核 | 128MB | 静态文件服务 |
| **总计** | **1.75核** | **1.8GB** | 预留系统开销 |

---

## 常用命令

```bash
# 查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f server

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新部署
git pull
docker-compose down
docker-compose up -d --build

# 查看资源使用
docker stats --no-stream
free -h
df -h
```

---

## 故障排查

### 服务无法启动

```bash
# 检查端口占用
netstat -tlnp | grep -E '80|443|4000|5432|6379'

# 检查容器日志
docker-compose logs

# 检查磁盘空间
df -h
```

### 内存不足

```bash
# 检查内存使用
free -h

# 检查 Swap
swapon --show

# 手动添加 Swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 数据库连接失败

```bash
# 检查数据库状态
docker-compose exec db pg_isready

# 检查数据库日志
docker-compose logs db
```

---

## 备份与恢复

### 备份数据库

```bash
docker-compose exec db pg_dump -U postgres MSIA > backup_$(date +%Y%m%d).sql
```

### 恢复数据库

```bash
cat backup_20240101.sql | docker-compose exec -T db psql -U postgres MSIA
```

---

## 安全建议

1. **修改默认密码**: 修改 `.env` 中的所有密码和密钥
2. **配置防火墙**: 只开放必要端口（80, 443, 22）
3. **启用 HTTPS**: 配置 SSL 证书
4. **定期备份**: 设置自动备份计划
5. **更新系统**: 定期更新操作系统和 Docker 镜像

---

## 联系支持

如有问题，请提交 Issue 到 GitHub 仓库。
