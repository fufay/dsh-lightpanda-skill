# 04 · 鸿蒙 App 与 HAP 开发（完整链路 / 签名 / hdc / AGC）

> 目标：把「鸿蒙应用（ArkTS/ArkUI）→ HAP → 签名 → 装机 → 调试」整条链路写全，新项目可直接照做。
> 本机已核实：HarmonyOS PC（2in1 · arm64 · API 26 / 7.0.0.105）；**已安装 DevEco Studio（GUI）**（bundle `com.huawei.devecostudio`，版本 26.0.0.201，AppGallery 安装）——但它是普通鸿蒙应用、安装目录沙箱不可读（除非走hdc bridge）；日常构建/签名走 CLI（devecocli + hmos-clt）即可，GUI 可选。
> 相关：`docs/00` §2（入口索引）、`docs/03`（原生 ELF `.codesign`）、`docs/05`（.NET）、`docs/06`（Godot）；Godot/.NET 的 HAP 另见 §7。

## 0. 一页速览

| 环节 | 用什么 | 一句话 |
|---|---|---|
| 新建/构建 HAP | `hmos-clt`（hvigor + ohpm + SDK API 26）或 `devecocli build` | 工程目录里 `hvigorw assembleHap`；产物在 `entry/build/default/outputs/` |
| 官方 CLI | `devecocli` 1.3.8 | `build/run/create/device/log/docs/signature/ui/check/skills/auth`；查文档用 `devecocli docs` |
| 签名（debug） | AGC 调试证书 + 调试 Profile（绑定设备 UDID） + `hap-sign-tool sign-app` | 现成材料在 `~/.ohos/godot-demo-signing/`；**未签名 HAP 装不上** |
| 签名（release） | AGC 正式证书 + 发布 Profile | 上架/分发用；`.app` 上传 AGC，`.hap` 只用于本机安装 |
| **更新已上架版本** | `agc upload file` → **直连 app-submit**（CLI 的 submit 有 bug） | 上传看 `bound=true`；提审前必须填 `newFeatures`，否则 204144692；见 §4.5 |
| 装机/启动 | `hdc install -r` + `aa start` | 沙箱内必须走 **hdc 桥**（`$HOME/bin/hdc`） |
| 日志/截图 | `hdc shell` + `hilog` / `snapshot_display` / `uitest` | 应用私有日志在 `/data/app/el2/100/base/<bundle>/files/` |
| 受限权限 | AGC Profile 里加 ACL | 例如 JIT 的 `ohos.permission.kernel.ALLOW_WRITABLE_CODE_MEMORY`；AOT 不需要 |

## 1. 工具链地图（本机路径）

| 项 | 路径 | 说明 |
|---|---|---|
| **HarmonyOS SDK（hmos-clt 自带）** | `/data/service/hnp/hmos-clt.org/hmos-clt_1.0.0/sdk/default/openharmony` | **26.0.0.105**；`runtimeOS=HarmonyOS`；**hvigor/DevEco 工程按它编译** |
| **OpenHarmony SDK（brew，legacy）** | `$BREW/opt/ohos-sdk`（5 个分件 `ohos-sdk-{native,js,ets,previewer,toolchains}`） | **26.0.0.38**；HAP 链路**不再使用**（签名已切 CLT）；仅旧脚本/其他工具链兜底；**不是** hvigor 的 SDK 根 |
| **签名材料（新项目）** | **自己项目**：`certificate/<项目名>/`（AGC 申请后放这里，见 §4.0）；历史共享副本 `certificate/ohos-debug-signing/` 仅适用 bundle `com.whale.godotdemo`（绑定本机 UDID） |
| **AGC 凭据（新项目）** | 共享：`certificate/agc/agc.env`；项目专用：`certificate/<项目名>/agc.env` | 新项目用 `AGC_ENV_FILE` 指向；旧项目仍用 `~/.config/whale/agc.env` 不变 |
| hmos-clt 工具 | `<CLT>/hvigor/bin/hvigorw`、`<CLT>/ohpm/bin/ohpm`、`<CLT>/node/bin/node`（24.18.1） | **都不在 PATH**，用绝对路径 |
| devecocli | `/storage/Users/currentUser/npm/bin/devecocli`（1.3.8）；也可 `node /storage/Users/currentUser/npm/lib/node_modules/@deveco/deveco-cli/cli.js …` | 需要 brew node@24 在 PATH |
| ohos-sdk | `$BREW/opt/ohos-sdk/bin` | `hdc`、`hap-sign-tool`、`binary-sign-tool`、`restool`、`packing_tool` |
| hdc（真身） | `$BREW/opt/ohos-sdk/bin/hdc`（3.2.0f）；CLT 里也有一份 | 沙箱内直接调会静默，必须走桥 |
| hdc 桥 | `$HOME/bin/hdc`、`$HOME/bin/hdcb`（自动起桥）；零件 `DSHM问题汇总与解决/hdc-bridge/` | `hdc list targets -v` 是唯一判据 |
| AGC CLI | `$HOME/bin/agc`（包装官方技能 **`hmos-connect-api-cli-skill`**；本地 `Common/agc-skill/hmos-connect-api-cli-skill/`） | 凭证 `~/.config/whale/agc.env`，不打印 |
| Godot 引擎 kit | `Common/godot-ohos` | 含 OHOS 导出模板；HAP 流程见 §7 |
| .NET（可选） | `~/.dotnet-ohos/env.sh` | Godot C# HAP 的 NativeAOT 链路见 §7.2 |

