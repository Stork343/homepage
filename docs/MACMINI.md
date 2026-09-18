# Mac mini 部署手册（方案 A：构建 / 门禁 / 内网预览）

## 1. 目标与边界

**做什么**

- Mac mini 常驻承担：仓库同步、数据/结构门禁、Playwright 全量 UI 测试、Lighthouse 门禁、内网预览。
- 相当于把 `.github/workflows/site-checks.yml` 搬到本地跑，不用排队、不受 GitHub 可用性影响。

**不做什么**

- **公网入口仍然是 GitHub Pages**（`https://stork343.github.io/homepage/`）。
  原因：纯静态站在 Pages 上免运维、自带 CDN 与证书；而且该 URL 已进入 sitemap、
  搜索引擎索引与合作者的收藏夹，换域名会作废这批链接资产。
- mini 不提供任何公网服务，不开放端口映射，因此不受家庭宽带上行与校园网政策约束。

**顺带收益**

- 视觉基线（`tests/ui/visual.spec.js`）只在 darwin 上运行，mini 是真实 darwin 环境，
  比 CI 的 `macos-latest` runner 更贴近你实际看到的效果。
- 可把 `main` 改成单写者：目前 `auto-sync-generated.yml` 会用 bot 回写 `main`，
  与你的手工推送并行（所以才有 `concurrency: main-writers`）。构建搬到 mini 后可以去掉这个机器人。

## 2. 架构

```
Windows 主力机 (D:\OneDrive\RUC\homepage)          Mac mini (~/Sites/homepage)
        │                                                  │
        │  git push main                                   │  launchd 每小时
        ▼                                                  ▼
   GitHub (Stork343/homepage)  ──── git fetch/ff-only ──► local-ci.sh --quick
        │                                                  │   ├─ build-site-data --check
        │  GitHub Actions                                  │   ├─ validate-site / contrast
        │   └ site-checks + auto-sync-generated            │   └─ acceptance-check
        ▼                                                  │
   GitHub Pages（公网入口，保持不变）                        │  手动 --full
                                                           │   └─ npm audit / Playwright / Lighthouse
                                                           ▼
                                                    Caddy :8080 内网预览
                                                    http://<hostname>.local:8080/homepage/
```

关键点：**mini 不参与发布**。发布链路仍是 `git push` → Pages。mini 只是"先在本地把
问题拦住"+"让合作者在局域网里看未发布版本"。

## 3. 前置条件

在 mini 上先准备好：

```bash
xcode-select --install        # 提供 git 与 /usr/bin/python3（Lighthouse 依赖 python3）
brew install node@22          # 或 node（CI 使用 22）
brew install caddy            # 内网预览
brew install lychee           # 可选：补齐 CI 的 link-check
```

GitHub 访问方式二选一（决定 `--repo-url`）：

- SSH：先把 mini 的 `~/.ssh/id_ed25519.pub` 加到 GitHub，用默认的
  `git@github.com:Stork343/homepage.git`（推荐，免交互）。
- HTTPS：用 `--repo-url https://github.com/Stork343/homepage.git`，但 `git fetch`
  可能要求凭据，无人值守场景不推荐。

电源与网络建议：

```bash
sudo pmset -a sleep 0 disablesleep 0      # 不进入睡眠（显示器可以照常睡）
sudo pmset -a autorestart 1               # 断电恢复后自动开机
```

在路由器上给 mini 做 DHCP 地址保留，这样 `http://<hostname>.local:8080/` 之外的
固定 IP 访问也稳定。

## 4. 一次性初始化

```bash
# 在 Windows 侧先提交并推送本手册与脚本（mini 要从 GitHub 拉取）
# 然后在 mini 上：
git clone git@github.com:Stork343/homepage.git ~/Sites/homepage
cd ~/Sites/homepage
./scripts/ops/macmini-bootstrap.sh                 # 只准备环境与配置
./scripts/ops/macmini-bootstrap.sh --install-services   # 顺带加载 launchd 服务
```

`macmini-bootstrap.sh` 会做五件事：预检依赖 → 克隆/更新仓库 → `npm ci` +
`npx playwright install chromium` → 渲染 Caddyfile 与两个 launchd plist →
（可选）加载服务并打印后续步骤。

脚本**幂等**，可以反复运行；已存在的仓库只会做 fast-forward 更新。

渲染产物：

