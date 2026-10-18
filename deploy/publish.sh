#!/usr/bin/env bash
# 一键发布 App H5：客户端页 + 运营后台 + API 后端
#
# 用法:
#   SSH_PW='<服务器root密码>' bash deploy/publish.sh
#
# 首次部署运营后台前，需先执行一次：
#   SSH_PW='<密码>' bash deploy/publish.sh --init-ops
#   （安装 nginx 配置与访问口令，之后日常发版不需要再加这个参数）
set -euo pipefail

PROJ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY="$PROJ/deploy"
cd "$PROJ"

HOST="${HOST:-139.199.211.157}"
SSH_USER="${SSH_USER:-root}"
WORK=/root/deploy-work
STAMP=$(date +%Y%m%d-%H%M%S)
INIT_OPS=0
[ "${1:-}" = "--init-ops" ] && INIT_OPS=1

: "${SSH_PW:?请先设置 SSH_PW 环境变量（服务器 root 密码）}"

unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy all_proxy ALL_PROXY
if [ -z "${SSH_BIND:-}" ]; then
  SSH_BIND="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi
export SSH_PW SSH_USER SSH_BIND

ssh_run() { expect "$DEPLOY/ssh-pass.exp" "$HOST" "$1"; }
scp_up()  { expect "$DEPLOY/scp-pass.exp" "$1" "$SSH_USER@$HOST" "$2"; }

echo "=========== 1. 构建前端（双入口）==========="
export PATH="/opt/homebrew/bin:$PATH"
# 注意：本机 pnpm 跑在 Rosetta x64 node 下，而 node_modules 是 arm64，
# 必须用 Homebrew 原生 arm64 node 执行，否则报 @rollup/rollup-darwin-x64 缺失
/opt/homebrew/bin/node "$HOME/.local/lib/node_modules/pnpm/bin/pnpm.cjs" build

echo ""
echo "=========== 2. 打包 API 后端 ==========="
ESB=$(ls -d node_modules/.pnpm/@esbuild+darwin-*/node_modules/@esbuild/darwin-*/bin/esbuild 2>/dev/null | head -1 || true)
[ -n "$ESB" ] || { echo "✘ 找不到 esbuild 原生二进制"; exit 1; }
mkdir -p deploy/out
"$ESB" server/prod-server.ts --bundle --platform=node --target=node20 \
  --format=cjs --outfile=deploy/out/prod-server.cjs
"$ESB" server/identity/identity-server.ts --bundle --platform=node --target=node20 \
  --format=cjs --outfile=deploy/out/identity-server.cjs

echo ""
echo "=========== 3. 上传产物 ==========="
echo "  发布标记: $STAMP"
ssh_run "mkdir -p $WORK"
scp_up "$PROJ/dist" "$WORK/dist-$STAMP"
scp_up "$DEPLOY/out/prod-server.cjs" "$WORK/"
scp_up "$DEPLOY/out/identity-server.cjs" "$WORK/"
scp_up "$DEPLOY/remote/api-ecosystem.json" "$WORK/"
scp_up "$DEPLOY/remote/deploy-site.sh" "$WORK/"

echo ""
echo "=========== 4. 远端部署 ==========="
ssh_run "bash $WORK/deploy-site.sh $STAMP"

# 运营后台的 nginx 配置与口令只需安装一次。
# 必须放在 deploy-site.sh 之后：install-ops.sh 会通过 nginx 验证 /api/health，
# 需要后端已经在跑（首次部署时后端正是由 deploy-site.sh 拉起的）。
if [ "$INIT_OPS" = "1" ]; then
  echo ""
  echo "=========== 4b. 安装运营后台配置（仅首次）==========="
  scp_up "$DEPLOY/remote/install-ops.sh" "$WORK/"
  scp_up "$DEPLOY/remote/sites/h5.aigrowpark.com.conf" "$WORK/"
  ssh_run "bash $WORK/install-ops.sh"
fi

echo ""
echo "=========== 5. 外网验证 ==========="
curl -s -o /dev/null -w "  客户端首页   → HTTP %{http_code}\n" --max-time 20 https://h5.aigrowpark.com/
curl -s -o /dev/null -w "  运营页(未认证) → HTTP %{http_code}（期望 401）\n" --max-time 20 https://h5.aigrowpark.com/admin
curl -s -o /dev/null -w "  主站         → HTTP %{http_code}\n" --max-time 20 http://aigrowpark.com/

echo ""
echo "=========== 完成 ==========="
echo "  客户端: https://h5.aigrowpark.com/"
echo "  运营页: https://h5.aigrowpark.com/admin"
echo "  版本备份: /root/deploy-backup/site-$STAMP"
