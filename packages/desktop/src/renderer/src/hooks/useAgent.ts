import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Message, ToolCall, ToolResult, WriteApprovalRequest } from '@minimal-agent/shared-types';

// TEACHING: Client-side agent bridge. It sends user messages through the
// preload API, subscribes to the pushed stream (text / tool calls / results /
// write approvals), and turns those events into `Message` objects for display
// and persistence. The streamed assistant text is accumulated into one bubble
// that updates in place.

interface UseAgentArgs {
  sessionId: string | null;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setWriteRequest: (request: WriteApprovalRequest | null) => void;
}

export function useAgent({ sessionId, setMessages, setWriteRequest }: UseAgentArgs) {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Serialize JSONL appends so stored message order matches display order.
  const appendQueue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueuePersist = useCallback(
    (message: Message) => {
      if (!sessionId) return;
      appendQueue.current = appendQueue.current.then(() => window.api.appendMessage(sessionId, message));
    },
    [sessionId],
  );

  const send = useCallback(
    async (content: string) => {
      if (!sessionId || content.trim() === '') return;
      setError(null);
      const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content, timestamp: Date.now() };
      setMessages((prev) => [...prev, userMessage]);
      enqueuePersist(userMessage);
      setStreaming(true);
      try {
        await window.api.agentSend(sessionId, content);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStreaming(false);
      }
    },
    [sessionId, setMessages, enqueuePersist],
  );

  useEffect(() => {
    if (!sessionId) return;

    // Per-session streaming draft state (reset when the session changes).
    let draftId: string | null = null;
    let draftText = '';
    let draftTimestamp = 0;
    let pendingToolCall: ToolCall | null = null;

    const finalizeDraft = () => {
      if (draftId && draftText !== '') {
        const message: Message = { id: draftId, role: 'assistant', content: draftText, timestamp: draftTimestamp };
        enqueuePersist(message);
      }
      draftId = null;
      draftText = '';
    };

    const unsubs = [
      window.api.onAgentStream((text) => {
        draftText += text;
        if (!draftId) {
          draftId = crypto.randomUUID();
          draftTimestamp = Date.now();
          const message: Message = { id: draftId, role: 'assistant', content: draftText, timestamp: draftTimestamp };
          setMessages((prev) => [...prev, message]);
        } else {
          const current: Message = { id: draftId, role: 'assistant', content: draftText, timestamp: draftTimestamp };
          setMessages((prev) => prev.map((m) => (m.id === draftId ? current : m)));
        }
      }),

      window.api.onAgentToolCall((toolCall) => {
        finalizeDraft(); // any reasoning text before the tool is its own bubble
        pendingToolCall = toolCall;
        const message: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          toolCalls: [toolCall],
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, message]);
        enqueuePersist(message);
      }),

      window.api.onAgentToolResult((result: ToolResult) => {
        const call = pendingToolCall;
        pendingToolCall = null;
        const message: Message = {
          id: crypto.randomUUID(),
          role: 'tool',
          toolCallId: call?.id ?? '',
          toolName: call?.name ?? '',
          content: result.success ? result.content : `Error: ${result.error ?? 'unknown error'}`,
          isError: !result.success,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, message]);
        enqueuePersist(message);
      }),

      window.api.onAgentDone(() => {
        finalizeDraft();
        pendingToolCall = null;
        setStreaming(false);
      }),

      window.api.onAgentError((message) => {
        finalizeDraft();
        setError(message);
        setStreaming(false);
      }),

      window.api.onWriteConfirm((request) => setWriteRequest(request)),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [sessionId, setMessages, setWriteRequest, enqueuePersist]);

  return { streaming, error, send, clearError: () => setError(null) };
}
