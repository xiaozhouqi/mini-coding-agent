import type { SessionMetadata } from '@minimal-agent/shared-types';

// The session list. Selecting a session loads it; "New" prompts for a workspace
// folder and creates a fresh conversation.
interface SidebarProps {
  sessions: SessionMetadata[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({ sessions, currentId, onSelect, onNew, onDelete, onOpenSettings }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">Minimal Agent</h1>
        <button className="btn btn-primary" onClick={onNew}>+ New</button>
      </div>
      <ul className="session-list">
        {sessions.map((s) => (
          <li
            key={s.id}
            className={`session-item ${s.id === currentId ? 'session-item-active' : ''}`}
            onClick={() => onSelect(s.id)}
          >
            <div className="session-item-main">
              <span className="session-title">{s.title || '(untitled)'}</span>
              <span className="session-workspace">{s.workspacePath}</span>
            </div>
            <button
              className="session-delete"
              title="Delete session"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(s.id);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button className="btn settings-btn" onClick={onOpenSettings}>Settings</button>
    </aside>
  );
}
