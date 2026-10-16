#!/usr/bin/env bash
# 远端部署：同步静态文件 + 更新并重启 API 后端
# 用法: bash deploy-site.sh <stamp>
set -euo pipefail

STAMP="${1:?用法: deploy-site.sh <stamp>}"
export PATH="/root/.nvm/versions/node/v20.19.5/bin:$PATH"

SITE=/www/wwwroot/h5.aigrowpark.com
API_DIR=/www/wwwroot/h5.aigrowpark.com-api
WORK=/root/deploy-work
SRC="$WORK/dist-$STAMP"
BK="/root/deploy-backup/site-$STAMP"

echo "--- 0. Nginx 运行环境自检（幂等）---"
# nginx 的临时目录（client_body_temp 等）位于 prefix 之下，需要 worker 用户可遍历 prefix。
# prefix 被硬化成 750 时，worker 进不去临时目录 → 带文件上传的请求一律 500，
# 且后端日志空白（请求根本没到后端）。这里每次发布都自愈一次，避免重装后复发。
NGX_PREFIX=/usr/local/nginx
NGX_TMP_DIRS=(client_body_temp proxy_temp fastcgi_temp uwsgi_temp scgi_temp)
NGX_USER=$(ps -eo user,args 2>/dev/null | awk '/[n]ginx: worker/ {print $1; exit}')
NGX_USER=${NGX_USER:-nobody}
if [ -d "$NGX_PREFIX" ]; then
  if runuser -u "$NGX_USER" -- test -x "$NGX_PREFIX" 2>/dev/null; then
    echo "    $NGX_PREFIX 对 $NGX_USER 可遍历 ✔"
  else
    echo "    ⚠ $NGX_PREFIX 对 $NGX_USER 不可遍历，补 o+x"
    chmod o+x "$NGX_PREFIX" || echo "    ✘ 补权限失败，请手动处理"
  fi
  for d in "${NGX_TMP_DIRS[@]}"; do
    mkdir -p "$NGX_PREFIX/$d"
    chown "$NGX_USER" "$NGX_PREFIX/$d" 2>/dev/null || true
    chmod 700 "$NGX_PREFIX/$d"
  done
  printf "    %-18s " "client_body_temp"
  runuser -u "$NGX_USER" -- sh -c "touch '$NGX_PREFIX/client_body_temp/.probe' && rm -f '$NGX_PREFIX/client_body_temp/.probe'" 2>/dev/null \
    && echo "✔ 可写" || echo "✘ 不可写（大请求体会 500）"
else
  echo "    (未找到 $NGX_PREFIX，跳过)"
fi

echo "--- 1. 备份当前站点 ---"
mkdir -p "$BK"
if [ -f "$SITE/index.html" ]; then
  tar -czf "$BK/site.tar.gz" -C "$SITE" --exclude=.well-known . 2>/dev/null || true
  echo "    已备份 → $BK/site.tar.gz"
  # 只保留最近 3 个版本
  ls -1dt /root/deploy-backup/site-* 2>/dev/null | tail -n +4 | xargs -r rm -rf
else
  echo "    (站点目录为空，跳过备份)"
fi

echo "--- 2. 同步静态文件 ---"
[ -d "$SRC" ] || { echo "    ✘ 找不到 $SRC"; exit 1; }
mkdir -p "$SITE"
# --exclude .well-known：ACME 续期验证目录不能被 --delete 清掉
rsync -a --delete --exclude '.well-known' "$SRC"/ "$SITE"/
echo "    已同步到 $SITE"
find "$SITE" -maxdepth 1 -type f | sed 's/^/      /'

echo "--- 3. 部署 API 后端 ---"
mkdir -p "$API_DIR/data/uploads" "$API_DIR/logs"
cp -f "$WORK/prod-server.cjs" "$API_DIR/app.cjs"
cp -f "$WORK/api-ecosystem.json" "$API_DIR/ecosystem.json"
cd "$API_DIR"
if pm2 describe app-h5-api >/dev/null 2>&1; then
  pm2 reload ecosystem.json --update-env >/dev/null
  echo "    已 reload app-h5-api"
else
  pm2 start ecosystem.json >/dev/null
  echo "    已启动 app-h5-api"
fi
pm2 save >/dev/null
sleep 2
pm2 describe app-h5-api 2>/dev/null | grep -E "status|script path|exec cwd" | sed 's/^/      /' || true

echo "--- 4. 服务端验证 ---"
echo -n "    /api/health      → "
curl -s --max-time 8 http://127.0.0.1:3900/api/health; echo
echo -n "    admin.html       → "
[ -f "$SITE/admin.html" ] && echo "✔ 存在" || echo "✘ 缺失"
echo -n "    3900 端口监听     → "
ss -lnt 2>/dev/null | grep ":3900 " || echo "未监听"

echo "--- 完成 ---"
