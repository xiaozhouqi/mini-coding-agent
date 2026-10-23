import { createInterface } from 'node:readline';
import type {
  AgentConfig,
  ChatMessage,
  InputFrame,
  OutputFrame,
  ToolCall,
  ToolResult,
  WriteApprovalRequest,
} from '@minimal-agent/shared-types';
import { AgentLoop } from './agent/AgentLoop';
import type { AgentStreamEvent } from './agent/AgentLoop';
import { PromptManager } from './agent/PromptManager';
import { DeepseekAdapter } from './llm/DeepseekAdapter';
import { createToolExecutor } from './tools/registry';

// TEACHING: Inter-process communication (IPC). This module turns the ReAct
// AgentLoop into a long-lived server that the Electron main process drives by
// writing JSONL frames to stdin and reading JSONL frames from stdout. The
// process boundary is the whole point — the agent never touches the UI, and a
// crash here cannot take down the Electron window.
//
// Responsibility: parse InputFrames, run the loop, emit OutputFrames, and
// route the human-in-the-loop write approval through the parent.
//
// Teaching concept: newline-delimited JSON (JSONL) as a minimal framing
// protocol over stdio; request/response correlation across a pipe.
//
// Extension points: swap `createLoop` to test without the network, or add
// frame types (e.g. `abort`) to support cancellation.

const MAX_ITERATIONS = 10;

/**
 * The subset of `AgentLoop` this server drives. Kept as an interface so tests
 * can inject a scripted fake loop instead of hitting the Deepseek API.
 */
export interface LoopLike {
  run(
    userMessage: string,
    workspaceRoot: string,
    history: ChatMessage[],
    approveWrite?: (request: WriteApprovalRequest) => Promise<boolean>,
  ): AsyncGenerator<AgentStreamEvent>;
  readonly totalTokens?: number;
}

export interface StdioServerOptions {
  write: (frame: OutputFrame) => void;
  /** Inject a loop factory for tests; defaults to the real Deepseek loop. */
  createLoop?: (config: AgentConfig) => LoopLike;
}

export class StdioAgentServer {
  private loop: LoopLike | null = null;
  private workspace = '';
  private history: ChatMessage[] = [];
  private pendingApproval: ((approved: boolean) => void) | null = null;
  private running = false;

  constructor(private readonly options: StdioServerOptions) {}

  /** Handle one input frame. `write-approval` resolves a pending write pause. */
  async handle(frame: InputFrame): Promise<void> {
    switch (frame.type) {
      case 'init':
        this.init(frame.config, frame.workspace, frame.history);
        break;
      case 'user-message':
        await this.handleUserMessage(frame.content);
        break;
      case 'write-approval':
        this.resolveApproval(frame.approved);
        break;
    }
  }

  private init(config: AgentConfig, workspace: string, history: ChatMessage[] = []): void {
    this.loop = this.options.createLoop
      ? this.options.createLoop(config)
      : createDefaultLoop(config);
    this.workspace = workspace;
    this.history = history;
  }

