// Launch check: boot the built Electron app headlessly, connect to the renderer
// over the Chrome DevTools Protocol, and verify the preload/IPC bridge and React
// mount without driving the UI by hand. Run after `pnpm --filter @minimal-agent/desktop build`.
//
// Usage: node packages/desktop/scripts/launch-check.mjs
// TEACHING: this is the "user-visible work checked in the running app" guard —
// deterministic, repeatable, and it reports evidence rather than a screenshot.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import * as fs from 'node:fs';

const require = createRequire(import.meta.url);
const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Electron's npm package exports the path to its binary from Node.
const electronBin = require('electron');
const PORT = 9333;

const app = spawn(electronBin, ['.', `--remote-debugging-port=${PORT}`], {
  cwd: desktopDir,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
});

const appStdout = [];
const appStderr = [];
app.stdout.on('data', (d) => appStdout.push(String(d)));
app.stderr.on('data', (d) => appStderr.push(String(d)));

let exited = false;
app.on('exit', (code) => {
  exited = true;
  console.log(`[launch-check] electron exited with code ${code}`);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getRenderers() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return res.json();
}

// Poll until the renderer page target is reachable over CDP.
async function waitForRenderer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = '';
  while (Date.now() < deadline) {
    if (exited) throw new Error(`electron exited before renderer appeared (code ${app.exitCode})`);
    try {
      const targets = await getRenderers();
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch (err) {
      lastErr = String(err);
    }
    await sleep(250);
  }
  throw new Error(`renderer never appeared over CDP: ${lastErr}`);
}

// Minimal CDP client: one WebSocket, id-matched responses, and a listener for
// console errors / uncaught exceptions.
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const errors = [];
  let nextId = 1;

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(`exception: ${msg.params.exceptionDetails?.text ?? JSON.stringify(msg.params)}`);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      const text = (msg.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ');
      errors.push(`console.error: ${text}`);
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', () => reject(new Error('websocket error')));
  });

  return { ws, send, ready, errors };
}

async function main() {
  const renderer = await waitForRenderer(15000);
  console.log(`[launch-check] renderer target: ${renderer.url}`);

  const { ws, send, ready, errors } = connect(renderer.webSocketDebuggerUrl);
  await ready;
  await send('Runtime.enable');
  await send('Page.enable');

  // Reload once so we observe a fresh boot and catch any load-time errors.
  await send('Page.reload', { ignoreCache: true });
  await sleep(2500);

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return r.result?.result?.value;
  };

  const checks = {
    hasApi: await evaluate('typeof window.api'),
    apiMethods: await evaluate('Object.keys(window.api || {}).sort()'),
    appMounted: await evaluate('!!document.querySelector(".app")'),
    appText: await evaluate('(document.querySelector(".app")?.innerText || "").slice(0, 120)'),
    preloadError: await evaluate('window.__preloadError || null'),
  };

  ws.close();

  console.log('[launch-check] renderer checks:');
  console.log(JSON.stringify(checks, null, 2));
  console.log(`[launch-check] renderer console errors (${errors.length}):`);
  for (const e of errors) console.log(`  - ${e}`);

  const ok = checks.hasApi === 'object' && checks.appMounted === true && errors.length === 0;
  console.log(ok ? '\n[launch-check] PASS' : '\n[launch-check] FAIL');
  process.exitCode = ok ? 0 : 1;
}

main()
  .catch((err) => {
    console.error('[launch-check] ERROR:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Ask the app to close its window; window-all-closed quits on Windows.
    if (!exited) {
      try {
        const targets = await getRenderers();
        const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) {
          const { ws, send, ready } = connect(page.webSocketDebuggerUrl);
          await ready;
          await send('Runtime.evaluate', { expression: 'window.close()' });
          ws.close();
        }
      } catch {
        /* fall through to kill */
      }
    }
    await sleep(1500);
    if (!exited) {
      app.kill();
    }
    // Dump any main-process output for diagnosis.
    const out = appStdout.join('');
    const err = appStderr.join('');
    if (out.trim()) console.log('\n[launch-check] main stdout:\n' + out.trim());
    if (err.trim()) console.log('\n[launch-check] main stderr:\n' + err.trim());
  });
