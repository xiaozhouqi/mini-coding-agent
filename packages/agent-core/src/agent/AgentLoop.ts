import type { ChatMessage, CommandApprovalRequest, ToolCall, ToolResult, WriteApprovalRequest } from '@minimal-agent/shared-types';
import type { LLMAdapter } from '../llm/LLMAdapter';
import type { ToolExecutor } from '../tools/ToolExecutor';
import { PromptManager } from './PromptManager';

export type AgentStreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolCall: ToolCall }
  | { type: 'tool-result'; toolResult: ToolResult }
  | { type: 'done' };

export interface AgentLoopOptions {
  maxIterations: number;
  tokenBudget: number;
}

const DEFAULT_OPTIONS: AgentLoopOptions = { maxIterations: 10, tokenBudget: 100000 };

export class AgentLoop {
  private usedTokens = 0;

  constructor(
    private readonly llm: LLMAdapter,
    private readonly tools: ToolExecutor,
    private readonly prompt: PromptManager,
    private readonly options: AgentLoopOptions = DEFAULT_OPTIONS,
  ) {}

  get totalTokens(): number {
    return this.usedTokens;
  }

  async *run(
    userMessage: string,
    workspaceRoot: string,
    history: ChatMessage[] = [],
    approveWrite?: (request: WriteApprovalRequest) => Promise<boolean>,
    approveCommand?: (request: CommandApprovalRequest) => Promise<boolean>,
  ): AsyncGenerator<AgentStreamEvent> {
    // TEACHING: The ReAct loop — Thought -> Action (tool call) -> Observation
    // (tool result) -> Thought -> ... until the model stops calling tools.
    const messages = this.prompt.buildMessages(userMessage, history);
    const toolDefs = this.tools.definitions();

    for (let iteration = 0; iteration < this.options.maxIterations; iteration++) {
      if (this.options.tokenBudget > 0 && this.usedTokens >= this.options.tokenBudget) {
        yield { type: 'text-delta', text: '\n[token budget reached]' };
        yield { type: 'done' };
        return;
      }

      let assistantText = '';
      let toolCalls: ToolCall[] = [];

      for await (const chunk of this.llm.chat(messages, { stream: true, tools: toolDefs })) {
        if (chunk.textDelta) {
          assistantText += chunk.textDelta;
          yield { type: 'text-delta', text: chunk.textDelta };
        }
        if (chunk.usage) {
          this.usedTokens += chunk.usage.inputTokens + chunk.usage.outputTokens;
        }
        if (chunk.toolCalls) toolCalls = chunk.toolCalls;
      }

      // No tool calls -> this turn is the final answer.
      if (toolCalls.length === 0) {
        yield { type: 'done' };
        return;
      }

      // Record the assistant turn (with tool calls) so the model sees its own
      // action in the conversation on the next turn.
      messages.push({ role: 'assistant', content: assistantText, toolCalls });

      for (const call of toolCalls) {
        yield { type: 'tool-call', toolCall: call };
        const result = await this.tools.execute(call, { workspaceRoot, approveWrite, approveCommand });
        yield { type: 'tool-result', toolResult: result };
        // TEACHING: The observation is fed back as a tool message. Errors are
        // included (not swallowed) so the model can self-correct.
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          content: result.success ? result.content : `Error: ${result.error ?? 'unknown error'}`,
        });
      }
    }

    throw new Error(`Agent did not produce a final answer within ${this.options.maxIterations} iterations`);
  }
}