  private async handleUserMessage(content: string): Promise<void> {
    if (!this.loop) {
      this.options.write({ type: 'error', message: 'Agent not initialized (no init frame)' });
      return;
    }
    if (this.running) {
      this.options.write({ type: 'error', message: 'Agent is busy' });
      return;
    }

    this.running = true;
    const events: AgentStreamEvent[] = [];
    try {
      for await (const event of this.loop.run(content, this.workspace, this.history, (req) =>
        this.approveWrite(req),
      )) {
        events.push(event);
        this.emit(event);
      }
      this.options.write({ type: 'done', tokenUsage: this.loop.totalTokens ?? 0 });
      // Carry this turn forward so the next message has conversation context.
      this.history.push({ role: 'user', content });
      this.history.push(...reconstructTurn(events));
    } catch (err) {
      this.options.write({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      this.running = false;
    }
  }

  private emit(event: AgentStreamEvent): void {
    switch (event.type) {
      case 'text-delta':
        this.options.write({ type: 'text-delta', delta: event.text });
        break;
      case 'tool-call':
        this.options.write({ type: 'tool-call', toolCall: event.toolCall });
        break;
      case 'tool-result':
        this.options.write({ type: 'tool-result', toolResult: event.toolResult });
        break;
      case 'done':
        break; // emitted once by the caller, not per event
    }
  }

  // TEACHING: The human-in-the-loop boundary. When the write_file tool calls
  // approveWrite, we emit a `write-confirm` frame and park the promise until a
  // `write-approval` frame arrives. The loop stays paused while the user decides.
  private approveWrite(request: WriteApprovalRequest): Promise<boolean> {
    // Register the resolver BEFORE emitting the confirm frame so a parent that
    // replies synchronously (as in tests) can't race ahead of it.
    return new Promise<boolean>((resolve) => {
      this.pendingApproval = resolve;
      this.options.write({ type: 'write-confirm', request });
    });
  }

  private resolveApproval(approved: boolean): void {
    if (!this.pendingApproval) return;
    const resolve = this.pendingApproval;
    this.pendingApproval = null;
    resolve(approved);
  }
}

/**
 * Rebuild a `ChatMessage[]` history from the stream events of a single turn,
 * matching the shape the AgentLoop builds internally (assistant-with-toolCalls
 * followed by its tool messages, then a final assistant answer). Tool results
 * are paired with their preceding tool call by order.
 */
export function reconstructTurn(events: AgentStreamEvent[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let assistantText = '';
  let assistantToolCalls: ToolCall[] = [];
  const toolMessages: Array<{ toolCallId: string; content: string }> = [];
  let currentToolCall: ToolCall | null = null;

  const flush = (): void => {
    if (assistantToolCalls.length > 0 || toolMessages.length > 0) {
      messages.push({ role: 'assistant', content: assistantText, toolCalls: assistantToolCalls });
      for (const t of toolMessages) messages.push({ role: 'tool', toolCallId: t.toolCallId, content: t.content });
    } else if (assistantText !== '') {
      messages.push({ role: 'assistant', content: assistantText });
    }
    assistantText = '';
    assistantToolCalls = [];
    toolMessages.length = 0;
    currentToolCall = null;
  };

  for (const event of events) {
    switch (event.type) {
      case 'text-delta':
        // Text arriving after a tool call means the model started a new
        // reasoning turn, so the previous tool-using turn is complete.
        if (assistantToolCalls.length > 0) flush();
        assistantText += event.text;
        break;
      case 'tool-call':
        assistantToolCalls.push(event.toolCall);
        currentToolCall = event.toolCall;
        break;
      case 'tool-result': {
        const result: ToolResult = event.toolResult;
        toolMessages.push({
          toolCallId: currentToolCall?.id ?? '',
          content: result.success ? result.content : `Error: ${result.error ?? 'unknown error'}`,
        });
        break;
      }
      case 'done':
        break;
    }
  }
  flush();
  return messages;
}

function createDefaultLoop(config: AgentConfig): LoopLike {
  const llm = new DeepseekAdapter({ apiKey: config.apiKey, model: config.model });
  return new AgentLoop(llm, createToolExecutor(), new PromptManager(config.systemPrompt || undefined), {
    maxIterations: MAX_ITERATIONS,
    tokenBudget: config.tokenBudget,
  });
}

/**
 * Wire the server to raw stdin/stdout. Reads one JSON frame per line and
 * writes one JSON frame per line back. This is the function `stdio-main.ts`
 * (and the Electron main process, via the spawned child) invokes.
 */
export function startStdioServer(input: NodeJS.ReadableStream, write: (frame: OutputFrame) => void): void {
  const server = new StdioAgentServer({ write });
  const rl = createInterface({ input, crlfDelay: Infinity });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let frame: InputFrame;
    try {
      frame = JSON.parse(trimmed) as InputFrame;
    } catch {
      write({ type: 'error', message: `Invalid JSON frame: ${line}` });
      return;
    }
    void server.handle(frame);
  });
}
