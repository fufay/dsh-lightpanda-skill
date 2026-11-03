#!/system/bin/sh
# 安装 skill 到 DSH skills 目录。用法: sh tools/install.sh [目标目录]
set -eu
HERE=$(cd "$(dirname "$0")/.." && pwd)
DEST=${1:-${DSH_HOME:-$HOME/.dsh}/skills}
mkdir -p "$DEST"
rm -rf "$DEST/dsh-lightpanda"
cp -r "$HERE/skill/dsh-lightpanda" "$DEST/dsh-lightpanda"
echo "✅ 已安装到 $DEST/dsh-lightpanda"
echo "   自检: node $DEST/dsh-lightpanda/scripts/resolve.mjs --check"
