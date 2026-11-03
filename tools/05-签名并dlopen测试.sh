#!/bin/sh
# 05-签名并dlopen测试.sh —— 原生 .so 打 self-sign（补 .codesign）后 dlopen 可行性测试（E2 泛化版）
# 来源：Common/mc-runtime-lab 的 E2（docs/10 §8）验证：-selfSign 1 → dlopen 成功；app 签名不被接受。
#
# 用法：
#   sh tools/05-签名并dlopen测试.sh -s <目标.so> [-d <依赖.so> ...] [-y <要 dlsym 的符号>] [-o <输出目录>]
#   或环境变量：TARGET=... DEPS="a.so b.so" SYMBOL=... OUT=... sh tools/05-签名并dlopen测试.sh
#
# 前提：HarmonyOS 设备/开发域（已验证：develop_tools_debug_hap + 用户存储）
# 边界：/tmp 应用数据目录仍不能 dlopen；普通 HAP 应用域未验证（库放 HAP libs/ 随包安装后重测）
set -u
BIN_SIGN_TOOL=${BIN_SIGN_TOOL:-}
CLANG=${CLANG:-}
TARGET=${TARGET:-}
DEPS=${DEPS:-}
SYMBOL=${SYMBOL:-}
OUT=${OUT:-_build/dlopen-test}

while [ $# -gt 0 ]; do
  case "$1" in
    -s) TARGET=$2; shift 2 ;;
    -d) DEPS="$DEPS $2"; shift 2 ;;
    -y) SYMBOL=$2; shift 2 ;;
    -o) OUT=$2; shift 2 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done
[ -n "$TARGET" ] || { echo "用法: sh $0 -s <目标.so> [-d 依赖.so ...] [-y 符号] [-o 输出目录]" >&2; exit 2; }
[ -f "$TARGET" ] || { echo "❌ 找不到目标: $TARGET" >&2; exit 2; }

[ -n "$BIN_SIGN_TOOL" ] || BIN_SIGN_TOOL=/data/service/hnp/hmos-clt.org/hmos-clt_1.0.0/sdk/default/openharmony/toolchains/lib/binary-sign-tool
[ -x "$BIN_SIGN_TOOL" ] || BIN_SIGN_TOOL=$(command -v binary-sign-tool 2>/dev/null || true)
[ -x "$BIN_SIGN_TOOL" ] || { echo "❌ 找不到 binary-sign-tool" >&2; exit 2; }
[ -n "$CLANG" ] || CLANG=$(command -v clang 2>/dev/null || echo /storage/Users/currentUser/.harmonybrew/bin/clang)
[ -x "$CLANG" ] || { echo "❌ 找不到 clang" >&2; exit 2; }

mkdir -p "$OUT/dep_signed" || exit 2
say() { printf '%s\n' "$*"; }

say "== 1) self-sign 目标：$TARGET"
OUT_TARGET="$OUT/selfsign-$(basename "$TARGET")"
"$BIN_SIGN_TOOL" sign -inFile "$TARGET" -outFile "$OUT_TARGET" -selfSign 1 >/dev/null 2>&1 || {
  echo "❌ 签名失败（-selfSign 1 不需要证书/profile；看 docs/03）" >&2; exit 3; }
say "   → $OUT_TARGET"
if command -v readelf >/dev/null 2>&1 && readelf -S "$TARGET" 2>/dev/null | grep -qi codesign; then
  say "   ℹ️ 原始目标已带 .codesign（多为 brew clang 链接期自签）；display-sign 可确认"
fi

say "== 2) self-sign 依赖（必须逐个；LD_LIBRARY_PATH 不能有未签版本抢先）"
for d in $DEPS; do
  [ -f "$d" ] || { echo "❌ 依赖不存在: $d" >&2; exit 3; }
  "$BIN_SIGN_TOOL" sign -inFile "$d" -outFile "$OUT/dep_signed/$(basename "$d")" -selfSign 1 >/dev/null 2>&1 || {
    echo "❌ 依赖签名失败: $d" >&2; exit 3; }
  say "   → dep_signed/$(basename "$d")"
done

if command -v readelf >/dev/null 2>&1; then
  say "== 3) 检查 .codesign"
  if readelf -S "$OUT_TARGET" 2>/dev/null | grep -qi codesign; then say "   ✅ 目标含 .codesign"; else say "   ❌ 目标缺 .codesign"; fi
fi

say "== 4) 编译 dlopen 探针（导出 __clear_cache，-Wl,-E）"
cat > "$OUT/dlopen_probe.c" <<'C'
#include <dlfcn.h>
#include <stdio.h>
/* compiler-rt 里是 local 符号：宿主必须导出，否则加载时报 symbol not found */
void __clear_cache(void *begin, void *end) { (void)begin; (void)end; }
int main(int argc, char **argv) {
  if (argc < 2) { printf("usage: %s <so> [symbol]\n", argv[0]); return 2; }
  void *h = dlopen(argv[1], RTLD_NOW | RTLD_GLOBAL);
  if (!h) { printf("FAIL dlopen: %s\n", dlerror()); return 1; }
  printf("PASS dlopen\n");
  if (argc >= 3) {
    void *sym = dlsym(h, argv[2]);
    if (!sym) { printf("FAIL dlsym(%s): %s\n", argv[2], dlerror()); return 1; }
    printf("PASS dlsym(%s)=%p\n", argv[2], sym);
  }
  return 0;
}
C
"$CLANG" -o "$OUT/dlopen_probe" "$OUT/dlopen_probe.c" -ldl -Wl,-E || { echo "❌ 探针编译失败" >&2; exit 4; }
say "   → $OUT/dlopen_probe"

say "== 5) dlopen 实测"
# shellcheck disable=SC2086
LD_LIBRARY_PATH="$OUT/dep_signed:${LD_LIBRARY_PATH:-}" "$OUT/dlopen_probe" "$OUT_TARGET" ${SYMBOL:-} || {
  echo "❌ FAIL（排查：app 签名不被接受 / 依赖未签 / 缺 __clear_cache / /tmp 限制 —— 见 docs/03）" >&2
  exit 5; }

say ""
say "✅ 完成。边界提醒："
say "   · self-sign 在 develop_tools_debug_hap + 用户存储下已验证；/tmp 应用数据目录另有限制"
say "   · 普通 HAP 应用域未验证 —— 决定性实验：库放 HAP libs/ 随包安装后重测"
