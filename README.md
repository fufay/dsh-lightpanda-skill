# dsh-lightpanda-skill

> 给 DSH / Whale 的**跨平台无头浏览器取数 skill**：把 lightpanda（Zig 写的轻量浏览器）装进 agent 的工具箱。
> P2 无状态抓取（查资料 / 抓数据）+ P3 有状态会话（cookie / 多步 / 表单）；二进制自动下载、sha256 校验，**用户零编译**。

---

## 1. 它补的是哪块短板：DSH 现有两件套的边界

DSH 已经有两个上网工具：**搜索 API（web_search）** 和 **抓取（web_fetch）**。它们覆盖"找"和"拿文本"，但有三类任务会掉链子：

| 场景 | web_search | web_fetch | 本 skill |
|---|---|---|---|
| 找到"去哪找"（关键词→候选 URL） | ✅ 强项 | ❌ | ❌ 不替代（继续用 web_search） |
| 打开一个 URL 拿正文 | ❌ 只给摘要 | ✅ 简单页面 | ✅ |
| **页面要跑 JS 才出内容**（SPA/异步列表/后台报表） | ❌ | ⚠️ 常常拿到空壳 | ✅ 真跑 JS（V8），可等选择器/轮询 |
| **要结构化字段**（JSON-LD / OpenGraph / meta / 语义树） | ❌ | ❌ | ✅ `--dump structured_data / semantic_tree` |
| **直接打站点接口**（同源 POST、翻页、带页面上下文） | ❌ | ❌ | ✅ CDP `Runtime.evaluate` 里 `fetch` |
| **批量 / 多 URL**（失败不中断、带 JSON 元数据） | ❌ | ⚠️ 要自己循环 | ✅ 单进程批量 + `--json` |
| **要登录态**（cookie 抓私有页/后台） | ❌ | ❌ | ✅ `--cookie` / `--cookie-jar`（P3） |
| **多步交互**（翻页、点选、填表、等元素） | ❌ | ❌ | ✅ P3：`serve` + 零依赖 CDP |
| 验证码 / 视觉截图 / 视频播放 | ❌ | ❌ | ❌（明确不做） |
| 成本 | 服务端搜索配额 | 服务端抓取 | **本机进程，零 API 费用** |

一句话定位：

> **web_search = 地图**（找 URL）；**web_fetch = 只看一眼**；
> **dsh-lightpanda = 真浏览器的手**（跑 JS、打接口、带 cookie、批量、结构化）。
> 三者是接力，不是替代。

## 2. 优势清单

**网页能力**
- 真 V8 执行 JS：SPA / 懒加载 / 异步列表能等到渲染完（`--wait-ms`、`--wait-selector`、`--wait-until`）。
- **无布局引擎 → 快且省内存**（厂商 benchmark 量级：约为 Chromium 的 1/16 内存、1/9 时间；本机未复测）。
- 多 dump 模式：`markdown`（最省 token）/ `html` / `structured_data` / `semantic_tree(_text)` / `png` / `pdf`。
- reader 模式 `--strip-mode clutter` 只要正文；`--dump-selector` 只取某个元素。

**数据能力**
- **页面上下文打接口**：`Runtime.evaluate` 里 `fetch('/api/...', {method:'POST'})`——带同源 cookie/UA，绕开"CLI 只能 GET"的限制。
- 翻页/批量逻辑写在脚本里，单进程跑完；`--json` 每页带 `url/http_status/page_status/error`，一个失败不中断。
- 结构化判定：`LP.getPageStatus` 直接给 `httpStatus/jsErrors/missingGlobals/botChallenge/skipped/unsupported`，不用猜"为什么是空页面"。

**会话与登录（P3）**
- `serve` 常驻：会话内保持 cookie/页面/JS 变量；`--cookie` 导入、`--cookie-jar` 回写。
- 提供 `cookies.mjs`：把浏览器导出的 Playwright `storageState` 转成 lightpanda 要的 Puppeteer JSON / Netscape cookies.txt。
- **登录策略是"带身份去抓"而不是"破解验证码"**：真实浏览器登录一次导 cookie，或扫码后落盘。

