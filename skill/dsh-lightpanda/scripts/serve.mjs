#!/usr/bin/env node
// P3（有状态）：管理 lightpanda serve（CDP 服务）的生命周期。
// 用法:
//   node serve.mjs start   [--port 9223] [--cookie f] [--cookie-jar f] [--load-resources iframe]
//   node serve.mjs ensure  [同上]      # 不健康就启动（幂等）
//   node serve.mjs status  [--port 9223]
//   node serve.mjs stop    [--port 9223]
//   node serve.mjs restart [同上参数]
// 说明: 只监听 127.0.0.1；禁用 telemetry；启动失败会自动重试（V8 偶发 kMinStackAlignment 崩溃）
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = process.env.DSH_LIGHTPANDA_CACHE || join(homedir(), '.cache', 'dsh-lightpanda');
const STATE_DIR = join(CACHE, 'serve');

const argv = process.argv.slice(2);
const cmd = argv[0] || 'status';
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > 0 && argv[i + 1] ? argv[i + 1] : d; };
const flag = (n) => argv.includes('--' + n);
const port = Number(opt('port', '9223'));
const stateFile = join(STATE_DIR, `serve-${port}.json`);

function loadState() {
  try { return JSON.parse(readFileSync(stateFile, 'utf8')); } catch { return null; }
}
function saveState(s) { mkdirSync(STATE_DIR, { recursive: true }); writeFileSync(stateFile, JSON.stringify(s, null, 2)); }
function alive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }

async function health(port = 9223) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function binPath() {
  return execFileSync(process.execPath, [join(HERE, 'resolve.mjs'), '--path'], { encoding: 'utf8' }).trim();
}

async function start() {
  const existing = await health(port);
  if (existing) { console.log(JSON.stringify({ started: false, alreadyRunning: true, port, ...existing })); return; }
  const bin = binPath();
  const log = join(STATE_DIR, `serve-${port}.log`);
  mkdirSync(STATE_DIR, { recursive: true });
  const args = ['serve', '--host', '127.0.0.1', '--port', String(port), '--log-level', 'warn'];
  if (opt('cookie', null)) args.push('--cookie', opt('cookie', null));
  if (opt('cookie-jar', null)) args.push('--cookie-jar', opt('cookie-jar', null));
  if (opt('load-resources', null)) args.push('--load-resources', opt('load-resources', null));
  if (flag('obey-robots')) args.push('--obey-robots');
  if (flag('block-private-networks')) args.push('--block-private-networks');

  for (let attempt = 1; attempt <= 3; attempt++) {
    const fd = openSync(log, 'a');
    const child = spawn(bin, args, { detached: true, stdio: ['ignore', fd, fd], env: { ...process.env, LIGHTPANDA_DISABLE_TELEMETRY: '1' } });
    child.unref();
    const startedAt = new Date().toISOString();
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const h = await health(port);
      if (h) {
        saveState({ pid: child.pid, port, started_at: startedAt, log, version: h['Lightpanda-Version'], ws: h.webSocketDebuggerUrl });
        console.log(JSON.stringify({ started: true, attempt, pid: child.pid, port, ...h }));
        return;
      }
      if (!alive(child.pid)) break; // 崩了 → 重试
    }
    console.error(`[serve] 第 ${attempt} 次启动失败（V8 偶发崩溃？），重试`);
  }
  console.error('[serve] 启动失败，见日志: ' + log);
  process.exit(6);
}

async function stop() {
  const s = loadState();
  if (!s) { console.log(JSON.stringify({ stopped: false, reason: 'no state' })); return; }
  try { process.kill(s.pid, 'SIGTERM'); } catch {}
  await new Promise((r) => setTimeout(r, 800));
  try { if (alive(s.pid)) process.kill(s.pid, 'SIGKILL'); } catch {}
  rmSync(stateFile, { force: true });
  console.log(JSON.stringify({ stopped: true, pid: s.pid, port: s.port }));
}

async function status() {
  const s = loadState();
  const h = await health(port);
  console.log(JSON.stringify({ state: s, healthy: !!h, version: h?.['Lightpanda-Version'] ?? null, ws: h?.webSocketDebuggerUrl ?? null }, null, 2));
}

switch (cmd) {
  case 'start': await start(); break;
  case 'ensure': { const h = await health(port); if (h) console.log(JSON.stringify({ started: false, healthy: true, port, ...h })); else await start(); break; }
  case 'stop': await stop(); break;
  case 'restart': await stop(); await start(); break;
  case 'status': await status(); break;
  default: console.error('用法: node serve.mjs start|ensure|stop|restart|status [--port 9223] [--cookie f] [--cookie-jar f]'); process.exit(2);
}