| 产物 | 路径 |
| --- | --- |
| 预览配置 | `~/Sites/homepage-preview.Caddyfile` |
| 定时门禁 | `~/Library/LaunchAgents/com.houjian.homepage-ci.plist` |
| 预览服务 | `~/Library/LaunchAgents/com.houjian.homepage-preview.plist` |
| 日志 | `~/Library/Logs/homepage-ci/` |

服务管理：

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.houjian.homepage-ci.plist
launchctl bootout   gui/$(id -u)/com.houjian.homepage-ci
launchctl print     gui/$(id -u)/com.houjian.homepage-ci
```

> 若 mini 从不登录图形界面（纯 SSH 使用），把 `gui/$(id -u)` 换成 `user/$(id -u)`。
> 但 Playwright 需要图形登录会话，所以 `--full` 仍建议在已登录的终端里手动跑。

## 5. 日常用法

```bash
cd ~/Sites/homepage

# 快检（数据/结构/对比度/验收，约 1 分钟；launchd 每小时自动跑这个）
./scripts/ops/local-ci.sh --quick --pull

# 发版前全量（含 npm audit、Playwright 三套、Lighthouse、lychee）
./scripts/ops/local-ci.sh --full --pull

# 视觉基线与 macos-latest runner 打架时临时跳过
./scripts/ops/local-ci.sh --full --skip-visual

# 只更新生成物（门禁失败、确认需要重建时）
node scripts/build-site-data.js --write
node scripts/sync-paper-seo.js --write
node scripts/generate-paper-toc.js --write
```

日志与预览：

```bash
ls -lt ~/Library/Logs/homepage-ci/ | head
tail -f ~/Library/Logs/homepage-ci/launchd-ci.out.log
open "http://$(hostname -s).local:8080/homepage/"
```

预览地址故意保留了 `/homepage/` 子路径，与 Pages 的 project page 路径结构一致，
因此相对链接、hash 深链、搜索参数的行为都与线上相同。

## 6. 门禁对照表（local-ci.sh ↔ site-checks.yml）

| CI job | 本地对应 | 备注 |
| --- | --- | --- |
| `syntax-check` | `--quick` 前 3 步 | 含 `node --check`、`htmlhint`、各 `--check` 与 `validate-site` / `contrast` / `acceptance-check` |
| `link-check`（lychee） | `--full`（装了 lychee 才跑） | 需要外网，建议仍以 CI 结果为准 |
| `ui-regression` | `--full` → `test:ui` | `testDir` 是 `tests/ui`，会跑全部三个 spec |
| `a11y-check` | `--full` → `test:ui` 已覆盖 | ⚠️ CI 里被重复跑了一遍，见坑 2 |
| `visual-regression` | `--full` → `test:ui`（darwin 才执行） | mini 原生可跑 |
| `lighthouse-check` | `--full` → `npm audit` + `lighthouse` | 依赖 `python3`（它的本地静态服务器用 `python3 -m http.server`） |

## 7. 已知坑（务必先读）

**1. 视觉基线跨环境不一致时，必须选定唯一权威平台**

`tests/ui/visual.spec.js` 对非 darwin 直接 skip，快照名默认带平台后缀，所以
mini（darwin）与 CI 的 `macos-latest`（darwin）会用**同一套** darwin 基线。
但两者的 macOS 版本/字体渲染未必一致，容差只有 `maxDiffPixelRatio: 0.02~0.03`。

一旦出现"mini 过、CI 挂"或反之，**不要两边都用 `--update-snapshots` 互相覆盖**，
必须二选一：

- **推荐：以 mini 为准**——删除 CI 里的 `visual-regression` job（顺带省下一个
  昂贵的 macOS runner），视觉门禁只在 mini 跑。
- 或以 CI 为准——本地固定加 `--skip-visual`。

**2. CI 里无障碍与视觉测试被跑了两遍**

`npm run test:ui` 的 `testDir` 是 `./tests/ui`，会执行 `regression` +
`accessibility` + `visual` 三个 spec。而 `site-checks.yml` 又分别用
`test:a11y`、`test:visual` 跑了两遍（ubuntu 上 visual 被 skip，macOS 上三个全跑）。
属于纯浪费，可考虑让 `ui-regression` job 改用 `npm run test:ui:core`，
把 a11y/visual 交给各自专用 job。

**3. Playwright 在本地默认要求安装 Google Chrome**

`playwright.config.js` 在**非** CI 环境下使用 `channel: 'chrome'`。因此
`local-ci.sh` 强制 `export CI=1`，改用 `npx playwright install chromium` 装的
随包 chromium，与 CI 行为一致。手动跑 `npx playwright test` 时请记得也加 `CI=1`，
否则会报找不到 Chrome。

**4. Lighthouse 依赖 python3**

`scripts/run-lighthouse-check.js` 在非 Windows 上调用 `python3 -m http.server`
起本地静态服务器（端口 4174）。macOS 自带的 `/usr/bin/python3` 由 Xcode
Command Line Tools 提供，所以 `xcode-select --install` 是必要步骤。Playwright
自己用 `scripts/serve.js`（端口 4173），两者不冲突，也不与 Caddy 的 8080 冲突。

**5. 预览暴露面与线上一致，但 `.git` 必须屏蔽**

GitHub Pages 会发布仓库根下所有非点号/非下划线文件，因此
`https://stork343.github.io/homepage/scripts/main.js` 这类路径**在线上本来就是公开的**，
预览服务保持同样行为是刻意的（避免"预览通过、线上 404"）。但 `.git/`（含完整历史，
可能含已删除的敏感内容）绝不能暴露，Caddyfile 里用 `route{}` 显式 404 掉
`.git`、`.dsh`、`.vscode`、`node_modules`。

