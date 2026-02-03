# MSIA 部署指南

## 系统要求

- Node.js 20+
- PostgreSQL 18+
- Nginx (生产环境)
- Linux 服务器 (Ubuntu 20.04+ 推荐)

## 部署环境说明

| 环境 | 说明 | 位置 |
|------|------|------|
| **本地开发机** | 你的开发电脑 (Windows/Mac/Linux) | 本地 |
| **远程服务器** | 生产环境 Linux 服务器 | 云端/机房 |

**重要**: 以下步骤中标注了每个命令的执行位置，请仔细阅读。

---

## 部署步骤

### 前置步骤: 准备部署包 (在本地开发机执行)

```bash
# 1. 确保代码已提交到 Git
# 在本地开发机执行
git add .
git commit -m "准备部署"
git push origin main

# 2. 或者打包代码上传到服务器
# 在本地开发机执行
cd 医学生智能问诊辅助系统（MSIA）
zip -r msia-deploy.zip . -x "node_modules/*" "client/node_modules/*" "server/node_modules/*" ".git/*"
# 然后将 msia-deploy.zip 上传到服务器
```

---

### 1. 服务器准备 (在远程服务器执行)

**执行位置**: 远程 Linux 服务器 (SSH 登录后)

```bash
# 创建应用用户
sudo useradd -r -s /bin/false msia

# 创建应用目录
sudo mkdir -p /opt/msia
sudo chown msia:msia /opt/msia
```

---

### 2. 代码部署 (在远程服务器执行)

**执行位置**: 远程 Linux 服务器 (SSH 登录后)

```bash
# 方式1: 通过 Git 克隆 (推荐)
cd /opt/msia
sudo -u msia git clone https://github.com/your-repo/MSIA.git .

# 方式2: 如果已上传压缩包
cd /opt/msia
sudo -u msia unzip msia-deploy.zip

# 安装后端依赖
cd /opt/msia/server
sudo -u msia npm ci

# 安装前端依赖
cd /opt/msia/client
sudo -u msia npm ci
```

---

### 3. 数据库配置 (在远程服务器执行)

**执行位置**: 远程 Linux 服务器 (SSH 登录后)

```bash
# 登录 PostgreSQL
sudo -u postgres psql
```

在 psql 命令行中执行:
```sql
-- 创建数据库
CREATE DATABASE MSIA;

-- 创建专用数据库用户 (使用强密码)
CREATE USER msia_user WITH PASSWORD '你的强密码';

-- 授权
GRANT ALL PRIVILEGES ON DATABASE MSIA TO msia_user;

-- 退出
\q
```

继续执行:
```bash
# 执行数据库迁移
cd /opt/msia/server
sudo -u msia npx prisma migrate deploy

# 导入知识库数据 (可选)
sudo -u msia npm run seed
```

---

### 4. 环境变量配置 (在远程服务器执行)

**执行位置**: 远程 Linux 服务器 (SSH 登录后)

```bash
cd /opt/msia/server

# 复制生产环境配置模板
sudo -u msia cp .env.production.example .env.production

# 编辑配置 (使用强密码)
sudo nano .env.production
```

**必须修改的配置项**:
```env
# 数据库密码 (使用步骤3中设置的密码)
DATABASE_URL="postgresql://msia_user:你的强密码@localhost:5432/MSIA?schema=public"
DB_PASSWORD=你的强密码

# 操作员认证令牌 (生成随机字符串)
OPERATOR_TOKEN=your_random_secure_token_here

# 允许的前端来源 (你的域名)
ALLOWED_ORIGINS=https://your-domain.com
```

保存并退出 (Ctrl+O, Enter, Ctrl+X)

---

### 5. 构建应用 (在远程服务器执行)

**执行位置**: 远程 Linux 服务器 (SSH 登录后)

```bash
# 后端构建
cd /opt/msia/server
sudo -u msia npm run build

# 前端构建
cd /opt/msia/client
sudo -u msia npm run build

# 将构建结果复制到 Nginx 目录
sudo mkdir -p /var/www/msia
sudo cp -r /opt/msia/client/dist /var/www/msia/client
sudo chown -R www-data:www-data /var/www/msia
```

