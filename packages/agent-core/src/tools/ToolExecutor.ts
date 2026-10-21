import type { Tool, ToolCall, ToolContext, ToolDefinition, ToolResult } from '@minimal-agent/shared-types';

// TEACHING: Tool dispatch — the agent asks for a tool by name, and the executor
// routes the call to the registered implementation.
export class ToolExecutor {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.definition.name, tool);
  }

  definitions(): ToolDefinition[] {
    return [...this.tools.values()].map((t) => t.definition);
  }

  async execute(call: ToolCall, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return { success: false, content: '', error: `Unknown tool: ${call.name}` };
    }
    return tool.execute(call.arguments, context);
  }
}
