import type { AgentConfig } from './config';
import type { ChatMessage } from './llm';
import type { ToolCall, ToolResult, WriteApprovalRequest } from './tool';

// TEACHING: Cross-process contracts. The desktop app has TWO boundaries that
// both need a shared vocabulary:
//   1. Renderer <-> Main   via Electron IPC (string channel names + payloads).
//   2. Main    <-> Agent   via stdio as newline-delimited JSONL frames.
// Keeping the shapes in shared-types means both sides compile against the same
// contract, so a rename or field change is caught at typecheck time.

/**
 * IPC channel names (Renderer <-> Main). Grouped by concern so the stringly
 * typed `ipcRenderer.invoke` calls stay in one place (the preload script).
 */
export const IpcChannels = {
  // Session metadata + messages (SQLite + JSONL).
  sessionList: 'session:list',
  sessionCreate: 'session:create',
  sessionLoad: 'session:load',
  sessionDelete: 'session:delete',
  appendMessage: 'session:append-message',
  // App config (API key encrypted via safeStorage, model, token budget).
  configGet: 'config:get',
  configSet: 'config:set',
  // Agent control (Renderer -> Main).
  agentSend: 'agent:send',
  // Agent stream pushed from Main -> Renderer.
  agentStream: 'agent:stream',
  agentToolCall: 'agent:tool-call',
  agentToolResult: 'agent:tool-result',
  agentDone: 'agent:done',
  agentError: 'agent:error',
  // Write approval dialog.
  writeConfirm: 'dialog:write-confirm',
  writeResult: 'dialog:write-result',
  // Native directory picker.
  workspacePick: 'dialog:workspace-pick',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

// ---------------------------------------------------------------------------
// stdio protocol (Main <-> Agent child process)
// ---------------------------------------------------------------------------

/**
 * Frames the main process writes to the agent's stdin, one JSON object per
 * line. `init` seeds the loop with its model config, workspace and (on
 * session restore) prior conversation history.
 */
export type InputFrame =
  | { type: 'init'; config: AgentConfig; workspace: string; history?: ChatMessage[] }
  | { type: 'user-message'; content: string }
  | { type: 'write-approval'; approved: boolean; reason?: string };

/**
 * Frames the agent writes to its stdout. `write-confirm` is emitted when a
 * write_file tool pauses for approval (it carries the `exists` flag the tool
 * already computed, so the main process does not have to re-derive it).
 */
export type OutputFrame =
  | { type: 'text-delta'; delta: string }
  | { type: 'tool-call'; toolCall: ToolCall }
  | { type: 'write-confirm'; request: WriteApprovalRequest }
  | { type: 'tool-result'; toolResult: ToolResult }
  | { type: 'done'; tokenUsage?: number }
  | { type: 'error'; message: string };
