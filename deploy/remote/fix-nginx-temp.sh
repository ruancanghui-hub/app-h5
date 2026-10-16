#!/usr/bin/env bash
# 修复 nginx worker 无法写入临时目录，导致「大请求体 / 大响应」一律 500 的问题。
#
# 症状（三条同时出现即可确诊）：
#   1. 前端报 500，响应头 `content-type: text/html` + `server: nginx/x.y.z`（是 nginx 生成的错误页）
#   2. 后端应用日志里**完全没有**这条请求（请求根本没到后端）
#   3. error.log 出现：
#      open() "/usr/local/nginx/client_body_temp/0000000003" failed (13: Permission denied)
#
# 根因：nginx 编译时的临时目录默认位于 prefix 之下（/usr/local/nginx/*_temp），
#       而该 prefix 目录被硬化成 750 root:root，worker 进程（nobody）无法遍历，
#       于是 `client_body_temp` 等目录**虽然属主正确也进不去**。
#       表现为：小请求体走内存缓冲一切正常，一旦带文件上传或响应体较大就 500。
#
# 修复：只给 prefix 补一个 o+x（其他人可遍历）位。不递归、不改任何子目录。
#       conf / logs / sbin 仍为 750 root:root，对外不暴露。
set -euo pipefail

NGX=/usr/local/nginx/sbin/nginx
PREFIX=/usr/local/nginx
DOMAIN=h5.aigrowpark.com
STAMP=$(date +%Y%m%d-%H%M%S)
BK=/root/deploy-backup/nginx-perm-$STAMP
TEMP_DIRS=(client_body_temp proxy_temp fastcgi_temp uwsgi_temp scgi_temp)

NGX_USER=$(ps -eo user,args 2>/dev/null | awk '/[n]ginx: worker/ {print $1; exit}')
NGX_USER=${NGX_USER:-nobody}

echo "=========== 0. 修复前复现（含文件上传的大请求体）==========="
mkdir -p "$BK"
head -c 100000 /dev/urandom > /tmp/perm-probe.bin
printf '\x89PNG\r\n\x1a\n' > /tmp/perm-probe.png
cat /tmp/perm-probe.bin >> /tmp/perm-probe.png
PROBE_CONTENT="权限修复脚本自检：这是一条包含图片的探针反馈内容，用于验证大请求体落盘"

probe() {
  local label="$1"
  local meta
  meta=$(curl -sk --max-time 30 -o /tmp/perm-probe-body.txt \
           -w '%{http_code} | %{content_type} | %{size_download} bytes' \
           -H "Host: $DOMAIN" \
           -F "problemType=other" \
           -F "content=${PROBE_CONTENT}" \
           -F "contact=__perm_probe__" \
           -F "images=@/tmp/perm-probe.png;type=image/png" \
           "https://127.0.0.1/api/feedback" 2>&1 || true)
  echo "  [$label] $meta"
  echo -n "  [$label] 响应正文: "; head -c 160 /tmp/perm-probe-body.txt; echo
}
probe "修复前"

echo ""
echo "=========== 1. 现状与备份 ==========="
stat -c '%a %U:%G %n' "$PREFIX" | tee "$BK/perms-before.txt"
for d in "${TEMP_DIRS[@]}"; do
  stat -c '%a %U:%G %n' "$PREFIX/$d" 2>/dev/null >> "$BK/perms-before.txt" || echo "  (缺 $d)" >> "$BK/perms-before.txt"
done
cat "$BK/perms-before.txt" | sed 's/^/  /'
echo "  权限快照已存 → $BK/perms-before.txt"

echo ""
echo "=========== 2. 补上 prefix 的遍历位 ==========="
chmod o+x "$PREFIX"
echo -n "  之后: "; ls -ld "$PREFIX" | awk '{print $1, $3":"$4, $NF}'

echo ""
echo "=========== 3. 确保临时目录存在且属主正确 ==========="
for d in "${TEMP_DIRS[@]}"; do
  mkdir -p "$PREFIX/$d"
  chown "$NGX_USER" "$PREFIX/$d" 2>/dev/null || true
  chmod 700 "$PREFIX/$d"
  printf "  %-18s " "$d"; ls -ld "$PREFIX/$d" | awk '{print $1, $3":"$4}'
done

echo ""
echo "=========== 4. 实测 worker 用户能否写入 ==========="
FAIL=0
for d in "${TEMP_DIRS[@]}"; do
  printf "  %-18s " "$d"
  if runuser -u "$NGX_USER" -- sh -c "touch '$PREFIX/$d/.probe' && rm -f '$PREFIX/$d/.probe'" 2>/dev/null; then
    echo "✔ 可写"
  else
    echo "✘ 不可写"; FAIL=1
  fi
done
[ "$FAIL" = "0" ] || { echo "  存在不可写目录，请检查"; exit 1; }

echo ""
echo "=========== 5. 敏感子目录仍受保护（确认未连带放开）==========="
for d in conf logs sbin; do
  printf "  %-8s " "$d"; ls -ld "$PREFIX/$d" | awk '{print $1, $3":"$4}'
done
printf "  %-8s " "htpasswd"; ls -l /etc/nginx/htpasswd | awk '{print $1, $3":"$4}'

echo ""
echo "=========== 6. 校验并 reload ==========="
"$NGX" -t
"$NGX" -s reload
sleep 1
echo "  重载完成"

echo ""
echo "=========== 7. 修复后复现（同一请求）==========="
probe "修复后"

echo ""
echo "=========== 8. 清理探针数据 ==========="
python3 - <<'PY'
import json, os
p = "/www/wwwroot/h5.aigrowpark.com-api/data/feedbacks.json"
if os.path.exists(p):
    d = json.load(open(p))
    n = len(d)
    d = [x for x in d if x.get("contact") != "__perm_probe__"]
    json.dump(d, open(p, "w"), ensure_ascii=False, indent=2)
    print(f"  清理前 {n} 条 → 清理后 {len(d)} 条")
else:
    print("  (数据文件不存在，跳过)")
PY
UP=/www/wwwroot/h5.aigrowpark.com-api/data/uploads
if [ -d "$UP" ]; then
  find "$UP" -name '*perm*' -delete 2>/dev/null || true
fi

rm -f /tmp/perm-probe.bin /tmp/perm-probe.png /tmp/perm-probe-body.txt

echo ""
echo "=========== 完成 ==========="
echo "  权限备份: $BK"
echo "  回滚: 参考 $BK/perms-before.txt 逐条 chmod 还原"
