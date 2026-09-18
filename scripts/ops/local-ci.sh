#!/usr/bin/env bash
#
# local-ci.sh — 在 macOS（Mac mini）上运行主页项目的质量门禁。
#
# 等价于 .github/workflows/site-checks.yml，但跑在本地、不用排队、视觉基线在真实
# darwin 环境生成。设计原则：
#   - 只读：所有门禁都走 --check，不修改仓库文件；唯一例外是
#     --update-visual-baseline 模式（它会写入视觉基线快照）。
#     说明：Playwright 测试产物已被 .gitignore 忽略。
#   - 全量报告：单个门禁失败不中断后续门禁，最后统一汇总并给出退出码。
#
# 用法:
#   ./scripts/ops/local-ci.sh --quick              数据/结构/对比度/验收（约 1 分钟，适合定时跑）
#   ./scripts/ops/local-ci.sh --full               quick + npm audit + Playwright 三套 + Lighthouse
#   ./scripts/ops/local-ci.sh --full --pull        先 fast-forward 拉取 origin/main 再跑
#   ./scripts/ops/local-ci.sh --quick --no-install 跳过 npm ci
#   ./scripts/ops/local-ci.sh --full --skip-visual 跳过视觉基线（跨平台基线冲突时用）
#   ./scripts/ops/local-ci.sh --update-visual-baseline   生成/更新视口视觉基线（仅 macOS）
#
# 退出码: 0=全部通过  1=存在失败门禁  2=环境不满足
#
# 注意（重要）:
#   * 脚本强制 export CI=1，因为 playwright.config.js 在非 CI 环境下会使用
#     channel:'chrome'（要求本机安装 Google Chrome）；CI=1 时改用随包 chromium。
#   * Playwright 与 Lighthouse 都需要图形登录会话，因此 launchd 定时任务只跑 --quick，
#     --full 请在已登录的终端里手动跑。
#   * 兼容 macOS 自带的 bash 3.2（不使用关联数组等 bash 4+ 特性）。

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 2

MODE="quick"
DO_PULL=0
DO_INSTALL=1
SKIP_VISUAL=0

usage() { sed -n '4,18p' "${BASH_SOURCE[0]}" | sed 's/^#\{1,\} \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --quick) MODE="quick" ;;
    --full) MODE="full" ;;
    --pull) DO_PULL=1 ;;
    --no-install) DO_INSTALL=0 ;;
    --skip-visual) SKIP_VISUAL=1 ;;
    --update-visual-baseline) MODE="baseline" ;;
    -h|--help) usage; exit 0 ;;
    *) printf '未知参数: %s\n\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if [ -t 1 ]; then
  C_OK=$'\033[32m'; C_NO=$'\033[31m'; C_WARN=$'\033[33m'; C_DIM=$'\033[2m'; C_B=$'\033[1m'; C_END=$'\033[0m'
else
  C_OK=""; C_NO=""; C_WARN=""; C_DIM=""; C_B=""; C_END=""
fi

LOG_DIR="${HOME}/Library/Logs/homepage-ci"
mkdir -p "$LOG_DIR" || exit 2
RUN_LOG="${LOG_DIR}/local-ci-$(date +%Y%m%d-%H%M%S).log"
: > "$RUN_LOG"

STEP_NO=0
PASS_N=0
FAIL_N=0
WARN_N=0
FAIL_SUMMARY=""

log() { printf '%s\n' "$*"; printf '%s\n' "$*" >>"$RUN_LOG"; }