> 缺工具：先 `brew search` 再 `brew install`（本仓 = AtomGit `Harmonybrew/brew`）。不要重复探测。

> **SDK 不要混用**：brew `ohos-sdk`（OpenHarmony SDK，当前 26.0.0.38）与 hmos-clt 自带 SDK（HarmonyOS SDK，当前 26.0.0.105）是两套不同产品线，版本号不可直接比较。**构建 HAP 时 hvigor/DevEco 必须用 CLT 的 SDK**；brew SDK 只用于命令行（hdc/hap-sign-tool/binary-sign-tool/NDK/clang）。
>
> **签名/打包：官方优先**。HAP 链路已切到 CLT：`<CLT>/sdk/default/openharmony/toolchains/lib/{hap-sign-tool,binary-sign-tool,ohos_packing_tool}`（本机 `~/.ohos/godot-demo-signing/sign-app-template.sh` 已改为优先 CLT，实测签名 + `hdc install -r` 通过）。brew `$BREW/opt/ohos-sdk/bin/…` 同名工具仅作为**旧环境 fallback**，新脚本不要再用；不要为了 HAP 去依赖 brew SDK。

### 1.1 官方资料 / 样例入口

| 入口 | 用法 |
|---|---|
| 官方离线文档 | `devecocli docs search <关键词>` / `devecocli docs read <id>`（本机已装，最优先） |
| 官方技能 | `devecocli skills list`（49 个） / `devecocli skills find <关键词>`；**AGC 对应 `hmos-connect-api-cli-skill`** |
| 官方样例 | AtomGit `HarmonyOS_Samples`（直连，约 459 个仓库）：ArkUI 组件、最佳实践、场景样例；版本偏旧，用前核对 API 26 |
| 本机应用源码 | `Common/whale/`（Whale 自身，ArkTS + 原生，读前先看其 `AGENTS.md`） |
| 现成 HAP 工程 | `ApiBox`、`Games/godot-demo/_build/hap/MOWDOWN/`（Godot 生成的标准 DevEco 工程） |
| DevEco Studio（GUI） | **已安装**：bundle `com.huawei.devecostudio`，版本 **26.0.0.201**（`versionCode 2600201`，AppGallery release；codePath `/data/app/el1/bundle/public/com.huawei.devecostudio`）；从桌面图标启动。⚠️ 它是鸿蒙应用，安装目录 `0700`/属主他人 ⇒ 沙箱读不到，**不要设 `DEVECO_HOME` 指过去**；构建/签名仍走 CLI（devecocli + hmos-clt），GUI 只是可选 |

### 1.2 开发语言/框架速查

| 层 | 用什么 |
|---|---|
| UI | ArkUI（声明式 `@Component` / `@Entry`），页面在 `entry/src/main/ets/pages/` |
| 逻辑 | ArkTS（TypeScript 超集；`@ohos.*` 系统 API） |
| 原生 | C/C++ → NDK（`$BREW/opt/ohos-sdk-native`）→ `.so`（需 `.codesign`，见 `docs/03`） |
| 包管理 | `ohpm` + `oh-package.json5` |
| 测试 | `devecocli check` / `hmos-local-test` 等官方技能；真机日志用 hdc |

## 2. 从零到 HAP 的两条路线

### 2.1 已有工程（最常见）

```sh
CLT=/data/service/hnp/hmos-clt.org/hmos-clt_1.0.0
cd <project-root>

# 依赖（如果工程有 oh-package.json5）
"$CLT/ohpm/bin/ohpm" install --all

# 构建（debug）
"$CLT/hvigor/bin/hvigorw" assembleHap --mode module -p product=default --no-daemon

# 产物
ls entry/build/default/outputs/default/*.hap
```

### 2.2 新建 ArkTS 工程

