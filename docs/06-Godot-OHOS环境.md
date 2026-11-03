# 06 · Godot 4.7.2（oheco / HarmonyOS headless）

> 本文是**新项目的入口指针**；完整文档已统一收在 `Common/godot-ohos/docs/`，Godot 知识在
> `Common/godot-ohos/skills/godot/`（DSH skill 名 `godot`）。**不要在项目里复制这些内容**。
> 本机环境事实见 `docs/00-环境与工具链.md`；.NET/C# 见 `docs/05`。

## 1. 引擎位置（唯一实体）

| 项 | 值 |
|---|---|
| 引擎入口（垫片，用绝对路径） | `/storage/Users/currentUser/projects/DSH_Proj/Common/godot-ohos/bin/godot` |
| kit 实体（304MB） | `Common/godot-ohos/kits/godot-editor-4.7.2-ohos.11/` |
| 版本 | `4.7.2.stable.mono.custom_build.2a6544884` |
| 形态 | **headless，无 GUI 编辑器**；GDScript 可用；看画面 = Web 导出用浏览器 / HAP 装真机 |
| 数据/模板指针 | `Common/godot-ohos/data/`（`GODOT_OHOS_DATA_DIR`） |

```sh
GODOT=/storage/Users/currentUser/projects/DSH_Proj/Common/godot-ohos/bin/godot
$GODOT --headless --version
$GODOT --headless --path . --import
$GODOT --headless --path . --script res://tests/xxx.gd
```

## 2. 按任务读哪份文档

| 任务 | 文档 |
|---|---|
| 引擎/平台限制/升级 | `Common/godot-ohos/docs/01-引擎与headless.md` |
| 导出 Web（mono 硬禁 + 9KB 垫片） | `Common/godot-ohos/docs/02-Web导出链.md` |
| 浏览器验收 | `Common/godot-ohos/docs/03-浏览器验证.md` |
| HAP 构建/签名/装机 | `Common/godot-ohos/docs/04-HAP构建与真机.md` |
| 音频/字体/AI 美术 | `docs/05` / `docs/06` / `docs/07`（同目录） |
| 常见坑 | `Common/godot-ohos/docs/08-常见坑.md` |
| skill 与上游技能库 | `Common/godot-ohos/docs/09-技能与上游知识.md` |

## 3. 约定

- 本机只能**代码建场景**（`.tscn` 文本 + GDScript 生成节点/资源/贴图）。
- kit 是外部二进制，**不要复制进项目 `_refer/`**；项目里用绝对路径，并在 `docs/02-参考资源清单.md` 登记版本 + SHA256。
- 构建产物放项目内 `_build/`；`_build/`、`_refer/` 放 `.gdignore`（Godot 不认 `.gitignore`）。
- 可运行参考实现与脚本：`Games/godot-demo/tools/`（01 导出、02 服务、03 浏览器验证、04 无头回归、07 HAP、08 AI 美术）。
