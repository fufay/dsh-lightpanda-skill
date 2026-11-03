#!/usr/bin/env node
// 解析/下载本平台对应的 lightpanda 二进制。
// 用法: node resolve.mjs [--path|--check] [--force]
// 环境变量:
//   DSH_LIGHTPANDA_CACHE    缓存目录（默认 ~/.cache/dsh-lightpanda）
//   DSH_LIGHTPANDA_ASSET_BASE  自定义下载基址（如 https://.../releases/download/<tag>/）
//   DSH_LIGHTPANDA_FORCE_ASSET  强制指定资产文件名（调试用）
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = JSON.parse(readFileSync(join(HERE, '..', 'assets', 'manifest.json'), 'utf8'));
const CACHE = process.env.DSH_LIGHTPANDA_CACHE || join(homedir(), '.cache', 'dsh-lightpanda');
const TAG = MANIFEST.release_tag;

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes('--' + n);

function platformKey() {
  const p = process.platform, a = process.arch;
  if (process.env.DSH_LIGHTPANDA_FORCE_ASSET) return process.env.DSH_LIGHTPANDA_FORCE_ASSET;
  if (p === 'openharmony') return 'lightpanda-aarch64-ohos';
  if (p === 'linux') return a === 'arm64' || a === 'aarch64' ? 'lightpanda-aarch64-ohos' : 'lightpanda-x86_64-linux';
  if (p === 'darwin') return a === 'arm64' ? 'lightpanda-aarch64-macos' : 'lightpanda-x86_64-macos';
  if (p === 'win32') {
    console.error('[resolve] lightpanda 没有原生 Windows 二进制。请在 WSL2 里运行本 skill（Windows 侧只做入口）。');
    console.error('          安装 WSL2: wsl --install；然后在 WSL 内按 Linux 使用（会自动下载 linux-x86_64 资产）。');
    process.exit(3);
  }
  console.error(`[resolve] 不支持的平台: ${p}/${process.arch}`);
  process.exit(3);
}

function assetFor(file) {
  return MANIFEST.assets.find((x) => x.file === file);
}

function sha256(path) {
  const h = createHash('sha256');
  h.update(readFileSync(path));
  return h.digest('hex');
}

function candidateUrls(file) {
  const urls = [];
  if (process.env.DSH_LIGHTPANDA_ASSET_BASE) urls.push(process.env.DSH_LIGHTPANDA_ASSET_BASE.replace(/\/$/, '') + '/' + file);
  urls.push(`https://atomgit.com/Kevin911/dsh-lightpanda-skill/releases/download/${TAG}/${file}`);
  urls.push(`https://github.com/fufay/dsh-lightpanda-skill/releases/download/${TAG}/${file}`);
  urls.push(`https://github.com/lightpanda-io/browser/releases/download/nightly/${file}`);
  return urls;
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
}

const file = platformKey();
const info = assetFor(file);
const dir = join(CACHE, TAG);
const bin = join(dir, 'lightpanda');

if (has('check')) {
  console.log(JSON.stringify({ platform: process.platform, arch: process.arch, file, cached: existsSync(bin), cacheDir: CACHE, tag: TAG, info }, null, 2));
  process.exit(0);
}

if (existsSync(bin) && !has('force')) {
  const ok = !info || sha256(bin) === info.sha256;
  if (ok) { console.log(bin); process.exit(0); }
  console.error('[resolve] 缓存文件校验失败，重新下载');
}

if (!info) { console.error(`[resolve] manifest 里没有 ${file}`); process.exit(4); }
let lastErr;
// 0) 本地目录优先（离线安装 / OHOS 用户手工放置）
const localDir = process.env.DSH_LIGHTPANDA_LOCAL_DIR;
if (localDir && existsSync(join(localDir, file))) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(bin, readFileSync(join(localDir, file)));
  const got = sha256(bin);
  if (!info || got === info.sha256) { chmodSync(bin, 0o755); console.error(`[resolve] OK ← ${join(localDir, file)}`); console.log(bin); process.exit(0); }
  console.error('[resolve] 本地文件 sha256 不匹配，回退到下载');
}
for (const url of candidateUrls(file)) {
  try {
    console.error(`[resolve] 下载 ${url}`);
    await download(url, bin);
    const got = sha256(bin);
    if (got !== info.sha256) throw new Error(`sha256 不匹配（期望 ${info.sha256.slice(0, 16)}…，得到 ${got.slice(0, 16)}…）`);
    chmodSync(bin, 0o755);
    console.error(`[resolve] OK → ${bin} (${info.size} bytes, ${file})`);
    console.log(bin);
    process.exit(0);
  } catch (e) { lastErr = e; console.error(`[resolve] 失败: ${e.message}`); }
}
console.error('[resolve] 所有镜像都失败：' + (lastErr?.message || ''));
process.exit(5);
