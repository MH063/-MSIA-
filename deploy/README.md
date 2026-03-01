# MSIA 生产环境部署指南

## 医学生智能问诊辅助系统 - 手动部署文档

本文档提供将 MSIA 系统手动部署到生产服务器的完整指南。

## 一、系统要求

### 服务器配置

| 配置项 | 最低要求 | 推荐配置 |
|--------|---------|---------|
| 操作系统 | Ubuntu 20.04+ | Ubuntu 22.04 LTS |
| CPU | 2核 | 4核 |
| 内存 | 4GB | 8GB |
| 磁盘 | 20GB SSD | 50GB SSD |
| 网络 | 公网IP | 公网IP + 域名 |

### 软件依赖

- Node.js 20+
- PostgreSQL 16+
- Nginx
- Git
- PM2（进程管理）

## 二、部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                         生产服务器                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐         ┌─────────────┐         ┌────────┐ │
│  │   Nginx     │────────▶│   Node.js   │────────▶│PostgreSQL│
│  │   :80/443   │         │   :4000     │         │ :5432   │
│  │             │         │             │         │         │
│  │  反向代理    │         │  后端服务    │         │  数据库  │
│  │  静态文件    │         │  Express    │         │         │
│  └─────────────┘         └─────────────┘         └────────┘ │
│                                                             │
│  ┌─────────────┐                                            │
│  │   React     │                                            │
│  │   构建文件   │                                            │
│  └─────────────┘                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 三、部署步骤

### 步骤 1: 服务器准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装必要软件
sudo apt install -y curl wget git nginx postgresql postgresql-contrib

# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version  # v20.x.x
npm --version   # 10.x.x
```

### 步骤 2: 数据库配置

```bash
# 切换到 postgres 用户
sudo -u postgres psql
```

在 psql 中执行：

```sql
-- 创建数据库
CREATE DATABASE MSIA;

-- 创建专用用户（使用强密码）
CREATE USER msia_user WITH PASSWORD 'your_strong_password';

-- 授权
GRANT ALL PRIVILEGES ON DATABASE MSIA TO msia_user;

-- 退出
\q
```

### 步骤 3: 代码部署

```bash
# 创建应用目录
sudo mkdir -p /opt/msia
sudo chown $USER:$USER /opt/msia

# 克隆代码
cd /opt/msia
git clone <repository-url> .

# 安装后端依赖
cd server
npm ci

# 安装前端依赖
cd ../client
npm ci
```

### 步骤 4: 环境配置

```bash
cd /opt/msia/server

# 创建环境变量文件
cp .env.example .env

# 编辑配置
nano .env
```

环境变量配置：

```env
# 数据库配置
DATABASE_URL="postgresql://msia_user:your_strong_password@localhost:5432/MSIA?schema=public"
DB_PASSWORD=your_strong_password

# 服务配置
PORT=4000
HOST=0.0.0.0
NODE_ENV=production

# JWT 安全配置（必填，建议 64 位以上）
JWT_SECRET=your_strong_jwt_secret_key_min_64_characters

# 禁用开发测试 Token
ENABLE_DEV_TOKENS=false

# 跨域配置（生产域名）
ALLOWED_ORIGINS=https://your-domain.com

# 登录安全配置
LOGIN_MAX_FAILS_DOCTOR=5
LOGIN_MAX_FAILS_ADMIN=3
LOGIN_LOCK_MS_DOCTOR=300000
LOGIN_LOCK_MS_ADMIN=600000

# 加密密钥（32 位）
ENCRYPTION_KEY=your_32_char_encryption_key

# 其他配置
LOG_LEVEL=info
MAX_FILE_SIZE=10485760
```

**安全提示：**
- `JWT_SECRET` 必须使用强密码，建议 64 位以上随机字符串
- 生产环境禁止使用默认的 JWT 密钥
- `ENABLE_DEV_TOKENS` 必须为 `false` 或不设置
- `ALLOWED_ORIGINS` 必须配置为生产域名

### 步骤 5: 构建应用

```bash
# 后端构建
cd /opt/msia/server
npm run build
npx prisma migrate deploy

# 前端构建
cd /opt/msia/client
npm run build

