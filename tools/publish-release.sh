#!/system/bin/sh
# 发布资产到 GitHub + AtomGit。用法:
#   sh tools/publish-release.sh --tag lightpanda-1.1.0-dev.11522 [--assets DIR]
# 需要:
#   - gh 已登录（GitHub）
#   - ATOMGIT_TOKEN 或 ATOMGIT_TOKEN_FILE（AtomGit PRIVATE-TOKEN）
# 说明: AtomGit 不支持同名附件覆盖，tag 变一次就传一次新文件。
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
ASSETS=$ROOT/_build/assets
TAG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG=$2; shift 2;;
    --assets) ASSETS=$2; shift 2;;
    *) echo "unknown arg: $1"; exit 2;;
  esac
done
[ -n "$TAG" ] || { echo "缺少 --tag"; exit 2; }
[ -d "$ASSETS" ] || { echo "资产目录不存在: $ASSETS"; exit 2; }
cp "$ROOT/skill/dsh-lightpanda/assets/manifest.json" "$ASSETS/manifest.json"
GH_REPO=${GH_REPO:-fufay/dsh-lightpanda-skill}
AT_REPO=${AT_REPO:-Kevin911/dsh-lightpanda-skill}
NOTES=$ROOT/_build/release-notes.md
if [ ! -f "$NOTES" ]; then
  printf '# lightpanda assets %s\n\nPlatform binaries + manifest (sha256).\n' "$TAG" > "$NOTES"
fi
B=/storage/Users/currentUser/.harmonybrew/bin
GH=$B/gh
[ -x "$GH" ] || GH=gh
echo "== GitHub release =="
if "$GH" release view "$TAG" --repo "$GH_REPO" >/dev/null 2>&1; then
  echo "[gh] release 已存在"
else
  "$GH" release create "$TAG" --repo "$GH_REPO" --title "$TAG" --notes-file "$NOTES"
fi
echo "== GitHub 上传 =="
for f in "$ASSETS"/*; do [ -f "$f" ] && "$GH" release upload "$TAG" "$f" --repo "$GH_REPO" --clobber; done
echo "== AtomGit release =="
python3 "$ROOT/tools/atomgit_release.py" --repo "$AT_REPO" --tag "$TAG" --name "$TAG" --body-file "$NOTES" --assets "$ASSETS"
echo "✅ 完成"
echo "GitHub:  https://github.com/$GH_REPO/releases/tag/$TAG"
echo "AtomGit: https://atomgit.com/$AT_REPO/releases/tag/$TAG"