- 本机**已装 DevEco Studio**（GUI 可选，从桌面图标启动）；CLI 路线可用 `devecocli create` 脚手架（官方 CLI，本机未逐项验证），或从现有工程复制骨架。
- 工程最小结构：`AppScope/app.json5` + `entry/src/main/module.json5` + `entry/src/main/ets/**` + `oh-package.json5` + `build-profile.json5` + `hvigorfile.ts`。
- 参考现成工程：`ApiBox`、`Games/godot-demo/_build/hap/...`（Godot 生成后也是标准 DevEco 工程）。

### 2.3 devecocli 顺手命令

```sh
export PATH="/storage/Users/currentUser/npm/bin:$PATH"       # devecocli
export PATH="/storage/Users/currentUser/.harmonybrew/opt/node@24/bin:$PATH"

devecocli docs search <关键词>       # 华为官方离线文档
devecocli docs read <docId>
devecocli skills list|find <词>      # 49 个官方鸿蒙技能
devecocli build                      # 构建当前工程
devecocli run                        # 构建 + 装到设备 + 启动
devecocli device list                # 设备
devecocli log                        # 拉设备应用日志
devecocli signature generate         # DevEco 自动签名（需 auth login）
devecocli auth status|login
devecocli check                      # 工程检查
devecocli ui                         # 设备 UI 检查/交互
```

> `devecocli` 是 CLI（不是 DSH 插件）；`docs`/`skills` 已在本机用过，其余子命令**未逐一验证**，失败时以 `--help` 为准。

### 2.4 ArkTS/ArkUI 最小骨架（新建工程可对照）

```ts
// entry/src/main/ets/pages/Index.ets
@Entry
@Component
struct Index {
  @State message: string = 'Hello HarmonyOS';

  build() {
    Column({ space: 12 }) {
      Text(this.message).fontSize(24)
      Button('点我').onClick(() => { this.message = 'clicked'; })
    }
    .width('100%').height('100%')
    .justifyContent(FlexAlign.Center)
  }
}
```

- 页面清单：`entry/src/main/resources/base/profile/main_pages.json` 里登记 `pages/Index`。
- 入口 Ability：`entry/src/main/ets/entryability/EntryAbility.ets` 的 `onWindowStageCreate` 里
  `windowStage.loadContent('pages/Index')`。
- `module.json5` 的 `abilities` 里声明 `EntryAbility`（`exported: true`、`skills` 里带 `entity.system.home` 等）。

## 3. HAP 构建关键点

- **SDK 来源**：hvigor 用 `<CLT>/sdk`（HarmonyOS SDK 26.0.0.105）；不要把它指到 `$BREW/opt/ohos-sdk`（OpenHarmony SDK，另一条产品线，API 元数据不同）。
- **hvigor 缓存**：需要已准备好的 pnpm 缓存。本机现成：
  `HVIGOR_USER_HOME=/storage/Users/currentUser/.hvigor`（内含 `wrapper/tools/10.28.2/node_modules/.bin/pnpm`）。
- **TMPDIR 必须 0700 且可写**：用户存储上 `chmod` 不生效，必须用沙箱私有目录，例如
  `TMPDIR=$HOME/.cache/godot-ohos-build-tmp`（`chmod 700` 生效）。
- **SDK/CLT 显式传入**（很多导出器/脚本用环境变量）：
  `GODOT_OHOS_COMMAND_LINE_TOOLS_ROOT=<CLT>`（Godot）；其他工具看各自文档。
- `build/export_project_only=true` 只生成 DevEco 工程、不构建；排查 preset/工程生成时用。
- HAP 产物未签名时**不能装**：`hdc install` 报 `code:9568320 no signature file`；先离线签。

## 4. 签名体系（HAP 与 ELF 是两回事）

### 4.0 AGC 材料存放规则（强制，2026-10-31 定）

- **凡是在 AGC 申请 / 签发的材料**——debug Profile、release Profile、证书 `.cer`、`p12`、CSR、口令、服务账号凭据等——**一律放 `certificate/<项目名>/`**（项目名 = 本项目目录名或约定短名）。
- 目录内放一个 `README.md`：写明 **bundleName、设备 UDID、证书/Profile 有效期、申请日期、来源（AGC 手工/`agc-cli`）**。
- **禁止**把新申请的 AGC 材料放 `~/.ohos/`、`~/.config/whale/`、`$HOME` 或项目源码目录；这些旧位置只保留给历史项目兼容。
- AGC **服务账号凭据**：共享副本放 `certificate/agc/`；项目专用凭据放 `certificate/<项目名>/agc.env`（用 `AGC_ENV_FILE` 指向）。
- 旧项目若已有材料在旧路径，**可保留原路径不动**（兼容）；**新项目、新申请的材料必须遵守本规则**。
- `certificate/` 含私钥/口令：**不入库、不打印、不外发**；`README` 只写路径，不写口令。