**平台与运维**
- **一套 skill 跑四个平台**：Windows(WSL2) / macOS(arm64,x64) / Linux(x86_64,aarch64) / **HarmonyOS PC**（自建静态自签二进制）。
- 二进制**不入库**：首次运行从 AtomGit（国内优先）→ GitHub → 上游下载，sha256 校验，缓存 `~/.cache/dsh-lightpanda/`。
- 离线/内网：`DSH_LIGHTPANDA_LOCAL_DIR` 指定本地资产目录；`DSH_LIGHTPANDA_ASSET_BASE` 指定自建镜像。
- `serve.mjs` 自带健康检查 + 崩溃自动重试（实测 lightpanda 偶发 V8 `kMinStackAlignment` 崩溃，重试可恢复）。
- 默认安全：只监听 `127.0.0.1`；`LIGHTPANDA_DISABLE_TELEMETRY=1`（上游默认会外发）；可选 `--block-private-networks` 防 SSRF。
- 许可干净：lightpanda 是 AGPL-3.0，本 skill **只做独立进程调用**，不链接其代码。

## 3. 功能矩阵（P2 / P3）

| 能力 | P2 `fetch.mjs` | P3 `serve.mjs`+`cdp.mjs` | 状态 |
|---|---|---|---|
| 单页正文（markdown/html） | ✅ | ✅ | 实测 |
| 结构化数据 / 语义树 / png / pdf | ✅ | ✅（CDP 域） | 实测（png/pdf 为文字排版图） |
| 等待策略（时间/选择器/事件） | ✅ | ✅（轮询选择器） | 实测 |
| 多 URL 批量 + `--json` | ✅ | —— | 实测 |
| 单次 cookie | ✅ `--cookie` | ✅ `--cookie`/`--cookie-jar` | 实测 |
| cookie 格式转换（Playwright→Puppeteer/Netscape） | ✅ `cookies.mjs` | 同 | 实测 |
| 会话内状态（多步/翻页/表单） | ❌（每次新进程） | ✅ | 实测 |
| CDP 导航 + evaluate + 页面状态 | —— | ✅ | 实测（22 域 21/22 OK） |
| 并发抓取 | 多进程（自行控制） | 多连接（一条 ws 一页，上限 16） | 源码+实测 |
| 登录态（导入 cookie） | ✅ | ✅ | 实测格式转换 |
| 验证码 / 视觉核对 / 视频播放 | ❌ | ❌ | 明确不做 |

> 实测环境：HarmonyOS PC（本机）。macOS / Windows-WSL2 / Linux x86_64 的资产已发布并登记 sha256，但**尚未在对应真机验证**。

## 4. 快速开始

```sh
# 1) 安装 skill（复制到 DSH skills 目录）
git clone https://atomgit.com/Kevin911/dsh-lightpanda-skill.git   # 或 GitHub
sh dsh-lightpanda-skill/tools/install.sh          # 默认 $DSH_HOME/skills/dsh-lightpanda

# 2) 自检 + 首次下载（按平台自动选资产）
NODE=node
$NODE "$DSH_HOME/skills/dsh-lightpanda/scripts/resolve.mjs" --check
$NODE "$DSH_HOME/skills/dsh-lightpanda/scripts/resolve.mjs" --path

# 3) P2：抓正文 / 抓结构化 / 批量
$NODE "$DSH_HOME/skills/dsh-lightpanda/scripts/fetch.mjs" "https://example.com" --dump markdown
$NODE "$DSH_HOME/skills/dsh-lightpanda/scripts/fetch.mjs" "https://example.com" --dump structured_data --json
$NODE "$DSH_HOME/skills/dsh-lightpanda/scripts/fetch.mjs" "https://a" "https://b" --dump markdown --json

# 4) P3：带 cookie 的会话 + CDP 取数
$NODE "$DSH_HOME/skills/dsh-lightpanda/scripts/cookies.mjs" convert \
  --from playwright --in storageState.json --out cookies.json
$NODE "$DSH_HOME/skills/dsh-lightpanda/scripts/serve.mjs" ensure --port 9223 \
  --cookie cookies.json --cookie-jar cookies-out.json
$NODE "$DSH_HOME/skills/dsh-lightpanda/scripts/cdp.mjs" --port 9223 \
  --url "https://site/search?q=x" --poll-selector ".card" --min 3 \
  --eval "JSON.stringify([...document.querySelectorAll('.card')].map(e=>e.innerText))" --status
$NODE "$DSH_HOME/skills/dsh-lightpanda/scripts/serve.mjs" stop --port 9223
```

