import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { ipcMain } from 'electron';
import type { AgentConfig, ChatMessage, InputFrame, Message, OutputFrame, SessionMetadata } from '@minimal-agent/shared-types';
import { IpcChannels } from '@minimal-agent/shared-types';
import { messagesToChatHistory } from '../history';

const nodeRequire = createRequire(import.meta.url);

// TEACHING: Process supervision. This owns the agent child process lifecycle:
// spawn it, frame its stdout into OutputFrames, and write InputFrames to its
// stdin. The process boundary isolates the UI from agent crashes.

export class AgentProcessManager {
  private child: ChildProcessWithoutNullStreams | null = null;
  currentSessionId: string | null = null;

  constructor(private readonly onFrame: (frame: OutputFrame) => void) {}

  /** (Re)spawn the agent child and hand it the model config, workspace and history. */
  start(config: AgentConfig, workspace: string, history: ChatMessage[], sessionId: string): void {
    this.stop();
    this.currentSessionId = sessionId;

    const child = spawnAgentChild();
    this.child = child;

    const rl = createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let frame: OutputFrame;
      try {
        frame = JSON.parse(trimmed) as OutputFrame;
      } catch {
        return; // ignore a malformed line; keep the process alive
      }
      this.onFrame(frame);
    });

    // Developer-only context on the local console. The API key never appears
    // here (it is passed over stdin, not echoed to stderr).
    child.stderr.on('data', (chunk: Buffer) => process.stderr.write(`[agent] ${String(chunk)}`));

    child.on('exit', (code) => {
      if (this.child !== child) return; // already superseded by a restart
      this.child = null;
      this.currentSessionId = null;
      if (code !== null && code !== 0) {
        this.onFrame({ type: 'error', message: `Agent process exited with code ${code}` });
      }
    });

    this.send({ type: 'init', config, workspace, history });
  }

  sendUserMessage(content: string): void {
    this.send({ type: 'user-message', content });
  }

  resolveApproval(approved: boolean): void {
    this.send({ type: 'approval-result', approved });
  }

  stop(): void {
    const child = this.child;
    this.child = null;
    this.currentSessionId = null;
    child?.kill();
  }

  private send(frame: InputFrame): void {
    this.child?.stdin.write(`${JSON.stringify(frame)}\n`);
  }
}

function spawnAgentChild(): ChildProcessWithoutNullStreams {
  // TEACHING: the agent core runs as a separate Node child process. In dev we
  // run the TypeScript entry through `tsx`; Node 24 is a project prerequisite.
  const tsxCli = nodeRequire.resolve('tsx/cli');
  const agentEntry = nodeRequire.resolve('@minimal-agent/agent-core/stdio-main');
  return spawn('node', [tsxCli, agentEntry], { stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
}

export interface AgentHandlerDeps {
  manager: AgentProcessManager;
  getSession: (id: string) => SessionMetadata | undefined;
  getMessages: (id: string) => Message[];
  getConfig: () => { apiKey: string; model: string; tokenBudget: number };
}

/** IPC handlers that let the renderer drive the agent. */
export function registerAgentHandlers(deps: AgentHandlerDeps): void {
  ipcMain.handle(IpcChannels.agentSend, (_event, sessionId: string, content: string) => {
    const session = deps.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const config = deps.getConfig();
    if (!config.apiKey) throw new Error('API key not configured — open Settings first.');

    // A new session means a fresh agent context, seeded from stored history.
    if (deps.manager.currentSessionId !== sessionId) {
      const history = messagesToChatHistory(deps.getMessages(sessionId));
      const agentConfig: AgentConfig = { ...config, systemPrompt: '' };
      deps.manager.start(agentConfig, session.workspacePath, history, sessionId);
    }

    deps.manager.sendUserMessage(content);
    return true;
  });

  ipcMain.handle(IpcChannels.approvalResult, (_event, approved: boolean) => {
    deps.manager.resolveApproval(approved);
    return true;
  });
}
