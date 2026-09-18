#!/usr/bin/env bash
#
# macmini-bootstrap.sh — 在 Mac mini 上一次性初始化"构建 / 门禁 / 内网预览"环境。
#
# 它做什么:
#   1. 预检依赖（git / node>=20 / python3 / brew / caddy）
#   2. 克隆或更新仓库到 --repo-dir（默认 ~/Sites/homepage）
#   3. npm ci + npx playwright install chromium
#   4. 渲染 Caddyfile 与两个 launchd plist 到目标位置（默认不加载服务）
#   5. 打印后续手动步骤
#
# 用法:
#   ./scripts/ops/macmini-bootstrap.sh                       # 只准备，不动服务
#   ./scripts/ops/macmini-bootstrap.sh --install-services    # 同时加载 launchd 服务
#   ./scripts/ops/macmini-bootstrap.sh --repo-dir ~/Sites/homepage --port 8080
#   ./scripts/ops/macmini-bootstrap.sh --repo-url https://github.com/Stork343/homepage.git
#
# 兼容 macOS 自带 bash 3.2。

set -uo pipefail

REPO_URL="git@github.com:Stork343/homepage.git"
REPO_DIR="${HOME}/Sites/homepage"
PORT="8080"
INSTALL_SERVICES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --repo-url) REPO_URL="${2:-}"; shift 2 ;;
    --repo-dir) REPO_DIR="${2:-}"; shift 2 ;;
    --port) PORT="${2:-}"; shift 2 ;;
    --install-services) INSTALL_SERVICES=1; shift ;;
    -h|--help) sed -n '3,20p' "${BASH_SOURCE[0]}" | sed 's/^#\{1,\} \{0,1\}//'; exit 0 ;;
    *) printf '未知参数: %s\n' "$1" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMPL_DIR="${SCRIPT_DIR}/macmini"
LAUNCH_AGENTS="${HOME}/Library/LaunchAgents"
LOG_DIR="${HOME}/Library/Logs/homepage-ci"
CADDY_CONFIG="${HOME}/Sites/homepage-preview.Caddyfile"

