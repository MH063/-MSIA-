# MSIA 部署指南

## 系统要求

- Node.js 18+
- PostgreSQL 14+
- Nginx (生产环境)
- Linux 服务器 (Ubuntu 20.04+ 推荐)

## 部署步骤

### 1. 服务器准备

```bash
# 创建应用用户
sudo useradd -r -s /bin/false msia

# 创建应用目录
sudo mkdir -p /opt/msia
sudo chown msia:msia /opt/msia
```

### 2. 代码部署

```bash
# 克隆代码 (或使用 SCP/FTP 上传)
cd /opt/msia
git clone https://github.com/your-repo/MSIA.git .

# 安装后端依赖
cd server
npm ci

# 安装前端依赖
cd ../client
npm ci
```

### 3. 数据库配置

```bash
# 登录 PostgreSQL
sudo -u postgres psql

# 创建数据库
CREATE DATABASE MSIA;
CREATE USER msia_user WITH PASSWORD '强密码';
GRANT ALL PRIVILEGES ON DATABASE MSIA TO msia_user;
\q

# 执行迁移
cd /opt/msia/server
npx prisma migrate deploy

# 导入知识库数据 (可选)
npm run seed
```

### 4. 环境变量配置

```bash
cd /opt/msia/server

# 复制生产环境配置模板
cp .env.production.example .env.production

# 编辑配置 (使用强密码)
nano .env.production
```

### 5. 构建应用

```bash
# 后端构建
cd /opt/msia/server
npm run build

# 前端构建
cd /opt/msia/client
npm run build

# 将构建结果复制到 Nginx 目录
sudo mkdir -p /var/www/msia
sudo cp -r dist /var/www/msia/client
```

### 6. Nginx 配置

```bash
# 复制 Nginx 配置
sudo cp /opt/msia/deploy/nginx.conf /etc/nginx/sites-available/msia

# 编辑配置，替换域名和证书路径
sudo nano /etc/nginx/sites-available/msia

# 启用配置
sudo ln -s /etc/nginx/sites-available/msia /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Systemd 服务配置

```bash
# 复制服务配置
sudo cp /opt/msia/deploy/systemd.service /etc/systemd/system/msia.service

# 编辑配置 (如有需要)
sudo nano /etc/systemd/system/msia.service

# 启用并启动服务
sudo systemctl daemon-reload
sudo systemctl enable msia
sudo systemctl start msia

# 查看状态
sudo systemctl status msia
sudo journalctl -u msia -f
```

### 8. SSL 证书配置 (Let's Encrypt)

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

## 常用命令

```bash
# 查看服务状态
sudo systemctl status msia

# 查看日志
sudo journalctl -u msia -f

# 重启服务
sudo systemctl restart msia

# 更新部署
cd /opt/msia
git pull
npm ci
npm run build
sudo systemctl restart msia
```

## 安全建议

1. **修改默认密码**: 确保所有密码都是强密码
2. **防火墙配置**: 只开放 80/443 端口
3. **定期备份**: 配置数据库自动备份
4. **日志监控**: 配置日志轮转和监控告警
5. **更新维护**: 定期更新系统和依赖包

## 故障排查

### 服务无法启动

```bash
# 检查日志
sudo journalctl -u msia -n 100

# 检查端口占用
sudo netstat -tlnp | grep 4000
```

### 数据库连接失败

```bash
# 测试数据库连接
psql -h localhost -U msia_user -d MSIA

# 检查 PostgreSQL 状态
sudo systemctl status postgresql
```

### 前端无法访问 API

```bash
# 检查 CORS 配置
curl -H "Origin: https://your-domain.com" -I http://localhost:4000/api/health

# 检查 Nginx 日志
sudo tail -f /var/log/nginx/error.log
```
