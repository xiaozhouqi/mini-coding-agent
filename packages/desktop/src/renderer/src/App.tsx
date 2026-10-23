import { useEffect, useState } from 'react';
import type { Message, WriteApprovalRequest } from '@minimal-agent/shared-types';
import { useAgent } from './hooks/useAgent';
import { useSession } from './hooks/useSession';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsPanel } from './components/SettingsPanel';

// TEACHING: App wires the two hooks together with the UI. State flow:
// useSession owns which session is open; useAgent turns user sends into
// streamed messages; the write-approval modal is the human-in-the-loop gate for
// file writes (the agent child process blocks until we resolve it).
export function App() {
  const { sessions, currentId, refresh, create, open, remove } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [writeRequest, setWriteRequest] = useState<WriteApprovalRequest | null>(null);
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { streaming, error, send } = useAgent({ sessionId: currentId, setMessages, setWriteRequest });

  // Keep the displayed workspace in sync with the open session.
  useEffect(() => {
    const session = sessions.find((s) => s.id === currentId);
    setWorkspace(session ? session.workspacePath : null);
  }, [sessions, currentId]);

  const handleNew = async () => {
    const path = await window.api.workspacePick();
    if (!path) return;
    await create(path);
    setMessages([]);
  };

  const handleSelect = async (id: string) => {
    const loaded = await open(id);
    if (loaded) setMessages(loaded);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    if (id === currentId) setMessages([]);
  };

  const handleWriteResponse = (approved: boolean) => {
    void window.api.resolveWrite(approved);
    setWriteRequest(null);
  };

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        currentId={currentId}
        onSelect={(id) => void handleSelect(id)}
        onNew={() => void handleNew()}
        onDelete={(id) => void handleDelete(id)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <ChatArea
        messages={messages}
        streaming={streaming}
        error={error}
        disabled={!currentId}
        onSend={(content) => void send(content)}
      />
      {writeRequest && <WriteApprovalModal request={writeRequest} onRespond={handleWriteResponse} />}
      {settingsOpen && (
        <SettingsPanel
          workspace={workspace}
          onWorkspacePicked={setWorkspace}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => void refresh()}
        />
      )}
    </div>
  );
}

// Human-in-the-loop approval. The agent child process has already emitted the
// request and is blocked; approving/denying here resolves that promise.
function WriteApprovalModal({
  request,
  onRespond,
}: {
  request: WriteApprovalRequest;
  onRespond: (approved: boolean) => void;
}) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Approve file write?</h2>
        <p>
          The agent wants to write <code>{request.path}</code>
          {request.exists ? ' (this will overwrite an existing file)' : ''}.
        </p>
        <pre className="modal-content">{request.content}</pre>
        <div className="modal-actions">
          <button className="btn btn-danger" onClick={() => onRespond(false)}>Deny</button>
          <button className="btn btn-primary" onClick={() => onRespond(true)}>Approve</button>
        </div>
      </div>
    </div>
  );
}
