# AGENTS.md — 《dsh-lightpanda-skill》项目工作约定

> 先读顺序：`HANDOFF.md`（当前状态）→ 本文件（稳定规则）→ `DECISIONS.md`（决策）→ `docs/00-环境与工具链.md`（本机环境）。
> 上层：`$DSH_HOME/AGENTS.md`（全局机器规则）与工作区根 `AGENTS.md`；冲突时以更具体/用户最新指令为准。
> 本文件只放**稳定规则**；当前状态写 `HANDOFF.md`；决策写 `DECISIONS.md`。

## 一、项目定位

- 名称：dsh-lightpanda-skill
- 目录：/storage/Users/currentUser/projects/DSH_Proj/Skills/dsh-lightpanda-skill
- 一句话目标：**待补**（写在 `docs/01-项目概览.md`）
- 目标平台 / 运行环境：**待补**
- 创建日期：2026-11-03

## 二、铁律

1. **构建产物不进仓库**：放**项目内** `_build/`（见 `.gitignore`）；不要放工作区上层 `Build/`（避免杂乱）。
2. **开工先读** `HANDOFF.md`；**收尾必须更新** `HANDOFF.md`（完成/未完成/坑/下一步/验证命令）。
3. **文档落盘**，不要只写在聊天里；新增文档接着 `docs/` 最大编号。
4. **不改无关文件**；不 `git reset --hard`；不删他人在写的文件。
5. **环境结论只写一处**：`docs/00-环境与工具链.md`，不要每个会话重新探测全盘。
6. **密钥/token 不入库、不打印**（AGC 私钥、GitHub token、模型 API key 等）。
7. **外部参考统一放 `_refer/`**：参考仓库 / 下载资料 / 素材**不散落**，放 `_refer/<来源>-<名称>-<版本>/`，并在 `docs/02-参考资源清单.md` 登记来源 / commit / 许可 / 用途（`_refer/` 已被 git 排除）。
8. **改造参考代码 → `vendor/`**：需要修改某份参考代码时，复制到 `vendor/<来源>-<名称>/`（**git 跟踪**）再改，并在 `docs/02` 标注「来源 = `_refer/…`，已修改」；`_refer/` 保持原样只读。
9. **缺工具先 `brew search` 再 `brew install`**：本仓是 AtomGit `Harmonybrew/brew`（不是 homebrew-core），先确认有再装；工具链越丰富越好，**不需要卸载/清理**。已装家底见 `docs/08`；装完把版本补进 `docs/00` §1 与 `docs/08` §4。
10. **环境名统一写 Whale**：本机 DSH 运行环境叫 **Whale**（源自 DSHM 的 MIT 分支，已独立演进）；文档/注释里**不要写 DSHM**（本机另装了 DSHM 应用，会混淆）。
    ⚠️ 例外：代码/环境变量名里的 `DSHM_*`、真实目录名 `DSHM问题汇总与解决/` 保持原样（既有契约/路径，不要改）。
11. **AGC 材料归位**：凡在 AGC 申请/签发的 debug/release Profile、证书、`p12`、CSR、口令等，**一律放 `certificate/<项目名>/`**（共享 service account 凭据放 `certificate/agc/`）；旧项目可保留原路径，新项目/新申请必须遵守，细则见 `docs/04` §4.0。

## 三、构建 / 验收

- 本机工具链与版本见 `docs/00-环境与工具链.md`（已核实，无需重复检查）。
- 验收默认：**产物级核验**（sha256、版本号、关键串命中/0 命中）；真机或交互冒烟交给用户做。
- 首次确定构建链后，把「一条命令构建」写进本文件 §三 与 `tools/`。

## 四、git

- 本地 `git init`（远端按需添加）；提交信息用中文简述。
- 需要访问 GitHub 时走代理（见 `docs/09-本机约定与通用坑.md`）；本机 `git push` 可能打印 Signal 6 噪音但实际成功。
- token 只从约定位置读取，不写进 `.git/config`、不 echo。

## 五、文档

| 文件 | 内容 |
|---|---|
| `HANDOFF.md` | 当前状态 / 下一步 / 坑 |
| `DECISIONS.md` | 决策记录（只追加） |
| `README.md` | 文档索引 |
| `docs/00-环境与工具链.md` | **本机环境索引**（核心版本 + 专题文档入口；细节在 03–09） |
| `docs/01-项目概览.md` | 目标 / 范围 / 明确不做 |
| `docs/02-参考资源清单.md` | 外部参考/下载资源登记（实体在 `_refer/`） |
| `docs/03-原生代码与签名.md` | 原生项目的 `.codesign` / dlopen / ELF 签名（非原生项目可忽略） |
| `docs/04-鸿蒙App与HAP开发.md` | **HAP / 鸿蒙 App 全链路**：hmos-clt/devecocli、签名（AGC/Profile/ACL）、hdc 桥、装机/日志、常见坑与验收 |
| `docs/05-.NET能力与场景.md` | **.NET 能力图**：CLI/类库/ASP.NET/NativeAOT/Godot C#、安装与边界 |
| `docs/06-Godot-OHOS环境.md` | Godot kit 路径 / headless 命令 / 约定 |
| `docs/07-VM构建环境.md` | 兜底 VM（openEuler）Linux 构建环境 |
| `docs/08-工具链清单与自检.md` | 完整工具链清单 / brew 家底 / 自检命令 |
| `docs/09-本机约定与通用坑.md` | 文件/沙箱约定、网络/git、通用坑 |
| `docs/99-参考链接.md` | 来源链接与出处 |