---

### 6. Nginx 配置 (在远程服务器执行)

**执行位置**: 远程 Linux 服务器 (SSH 登录后)

```bash
# 复制 Nginx 配置
sudo cp /opt/msia/deploy/nginx.conf /etc/nginx/sites-available/msia

# 编辑配置，替换域名和证书路径
sudo nano /etc/nginx/sites-available/msia
```

**需要修改的内容**:
- `your-domain.com` → 你的实际域名
- `/path/to/your/certificate.crt` → SSL 证书路径
- `/path/to/your/private.key` → SSL 私钥路径

```bash
# 启用配置
sudo ln -s /etc/nginx/sites-available/msia /etc/nginx/sites-enabled/

# 测试配置语法
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

---

### 7. Systemd 服务配置 (在远程服务器执行)

**执行位置**: 远程 Linux 服务器 (SSH 登录后)

Systemd 服务配置用于管理后端 Node.js 应用的启动、停止和自动重启。

#### 7.1 复制服务配置文件

```bash
# 复制服务配置到 systemd 目录
sudo cp /opt/msia/deploy/systemd.service /etc/systemd/system/msia.service

# 查看服务配置内容
sudo cat /etc/systemd/system/msia.service
```

#### 7.2 服务配置文件说明

服务配置文件 `/etc/systemd/system/msia.service` 包含以下关键配置：

| 配置项 | 说明 | 值 |
|--------|------|-----|
| `User` | 运行服务的用户 | `msia` |
| `Group` | 运行服务的用户组 | `msia` |
| `WorkingDirectory` | 工作目录 | `/opt/msia/server` |
| `EnvironmentFile` | 环境变量文件 | `/opt/msia/server/.env.production` |
| `ExecStart` | 启动命令 | `/usr/bin/node dist/index.js` |
| `Restart` | 重启策略 | `always` (总是重启) |
| `RestartSec` | 重启间隔 | `10` 秒 |

#### 7.3 创建必要的目录并设置权限

```bash
# 创建上传目录和日志目录
sudo mkdir -p /opt/msia/server/uploads
sudo mkdir -p /opt/msia/server/logs

# 设置目录所有者为 msia 用户
sudo chown -R msia:msia /opt/msia/server/uploads
sudo chown -R msia:msia /opt/msia/server/logs

# 设置目录权限
sudo chmod 755 /opt/msia/server/uploads
sudo chmod 755 /opt/msia/server/logs

# 验证权限
sudo ls -la /opt/msia/server/ | grep -E "uploads|logs"
```

#### 7.4 重新加载 systemd 配置

```bash
# 重新加载 systemd 守护进程配置 (修改服务文件后必须执行)
sudo systemctl daemon-reload
```

#### 7.5 设置服务开机自启

```bash
# 启用服务 (开机自动启动)
sudo systemctl enable msia

# 验证服务已启用
sudo systemctl is-enabled msia
# 预期输出: enabled
```

#### 7.6 启动服务

```bash
# 启动服务
sudo systemctl start msia

# 查看服务状态
sudo systemctl status msia
```

**正常状态应显示：**
```
● msia.service - MSIA 医学生智能问诊辅助系统
   Loaded: loaded (/etc/systemd/system/msia.service; enabled; vendor preset: enabled)
   Active: active (running) since Mon 2024-01-01 12:00:00 UTC; 1min ago
 Main PID: 12345 (node)
   Memory: 45.2M
   CGroup: /system.slice/msia.service
           └─12345 /usr/bin/node dist/index.js
```

#### 7.7 查看服务日志

```bash
# 实时查看日志 (按 Ctrl+C 退出)
sudo journalctl -u msia -f

# 查看最近 100 行日志
sudo journalctl -u msia -n 100

# 查看今天的日志
sudo journalctl -u msia --since today

