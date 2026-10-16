#!/usr/bin/env bash
# 为现有 nginx 补上 SSL 模块：编译同版本、同 prefix 的二进制后原地替换
# 全程备份旧二进制，失败可立即回滚
set -euo pipefail

NGX_VER=1.25.3
PREFIX=/usr/local/nginx
SBIN=$PREFIX/sbin/nginx
SRC_DIR=/usr/local/src/nginx-$NGX_VER
STAMP=$(date +%Y%m%d-%H%M%S)
BK=/root/deploy-backup/nginx-binary-$STAMP
JOBS=$(nproc)

echo "=========== 1. 安装编译依赖 ==========="
dnf install -y gcc make pcre-devel zlib-devel openssl-devel 2>&1 | tail -5

echo ""
echo "=========== 2. 备份现有二进制 ==========="
mkdir -p "$BK"
cp -a "$SBIN" "$BK/nginx.original"
echo "  已备份 → $BK/nginx.original"
ls -la "$BK"

echo ""
echo "=========== 3. 下载 nginx $NGX_VER 源码 ==========="
mkdir -p /usr/local/src
cd /usr/local/src
TARBALL=nginx-$NGX_VER.tar.gz
if [ ! -s "$TARBALL" ]; then
  ok=0
  for url in \
    "https://nginx.org/download/$TARBALL" \
    "https://mirrors.cloud.tencent.com/nginx/$TARBALL" \
    "https://mirrors.aliyun.com/nginx/$TARBALL" ; do
    echo "  尝试: $url"
    if curl -fsSL --max-time 120 -o "$TARBALL" "$url"; then ok=1; echo "  ✔ 下载成功"; break; fi
  done
  [ "$ok" = "1" ] || { echo "  ✘ 所有源均下载失败"; exit 1; }
fi
ls -lh "$TARBALL"

echo ""
echo "=========== 4. 解压 ==========="
rm -rf "$SRC_DIR"
tar -xzf "$TARBALL"
ls -d "$SRC_DIR"

echo ""
echo "=========== 5. configure（保持原 prefix，补上 SSL 相关模块）==========="
cd "$SRC_DIR"
./configure \
  --prefix=$PREFIX \
  --with-http_ssl_module \
  --with-http_v2_module \
  --with-http_gzip_static_module \
  --with-http_realip_module \
  --with-http_stub_status_module \
  --with-threads \
  --with-file-aio 2>&1 | tail -12

echo ""
echo "=========== 6. 编译 ==========="
make -j"$JOBS" 2>&1 | tail -6

echo ""
echo "=========== 7. 校验新二进制 ==========="
"$SRC_DIR/objs/nginx" -v
"$SRC_DIR/objs/nginx" -V 2>&1 | tr ' ' '\n' | grep -E 'with-http_ssl|with-http_v2' || echo "  [警告] 未找到 ssl/v2 模块"

echo ""
echo "=========== 8. 用新二进制试解析线上配置 ==========="
"$SRC_DIR/objs/nginx" -t -p $PREFIX/ -c $PREFIX/conf/nginx.conf

echo ""
echo "=========== 9. 替换二进制 ==========="
cp -f "$SRC_DIR/objs/nginx" "$SBIN"
chmod 755 "$SBIN"
cp -a "$SBIN" "$BK/nginx.new"
"$SBIN" -v

echo ""
echo "=========== 10. 重启 nginx（短暂中断）==========="
"$SBIN" -s stop 2>/dev/null || true
sleep 1
# 确保端口释放
for i in $(seq 1 10); do ss -lnt | grep -q ':80 ' || break; sleep 1; done
"$SBIN"
sleep 2
echo -n "  nginx 进程数: "; pgrep -c -x nginx || echo 0

echo ""
echo "=========== 11. 验证服务 ==========="
echo -n "  [主站] aigrowpark.com    → "
curl -s --max-time 10 -o /dev/null -w "HTTP %{http_code}\n" -H "Host: aigrowpark.com" http://127.0.0.1/
echo -n "  [H5]   h5.aigrowpark.com → "
curl -s --max-time 10 -o /dev/null -w "HTTP %{http_code}\n" -H "Host: h5.aigrowpark.com" http://127.0.0.1/
echo -n "  SSL 能力检测: "
"$SBIN" -t -c /tmp/ssltest/t.conf 2>&1 | tail -1

echo ""
echo "=========== 完成 ==========="
echo "  旧二进制备份: $BK/nginx.original"
echo "  回滚命令:     cp -a $BK/nginx.original $SBIN && $SBIN -s stop && $SBIN"
