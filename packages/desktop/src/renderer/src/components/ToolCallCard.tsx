import type { ToolCallMessage, ToolResultMessage } from '@minimal-agent/shared-types';

// A tool invocation, rendered as a collapsed card: the tool name + arguments,
// followed by the result (or error) when one has arrived.
export function ToolCallCard({ call, results }: { call: ToolCallMessage; results: ToolResultMessage[] }) {
  const resultByCallId = new Map(results.map((r) => [r.toolCallId, r]));
  return (
    <div className="tool-card">
      <div className="tool-card-header">Tool call</div>
      {call.toolCalls.map((tc) => {
        const result = resultByCallId.get(tc.id);
        return (
          <div key={tc.id} className="tool-call">
            <div className="tool-call-name">{tc.name}</div>
            <pre className="tool-call-args">{JSON.stringify(tc.arguments, null, 2)}</pre>
            {result && (
              <pre className={`tool-result ${result.isError ? 'tool-result-error' : ''}`}>{result.content}</pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
