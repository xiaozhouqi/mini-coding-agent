import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OutputFrame } from '@minimal-agent/shared-types';
import { IpcChannels } from '@minimal-agent/shared-types';
import { ConfigStore, MessageStore, openDatabase, SessionRepository } from '@minimal-agent/storage';
import { AgentProcessManager, registerAgentHandlers } from './ipc/agent';
import { registerConfigHandlers } from './ipc/config';
import { registerDialogHandlers } from './ipc/dialog';
import { registerSessionHandlers } from './ipc/session';
import { decryptSecret } from './security/safeStorage';

// TEACHING: The Electron main process is the conductor. It owns the window,
// the storage layer and the agent child process, and it relays messages
// between the renderer (IPC) and the agent (stdio JSONL). It never touches
// the DOM — that is the renderer's job.

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false,
    webPreferences: {
      // contextIsolation + no nodeIntegration keep the renderer sandboxed from
      // Node; the preload bridge exposes a narrow, typed API surface.
      preload: path.join(fileURLToPath(new URL('.', import.meta.url)), '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload needs `require`/`contextBridge`; contextIsolation still applies
    },
  });

  win.on('ready-to-show', () => win.show());

  // electron-vite injects the dev server URL in dev; production loads the file.
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(path.join(fileURLToPath(new URL('.', import.meta.url)), '../renderer/index.html'));
  }
  return win;
}

app.whenReady().then(() => {
  const userData = app.getPath('userData');
  const db = openDatabase(path.join(userData, 'agent.db'));
  const sessions = new SessionRepository(db);
  const messages = new MessageStore(path.join(userData, 'messages'));
  const config = new ConfigStore(db);

  const manager = new AgentProcessManager(forwardFrame);

  registerSessionHandlers(sessions, messages);
  registerConfigHandlers(config);
  registerDialogHandlers(() => mainWindow);
  registerAgentHandlers({
    manager,
    getSession: (id) => sessions.getById(id),
    getMessages: (id) => messages.read(id),
    getConfig: () => {
      const c = config.get();
      // The stored api_key is ciphertext; decrypt in memory only for the agent.
      return { apiKey: c.apiKey ? decryptSecret(c.apiKey) : '', model: c.model, tokenBudget: c.tokenBudget };
    },
  });

  mainWindow = createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

/** Relay an agent OutputFrame to the renderer over its matching IPC channel. */
function forwardFrame(frame: OutputFrame): void {
  const wc = mainWindow?.webContents;
  if (!wc) return;
  switch (frame.type) {
    case 'text-delta':
      wc.send(IpcChannels.agentStream, frame.delta);
      break;
    case 'tool-call':
      wc.send(IpcChannels.agentToolCall, frame.toolCall);
      break;
    case 'tool-result':
      wc.send(IpcChannels.agentToolResult, frame.toolResult);
      break;
    case 'done':
      wc.send(IpcChannels.agentDone, frame.tokenUsage);
      break;
    case 'error':
      wc.send(IpcChannels.agentError, frame.message);
      break;
    case 'write-confirm':
      wc.send(IpcChannels.writeConfirm, frame.request);
      break;
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
