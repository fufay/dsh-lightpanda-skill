---
name: dsh-lightpanda
description: 用 lightpanda（Zig 写的轻量无头浏览器）在本机抓网页/跑 JS/打接口/CDP 交互，覆盖 Windows/macOS/Linux(x86_64/aarch64)/HarmonyOS PC；二进制自动从 AtomGit 或 GitHub 发行版下载并按 sha256 校验。分两种形态：P2 无状态抓取（fetch，查资料/抓数据）与 P3 有状态会话（serve+CDP，cookie/多步/表单）。触发词：用 lightpanda 抓、无头浏览器抓网页、抓这个页面、批量抓取、登录后抓数据、跑 JS 抓接口、CDP 抓取。
whenToUse: 用户要求抓取网页内容/列表/结构化数据/接口数据、需要执行页面 JS 后再取内容、需要登录态（cookie）抓数据、或需要批量/多页抓取。不用于：纯搜索（先用搜索工具）、需要真实渲染截图/验证码识别/视频播放的场景、头条发布这类必须真实浏览器 UI 的流程。
---

# dsh-lightpanda：跨平台无头浏览器取数

> 本 skill 调用 **lightpanda**（<https://github.com/lightpanda-io/browser>，非 Chromium）。
> 二进制不在仓库里：`scripts/resolve.mjs` 会按平台从 **AtomGit（国内优先）→ GitHub → 上游** 下载并校验 sha256，缓存在 `~/.cache/dsh-lightpanda/<tag>/lightpanda`。

## 0. 先决策：用哪种形态

| 形态 | 何时用 | 入口 |
|---|---|---|
| **P2 无状态** | 公开页面、单页/多 URL、只要内容（markdown/html/结构化数据） | `scripts/fetch.mjs` |
| **P3 有状态** | 需要 cookie/登录态、多步交互（翻页/点选/填表）、同一会话连续取多页 | `scripts/serve.mjs` + `scripts/cdp.mjs` |

**P2 是默认**；只有"必须记住状态/必须操作页面"才上 P3。

## 1. 准备（首次自动完成）

```sh
NODE=node            # 需要 Node 18+（Node 24 最好，内建 WebSocket）
$NODE scripts/resolve.mjs --check     # 看本平台会选哪个资产
$NODE scripts/resolve.mjs --path      # 下载+校验+chmod，打印二进制路径
```

- HarmonyOS / Linux aarch64：用**静态 musl 自签**资产（OHOS 可直接执行）；
- Linux x86_64：用上游 glibc 资产；
- macOS arm64/x64：用上游 Mach-O（首次运行先 `xattr -d com.apple.quarantine <bin>`）；
- **Windows**：lightpanda 无原生 exe，**必须在 WSL2 里跑**（Windows 侧只做入口）。
- 离线/内网：把对应资产放到一个目录，设 `DSH_LIGHTPANDA_LOCAL_DIR=<dir>`。

## 2. P2：无状态抓取（查资料 / 抓数据）

```sh
# 正文（reader 模式，最省 token）
$NODE scripts/fetch.mjs "https://example.com" --dump markdown

# 结构化数据（JSON-LD/OpenGraph/meta/link）
$NODE scripts/fetch.mjs "https://example.com" --dump structured_data --json

# 等页面渲染完再取（JS 重站点）
$NODE scripts/fetch.mjs "https://search.bilibili.com/all?keyword=xxx&order=pubdate" \
  --dump html --wait-ms 8000

# 单次带 cookie（登录态一次性使用）
$NODE scripts/fetch.mjs "https://site/private" --cookie cookies.json --dump markdown

# 批量（多 URL 需要 --json，一个失败不中断）
$NODE scripts/fetch.mjs "https://a" "https://b" --dump markdown --json
```

常用参数（透传给 lightpanda，均可组合）：
`--dump markdown|html|structured_data|semantic_tree|semantic_tree_text|png|pdf`、
`--wait-ms` / `--wait-selector` / `--wait-until`、`--strip clutter`（只要正文）、`--json`、`--cookie`、
`--obey-robots`、`--block-private-networks`、`--load-resources iframe,image,stylesheet`、`--` 后接任意上游参数。

**判定返回内容**（用 `--json` 时）：
```jsonc
{
  "url": "...", "http_status": 200, "error": null,
  "page_status": { "js_errors": 1, "missing_globals": ["..."],
                   "bot_challenge": null, "failed": {"script":0,"fetch":0,"xhr":0} },
  "dump": "markdown", "content": "..."
}
```
- `http_status != 200` 或 `error != null` → 失败；
- `bot_challenge` 非空 / 正文出现"安全验证/登录/验证码" → 判定被风控/需登录；
- `content` 太短（< 200 字）且不是纯列表页 → 大概率没渲染出来，加大 `--wait-ms` 或改用 P3 轮询。

