# HANDOFF · dsh-lightpanda-skill 项目交接

> **当前状态，不是规则。** 规则看 `AGENTS.md`；决策看 `DECISIONS.md`；环境看 `docs/00-环境与工具链.md`。
> 每次开工先读本文件，收尾必须更新本文件。目标 1–2 页，不写流水账。

**最后更新**：2026-11-03
**仓库**：本地 git（远端待定）· 分支 `main`
**当前环境**：HarmonyOS PC 工作区（`/storage/Users/currentUser/projects/DSH_Proj`）

---

## 1. 当前目标

- **待补**：一句话说明本阶段要达成什么。

## 2. 上次做到哪

- 2026-11-03：初始化项目骨架（`AGENTS.md` / `HANDOFF.md` / `DECISIONS.md` / `README.md` / `docs/` 编号文档 / `tools/` / `.gitignore`）。

## 3. 下一步（按优先级）

1. 补 `docs/01-项目概览.md`：目标、范围、**明确不做**。
2. 确定构建链（按项目类型选，见 `docs/00-环境与工具链.md` §2），写进 `AGENTS.md` §三。
3. 搭出第一个可运行骨架并产物级验证。

## 4. 已知坑 / 约束（别重复踩）

- 见 `docs/00-环境与工具链.md` §6（本机通用坑：npm/pnpm 假壳、brew 命令不在默认 PATH、python SSL、chmod 无效、DevEco 目录不可读、`gcc` 其实是 clang 包装、没有 ldd/gdb/valgrind）。

## 5. 本次改动（2026-11-03）

- 初始化项目骨架；未写业务代码、未改环境。

## 6. 开工 / 收尾模板

```text
开工：项目 dsh-lightpanda-skill。先读 HANDOFF.md、AGENTS.md、DECISIONS.md、docs/00。
本次只做：<一个明确任务>。结束前更新 HANDOFF.md。
收尾：更新 HANDOFF.md：1) 改了什么 2) 验证结果 3) 没做完的 4) 新坑 5) 下一步。
```