# 复制到 Nginx 目录
sudo mkdir -p /var/www/msia
sudo cp -r dist/* /var/www/msia/
sudo chown -R www-data:www-data /var/www/msia
```

### 步骤 6: Nginx 配置

创建 Nginx 配置文件：

```bash
sudo nano /etc/nginx/sites-available/msia
```

配置内容：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/msia;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 健康检查
    location /health {
        proxy_pass http://localhost:4000/health;
    }
}
```

启用配置：

```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/msia /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 步骤 7: Systemd 服务配置

创建服务文件：

```bash
sudo nano /etc/systemd/system/msia.service
```

服务配置：

```ini
[Unit]
Description=MSIA 医学生智能问诊辅助系统
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/msia/server
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
# 重新加载 systemd
sudo systemctl daemon-reload

# 启用开机自启
sudo systemctl enable msia

# 启动服务
sudo systemctl start msia

# 查看状态
sudo systemctl status msia
```

### 步骤 8: SSL 证书配置（HTTPS）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

### 步骤 9: Docker 部署开启 HTTPS 与证书挂载

1) 在 `docker-compose.yml` 中为前端服务增加 443 端口映射与证书卷挂载：

```yaml
client:
  ports:
    - "${CLIENT_PORT:-80}:80"
    - "${CLIENT_PORT_SSL:-443}:443"
  volumes:
    - ./client/certs:/etc/nginx/certs:ro
```

2) 生成并挂载证书（脚本已提供）：

```bash
cd /opt/msia
DOMAIN=your-domain.com EMAIL=admin@your-domain.com CERTS_DIR=/etc/nginx/certs \
sudo bash deploy/scripts/setup-https.sh

# 重启前端容器使证书生效
docker compose restart msia_client
```

3) 环境变量模板（位于仓库根目录 `.env.docker.example`）：

```env
CLIENT_PORT=80
CLIENT_PORT_SSL=443
DB_SSL=true
ENABLE_HSTS=true
ALLOWED_ORIGINS=https://your-domain.com
```

## 四、服务管理

### 常用命令

| 命令 | 说明 |
|------|------|
| `sudo systemctl start msia` | 启动服务 |
| `sudo systemctl stop msia` | 停止服务 |
| `sudo systemctl restart msia` | 重启服务 |
| `sudo systemctl status msia` | 查看状态 |
| `sudo journalctl -u msia -f` | 查看日志 |

### 日志查看

```bash
# 查看应用日志
sudo journalctl -u msia -n 100

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# 查看 PostgreSQL 日志
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

## 五、更新部署

```bash
cd /opt/msia

# 拉取最新代码
git pull

# 安装依赖
cd server && npm ci && cd ..
cd client && npm ci && cd ..

# 构建
npm run build

# 执行迁移
cd server
npx prisma migrate deploy
cd ..

# 复制前端文件
sudo cp -r client/dist/* /var/www/msia/

# 重启服务
sudo systemctl restart msia
```

## 六、备份与恢复

### 数据库备份

```bash
# 手动备份
pg_dump -U msia_user -h localhost MSIA > backup_$(date +%Y%m%d).sql

# 自动备份脚本
sudo nano /opt/msia/scripts/backup.sh
```

备份脚本：

```bash
#!/bin/bash
BACKUP_DIR="/opt/msia/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
pg_dump -U msia_user -h localhost MSIA > $BACKUP_DIR/backup_$DATE.sql

# 保留最近 7 天的备份
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

### 数据库恢复

```bash
# 恢复备份
psql -U msia_user -h localhost -d MSIA < backup_20240101.sql
```

## 七、故障排查

### 服务无法启动

```bash
# 检查日志
sudo journalctl -u msia -n 50

# 检查端口占用
sudo netstat -tlnp | grep 4000

# 检查文件权限
ls -la /opt/msia/server/dist/
```

### 数据库连接失败

```bash
# 测试连接
psql -U msia_user -h localhost -d MSIA

# 检查 PostgreSQL 状态
sudo systemctl status postgresql

# 检查用户权限
sudo -u postgres psql -c "\du"
```

### 前端无法访问 API

```bash
# 检查 Nginx 配置
sudo nginx -t

# 检查后端服务
curl http://localhost:4000/health

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

### 认证失败

```bash
# 检查 JWT_SECRET 是否配置
grep JWT_SECRET /opt/msia/server/.env

# 检查 ENABLE_DEV_TOKENS 是否禁用
grep ENABLE_DEV_TOKENS /opt/msia/server/.env

# 生产环境必须确保 ENABLE_DEV_TOKENS=false 或不设置
```

## 八、安全建议

### 1. 修改默认密码

- 数据库密码
- JWT 密钥
- 服务器 root 密码

### 2. 配置防火墙

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

### 3. 定期更新

```bash
sudo apt update && sudo apt upgrade -y
```

### 4. 配置自动备份

- 数据库每日备份
- 配置文件备份

### 5. 安全配置检查

- [ ] JWT_SECRET 已配置强密钥
- [ ] ENABLE_DEV_TOKENS 已禁用
- [ ] ALLOWED_ORIGINS 已配置生产域名
- [ ] 数据库密码已修改
- [ ] HTTPS 已启用

## 九、相关文档

- [项目主文档](../README.md) - 项目介绍和快速开始
- [Docker 部署指南](../DOCKER_DEPLOY.md) - Docker 部署说明
- [后端开发文档](../server/README.md) - 后端 API 说明
- [前端开发文档](../client/README.md) - 前端开发说明
- [术语表](../docs/TERMINOLOGY.md) - 统一术语规范

---

**部署完成后访问**: https://your-domain.com

**版本**: v2.2  
**最后更新**: 2026年3月