示例：

```text
certificate/
├── agc/                     # 共享 service account 凭据（agc.env）
├── ohos-debug-signing/      # 历史共享副本（仅 com.whale.godotdemo + 本机 UDID）
└── <项目名>/
    ├── README.md            # bundle / UDID / 有效期 / 来源
    ├── key_<id>.p12
    ├── cert_<id>.cer
    ├── profile_<id>.p7b
    ├── 口令.txt              # 不打印/不入库
    └── sign-app.sh          # 可选：自定位签名入口
```

### 4.1 HAP 签名（应用包签名）

- **debug**：AGC 调试证书 + 调试 Profile（**绑定设备 UDID + bundle**）。
  - **新项目**：在 AGC 申请后，把 `.p12/.cer/.p7b/口令` 放 **`certificate/<项目名>/`**（§4.0），并放一个自定位的 `sign-app.sh`（可参考 `certificate/ohos-debug-signing/sign-app.sh`）。
  - `certificate/ohos-debug-signing/` 是历史共享副本，**只适用 bundle `com.whale.godotdemo` + 本机 UDID**；换 bundle/换设备必须重新申请 profile。
  - 口令从项目目录 `口令.txt` 读取，不打印。
- **release**：AGC 正式证书 + 发布 Profile；上传 AGC 用 **`.app`**（不是 `.hap`），≥5MB 自动分片。
- 命令模型（模板脚本内部等价）：

```sh
$BREW/bin/hap-sign-tool sign-app \
  -mode localSign -keyAlias <alias> -keyPwd "$PW" \
  -appCertFile <cert.cer> -profileFile <profile.p7b> \
  -inFile unsigned.hap -outFile signed.hap \
  -signAlg SHA256withECDSA -keystoreFile <key.p12> -keystorePwd "$PW" \
  -compatibleVersion <HAP 的 minAPIVersion，如 260000026> -signCode 1
```

- `compatibleVersion` 从 HAP 的 `module.json` → `app.minAPIVersion` 读，**不要手填 26**。
- 查看已装应用的签名/版本：`hdc shell "bm dump -n <bundle>"`（`appProvisionType` / `versionCode` / `appIdentifier`）。

### 4.2 受限权限 / ACL

> **AGC 官方技能名**：**`hmos-connect-api-cli-skill`**（完整规则：`Common/agc-skill/hmos-connect-api-cli-skill/SKILL.md`；DSH 技能目录里的 `agc-cli` 是它的本地包装/别名）。
> 重装/升级：`devecocli skills add --skill hmos-connect-api-cli-skill --path <目录>`。

- 默认权限在 `module.json5` 的 `requestPermissions` 里声明即可。
- **受限权限（restricted permission）** 必须由 AGC 在 **Profile 的 ACL** 里批准，否则安装/运行被拒。
  例：应用内 JIT 需要 `ohos.permission.kernel.ALLOW_WRITABLE_CODE_MEMORY`。
- 走 `hmos-connect-api-cli-skill`（DSH 侧别名 `agc-cli`，本地 `Common/agc-skill/hmos-connect-api-cli-skill/`）可自动申请/更新 Profile ACL；**证书有配额，别乱删**。
- **新项目的 AGC 凭据**用 `certificate/agc/agc.env`（副本）：`AGC_ENV_FILE=/storage/Users/currentUser/projects/DSH_Proj/certificate/agc/agc.env agc auth status`；旧项目默认路径 `~/.config/whale/agc.env` 不变。
- **NativeAOT / 纯 AOT 应用不需要 JIT ACL**（已验证：Godot C# HAP）。

### 4.4 release 签名与上架（流程级）

1. AGC 创建应用（bundle 与 `AppScope/app.json5` 一致）→ 申请**发布证书** + **发布 Profile**（可含 ACL）。
2. `devecocli build`/`hvigorw` 出 **release HAP** → 用发布证书签名。
3. 上架/测试分发：把 `.hap` 打包成 **`.app`**（`ohos_packing_tool`/AGC 上传流程；`hmos-connect-api-cli-skill`/`agc-cli` 可自动化），
   上传 AGC → 提交审核；`.hap` 只用于本机 `hdc install`。
4. 发布 Profile 不绑定设备，但**绑定 bundle 与证书**；换 bundle/证书必须重签。
5. 证书/Profile 有配额，**不要删除**现有 AGC 材料；操作前先看 `hmos-connect-api-cli-skill`（`agc-cli`）的安全说明。

### 4.3 自编原生 `.so` 的 `.codesign`

