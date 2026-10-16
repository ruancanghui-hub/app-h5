#!/usr/bin/env bash
# 迁移 idea-website 80 → 3001，然后启动 Nginx 接管 80
# 带自动回滚：3001 未就绪则把应用还原回 80
set -uo pipefail

NODE_DIR=/root/.nvm/versions/node/v20.19.5/bin
export PATH="$NODE_DIR:$PATH"
NGX=/usr/local/nginx/sbin/nginx
APP_NAME=idea-website
APP_CWD=/code/idea-website
NEW_PORT=3001
OLD_PORT=80

start_app() {  # $1 = port
  pm2 start "$NODE_DIR/npm" --name "$APP_NAME" --cwd "$APP_CWD" -- run start -- -p "$1"
}

echo "=========== 迁移前状态 ==========="
pm2 list 2>/dev/null | grep -E "$APP_NAME" || true
ss -lnt 2>/dev/null | grep -E ":80 |:$NEW_PORT " || true
echo -n "  80 端口返回: "
curl -s --max-time 5 -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1/ || echo "无响应"

echo ""
echo "=========== 停止 $APP_NAME（释放 80）==========="
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
sleep 2
if ss -lnt 2>/dev/null | grep -q ":80 "; then
  echo "  [警告] 80 仍被占用："
  ss -lntp 2>/dev/null | grep ":80 " || true
else
  echo "  80 已释放"
fi

echo ""
echo "=========== 以 $NEW_PORT 端口重启 ==========="
start_app "$NEW_PORT" | tail -6

echo ""
echo "=========== 等待 $NEW_PORT 就绪 ==========="
READY=0
for i in $(seq 1 45); do
  if curl -s --max-time 3 -o /dev/null http://127.0.0.1:$NEW_PORT/ 2>/dev/null; then
    echo "  ✔ $NEW_PORT 就绪（耗时 ${i}s）"
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" != "1" ]; then
  echo "  ✘ $NEW_PORT 启动失败，开始回滚到 $OLD_PORT"
  pm2 logs "$APP_NAME" --lines 20 --nostream 2>/dev/null || true
  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
  start_app "$OLD_PORT" | tail -3
  echo "  已回滚，未启动 Nginx。"
  exit 1
fi

echo ""
echo "=========== 启动 Nginx ==========="
if pgrep -x nginx >/dev/null; then
  $NGX -s reload && echo "  nginx 已 reload"
else
  $NGX && echo "  nginx 已启动"
fi
sleep 2
echo -n "  nginx 进程数: "; pgrep -c -x nginx || echo 0

echo ""
echo "=========== 验证 ==========="
echo -n "  [主站] aigrowpark.com      → "
curl -s --max-time 10 -o /dev/null -w "HTTP %{http_code}\n" -H "Host: aigrowpark.com" http://127.0.0.1/
echo -n "  [主站] www.aigrowpark.com  → "
curl -s --max-time 10 -o /dev/null -w "HTTP %{http_code}\n" -H "Host: www.aigrowpark.com" http://127.0.0.1/
echo -n "  [H5]   h5.aigrowpark.com   → "
curl -s --max-time 10 -o /dev/null -w "HTTP %{http_code}\n" -H "Host: h5.aigrowpark.com" http://127.0.0.1/
echo "  主站页面标题:"
curl -s --max-time 10 -H "Host: aigrowpark.com" http://127.0.0.1/ | grep -oE "<title>[^<]*</title>" | head -1

echo ""
echo "=========== 持久化 ==========="
pm2 save >/dev/null 2>&1 && echo "  pm2 save 完成"

echo ""
echo "=========== 端口现状 ==========="
ss -lntp 2>/dev/null | grep -E ":80 |:443 |:$NEW_PORT " || true