run_step() {
  local name="$1"; shift
  STEP_NO=$((STEP_NO + 1))
  log ""
  log "${C_DIM}── [${STEP_NO}] ${name}${C_END}"
  local start=$SECONDS
  local rc=0
  "$@" >>"$RUN_LOG" 2>&1 || rc=$?
  local dur=$((SECONDS - start))
  if [ "$rc" -eq 0 ]; then
    PASS_N=$((PASS_N + 1))
    log "   ${C_OK}✔ PASS${C_END}  ${name}  ${C_DIM}(${dur}s)${C_END}"
  else
    FAIL_N=$((FAIL_N + 1))
    FAIL_SUMMARY="${FAIL_SUMMARY}  - ${name} (exit ${rc})
"
    log "   ${C_NO}✘ FAIL${C_END}  ${name}  ${C_DIM}(exit ${rc}, ${dur}s)${C_END}"
    log "   ${C_DIM}最近输出:${C_END}"
    tail -n 25 "$RUN_LOG" | sed 's/^/     /'
  fi
  return 0
}

warn() {
  WARN_N=$((WARN_N + 1))
  log "   ${C_WARN}⚠ $1${C_END}"
}

# ---------------------------------------------------------------- 环境预检

log "${C_B}主页门禁 · $(date '+%Y-%m-%d %H:%M:%S')${C_END}"
log "${C_DIM}仓库: ${ROOT}   模式: ${MODE}${C_END}"

if ! command -v node >/dev/null 2>&1; then
  log "${C_NO}缺少 node。建议: brew install node@22${C_END}"
  exit 2
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
  log "${C_NO}Node 版本过低（$(node -v)），需要 >= 20（CI 使用 22）${C_END}"
  exit 2
fi
if ! command -v git >/dev/null 2>&1; then
  log "${C_NO}缺少 git。请先运行: xcode-select --install${C_END}"
  exit 2
fi

# playwright.config.js 在非 CI 环境下要求本机 Google Chrome，强制 CI=1 使用随包 chromium。
export CI=1

if [ "$MODE" = "full" ]; then
  if ! command -v python3 >/dev/null 2>&1; then
    warn "未找到 python3，Lighthouse 步骤预计会失败（xcode-select --install 或 brew install python）"
  fi
fi

if [ "$MODE" = "full" ] || [ "$MODE" = "baseline" ]; then
  if ! ls "$HOME"/Library/Caches/ms-playwright/chromium-* >/dev/null 2>&1; then
    log "${C_DIM}未检测到 Playwright chromium，正在安装…${C_END}"
    npx playwright install chromium >>"$RUN_LOG" 2>&1 || warn "npx playwright install chromium 失败"
  fi
fi

# ---------------------------------------------------------------- 拉取远端

if [ "$DO_PULL" = "1" ]; then
  STEP_NO=$((STEP_NO + 1))
  log ""
  log "${C_DIM}── [${STEP_NO}] git pull（fast-forward only）${C_END}"
  if [ -n "$(git status --porcelain)" ]; then
    warn "工作区不干净，跳过 pull（避免覆盖本地改动）"
  elif git fetch --prune origin >>"$RUN_LOG" 2>&1 && git merge --ff-only origin/main >>"$RUN_LOG" 2>&1; then
    PASS_N=$((PASS_N + 1))
    log "   ${C_OK}✔ PASS${C_END}  已同步到 $(git rev-parse --short HEAD)"
  else
    FAIL_N=$((FAIL_N + 1))
    FAIL_SUMMARY="${FAIL_SUMMARY}  - git pull (无法 fast-forward)
"
    log "   ${C_NO}✘ FAIL${C_END}  pull 失败（本地与远端可能已分叉），最近输出:"
    tail -n 15 "$RUN_LOG" | sed 's/^/     /'
  fi
fi

# ---------------------------------------------------------------- 依赖

needs_npm_ci() {
  [ -d node_modules ] || return 0
  [ -f node_modules/.package-lock.json ] || return 0
  [ package-lock.json -nt node_modules/.package-lock.json ] && return 0
  return 1
}

if [ "$DO_INSTALL" = "0" ]; then
  log "${C_DIM}已指定 --no-install，跳过依赖安装${C_END}"
elif needs_npm_ci; then
  run_step "npm ci" npm ci --no-audit --no-fund
