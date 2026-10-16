#!/usr/bin/env bash
# App H5 部署脚本 —— 腾讯云轻量应用服务器 (宝塔 / Nginx)
#
# 用法:
#   ./deploy.sh
#   SSH_KEY=~/.ssh/tencent.pem ./deploy.sh
#   DOMAIN=xxx.com REMOTE_ROOT=/www/wwwroot/xxx.com ./deploy.sh
#
set -euo pipefail

# ===== 配置（均可用环境变量覆盖）=====
SERVER_HOST="${SERVER_HOST:-139.199.211.157}"
SERVER_USER="${SERVER_USER:-root}"
SSH_KEY="${SSH_KEY:-}"                        # 私钥路径；留空则走默认 ssh / 密码
DOMAIN="${DOMAIN:-aigrowpark.com}"
REMOTE_ROOT="${REMOTE_ROOT:-/www/wwwroot/aigrowpark.com}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"

# ===== 路径 =====
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$PROJECT_DIR/dist"
STAMP="$(date +%Y%m%d-%H%M%S)"
UPLOAD_DIR="${REMOTE_ROOT}.staging-${STAMP}"   # 服务器上的临时落地目录

# ===== SSH 参数 =====
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -o ServerAliveInterval=15)
[[ -n "$SSH_KEY" ]] && SSH_OPTS+=(-i "$SSH_KEY")
SSH_CMD=(ssh "${SSH_OPTS[@]}" "$SERVER_USER@$SERVER_HOST")
RSYNC_RSH="ssh ${SSH_OPTS[*]}"

log() { printf '\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m[ERROR] %s\033[0m\n' "$*" >&2; exit 1; }

# ---------- 1. 本地构建 ----------
log "1/5 本地构建"
cd "$PROJECT_DIR"

# 本机 pnpm 默认跑在 Rosetta x64 的 node 下，而依赖装的是 arm64 版 rollup，
# 不显式指定 arm64 node 会报 "Cannot find module '@rollup/rollup-darwin-x64'"。
PNPM_JS="$(node -e "try{console.log(require.resolve('pnpm/bin/pnpm.cjs'))}catch(e){process.exit(1)}" 2>/dev/null || true)"
PNPM_JS="${PNPM_JS:-/Users/orico/.local/lib/node_modules/pnpm/bin/pnpm.cjs}"

if [[ "$(uname -m)" == "arm64" && -x /opt/homebrew/bin/node ]]; then
  /opt/homebrew/bin/node "$PNPM_JS" build
else
  node "$PNPM_JS" build
fi

[[ -f "$DIST_DIR/index.html" ]] || die "构建产物缺失：$DIST_DIR/index.html"

# ---------- 2. 连通性预检 ----------
log "2/5 检查 SSH 连通性"
"${SSH_CMD[@]}" 'echo SSH_OK' >/dev/null 2>&1 \
  || die "SSH 登录失败。请确认：① 私钥/密码正确 ② 本机代理（TUN/VPN）已关闭 ③ 服务器未限制来源 IP"

# ---------- 3. 上传到临时目录 ----------
log "3/5 上传文件到 $UPLOAD_DIR"
"${SSH_CMD[@]}" "rm -rf '$UPLOAD_DIR' && mkdir -p '$UPLOAD_DIR'"
rsync -az --delete -e "$RSYNC_RSH" \
  "$DIST_DIR/" "$SERVER_USER@$SERVER_HOST:$UPLOAD_DIR/"

# ---------- 4. 原子切换 + 历史版本保留 ----------
log "4/5 原子切换发布"
"${SSH_CMD[@]}" bash -s -- "$REMOTE_ROOT" "$UPLOAD_DIR" "$STAMP" "$KEEP_RELEASES" <<'REMOTE'
set -euo pipefail
ROOT="$1"; UPLOAD="$2"; STAMP="$3"; KEEP="$4"
RELEASES="$ROOT/releases"
mkdir -p "$RELEASES"

# 归档当前线上版本
if [[ -d "$ROOT" && ! "$ROOT" =~ ^.*\.staging- ]] && [[ -n "$(ls -A "$ROOT" 2>/dev/null || true)" ]]; then
  mkdir -p "$RELEASES/$STAMP-old"
  # 只搬业务文件，避免把 releases 自身搬进去
  for f in "$ROOT"/*; do
    [[ "$(basename "$f")" == "releases" ]] && continue
    mv "$f" "$RELEASES/$STAMP-old/" 2>/dev/null || true
  done
fi

mkdir -p "$ROOT"
# 把新版本内容同步进站点根目录（保留 releases 子目录）
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete --exclude 'releases' "$UPLOAD/" "$ROOT/"
else
  cp -R "$UPLOAD"/. "$ROOT"/
fi
rm -rf "$UPLOAD"

# 清理历史版本
if [[ -d "$RELEASES" ]]; then
  cd "$RELEASES"
  ls -1dt */ 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -rf
fi

echo "--- 当前版本 ---"
[[ -d "$RELEASES" ]] && ls -1dt "$RELEASES"/*/ 2>/dev/null | head -5
echo "--- 站点根目录 ---"
ls -1 "$ROOT" | head -10
REMOTE

# ---------- 5. 重载 Nginx ----------
log "5/5 重载 Nginx"
"${SSH_CMD[@]}" 'if command -v nginx >/dev/null 2>&1; then nginx -t && (systemctl reload nginx 2>/dev/null || nginx -s reload); else echo "未检测到 nginx，跳过"; fi'

log "部署完成"
echo "  访问: http://$DOMAIN/"
echo "  直连: http://$SERVER_HOST/"