say()  { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✔\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m⚠\033[0m %s\n' "$*"; }
die()  { printf '  \033[31m✘\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || die "此脚本只用于 macOS。"

# ---------------------------------------------------------------- 1. 预检

say "1/5 预检依赖"

command -v git >/dev/null 2>&1 && ok "git $(git --version | awk '{print $3}')" \
  || die "缺少 git，请先运行: xcode-select --install"

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [ "${NODE_MAJOR:-0}" -ge 20 ] && ok "node $(node -v)" \
    || die "Node 版本过低（$(node -v)），需要 >= 20。建议: brew install node@22"
else
  die "缺少 node。建议: brew install node@22"
fi

command -v python3 >/dev/null 2>&1 && ok "python3（Lighthouse 需要）" \
  || warn "未找到 python3，Lighthouse 门禁会失败。可运行: xcode-select --install"

CADDY_BIN=""
if command -v caddy >/dev/null 2>&1; then
  CADDY_BIN="$(command -v caddy)"
  ok "caddy ${CADDY_BIN}"
else
  warn "未安装 caddy，内网预览服务将跳过。安装: brew install caddy"
fi

# ---------------------------------------------------------------- 2. 仓库

say "2/5 准备仓库 ${REPO_DIR}"

mkdir -p "$(dirname "$REPO_DIR")" || die "无法创建 $(dirname "$REPO_DIR")"
if [ -d "${REPO_DIR}/.git" ]; then
  if [ -n "$(git -C "$REPO_DIR" status --porcelain)" ]; then
    warn "工作区不干净，跳过更新（请先手动处理 ${REPO_DIR}）"
  else
    git -C "$REPO_DIR" fetch --prune origin >/dev/null 2>&1 \
      && git -C "$REPO_DIR" merge --ff-only origin/main >/dev/null 2>&1 \
      && ok "已更新到 $(git -C "$REPO_DIR" rev-parse --short HEAD)" \
      || warn "更新失败（可能非 fast-forward），保持现状"
  fi
else
  if [ -e "$REPO_DIR" ] && [ -n "$(ls -A "$REPO_DIR" 2>/dev/null)" ]; then
    die "${REPO_DIR} 已存在且非空，但不是 git 仓库，请手动处理"
  fi
  git clone "$REPO_URL" "$REPO_DIR" || die "克隆失败。若用 SSH 地址，请确认已配置 GitHub SSH key；或改用 --repo-url https://github.com/Stork343/homepage.git"
  ok "克隆完成"
fi

# ---------------------------------------------------------------- 3. 依赖

say "3/5 安装 Node 依赖与 Playwright chromium"

if [ ! -d "${REPO_DIR}/node_modules" ] \
   || [ ! -f "${REPO_DIR}/node_modules/.package-lock.json" ] \
   || [ "${REPO_DIR}/package-lock.json" -nt "${REPO_DIR}/node_modules/.package-lock.json" ]; then
  ( cd "$REPO_DIR" && npm ci --no-audit --no-fund ) && ok "npm ci 完成" || die "npm ci 失败"
else
  ok "node_modules 已是最新，跳过 npm ci"
fi

( cd "$REPO_DIR" && npx playwright install chromium ) && ok "Playwright chromium 就绪" \
  || warn "npx playwright install chromium 失败，--full 模式的 UI 测试会不可用"

# ---------------------------------------------------------------- 4. 渲染配置

say "4/5 渲染服务配置"

mkdir -p "$LAUNCH_AGENTS" "$LOG_DIR" "${HOME}/Sites" || die "无法创建配置目录"

render() {  # render <模板> <目标>
  local src="$1" dst="$2"
  sed -e "s|__REPO_DIR__|${REPO_DIR}|g" \
      -e "s|__LOG_DIR__|${LOG_DIR}|g" \
      -e "s|__PORT__|${PORT}|g" \
      -e "s|__PATH__|${PATH}|g" \
      -e "s|__CADDY_BIN__|${CADDY_BIN}|g" \
      -e "s|__CADDY_CONFIG__|${CADDY_CONFIG}|g" \
      "$src" >"$dst" || return 1
  ok "$dst"
}

if [ -n "$CADDY_BIN" ]; then
  render "${TMPL_DIR}/Caddyfile.tmpl" "$CADDY_CONFIG" || die "Caddyfile 渲染失败"
  render "${TMPL_DIR}/com.houjian.homepage-preview.plist.tmpl" "${LAUNCH_AGENTS}/com.houjian.homepage-preview.plist" \
    || die "预览 plist 渲染失败"
else
  warn "跳过 Caddyfile 与预览 plist（caddy 未安装）"
fi

render "${TMPL_DIR}/com.houjian.homepage-ci.plist.tmpl" "${LAUNCH_AGENTS}/com.houjian.homepage-ci.plist" \
  || die "CI plist 渲染失败"

# ---------------------------------------------------------------- 5. 服务

say "5/5 服务"

if [ "$INSTALL_SERVICES" = "1" ]; then
  load_agent() {  # load_agent <label> <plist>
    local label="$1" plist="$2"
    launchctl bootout "gui/${UID}/${label}" >/dev/null 2>&1 || true
    if launchctl bootstrap "gui/${UID}" "$plist" >/dev/null 2>&1; then
      ok "已加载 ${label}"
    else
      warn "加载 ${label} 失败。若无图形登录会话，请改用: launchctl bootstrap user/${UID} ${plist}"
    fi
  }
  load_agent "com.houjian.homepage-ci" "${LAUNCH_AGENTS}/com.houjian.homepage-ci.plist"
  [ -n "$CADDY_BIN" ] && load_agent "com.houjian.homepage-preview" "${LAUNCH_AGENTS}/com.houjian.homepage-preview.plist"
else
  warn "未加载服务（未指定 --install-services）。手动加载:"
  printf '      launchctl bootstrap gui/%s %s/com.houjian.homepage-ci.plist\n' "${UID}" "$LAUNCH_AGENTS"
  if [ -n "$CADDY_BIN" ]; then
    printf '      launchctl bootstrap gui/%s %s/com.houjian.homepage-preview.plist\n' "${UID}" "$LAUNCH_AGENTS"
  fi
fi

say "完成"
printf '  预览地址（局域网）: http://%s.local:%s/homepage/\n' "$(hostname -s)" "$PORT"
printf '  手动全量门禁      : %s/scripts/ops/local-ci.sh --full --pull\n' "$REPO_DIR"
printf '  日志目录          : %s\n' "$LOG_DIR"
printf '  详细说明          : %s/docs/MACMINI.md\n' "$REPO_DIR"