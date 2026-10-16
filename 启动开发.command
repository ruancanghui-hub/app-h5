#!/bin/zsh
set -euo pipefail

cd "$(dirname "$0")"

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "$HOME/.nvm/nvm.sh"
fi

echo "项目目录: $(pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 node，请先安装 Node.js"
  read -r "?按回车关闭..."
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "未找到 pnpm，正在通过 corepack 启用..."
  corepack enable
  corepack prepare pnpm@10.6.1 --activate
fi

if [[ ! -d node_modules ]]; then
  echo "首次启动，正在安装依赖..."
  pnpm install
fi

# 若本项目旧的 Vite 仍占用端口，先清掉，保证默认 5173
for port in 5173 5174 5175; do
  pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "${pids:-}" ]]; then
    echo "释放端口 $port ..."
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
  fi
done
sleep 0.4

LOG="$(mktemp -t app-h5-dev)"
cleanup() {
  if [[ -n "${TAIL_PID:-}" ]] && kill -0 "$TAIL_PID" 2>/dev/null; then
    kill "$TAIL_PID" 2>/dev/null || true
  fi
  if [[ -n "${DEV_PID:-}" ]] && kill -0 "$DEV_PID" 2>/dev/null; then
    kill "$DEV_PID" 2>/dev/null || true
    wait "$DEV_PID" 2>/dev/null || true
  fi
  rm -f "$LOG"
}
trap cleanup EXIT INT TERM

echo "启动开发服务..."
pnpm dev >"$LOG" 2>&1 &
DEV_PID=$!

BASE=""
for _ in {1..80}; do
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    echo "启动失败，日志如下："
    cat "$LOG"
    read -r "?按回车关闭..."
    exit 1
  fi
  if grep -Eq 'Local:\s+http://localhost:[0-9]+/' "$LOG" 2>/dev/null; then
    BASE=$(grep -Eo 'http://localhost:[0-9]+' "$LOG" | head -1)
    break
  fi
  sleep 0.25
done

if [[ -z "$BASE" ]]; then
  echo "等待服务就绪超时，日志如下："
  cat "$LOG"
  read -r "?按回车关闭..."
  exit 1
fi

CLIENT_URL="${BASE}/#/feedback"
OPS_URL="${BASE}/admin.html"

echo ""
echo "服务已就绪: $BASE"
echo "客户端:   $CLIENT_URL"
echo "运营后台: $OPS_URL"
echo ""
echo "正在打开浏览器（关闭本窗口将停止开发服务）..."
echo "----------------------------------------"
tail -n +1 -f "$LOG" &
TAIL_PID=$!

open "$CLIENT_URL"
sleep 0.3
open "$OPS_URL"

set +e
wait "$DEV_PID"
status=$?
set -e

if [[ $status -ne 0 ]]; then
  echo "服务已退出，退出码: $status"
  read -r "?按回车关闭..."
fi
exit $status