如果以后想收紧暴露面，正确做法是把站点文件移进 `site/` 子目录再改 Pages 发布目录，
而不是只在预览里屏蔽——两边行为必须一致。

**6. 定时任务只跑 `--quick`**

Playwright/Lighthouse 需要图形登录会话，无人值守时可能失败或产出异常快照。
因此 launchd 定时任务固定 `--quick --pull`，`--full` 由你在已登录终端手动触发。

**7. 不要用同步盘里的副本构建**

Windows 侧的工作目录在 `D:\OneDrive\RUC\homepage`。不要在 mini 上用 iCloud/
同步目录里的副本构建（`node_modules`、`.git` 与频繁写盘会被同步进程搅乱）。
mini 上一律用 `git clone` 的独立副本（`~/Sites/homepage`）。

**8. `.gitattributes` 已保证脚本 LF 换行**

仓库已有 `* text=auto eol=lf`，所以新增的 `scripts/ops/*.sh` 不会被 CRLF 污染
（否则 macOS 上会报 `bad interpreter: /bin/bash^M`）。修改 `.gitattributes`
前请留意这条保障。

## 8. 卸载与回滚

```bash
# 停掉并移除服务
launchctl bootout gui/$(id -u)/com.houjian.homepage-ci       2>/dev/null || true
launchctl bootout gui/$(id -u)/com.houjian.homepage-preview  2>/dev/null || true
rm -f ~/Library/LaunchAgents/com.houjian.homepage-*.plist
rm -f ~/Sites/homepage-preview.Caddyfile

# 可选：连仓库与日志一起清掉（仓库可从 GitHub 重新 clone）
rm -rf ~/Library/Logs/homepage-ci
```

站点本身**不受影响**：公网入口一直是 GitHub Pages，mini 上的任何操作都不会
影响线上可用性。这也是方案 A 的核心好处——出事半径为零。

## 9. 后续可选步骤

**Step 2：把生成物回写改由 mini 承担**

目标是让 `main` 只有你一个写者。做法：删掉 `auto-sync-generated.yml`，
改为"你在 Windows 提交 → mini 手动/定时 pull → 跑 `--write` → 你确认 diff 后 push"。
好处是历史干净、不再需要 `concurrency: main-writers` 防双写。

**Step 3：公网自托管（仅在明确需要时）**

如果动机是"国内访问 Pages 有时打不开"，可先在 mini 上做**双发布但不切 DNS**：
Cloudflare Tunnel（`cloudflared`）出站建连，绕开家宽无公网 IP 与封 80/443 的限制，
产物用 `rsync` 到 `~/Sites/homepage-releases/<时间戳>/` + `current` symlink 原子切换，
观察数周稳定性后再决定是否切换主域名。**注意**：这一步会牵动 canonical/OG/
JSON-LD/sitemap/robots 里的绝对 URL（唯一真源是 `data/site-master.json` 的 `base_url`，
但 `scripts/main.js:908` 与 `index.html` 的 canonical/OG、`robots.txt`、Plausible 的
`data-domain` 是硬编码），需要先把站点域名参数化再动。