- 自编 ELF（`.so`/可执行）需要 `.codesign` 段：用 `binary-sign-tool sign -selfSign 1`；详见 `docs/03`。
- HAP 里的 `libs/arm64-v8a/*.so` 也要满足这条（Godot AOT 库靠 linker 自带 `.codesign`，dlopen 可加载）。
- 常见坑：带 `.codesign` 的 ELF 再签会报 `section already exists`；先 `llvm-objcopy --remove-section .codesign` 再签；`exec` 路径对签名更严格（AppHost/NativeAOT 可执行体曾遇到 EPERM，HAP 内 dlopen 路径正常）。

### 4.5 更新**已上架**版本：上传 + 提审的两个必踩坑（2026-10-31 实测，ApiBox 1.0.0→1.0.1）

> 前置：`agc` 包装可用（§1）、发布证书/Profile 在 `certificate/<项目名>/`（§4.0）、`.app` 已出且验签通过。
> 本节结论适用于**任何用 `agc` 更新已上架应用**的项目；现成实现可抄 `ApiBox/tools/94-agc提审.mjs`。

**第 1 步 · 上传（CLI 可用）**

```sh
agc upload file -a <APP_ID> -f <abs-path>.app -r 1        # .ret.code==0 且 bound==true，记下 packageId
agc publish compile-status -a <APP_ID> --pkg-ids <packageId>   # successStatus==1 才算解析通过
```

上传只「挂包」不改线上：`app-info.onShelfVersion*` 仍是线上旧版，`releaseState` 不变。

**坑① `agc publish submit` 直接调用必 400（CLI 缺陷，错误体还被吞掉）**

- 现象：`Request failed: Request failed with status code 400`，没有任何细节。
- 真因（拦响应体才看到）：`Parameter is not valid for operation [...submitApp]. Parameter is [appId] ... Parameter is required.`
  —— CLI v1.1.4 把 `appId` 只放 **header**，而 `POST /api/publish/v3/app-submit` 要求 `appId` 在 **query**。
- 正确调用（直连 API，推荐）：

```sh
# token 直接复用 CLI 缓存，不要自己造： $HOME/.connect-api-cli-token.json
# {accessToken, clientId, expiresAt(ms)}；过期先跑一次 agc auth status 刷新
curl -s -X POST \
  "https://connect-api.cloud.huawei.com/api/publish/v3/app-submit?appId=<APP_ID>" \
  -H "Authorization: Bearer <accessToken>" \
  -H "client_id: <clientId>" \
  -H "Content-Type: application/json" \
  -d '{"releaseType":1,"remark":"<审核备注>"}'
# 判据：{"ret":{"code":0,"msg":"success"}}
```

- 备选（不改 skill 文件）：`NODE_OPTIONS="--require ./agc-preload.js" agc publish submit …`，
  preload 里给 `https.request` 的 response 挂监听，并把 header 里的 appId 注入 query。
- **附：怎么看 AGC API 的真实错误**——CLI 只打印 HTTP 码。做法：预加载 patch `https.request`，
  对 4xx 响应收集 body 并 **gunzip**（AGC 有时回 gzip 但**不带 `content-encoding`**，直接读是乱码）。
  示例 preload 与完整踩坑记录见 `ApiBox/78-AGC-CLI接入与验证.md` §6.6。

**坑② 升级版本提审前必须填 `newFeatures`（版本更新说明），否则业务码 204144692**

- 现象：`[AMIS] submit version for review failed ... [AppGalleryConnectAppMetaInfoService]newFeatures is necessary!`
- 真因：AGC 规定「升级版本时 `newFeatures` 必填」（`更新应用语言信息` 接口 Body：`newFeatures`，String(500)）。
- 修法（保留现有字段，别把商店页信息冲掉）：

```sh
# 1) 先 GET 现有语言信息（拿到 appName/appDesc/briefInfo，稍后原样带回）
#    GET /api/publish/v3/app-info?appId=<APP_ID>&releaseType=1&lang=zh-CN
#    → languages[0] = {lang, appName, appDesc, briefInfo, deviceMaterials…}
# 2) PUT 更新 newFeatures
#    PUT /api/publish/v3/app-language-info?appId=<APP_ID>&releaseType=1
#    body = {"lang":"zh-CN","appName":"…","appDesc":"…","briefInfo":"…","newFeatures":"…"}
# 3) 再 GET 校验：appName/appDesc/briefInfo/deviceMaterials 未变、newFeatures 已写入
```

- `newFeatures` ≤ **500** 字；建议写「本版修复/新增」3–6 条，别贴跑题内容。
- 工作区现成实现（两条命令搞定）：
  `node ApiBox/tools/94-agc提审.mjs --check` / `--set-newfeatures <文本文件>` / `--submit --remark "…"`。

