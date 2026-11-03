# dsh-lightpanda-skill

跨平台（Windows-WSL2 / macOS / Linux x86_64+aarch64 / HarmonyOS PC）的 **lightpanda 无头浏览器取数 skill**。

- **P2 无状态**：`fetch` 抓正文/结构化数据/接口，查资料、抓列表、批量抓取。
- **P3 有状态**：`serve` + CDP，带 cookie 登录态、多步操作、按页轮询。
- 二进制**不入库**：首次运行自动从 **AtomGit（国内优先）→ GitHub → 上游** 下载，sha256 校验，缓存到 `~/.cache/dsh-lightpanda/<tag>/`。

## 快速开始

```sh
# 1) 安装 skill（复制到 DSH skills 目录）
sh tools/install.sh                 # 默认 $DSH_HOME/skills/dsh-lightpanda

# 2) 在你的 agent 里说「用 lightpanda 抓 <URL>」，或手动试：
NODE=node
$NODE "$DSH_HOME/skills/dsh-lightpanda/scripts/resolve.mjs" --check
$NODE "$DSH_HOME/skills/dsh-lightpanda/scripts/fetch.mjs" "https://example.com" --dump markdown
```

## 平台矩阵

| 平台 | 资产 | 说明 |
|---|---|---|
| HarmonyOS PC / Linux aarch64 | `lightpanda-aarch64-ohos` | **静态 musl + 已为 OHOS 自签**；Linux 上也可直接跑 |
| Linux x86_64 | `lightpanda-x86_64-linux` | 上游 glibc 构建 |
| macOS arm64 / x86_64 | `lightpanda-aarch64-macos` / `lightpanda-x86_64-macos` | 未签名，首次 `xattr -d com.apple.quarantine` |
| Windows | —— | 上游无原生 exe，**在 WSL2 内使用**（自动选 linux-x86_64） |

## 发布（维护者）

```sh
sh tools/publish-release.sh --tag lightpanda-1.1.0-dev.11522
# 需要：gh 已登录；ATOMGIT_TOKEN 或 ATOMGIT_TOKEN_FILE 指向 AtomGit 私人令牌
```

资产清单与 sha256：`skill/dsh-lightpanda/assets/manifest.json`。

## 目录

| 路径 | 内容 |
|---|---|
| `skill/dsh-lightpanda/SKILL.md` | 给 agent 的流程说明（P2/P3、路由、判定、安全） |
| `skill/dsh-lightpanda/scripts/` | `resolve.mjs`（下载/校验）、`fetch.mjs`（P2）、`serve.mjs`（P3 生命周期）、`cdp.mjs`（零依赖 CDP） |
| `skill/dsh-lightpanda/assets/manifest.json` | 平台资产表 + sha256 + 镜像地址 |
| `tools/` | `install.sh`、`publish-release.sh` |
| `docs/` | 概览、参考资源、发布与设计 |

## 边界

- 不做真实渲染截图/视觉核对、不解验证码、不播放视频；登录用 cookie 导入而非破解。
- lightpanda 为 AGPL-3.0：本 skill **只以独立进程调用**，不链接其代码。
