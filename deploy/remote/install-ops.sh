#!/usr/bin/env bash
# 安装运营后台所需的 Nginx 配置与访问口令
#
# 环境变量：
#   OPS_USER  运营页用户名，默认 admin
#   OPS_PW    运营页密码，不传则随机生成 16 位并在输出中打印
#
# 前置：h5.aigrowpark.com.conf 已上传到 /root/deploy-work/
set -euo pipefail

NGX=/usr/local/nginx/sbin/nginx
SITES=/usr/local/nginx/conf/sites
DOMAIN=h5.aigrowpark.com
HTPASSWD=/etc/nginx/htpasswd
SRC=/root/deploy-work/$DOMAIN.conf
OPS_USER=${OPS_USER:-admin}
STAMP=$(date +%Y%m%d-%H%M%S)
BK=/root/deploy-backup/ops-$STAMP

echo "=========== 1. 备份 ==========="
mkdir -p "$BK"
cp -a "$SITES/$DOMAIN.conf" "$BK/" 2>/dev/null && echo "  已备份站点配置 → $BK" || echo "  (原站点配置不存在，跳过)"
[ -f "$HTPASSWD" ] && cp -a "$HTPASSWD" "$BK/" && echo "  已备份口令文件 → $BK" || true

echo ""
echo "=========== 2. 生成访问口令 ==========="
if [ -n "${OPS_PW:-}" ]; then
  PW="$OPS_PW"
else
  # 注意：不要用 `tr ... < /dev/urandom | head -c 16`。
  # head 读够就退出会让 tr 收到 SIGPIPE（退出码 141），
  # 在 set -o pipefail 下会被判定为失败并触发 set -e 中断脚本。
  PW=$(openssl rand -base64 18 | tr -d '\n/=+')
fi
HASH=$(openssl passwd -apr1 "$PW")
[ -n "$HASH" ] || { echo "  ✘ 口令哈希生成失败"; exit 1; }

touch "$HTPASSWD"
grep -v "^${OPS_USER}:" "$HTPASSWD" > "$HTPASSWD.tmp" 2>/dev/null || true
mv "$HTPASSWD.tmp" "$HTPASSWD"
echo "${OPS_USER}:${HASH}" >> "$HTPASSWD"

# 权限很关键：nginx master 以 root 运行、worker 以 nobody 运行。
# 注意这里踩过一次坑：文件权限改了还不够，**父目录也必须可被 worker 遍历**。
# /usr/local/nginx/conf 是 750 root:root，worker 进不去，会报
#   open() "...htpasswd" failed (13: Permission denied)  然后返回 500。
# 所以口令文件放在 /etc/nginx（755）而不是 /usr/local/nginx/conf。
NGX_USER=$(ps -eo user,args 2>/dev/null | awk '/[n]ginx: worker/ {print $1; exit}')
NGX_USER=${NGX_USER:-nobody}
mkdir -p "$(dirname "$HTPASSWD")"
if chown "$NGX_USER" "$HTPASSWD" 2>/dev/null; then
  chmod 640 "$HTPASSWD"
else
  chmod 644 "$HTPASSWD"
fi
echo "  用户 ${OPS_USER} 已写入 $HTPASSWD（属主 ${NGX_USER}）"

# 实测 worker 用户能否读出口令文件，读不到就当场报警（否则线上表现为 500）
READ_OK=0
if command -v runuser >/dev/null 2>&1; then
  runuser -u "$NGX_USER" -- head -c 1 "$HTPASSWD" >/dev/null 2>&1 && READ_OK=1
else
  su -s /bin/sh -c "head -c 1 '$HTPASSWD' >/dev/null 2>&1" "$NGX_USER" && READ_OK=1
fi
if [ "$READ_OK" = "1" ]; then
  echo "  ✔ 已确认 $NGX_USER 可读取该文件"
else
  echo "  ✘ $HTPASSWD 无法被 $NGX_USER 读取，认证会返回 500，请检查父目录权限"
  exit 1
fi

# 清理旧位置遗留的口令文件
[ -f /usr/local/nginx/conf/htpasswd ] && rm -f /usr/local/nginx/conf/htpasswd && echo "  已清理旧口令文件"

echo ""
echo "=========== 3. 安装站点配置 ==========="
[ -f "$SRC" ] || { echo "  ✘ 找不到 $SRC"; exit 1; }
cp -f "$SRC" "$SITES/$DOMAIN.conf"
echo "  已安装 $SITES/$DOMAIN.conf"

echo ""
echo "=========== 4. 校验并重载 ==========="
"$NGX" -t
"$NGX" -s reload
sleep 1
echo "  重载完成"

echo ""
echo "=========== 5. 本地验证 ==========="
echo -n "  运营页 /admin 未带凭证 → "
curl -sk --max-time 10 -o /dev/null -w "HTTP %{http_code}\n" -H "Host: $DOMAIN" https://127.0.0.1/admin

echo -n "  运营页 /admin 带凭证   → "
curl -sk --max-time 10 -o /dev/null -w "HTTP %{http_code}\n" -u "${OPS_USER}:${PW}" -H "Host: $DOMAIN" https://127.0.0.1/admin

echo -n "  运营接口 未带凭证      → "
curl -sk --max-time 10 -o /dev/null -w "HTTP %{http_code}\n" -H "Host: $DOMAIN" https://127.0.0.1/api/ops/feedbacks

echo -n "  运营接口 带凭证        → "
curl -sk --max-time 10 -w "HTTP %{http_code} | " -u "${OPS_USER}:${PW}" -H "Host: $DOMAIN" https://127.0.0.1/api/ops/feedbacks; echo

echo -n "  后端健康检查           → "
curl -sk --max-time 10 -w "HTTP %{http_code} | " -H "Host: $DOMAIN" https://127.0.0.1/api/health; echo

echo ""
echo "=========== 完成 ==========="
echo "  运营页地址: https://$DOMAIN/admin"
echo "  用户名:     $OPS_USER"
echo "  密码:       $PW"
echo "  配置备份:   $BK"
