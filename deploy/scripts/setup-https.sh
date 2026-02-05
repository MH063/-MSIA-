#!/usr/bin/env bash
set -euo pipefail

# 配置变量
DOMAIN="${DOMAIN:-your-domain.com}"
EMAIL="${EMAIL:-admin@your-domain.com}"
CERTS_DIR="${CERTS_DIR:-/etc/nginx/certs}"

echo "准备为域名签发证书: ${DOMAIN}"
echo "证书输出目录: ${CERTS_DIR}"

# 安装 Certbot（Debian/Ubuntu）
if ! command -v certbot >/dev/null 2>&1; then
  echo "安装 Certbot..."
  sudo apt update
  sudo apt install -y certbot python3-certbot-nginx
fi

# 使用 Nginx 插件签发证书
sudo certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}"

# 创建证书挂载目录
sudo mkdir -p "${CERTS_DIR}"

# 复制证书到挂载目录（供容器内 Nginx 使用）
sudo cp /etc/letsencrypt/live/"${DOMAIN}"/fullchain.pem "${CERTS_DIR}/fullchain.pem"
sudo cp /etc/letsencrypt/live/"${DOMAIN}"/privkey.pem "${CERTS_DIR}/privkey.pem"
sudo chmod 644 "${CERTS_DIR}/fullchain.pem"
sudo chmod 600 "${CERTS_DIR}/privkey.pem"

echo "证书已复制到 ${CERTS_DIR}"
echo "请确保 docker-compose.yml 中已挂载： ./client/certs:/etc/nginx/certs:ro"
echo "完成后执行 docker compose restart msia_client 使 Nginx 生效"

# 测试自动续期
sudo certbot renew --dry-run
echo "证书续期测试完成"
