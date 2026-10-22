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

export interface WriteApprovalRequest {
  path: string;
  content: string;
  exists: boolean;
}

export interface ToolContext {
  workspaceRoot: string;
  approveWrite?: (request: WriteApprovalRequest) => Promise<boolean>;
}

export interface Tool {
  definition: ToolDefinition;
  execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