> agent 侧不用记这些：直接说「用 lightpanda 抓 <URL>」即可，`SKILL.md` 里有完整决策树。

## 4.1 登录态（P3）的现状与设计方向

当前 P3 需要"cookie 从哪来"。**设计稿见 [`docs/04-登录与凭据处理设计.md`](docs/04-登录与凭据处理设计.md)**（未实现）：

- 核心原则：**秘密不进 agent 上下文**——agent 只拿 `cookie 文件路径 / 状态`，密码/短信由本地 helper 独立窗口输入。
- 推荐路线：**扫码（无秘密）→ 本地 helper（密码/OTP）→ 钥匙串（可选）→ 凭据代理守护进程（后置）**。
- 明确不做：验证码识别/绕过、把密码写进任何日志或会话。

## 5. 跨平台资产

| 资产 | 平台 | 说明 |
|---|---|---|
| `lightpanda-aarch64-ohos` | HarmonyOS PC / Linux aarch64 | 静态 musl + OHOS 自签（本机构建，版本 `1.1.0-dev.11522+daa09e7a`） |
| `lightpanda-x86_64-linux` | Linux x86_64 | 上游 nightly（glibc） |
| `lightpanda-aarch64-linux` | Linux aarch64 (glibc ≥2.38) | 上游 nightly |
| `lightpanda-aarch64-macos` / `lightpanda-x86_64-macos` | macOS | 上游 nightly（未签名，首次 `xattr -d com.apple.quarantine`） |
| `manifest.json` | 全部 | 平台映射 + sha256 + 镜像地址 |

Windows：上游无原生 exe，**在 WSL2 内使用**（自动选 linux-x86_64）。

## 6. 发布（维护者）

```sh
# 代码推送
git push https://github.com/fufay/dsh-lightpanda-skill.git HEAD:refs/heads/main
git push "https://Kevin911:<token>@atomgit.com/Kevin911/dsh-lightpanda-skill.git" HEAD:refs/heads/main
# 资产发布（tag 变化才需要重发；AtomGit 不支持同名覆盖）
sh Common/ProxyAgent/scripts/with-proxy.sh sh tools/publish-release.sh --tag <tag> --github-only
sh tools/publish-release.sh --tag <tag> --atomgit-only
```

资产来源、sha256、AtomGit API 要点（PRIVATE-TOKEN / 无 id / 上传两步法）见 `docs/03-发布与设计.md`。

## 7. 边界（不做）

- 不做真实渲染截图/视觉核对（无布局引擎，png 是文字排版图）。
- 不破验证码；不绕过登录/付费墙；不抓敏感数据。
- 不播放视频、不做 canvas/WebGL 交互。
- 不链接 lightpanda 源码（AGPL）；不做插件形态（先用 skill，需要时再评估 MCP）。

## 8. 目录

| 路径 | 内容 |
|---|---|
| `skill/dsh-lightpanda/SKILL.md` | agent 执行手册（P2/P3、A/B 路由、判定、安全、排障） |
| `skill/dsh-lightpanda/scripts/resolve.mjs` | 平台探测 + 多镜像下载 + sha256 + 缓存 |
| `skill/dsh-lightpanda/scripts/fetch.mjs` | P2 入口 |
| `skill/dsh-lightpanda/scripts/serve.mjs` | P3 生命周期（start/ensure/stop/status/restart） |
| `skill/dsh-lightpanda/scripts/cdp.mjs` | 零依赖 CDP：导航/轮询/evaluate/页面状态 |
| `skill/dsh-lightpanda/scripts/cookies.mjs` | cookie 导入与格式转换 |
| `skill/dsh-lightpanda/assets/manifest.json` | 平台资产表 |
| `tools/` | `install.sh`、`publish-release.sh`、`atomgit_release.py` |
| `docs/` | 概览、参考资源、发布与设计、**登录与凭据处理设计**（`docs/04`，设计稿未实现） |