else
  log "${C_DIM}依赖已是最新，跳过 npm ci${C_END}"
fi

# ---------------------------------------------------------------- 门禁

if [ "$MODE" = "baseline" ]; then
  # 基线模式：唯一目的是在真实 darwin 环境生成视口基线快照。
  # 用 -g 只跑这一个用例，避免 --update-snapshots 顺带改写其它已通过的基线。
  export UPDATE_MAIN_BASELINE=1
  log "${C_DIM}基线模式：只生成视觉基线，不跑其它门禁${C_END}"
  run_step "生成视口视觉基线（--update-snapshots）" npx playwright test tests/ui/visual.spec.js --update-snapshots -g "Homepage viewport baseline"

  log ""
  log "${C_B}═══ 汇总${C_END}  通过 ${PASS_N} / 失败 ${FAIL_N} / 警告 ${WARN_N}"
  log "  日志: ${RUN_LOG}"
  if [ "$FAIL_N" -gt 0 ]; then
    log "${C_NO}基线生成失败，请查看日志。${C_END}"
    exit 1
  fi
  log "${C_OK}视口基线已生成${C_END}。如快照文件有变化，请提交："
  log "  git add tests/ui/visual.spec.js-snapshots"
  log "  git commit -m \"test(visual): 生成 darwin 视口视觉基线\""
  exit 0
fi

run_step "check:syntax（JS 语法）" npm --silent run check:syntax
run_step "htmlhint（HTML 语法）" bash -c "npx --yes htmlhint index.html && find papers -name '*.html' -print0 | xargs -0 npx --yes htmlhint"
run_step "build-site-data --check" node scripts/build-site-data.js --check
run_step "generate-paper-toc --check" node scripts/generate-paper-toc.js --check
run_step "sync-paper-seo --check" node scripts/sync-paper-seo.js --check
run_step "validate-site" node scripts/validate-site.js
run_step "check:contrast（WCAG AA）" npm --silent run check:contrast
run_step "acceptance-check" node scripts/acceptance-check.js

if [ "$MODE" = "full" ]; then
  run_step "npm audit（high）" npm audit --audit-level=high
  if command -v lychee >/dev/null 2>&1; then
    run_step "lychee（链接检查）" lychee --no-progress --accept 200,429 --exclude-loopback \
      --max-redirects 5 --timeout 20 --max-concurrency 6 \
      --exclude 'https://scholar.google.com/.*' --exclude 'https://www.researchgate.net/.*' \
      --exclude 'https://kns.cnki.net/.*' --exclude 'https://link.cnki.net/.*' \
      --exclude 'https://cdn.jsdelivr.net/.*' --exclude 'https://www.sciencedirect.com/.*' \
      index.html papers
  else
    warn "未安装 lychee，跳过链接检查（brew install lychee 可补齐 CI 的 link-check job）"
  fi
  if [ "$SKIP_VISUAL" = "1" ]; then
    # test:ui 的 testDir 是 tests/ui，会跑全部三个 spec；跳过视觉时只跑回归 + 无障碍。
    run_step "test:ui:core（回归 + 无障碍）" npm --silent run test:ui:core
  else
    run_step "test:ui（回归 + 无障碍 + 视觉，全部 spec）" npm --silent run test:ui
  fi
  run_step "lighthouse（性能/无障碍门禁）" npm --silent run lighthouse
fi

# ---------------------------------------------------------------- 汇总

log ""
log "${C_B}═══ 汇总${C_END}  通过 ${PASS_N} / 失败 ${FAIL_N} / 警告 ${WARN_N}"
log "  日志: ${RUN_LOG}"

if [ "$FAIL_N" -gt 0 ]; then
  log "${C_NO}失败门禁:${C_END}"
  printf '%s' "$FAIL_SUMMARY" | tee -a "$RUN_LOG"
  exit 1
fi

log "${C_OK}全部通过${C_END}"
exit 0