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

export interface CommandApprovalRequest {
  command: string;
  reason: string;
}

// TEACHING: One human-in-the-loop gate for every kind of approval. The
// transport layer carries this discriminated union; each tool exposes its own
// typed callback (approveWrite / approveCommand) but they funnel through the
// same approve/reject round trip.
export type ApprovalRequest =
  | { kind: 'write'; request: WriteApprovalRequest }
  | { kind: 'command'; request: CommandApprovalRequest };

export interface ToolContext {
  workspaceRoot: string;
  approveWrite?: (request: WriteApprovalRequest) => Promise<boolean>;
  approveCommand?: (request: CommandApprovalRequest) => Promise<boolean>;
  /** Override for the run_command timeout; defaults inside the tool. Test/extension hook. */
  commandTimeoutMs?: number;
}

export interface Tool {
  definition: ToolDefinition;
  execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