**状态判定与回退**

| 字段 | 含义 |
| --- | --- |
| `appInfo.releaseState = 7` | 已上架（线上生效） |
| `appInfo.releaseState = 12` | **审核中**（提审成功的直接判据） |
| `appInfo.onShelfVersionName/Code` | 提审后仍是**线上旧版**，审核通过才切新版 |
| 版本记录 `state` | 同上（与 releaseState 同义） |

- 撤回审核：`agc publish cancel-review -a <APP_ID> -v <versionId>`（**写操作，执行前问用户**）。
- 审核期间不要重复提审；被拒 → 按意见修 → 递增 versionCode 重出包 → 重新上传提审。

## 5. hdc：装机 / 启动 / 日志 / 截图

### 5.1 沙箱内必须走桥

- 沙箱里原生 `hdc` 会**静默失败**（server 起不来）；判据只看 `hdc list targets -v`。
- 桥：`sh DSHM问题汇总与解决/hdc-bridge/bridge.sh` 建好后，`$HOME/bin/hdc` / `$HOME/bin/hdcb` 自动起桥。
- 本机 PC 自己：需要**无线调试**端口（当前目标如 `127.0.0.1:35983`）；USB 手机/平板可走宿主 hdc 或 `hdc-via-host.sh`。

### 5.2 常用命令

```sh
export PATH="$HOME/bin:$PATH"
hdc list targets -v                    # 必须有 Connected
hdc install -r signed.hap              # 装机；不允许降级（versionCode 只能升）
hdc shell "aa start -b <bundle> -a EntryAbility"
hdc shell "pidof <bundle>"
hdc shell "aa force-stop -b <bundle>"  # 停应用（不删数据）
hdc shell "bm dump -n <bundle>"        # 版本/签名信息
hdc shell "ls -t /data/app/el2/100/base/<bundle>/files | head"
hdc shell "cat /data/app/el2/100/base/<bundle>/files/godot-<pid>-engine.log"
hdc shell "snapshot_display -f /data/local/tmp/shot.jpeg"   # 只认 .jpeg 后缀
hdc file recv /data/local/tmp/shot.jpeg ./shot.jpeg
hdc shell "uitest uiInput keyEvent 2050"                    # 注入按键（如空格）
```

### 5.3 日志

- 应用私有日志：`/data/app/el2/100/base/<bundle>/files/`（引擎/崩溃/诊断）。
- `hilog`：默认全局级别 **W**，`hilog.info()` 会被丢弃；抓取前 `hdc shell "hilog -b D"`，**用完还原 `hilog -b W`**；缓冲区仅 512KB，边跑边抓。
- `dsh-hilog` 插件（`hilog_level/dump/capture`）与 `screen-pilot` 插件（`screen_capture`/`ui_*`）就是封装这些；沙箱内它们也走 hdc 桥。

## 6. HAP 结构与配置速查

| 文件/字段 | 要点 |
|---|---|
| `AppScope/app.json5` | `bundleName`、`versionCode`（**升级必须递增**）、`versionName`、`minAPIVersion` |
| `entry/src/main/module.json5` | `deviceTypes`（PC 用 `2in1`；手机 `phone`）、`abilities`、`requestPermissions` |
| `entry/build-profile.json5` | `compileSdkVersion`/`compatibleSdkVersion`（本机 26）、`runtimeOS`（HarmonyOS） |
| `libs/arm64-v8a/*.so` | 原生库；需 `.codesign` |
| `resources/rawfile/` | 打包进 HAP 的资源（Godot 的 `template.pck`、`godot_host.json` 在这里） |
| `.hap` vs `.app` | `.hap` 本机 `hdc install`；`.app` 用于 AGC 上传/审核 |

## 7. 现成参考（优先抄）

| 参考 | 内容 |
|---|---|
| `Games/godot-demo/tools/07-hap.sh` + `docs/10-HAP真机构建与调试.md` | **最完整的 HAP 端到端**：export → hvigor → 未签名 HAP → AGC 离线签 → `hdc install -r` → `aa start` → 日志；含截图证据与坑 |
| `Games/godot-demo/_build/hap/MOWDOWN/` | 标准 DevEco 工程样例（ArkTS 壳 + C++ N-API + libgodot.so） |
| `DSHM问题汇总与解决/hdc-bridge/README.md` | hdc 桥的完整因果链与修复记录 |
| `Common/agc-skill/` | AGC CLI + 官方技能 **`hmos-connect-api-cli-skill`**（证书/Profile/ACL/上传/审核；`SKILL.md` 完整规则） |
| `Common/godot-ohos/README.md` | Godot OHOS kit：导出模板、C# 支持、HAP 导出 |
| `Eva-Research/2026-10-30-mono-harmonybrew-移植评估/docs/14…` | Godot C# HAP 实测（NativeAOT、无 runtime/JIT ACL） |

