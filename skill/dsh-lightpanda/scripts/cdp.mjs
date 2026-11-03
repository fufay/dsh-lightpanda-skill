#!/usr/bin/env node
// 零依赖 CDP 客户端（Node 24 内建 WebSocket）。
// 用法:
//   node cdp.mjs --port 9223 --url https://example.com --eval "document.title" [--wait-ms 5000]
//   node cdp.mjs --port 9223 --url https://x --poll-selector ".card" [--min 3] --eval "JSON.stringify([...document.querySelectorAll('.card')].map(e=>e.innerText))"
//   node cdp.mjs --port 9223 --eval-only "1+1"
// 输出: JSON {url,title,value}
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const flag = (n) => argv.includes('--' + n);
const port = Number(opt('port', '9223'));
const url = opt('url', null);
const evalExpr = opt('eval', null);
const evalOnly = flag('eval-only');
const waitMs = Number(opt('wait-ms', '5000'));
const pollSel = opt('poll-selector', null);
const pollMin = Number(opt('min', '3'));
const wantStatus = argv.includes('--status');

const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const ws = new WebSocket(v.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { const { res } = pend.get(d.id); pend.delete(d.id); res(d); } };
const send = (method, params = {}, sid) => new Promise((res) => { const i = ++id; pend.set(i, { res }); ws.send(JSON.stringify({ id: i, method, params, ...(sid ? { sessionId: sid } : {}) })); });

let sid = null;
if (!evalOnly) {
  const t = await send('Target.createTarget', { url: 'about:blank' });
  sid = (await send('Target.attachToTarget', { targetId: t.result.targetId, flatten: true })).result.sessionId;
  if (url) await send('Page.navigate', { url }, sid);
  if (pollSel) {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const r = await send('Runtime.evaluate', { expression: `document.querySelectorAll(${JSON.stringify(pollSel)}).length`, returnByValue: true }, sid);
      if ((r.result?.result?.value || 0) >= pollMin) break;
    }
  } else {
    await new Promise((r) => setTimeout(r, waitMs));
  }
}
const out = { url: null, title: null, value: null };
if (evalExpr) {
  const r = await send('Runtime.evaluate', { expression: evalExpr, awaitPromise: true, returnByValue: true }, sid || undefined);
  out.value = r.result?.result?.value ?? null;
  if (r.result?.exceptionDetails) out.error = r.result.exceptionDetails.text;
}
if (sid) {
  const meta = await send('Runtime.evaluate', { expression: 'JSON.stringify({url:location.href,title:document.title})', returnByValue: true }, sid);
  try { Object.assign(out, JSON.parse(meta.result.result.value)); } catch {}
  if (wantStatus) {
    const st = await send('LP.getPageStatus', {}, sid);
    out.page_status = st.result ?? null;
  }
}
console.log(JSON.stringify(out));
ws.close();
