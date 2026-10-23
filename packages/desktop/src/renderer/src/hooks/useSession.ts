import { useCallback, useEffect, useState } from 'react';
import type { Message, SessionMetadata } from '@minimal-agent/shared-types';

// TEACHING: Client-side session state. The list of sessions lives in main
// (SQLite); this hook keeps a mirror in React state and exposes the CRUD
// actions the sidebar and App need.

export function useSession() {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setSessions(await window.api.sessionList());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (workspacePath: string): Promise<SessionMetadata> => {
      const session = await window.api.sessionCreate(workspacePath);
      setCurrentId(session.id);
      await refresh();
      return session;
    },
    [refresh],
  );

  /** Load a session; returns its messages so the caller can populate the view. */
  const open = useCallback(async (id: string): Promise<Message[] | null> => {
    const loaded = await window.api.sessionLoad(id);
    if (!loaded.session) return null;
    setCurrentId(id);
    return loaded.messages;
  }, []);

  const remove = useCallback(
    async (id: string) => {
      await window.api.sessionDelete(id);
      if (currentId === id) setCurrentId(null);
      await refresh();
    },
    [currentId, refresh],
  );

  return { sessions, currentId, setCurrentId, refresh, create, open, remove };
}
