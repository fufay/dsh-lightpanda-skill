# DECISIONS · dsh-lightpanda-skill 决策记录

> 只追加「决定了什么 / 为什么 / 放弃了什么」。不写每日进度、不写命令流水账。
> 当前状态看 `HANDOFF.md`；规则看 `AGENTS.md`；环境看 `docs/00-环境与工具链.md`。

| ID | 日期 | 决定 | 为什么 / 放弃了什么 | 影响 / 文档 |
|---|---|---|---|---|
| D-001 | 2026-11-03 | 建立项目骨架：AGENTS / HANDOFF / DECISIONS + `docs/` 编号文档 + 环境文档 | 新会话开工先读 HANDOFF/环境文档，避免重复探测；文档编号便于长期维护 | 本仓库根三文件、`docs/` |

| D-002 | 2026-11-03 | 形态选 **skill**（非插件）：脚本+SKILL.md，按需调用二进制 | 不改 Whale/profile；流程知识适合 skill；将来要模型自助调用再评估 MCP | `docs/03` |
| D-003 | 2026-11-03 | 同一 skill 两条驱动：**P2 无状态 fetch** / **P3 有状态 serve+CDP** | 共用判定/预算/站点表；P3 只在需要 cookie/多步时启用 | `skill/dsh-lightpanda/SKILL.md` |
| D-004 | 2026-11-03 | 二进制**自带分发**（AtomGit 优先、GitHub 备源、上游兜底），assets 走 release 附件 + manifest sha256 | 用户不用编译；国内直连 AtomGit；OHOS 用自建静态自签资产 | `skill/dsh-lightpanda/assets/manifest.json` |
| D-005 | 2026-11-03 | Windows **不做原生支持**（上游无 exe），统一走 WSL2 | 避免维护 msys 补丁；文档明确提示 | `docs/01`、`SKILL.md` |

## 追加格式

```text
| D-0xx | YYYY-MM-DD | 决定（一句话） | 为什么 / 放弃了什么 | 影响文件 / docs 链接 |
```
