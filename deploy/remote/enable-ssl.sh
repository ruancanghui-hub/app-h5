#!/usr/bin/env bash
# 为 h5.aigrowpark.com 申请 Let's Encrypt 证书并启用 HTTPS
# 前置条件：h5.aigrowpark.com 的 A 记录已指向本机，且 80 端口外网可达
set -euo pipefail

DOMAIN=h5.aigrowpark.com
WEBROOT=/www/wwwroot/h5.aigrowpark.com
SSL_DIR=/usr/local/nginx/conf/ssl/$DOMAIN
SITES=/usr/local/nginx/conf/sites
NGX=/usr/local/nginx/sbin/nginx
ACME=/root/.acme.sh/acme.sh
STAMP=$(date +%Y%m%d-%H%M%S)
BK=/root/deploy-backup/ssl-$STAMP

echo "=========== 0. 前置检查 ==========="
echo -n "  DNS 解析: "
IP=$(curl -s --max-time 10 "https://dns.alidns.com/resolve?name=$DOMAIN&type=A" \
     | grep -oE '"data":"[0-9.]+"' | head -1 | cut -d'"' -f4 || true)
if [ "$IP" != "139.199.211.157" ]; then
  echo "✘ 未解析到本机（当前: ${IP:-无}）"
  echo ""
  echo "  请先在 DNSPod 添加解析记录："
  echo "    主机记录: h5"
  echo "    记录类型: A"
  echo "    记录值:   139.199.211.157"
  echo "  添加后等待 1-2 分钟再运行本脚本。"
  exit 1
fi
echo "✔ $IP"

echo -n "  80 端口本地: "
curl -s --max-time 8 -o /dev/null -w "HTTP %{http_code}\n" -H "Host: $DOMAIN" http://127.0.0.1/ || true

echo -n "  站点目录: "
[ -f "$WEBROOT/index.html" ] && echo "✔ 已有 index.html" || { echo "✘ 无 index.html"; exit 1; }

mkdir -p "$BK"
cp -a "$SITES/$DOMAIN.conf" "$BK/$DOMAIN.conf.bak" 2>/dev/null || true

echo ""
echo "=========== 1. 申请证书（HTTP-01 验证）==========="
"$ACME" --issue -d "$DOMAIN" --webroot "$WEBROOT" --server letsencrypt --keylength ec-256 2>&1 | tail -20

echo ""
echo "=========== 2. 安装证书到 nginx 目录 ==========="
mkdir -p "$SSL_DIR"
"$ACME" --install-cert -d "$DOMAIN" --ecc \
  --key-file       "$SSL_DIR/privkey.pem" \
  --fullchain-file "$SSL_DIR/fullchain.pem" \
  --reloadcmd      "$NGX -s reload" 2>&1 | tail -8
ls -la "$SSL_DIR"

echo ""
echo "=========== 3. 写入 HTTPS 站点配置 ==========="
cat > "$SITES/$DOMAIN.conf" <<'NGINXEOF'
# h5.aigrowpark.com —— App H5 静态站点（HTTPS）

# HTTP 自动跳转 HTTPS，保留 ACME 续期验证路径
server {
    listen 80;
    listen [::]:80;
    server_name h5.aigrowpark.com;

    location ^~ /.well-known/acme-challenge/ {
        root /www/wwwroot/h5.aigrowpark.com;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name h5.aigrowpark.com;

    ssl_certificate     /usr/local/nginx/conf/ssl/h5.aigrowpark.com/fullchain.pem;
    ssl_certificate_key /usr/local/nginx/conf/ssl/h5.aigrowpark.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    add_header Strict-Transport-Security "max-age=31536000" always;

    root /www/wwwroot/h5.aigrowpark.com;
    index index.html;
    charset utf-8;
    client_max_body_size 20m;

    access_log /usr/local/nginx/logs/h5.aigrowpark.access.log;
    error_log  /usr/local/nginx/logs/h5.aigrowpark.error.log warn;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        expires -1;
    }

    location ^~ /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    gzip on;
    gzip_vary on;
    gzip_min_length 1k;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/javascript
               application/javascript application/json
               application/xml image/svg+xml;

    location ~ /\. { deny all; }
}
NGINXEOF
echo "  已写入 $SITES/$DOMAIN.conf"

echo ""
echo "=========== 4. 校验并重载 ==========="
"$NGX" -t
"$NGX" -s reload
sleep 2

echo ""
echo "=========== 5. 验证 ==========="
echo -n "  HTTP 是否跳转 → "
curl -s --max-time 10 -o /dev/null -w "HTTP %{http_code} → %{redirect_url}\n" -H "Host: $DOMAIN" http://127.0.0.1/
echo -n "  HTTPS 首页    → "
curl -sk --max-time 10 -o /dev/null -w "HTTP %{http_code} | %{size_download} bytes\n" -H "Host: $DOMAIN" https://127.0.0.1/
echo "  证书信息:"
echo | openssl s_client -connect 127.0.0.1:443 -servername "$DOMAIN" 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates 2>/dev/null || true

echo ""
echo "=========== 6. 自动续期确认 ==========="
crontab -l 2>/dev/null | grep acme.sh || echo "  (acme.sh 已自带 cron)"
"$ACME" --list 2>/dev/null | grep -A3 "$DOMAIN" || true

echo ""
echo "=========== 完成 ==========="
echo "  访问地址: https://$DOMAIN/"
echo "  配置备份: $BK"
