import { ipcMain } from 'electron';
import type { Message } from '@minimal-agent/shared-types';
import { IpcChannels } from '@minimal-agent/shared-types';
import type { MessageStore, SessionRepository } from '@minimal-agent/storage';

// TEACHING: Session CRUD over IPC. These handlers are thin — they delegate to
// the storage package and return plain data, so the renderer never sees SQL or
// file paths.

export function registerSessionHandlers(sessions: SessionRepository, messages: MessageStore): void {
  ipcMain.handle(IpcChannels.sessionList, () => sessions.list());

  ipcMain.handle(IpcChannels.sessionCreate, (_event, workspacePath: string) =>
    sessions.create({ title: 'New session', workspacePath }),
  );

  ipcMain.handle(IpcChannels.sessionLoad, (_event, sessionId: string) => ({
    session: sessions.getById(sessionId),
    messages: messages.read(sessionId),
  }));

  ipcMain.handle(IpcChannels.sessionDelete, (_event, sessionId: string) => {
    sessions.delete(sessionId);
    messages.delete(sessionId);
    return true;
  });

  ipcMain.handle(IpcChannels.appendMessage, (_event, sessionId: string, message: Message) => {
    // Derive the session title from the first user message.
    if (message.role === 'user' && messages.read(sessionId).length === 0) {
      sessions.update(sessionId, { title: message.content.slice(0, 60) || 'New session' });
    }
    messages.append(sessionId, message);
    sessions.update(sessionId, {}); // bump updated_at for list ordering
    return true;
  });
}
