// One-off live check: boot the built app, configure the API key, create a
// session against a scratch workspace, and drive one real chat -> tool-call ->
// result turn entirely through the renderer's `window.api` bridge over CDP.
// NOT committed as a standard guard (it makes a real Deepseek call); it proves
// the full renderer -> IPC -> main -> agent-child -> stdio -> Deepseek chain.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const desktopDir = path.resolve(root, 'packages', 'desktop');

process.loadEnvFile(path.join(root, '.env'));
const API_KEY = process.env.DEEPSEEK_API_KEY;
if (!API_KEY) {
  console.error('DEEPSEEK_API_KEY not set in .env');
  process.exit(1);
}

const electronBin = require('electron');
const PORT = 9334;

const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-live-'));
fs.writeFileSync(path.join(ws, 'notes.txt'), 'The project name is Aurora.\napi_key=sk-live_secret_12345\n');

const app = spawn(electronBin, ['.', `--remote-debugging-port=${PORT}`], {
  cwd: desktopDir,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
});
const appStderr = [];
app.stderr.on('data', (d) => appStderr.push(String(d)));
let exited = false;
app.on('exit', (code) => { exited = true; });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function list() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return res.json();
}

async function waitForRenderer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exited) throw new Error('electron exited before renderer appeared');
    try {
      const page = (await list()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('renderer never appeared');
}

function connect(wsUrl) {
  const sock = new WebSocket(wsUrl);
  const pending = new Map();
  let id = 1;
  sock.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((res) => {
    const myId = id++;
    pending.set(myId, res);
    sock.send(JSON.stringify({ id: myId, method, params }));
  });
  const ready = new Promise((res, rej) => {
    sock.addEventListener('open', res);
    sock.addEventListener('error', () => rej(new Error('ws error')));
  });
  return { sock, send, ready };
}

async function evaluate(send, expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
}

async function main() {
  const renderer = await waitForRenderer(15000);
  const { sock, send, ready } = connect(renderer.webSocketDebuggerUrl);
  await ready;
  await send('Runtime.enable');

  // 1. Configure key + model (same path as the Settings panel save).
  const key = JSON.stringify(API_KEY);
  await evaluate(send, `window.api.configSet({ apiKey: ${key}, model: 'deepseek-v4-pro', tokenBudget: 100000 })`);

  // 2. Create a session against the scratch workspace.
  const sessionId = await evaluate(send, `window.api.sessionCreate(${JSON.stringify(ws)}).then(s => s.id)`);
  console.log('[live] session created:', sessionId);

  // 3. Wire event collectors on the exact preload API the renderer uses.
  await evaluate(send, `(function(){
    window.__agentEvents = [];
    window.api.onAgentStream(t => window.__agentEvents.push({t:'stream', text:t}));
    window.api.onAgentToolCall(tc => window.__agentEvents.push({t:'tool-call', tc}));
    window.api.onAgentToolResult(tr => window.__agentEvents.push({t:'tool-result', tr}));
    window.api.onAgentDone(u => window.__agentEvents.push({t:'done', usage:u}));
    window.api.onAgentError(m => window.__agentEvents.push({t:'error', m}));
    window.api.onApprovalRequest(r => window.__agentEvents.push({t:'approval-request', r}));
  })()`);

  // 4. Send the user message.
  await evaluate(send, `window.api.agentSend(${JSON.stringify(sessionId)}, "Read notes.txt and tell me what the project name is.")`);

  // 5. Poll the collector until done/error or timeout.
  const deadline = Date.now() + 60000;
  let events = [];
  let answer = '';
  while (Date.now() < deadline) {
    const snapshot = await evaluate(send, 'window.__agentEvents.slice()');
    events = snapshot ?? [];
    if (events.some((e) => e.t === 'done' || e.t === 'error')) break;
    await sleep(500);
  }
  answer = events.filter((e) => e.t === 'stream').map((e) => e.text).join('');

  console.log('[live] event sequence:', events.map((e) => e.t).join(' -> '));
  console.log('[live] tool calls:', JSON.stringify(events.filter((e) => e.t === 'tool-call').map((e) => e.tc)));
  console.log('[live] tool results ok:', events.filter((e) => e.t === 'tool-result').every((e) => e.tr.success));
  console.log('[live] final answer:', JSON.stringify(answer));

  // Data-boundary check: the secret in notes.txt must not reach the model.
  const leaked = answer.includes('sk-live_secret_12345') || JSON.stringify(events).includes('sk-live_secret_12345');
  console.log('[live] secret leaked to model output:', leaked);

  const done = events.some((e) => e.t === 'done');
  console.log(done && !leaked ? '\n[live] PASS' : '\n[live] FAIL');

  sock.close();
  process.exitCode = done && !leaked ? 0 : 1;
}

main()
  .catch((err) => { console.error('[live] ERROR:', err.message); process.exitCode = 1; })
  .finally(async () => {
    if (!exited) {
      try {
        const page = (await list()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) {
          const { sock, send, ready } = connect(page.webSocketDebuggerUrl);
          await ready;
          await send('Runtime.evaluate', { expression: 'window.close()' });
          sock.close();
        }
      } catch { /* ignore */ }
    }
    await sleep(1500);
    if (!exited) app.kill();
    fs.rmSync(ws, { recursive: true, force: true });
    const err = appStderr.join('');
    if (err.trim()) console.log('\n[live] main stderr:\n' + err.trim());
  });
