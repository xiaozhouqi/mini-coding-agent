import type { Message } from './message';
import type { SessionMetadata } from './session';
import type { ApprovalRequest, ToolCall, ToolResult } from './tool';

// TEACHING: The preload bridge. This is the *only* thing the sandboxed
// renderer can call — a small, typed surface instead of raw ipcRenderer. The
// preload implements it; the renderer consumes it via `window.api`.

export interface ConfigView {
  model: string;
  tokenBudget: number;
  hasApiKey: boolean;
}

export interface LoadedSession {
  session: SessionMetadata | undefined;
  messages: Message[];
}

export interface DesktopApi {
  sessionList(): Promise<SessionMetadata[]>;
  sessionCreate(workspacePath: string): Promise<SessionMetadata>;
  sessionLoad(sessionId: string): Promise<LoadedSession>;
  sessionDelete(sessionId: string): Promise<boolean>;
  appendMessage(sessionId: string, message: Message): Promise<boolean>;

  configGet(): Promise<ConfigView>;
  configSet(next: { apiKey?: string; model: string; tokenBudget: number }): Promise<boolean>;

  workspacePick(): Promise<string | null>;

  agentSend(sessionId: string, content: string): Promise<boolean>;
  resolveApproval(approved: boolean): Promise<boolean>;

  // Push subscriptions; each returns an unsubscribe function.
  onAgentStream(cb: (text: string) => void): () => void;
  onAgentToolCall(cb: (toolCall: ToolCall) => void): () => void;
  onAgentToolResult(cb: (result: ToolResult) => void): () => void;
  onAgentDone(cb: (tokenUsage?: number) => void): () => void;
  onAgentError(cb: (message: string) => void): () => void;
  onApprovalRequest(cb: (request: ApprovalRequest) => void): () => void;
}
