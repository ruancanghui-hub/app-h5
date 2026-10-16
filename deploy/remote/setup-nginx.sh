#!/usr/bin/env bash
# 服务器侧一次性环境准备（幂等）
# 作用：备份现有配置 → 写入 sites 配置 → 把 include 插入 nginx.conf
set -euo pipefail

NGX_CONF=/usr/local/nginx/conf/nginx.conf
SITES_DIR=/usr/local/nginx/conf/sites
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=/root/deploy-backup/$STAMP

echo "===[ 1. 备份现有配置 ]==="
mkdir -p "$BACKUP_DIR"
cp -a "$NGX_CONF" "$BACKUP_DIR/nginx.conf.bak"
mkdir -p /root/.pm2 && cp -a /root/.pm2/dump.pm2 "$BACKUP_DIR/dump.pm2.bak" 2>/dev/null || echo "  (无 dump.pm2，跳过)"
echo "  备份目录: $BACKUP_DIR"
ls -la "$BACKUP_DIR"

echo "===[ 2. 准备日志目录 ]==="
mkdir -p /usr/local/nginx/logs

echo "===[ 3. 站点目录 ]==="
mkdir -p /www/wwwroot/h5.aigrowpark.com

echo "===[ 4. 写入 sites 配置 ]==="
ls -la "$SITES_DIR"

echo "===[ 5. 将 include 插入 nginx.conf ]==="
python3 - "$NGX_CONF" <<'PYEOF'
import sys, re, shutil
path = sys.argv[1]
src = open(path, encoding='utf-8').read()

marker = 'include sites/*.conf;'
if marker in src:
    print("  已存在 include，跳过")
    sys.exit(0)

# 在 http { 之后的第一行 include mime.types; 后面插入
lines = src.splitlines(keepends=True)
out, inserted, in_http = [], False, False
for line in lines:
    out.append(line)
    if re.match(r'\s*http\s*\{', line):
        in_http = True
        continue
    if in_http and not inserted and re.match(r'\s*include\s+mime\.types;', line):
        out.append('    include       sites/*.conf;\n')
        inserted = True

if not inserted:
    print("  [警告] 未找到插入点，改为在 http 块起始处插入", file=sys.stderr)
    sys.exit(2)

open(path, 'w', encoding='utf-8').write(''.join(out))
print("  已插入: include sites/*.conf;")
PYEOF

echo "===[ 6. 校验 nginx 配置 ]==="
/usr/local/nginx/sbin/nginx -t

echo ""
echo "准备完成。备份位于: $BACKUP_DIR"
