import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type { DesktopApi } from '@minimal-agent/shared-types';
import { IpcChannels } from '@minimal-agent/shared-types';

// TEACHING: The preload bridge. It runs with Node access but in an isolated
// context, and exposes a single narrow `window.api` to the renderer via
// contextBridge. The renderer never touches ipcRenderer or Node directly.

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: DesktopApi = {
  sessionList: () => ipcRenderer.invoke(IpcChannels.sessionList),
  sessionCreate: (workspacePath) => ipcRenderer.invoke(IpcChannels.sessionCreate, workspacePath),
  sessionLoad: (sessionId) => ipcRenderer.invoke(IpcChannels.sessionLoad, sessionId),
  sessionDelete: (sessionId) => ipcRenderer.invoke(IpcChannels.sessionDelete, sessionId),
  appendMessage: (sessionId, message) => ipcRenderer.invoke(IpcChannels.appendMessage, sessionId, message),

  configGet: () => ipcRenderer.invoke(IpcChannels.configGet),
  configSet: (next) => ipcRenderer.invoke(IpcChannels.configSet, next),

  workspacePick: () => ipcRenderer.invoke(IpcChannels.workspacePick),

  agentSend: (sessionId, content) => ipcRenderer.invoke(IpcChannels.agentSend, sessionId, content),
  resolveApproval: (approved) => ipcRenderer.invoke(IpcChannels.approvalResult, approved),

  onAgentStream: (cb) => subscribe(IpcChannels.agentStream, cb),
  onAgentToolCall: (cb) => subscribe(IpcChannels.agentToolCall, cb),
  onAgentToolResult: (cb) => subscribe(IpcChannels.agentToolResult, cb),
  onAgentDone: (cb) => subscribe(IpcChannels.agentDone, cb),
  onAgentError: (cb) => subscribe(IpcChannels.agentError, cb),
  onApprovalRequest: (cb) => subscribe(IpcChannels.approvalRequest, cb),
};

contextBridge.exposeInMainWorld('api', api);
