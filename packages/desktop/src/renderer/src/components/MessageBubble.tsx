import type { TextMessage } from '@minimal-agent/shared-types';

// A single user or assistant text message, styled by role.
export function MessageBubble({ message }: { message: TextMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`bubble ${isUser ? 'bubble-user' : 'bubble-assistant'}`}>
      <div className="bubble-role">{isUser ? 'You' : 'Agent'}</div>
      <div className="bubble-content">{message.content || ' '}</div>
    </div>
  );
}
