import { useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { Message, ToolResultMessage } from '@minimal-agent/shared-types';
import { MessageBubble } from './MessageBubble';
import { ToolCallCard } from './ToolCallCard';

// The conversation view: a message list plus the composer. Tool-call messages
// are grouped with the tool-result messages that immediately follow them, so a
// single "tool call" renders as one card.
interface ChatAreaProps {
  messages: Message[];
  streaming: boolean;
  error: string | null;
  disabled: boolean;
  onSend: (content: string) => void;
}

function buildItems(messages: Message[]): ReactNode[] {
  const items: ReactNode[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    if (msg.role === 'tool') {
      // Orphaned result (no preceding tool-call in view); render inline.
      items.push(
        <pre key={msg.id} className={`tool-result ${msg.isError ? 'tool-result-error' : ''}`}>{msg.content}</pre>,
      );
      i += 1;
    } else if ('toolCalls' in msg) {
      const results: ToolResultMessage[] = [];
      let j = i + 1;
      while (j < messages.length && messages[j].role === 'tool') {
        results.push(messages[j] as ToolResultMessage);
        j += 1;
      }
      items.push(<ToolCallCard key={msg.id} call={msg} results={results} />);
      i = j;
    } else {
      items.push(<MessageBubble key={msg.id} message={msg} />);
      i += 1;
    }
  }
  return items;
}

export function ChatArea({ messages, streaming, error, disabled, onSend }: ChatAreaProps) {
  const [input, setInput] = useState('');

  const submit = () => {
    const content = input.trim();
    if (!content || disabled || streaming) return;
    onSend(content);
    setInput('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <main className="chat-area">
      <div className="message-list">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>
              Start a session to begin. Use <strong>+ New</strong> to pick a workspace folder.
            </p>
          </div>
        )}
        {buildItems(messages)}
        {streaming && <div className="streaming-indicator">Agent is thinking…</div>}
        {error && <div className="error-banner">{error}</div>}
      </div>
      <div className="composer">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={disabled ? 'Create a session to send a message' : 'Message the agent…'}
          disabled={disabled}
          rows={2}
        />
        <button
          className="btn btn-primary"
          onClick={submit}
          disabled={disabled || streaming || input.trim() === ''}
        >
          Send
        </button>
      </div>
    </main>
  );
}