## 3. P3：有状态会话（cookie / 多步 / 表单）

```sh
# 0) cookie 转换（浏览器导出的 Playwright storageState → lightpanda 格式）
$NODE scripts/cookies.mjs convert --from playwright --in storageState.json --out cookies.json
$NODE scripts/cookies.mjs convert --from playwright --in storageState.json --out cookies.txt --format netscape
$NODE scripts/cookies.mjs inspect cookies.txt        # 看条数/域名/是否过期

# 启动（只监听 127.0.0.1；自动重试 V8 偶发崩溃）
$NODE scripts/serve.mjs ensure --port 9223 \
  --cookie cookies.json --cookie-jar cookies-out.json

# 状态 / 停止
$NODE scripts/serve.mjs status --port 9223
$NODE scripts/serve.mjs stop   --port 9223

# CDP 单步：导航 + 等选择器 + 取 DOM（零依赖）
$NODE scripts/cdp.mjs --port 9223 --url "https://search.bilibili.com/all?keyword=xxx&order=pubdate" \
  --poll-selector ".bili-video-card" --min 3 --status \
  --eval "JSON.stringify([...document.querySelectorAll('.bili-video-card')].slice(0,8).map(c=>({t:c.innerText.split('\n')[0]})))"
```

`--status` 会额外返回 `LP.getPageStatus`（`httpStatus/jsErrors/missingGlobals/botChallenge`），用来判定"页面到底活没活"。

要点：
- **并发单位是连接**：一条 WebSocket 只能有一个页面（第二次 `Target.createTarget` 报 `-31998`）；并发就开多条连接，上限 `--cdp-max-connections`（默认 16）。
- **登录**：不要试图让 lightpanda 过验证码（它没有视觉；UA 禁 `Mozilla`）。正确做法是**导入已验证的 cookie**（在真实浏览器/手机上登录一次 → 导出 cookies），或扫码后 `--cookie-jar` 落盘。P3 的价值就是"会话内保持 cookie + 多步操作"。
- **只持久化 cookie**：localStorage/IndexedDB 不落盘；靠 localStorage 的站要在同一 serve 进程内完成采集。

## 4. A/B 两条路由

- **A（用户指定站点）**：直接用上面 P2/P3 打开站点（站内搜索/列表/详情），**不需要先搜索**。
- **B（未指定站点）**：先用搜索工具拿候选 URL → 逐个 `fetch.mjs` → 判定（§2）→ 不合格换下一个/改写检索词 → 汇总并引用 URL。

## 5. 预算与安全（默认值）

- 单任务：搜索 ≤ 4 次、抓取 ≤ 8 页、单页超时 ≤ 60s；超限如实报告"没抓完"。
- **telemetry**：脚本默认设 `LIGHTPANDA_DISABLE_TELEMETRY=1`（上游默认会外发）。
- **只监听 127.0.0.1**；要防 SSRF 时加 `--block-private-networks`。
- 礼貌抓取：需要时加 `--obey-robots`；同域并发 ≤ 2；不要绕过登录/付费墙，不抓敏感数据。
- 许可：lightpanda 是 **AGPL-3.0**；本 skill 只**独立进程调用**，不链接其代码。

## 6. 已知限制（先想清楚再承诺）

- **无布局引擎**：`--dump png/pdf` 是"文字排版图"，不是真实渲染；**不能当视觉证据/截图核对**；canvas 不支持；中文需 `--render-font`。
- **UA 硬编码 `Lightpanda/1.0`**（禁止含 `Mozilla`）→ 强反爬站点可能 412/验证码。
- **不能过验证码**（图形/滑块/短信）：走 cookie 导入或人机协作（扫码/人工输入）。
- 播放器、弹幕、WebGL、复杂 SPA 交互不做；`iframe` 默认不加载（`--load-resources iframe`）。

## 7. 故障排查

| 现象 | 处理 |
|---|---|
| 启动即崩，报 `kMinStackAlignment` | 已知偶发；`serve.mjs` 已自动重试 3 次 |
| `AccessDenied` / `Permission denied`（HarmonyOS） | 资产必须用 `lightpanda-aarch64-ohos`（已自签）；不要用 glibc 版 |
| 正文为空/只有导航 | 加大 `--wait-ms`，或用 P3 `--poll-selector`；再不行 `--load-resources iframe,stylesheet` |
| 412 / 安全验证 | 站点风控；换来源/降频/用搜索摘要，不要硬刷 |
| 下载慢/失败 | 优先 AtomGit 镜像；可设 `DSH_LIGHTPANDA_ASSET_BASE` 指向自建镜像 |
