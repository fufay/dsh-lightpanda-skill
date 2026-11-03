#!/usr/bin/env node
// P2（无状态）：调用 lightpanda fetch 抓页面。
// 用法:
//   node fetch.mjs <url> [--dump markdown|html|structured_data|semantic_tree_text|png|pdf]
//                        [--wait-ms N] [--wait-selector S] [--cookie FILE] [--json]
//                        [--obey-robots] [--block-private-networks] [--no-telemetry]
//                        [--load-resources iframe,image,...] [--] [其他透传参数...]
// 输出: 默认原样透传 lightpanda 的 stdout（配合 --dump/--json 使用）
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
if (!argv.length || argv[0] === '-h' || argv[0] === '--help') {
  console.error('用法: node fetch.mjs <url> [--dump markdown] [--wait-ms 5000] [--cookie file] [--json] [--obey-robots] ...');
  process.exit(2);
}
const bin = execFileSync(process.execPath, [join(HERE, 'resolve.mjs'), '--path'], { encoding: 'utf8' }).trim();

const take = (name, def) => {
  const i = argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v ?? true;
};
const flag = (name) => { const i = argv.indexOf('--' + name); if (i < 0) return false; argv.splice(i, 1); return true; };

const dump = take('dump', 'markdown');
const waitMs = take('wait-ms', '5000');
const cookie = take('cookie', null);
const json = flag('json');
const obey = flag('obey-robots');
const blockPriv = flag('block-private-networks');
const loadRes = take('load-resources', null);
const noTelemetry = flag('no-telemetry');
// 允许用户用 -- 分隔透传参数
const sep = argv.indexOf('--');
const passthru = sep >= 0 ? argv.splice(sep + 1) : [];

const args = ['fetch', '--dump', String(dump), '--wait-ms', String(waitMs)];
if (cookie) args.push('--cookie', String(cookie));
if (json) args.push('--json');
if (obey) args.push('--obey-robots');
if (blockPriv) args.push('--block-private-networks');
if (loadRes) args.push('--load-resources', String(loadRes));
args.push(...passthru, ...argv);

const env = { ...process.env };
if (!noTelemetry) env.LIGHTPANDA_DISABLE_TELEMETRY = '1';
const child = spawn(bin, args, { stdio: 'inherit', env });
child.on('exit', (code, sig) => process.exit(code ?? (sig ? 1 : 0)));
