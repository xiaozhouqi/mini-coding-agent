export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  content: string;
  error?: string;
}

export interface ToolContext {
  workspaceRoot: string;
}

export interface Tool {
  definition: ToolDefinition;
  execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