# 查看特定时间段的日志
sudo journalctl -u msia --since "2024-01-01 10:00:00" --until "2024-01-01 12:00:00"
```

#### 7.8 服务管理命令

```bash
# 启动服务
sudo systemctl start msia

# 停止服务
sudo systemctl stop msia

# 重启服务 (修改代码后使用)
sudo systemctl restart msia

# 重新加载配置 (不中断服务)
sudo systemctl reload msia

# 查看服务状态
sudo systemctl status msia

# 禁用开机自启
sudo systemctl disable msia
```

#### 7.9 故障排查

**服务无法启动时，按以下步骤排查：**

```bash
# 步骤1: 查看详细错误信息
sudo journalctl -u msia -n 50 --no-pager

# 步骤2: 检查 Node.js 路径是否正确
which node
# 预期输出: /usr/bin/node

# 步骤3: 检查构建文件是否存在
sudo ls -la /opt/msia/server/dist/index.js

# 步骤4: 检查环境变量文件
sudo cat /opt/msia/server/.env.production

# 步骤5: 手动运行测试 (查看具体错误)
cd /opt/msia/server
sudo -u msia node dist/index.js
```

**常见错误及解决方法：**

| 错误信息 | 原因 | 解决方法 |
|----------|------|----------|
| `Permission denied` | 文件权限不足 | `sudo chown -R msia:msia /opt/msia` |
| `EACCES: permission denied, open '/opt/msia/server/uploads'` | 上传目录权限不足 | `sudo mkdir -p /opt/msia/server/uploads && sudo chown msia:msia /opt/msia/server/uploads` |
| `Cannot find module` | 依赖未安装或构建失败 | 重新运行 `npm ci` 和 `npm run build` |
| `Port 4000 is already in use` | 端口被占用 | `sudo lsof -i :4000` 查找并停止占用进程 |
| `DATABASE_URL is required` | 环境变量未配置 | 检查 `.env.production` 文件是否存在 |
| `Connection refused` | 数据库未启动 | `sudo systemctl start postgresql` |

#### 7.10 验证服务运行

```bash
# 检查端口监听
sudo netstat -tlnp | grep 4000
# 或
sudo ss -tlnp | grep 4000

# 预期输出: tcp 0 0 0.0.0.0:4000 0.0.0.0:* LISTEN xxxx/node

# 测试 API 接口
curl http://localhost:4000/health

# 预期输出:
# {
#   "success": true,
#   "status": "healthy",
#   "timestamp": "2024-01-01T12:00:00.000Z",
#   "uptime": 123.456,
#   "environment": "production",
#   "database": "connected"
# }
```

---

### 8. SSL 证书配置 (在远程服务器执行)

**执行位置**: 远程 Linux 服务器 (SSH 登录后)

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书 (按提示输入邮箱、同意协议)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

---

## 部署完成后的验证

在本地浏览器访问:
- 前端页面: `https://your-domain.com`
- API 健康检查: `https://your-domain.com/api/health`

---

## 常用命令速查表

### 服务管理 (在远程服务器执行)

```bash
# 查看服务状态
sudo systemctl status msia

# 查看实时日志
sudo journalctl -u msia -f

# 重启服务
sudo systemctl restart msia

# 停止服务
sudo systemctl stop msia
```

### 更新部署 (在远程服务器执行)

```bash
cd /opt/msia

# 拉取最新代码
sudo -u msia git pull

# 安装依赖
sudo -u msia npm ci

# 构建
sudo -u msia npm run build
cd client && sudo -u msia npm run build && cd ..

# 复制前端构建文件
sudo cp -r client/dist /var/www/msia/client

# 重启服务
sudo systemctl restart msia
```

---

## 安全建议

1. **修改默认密码**: 确保所有密码都是强密码 (至少12位，包含大小写字母、数字、特殊字符)
2. **防火墙配置**: 只开放 80/443 端口，关闭其他端口
3. **定期备份**: 配置数据库自动备份
4. **日志监控**: 配置日志轮转和监控告警
5. **更新维护**: 定期更新系统和依赖包

---

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