### 7.1 Godot → HAP 速记

```sh
export GODOT_OHOS_COMMAND_LINE_TOOLS_ROOT=<CLT>
export HVIGOR_USER_HOME=/storage/Users/currentUser/.hvigor
export TMPDIR=$HOME/.cache/godot-ohos-build-tmp   # chmod 700
godot --headless --path <proj> --export-debug OpenHarmony out/MOWDOWN.hap
sh <sign-dir>/sign-app-template.sh out/MOWDOWN.hap out/MOWDOWN-signed.hap
hdc install -r out/MOWDOWN-signed.hap
```

### 7.2 Godot C# → HAP（两个额外坑）

- `.sln` 必须用 `dotnet new sln -f sln`（.NET 10 默认 `.slnx`，Godot 不认）。
- csproj 加 `<OpenHarmonyCodesignEnabled>false</OpenHarmonyCodesignEnabled>`（否则 `dotnet publish` 二次签名报 `.codesign section already exists`）。
- kit 会自动产出 **NativeAOT 共享库** `libgodot-csharp-game.so`，HAP 内无 .NET runtime/托管 DLL，**不需要嵌 runtime、不需要 JIT ACL**。

## 7.3 HAP 工具链归属与 brew 卸载边界（2026-10-31 审计）

**HAP 链路已全部走官方（hmos-clt / devecocli / AGC skill），不再依赖 brew 的 `ohos-sdk`：**

| 环节 | 当前使用 |
|---|---|
| 构建 | hmos-clt 的 `hvigorw` + HarmonyOS SDK 26.0.0.105 |
| 签名 | `<CLT>/sdk/default/openharmony/toolchains/lib/hap-sign-tool`（`~/.ohos/godot-demo-signing/sign-app-template.sh` 已切；实测签名 + `hdc install -r` 通过） |
| 打包 | hvigor 调 CLT 的 `ohos_packing_tool` |
| 装机/日志 | `$HOME/bin/hdc`（桥，实际调用 CLT 的 hdc） |
| AGC | `hmos-connect-api-cli-skill`（`$HOME/bin/agc`） |

**但 brew 的 `ohos-sdk*` 不能直接卸载**（严格检测结论：会影响非 HAP 工具链）：

```sh
brew uses --installed ohos-sdk-native
# llvm@22、llvm-gcc-compat（以及 ohos-sdk 自身）
brew uses --installed ohos-sdk-ets/js/previewer/toolchains
# llvm-gcc-compat
```

- `llvm@22` 依赖 `ohos-sdk-native` 的 **OHOS sysroot / libcxx 头文件**；
- `llvm-gcc-compat` 依赖全部 `ohos-sdk*` 组件（把 gcc/cc 软链到 OHOS clang）；
- `$BREW/bin/clang`、`$BREW/bin/llvm-objcopy` 等符号链接也指向 `ohos-sdk`。

⇒ **不要 `brew uninstall ohos-sdk*`**，否则会破坏 `llvm@22` / `llvm-gcc-compat` / `$BREW/bin/clang`，影响范围超出 HAP。  
⇒ 正确做法：**HAP 脚本/文档切到 CLT（已做），brew 的 OHOS 包保留作为 llvm 工具链的底层依赖，不再被 HAP 引用**。若将来要彻底移除，需要先给 `llvm@22`/`llvm-gcc-compat` 找替代 sysroot，属另一个工程。

## 8. 常见坑（汇总）

| 现象 | 原因 / 解法 |
|---|---|
| `hdc` 无输出/静默 | 沙箱 hdc server 起不来；走 `$HOME/bin/hdc`（桥），判据 `list targets -v` |
| `hdc install` → `code:9568320 no signature file` | HAP 未签；先 `hap-sign-tool sign-app`（Profile 绑定本机 UDID） |
| `hdc install` 拒绝 | 不允许降级；把 `versionCode` 递增后重新构建 |
| hvigor 报缺 pnpm/缓存 | 设 `HVIGOR_USER_HOME` 到已有 wrapper 的目录（本机 `/storage/Users/currentUser/.hvigor`） |
| 构建报 `TMPDIR must be 0700` | 用户存储 chmod 不生效；换沙箱私有目录并 `chmod 700` |
| 导出报 `ETC2/ASTC texture compression must be enabled` | Godot：`textures/vram_compression/import_etc2_astc=true` |
| Godot 导出报 Compatibility 驱动 | `gl_compatibility/driver="opengl3"` |
| 找不到 CLT/SDK | 显式传 `GODOT_OHOS_COMMAND_LINE_TOOLS_ROOT=<CLT>` |
| `snapshot_display` 报 suffix | 输出文件名必须 `.jpeg`（不是 `.png`） |
| `screen_capture` 工具超时 | 插件走 hdc 可能 timeout；改用 `hdc shell snapshot_display` + `file recv` |
| 应用日志找不到 | 在 `/data/app/el2/100/base/<bundle>/files/`，按 pid 命名 |
| 自编 ELF 加载被拒 | 需要 `.codesign`（`binary-sign-tool sign -selfSign 1`，见 `docs/03`） |
| 二次签名报 `.codesign already exists` | 先 `llvm-objcopy --remove-section .codesign` 再签（或导出时关掉重复签名 target） |
| 改 bundle 后装不上 | debug Profile 绑定 `bundleName`；换 bundle 需重新申请 AGC Profile |
| 换设备装不上 | debug Profile 绑定设备 UDID；需 AGC 更新 Profile |
| AGC 证书/Profile 配额 | 不要删除现有证书/材料；需要新证书先看 `hmos-connect-api-cli-skill`（`agc-cli`） |
| hvigor 报 SDK/API 不匹配 | 混用了 SDK：hvigor/DevEco 用 `<CLT>/sdk`（HarmonyOS SDK 26.0.0.105），不是 `$BREW/opt/ohos-sdk`（OpenHarmony SDK 26.0.0.38） |
| HAP 修改后不生效 | 确认 `versionCode` 递增、`hdc install -r` 覆盖、`aa force-stop` 后重启 |
| `agc publish submit` 报 400 且无错误体 | CLI v1.1.4 把 `appId` 放 header，`app-submit` 要 query ⇒ 直连 API 或 preload 注 query（§4.5 坑①） |
| 提审返回 `204144692 newFeatures is necessary!` | 升级版本必填版本更新说明 ⇒ PUT `app-language-info` 带 `newFeatures`（保留 appName/appDesc/briefInfo，§4.5 坑②） |
| 看不到 AGC 真实错误原因 | CLI 只打印 HTTP 码 ⇒ preload 拦 `https.request` 的 4xx 响应体并 gunzip（§4.5 坑①附） |

## 9. 安全边界（硬约束）

- ⛔ 不 `hdc uninstall`、不清应用数据、不删 `~/.ohos` 签名材料（真实事故教训）。
- ⛔ 不打印/复制 AGC 口令、`.p12`、`.p7b`、服务账号私钥；只写路径。
- ✅ `hdc install -r`、`hdc shell`、`aa start/force-stop`、`bm dump`、`hilog`、截图属于允许的调试操作。
- 真机 UI 冒烟默认交给用户；需要自动化时用 `ui_*`/`uitest`，并注意 `hilog` 级别还原。

## 10. 速查（复制即用）

```sh
BREW=/storage/Users/currentUser/.harmonybrew
CLT=/data/service/hnp/hmos-clt.org/hmos-clt_1.0.0
export PATH="$HOME/bin:$BREW/opt/node@24/bin:/storage/Users/currentUser/npm/bin:$PATH"

# 设备
hdc list targets -v

# 构建
"$CLT/ohpm/bin/ohpm" install --all
"$CLT/hvigor/bin/hvigorw" assembleHap --mode module -p product=default --no-daemon

# 签名（替换成你的材料路径）
sh certificate/<项目名>/sign-app.sh unsigned.hap signed.hap

# 安装/启动/日志
hdc install -r signed.hap
hdc shell "aa start -b <bundle> -a EntryAbility"
hdc shell "ls -t /data/app/el2/100/base/<bundle>/files | head"
```

## 11. 验收清单（每次出 HAP 必过）

- [ ] HAP 签名成功（`hap-sign-tool` 无报错；`bm dump` 显示 `appProvisionType=debug`）
- [ ] `versionCode` 比已装版本大（或首次安装）
- [ ] `hdc install -r` 成功；`aa start` 后进程存在
- [ ] 应用日志无 crash/exception；关键功能日志命中
- [ ] 需要时截图（`.jpeg`）留证
- [ ] `hilog` 级别已还原（`-b W`）
- [ ] 构建脚本/命令已写进 `tools/`，下次一条命令可复跑
- [ ] （更新已上架版本时）上传 `bound=true`、`compile-status successStatus=1`、提审后 `releaseState=12`；
      `newFeatures` 已填且 ≤500 字、商店页 appName/appDesc/briefInfo/截图未被清空（§4.5）
