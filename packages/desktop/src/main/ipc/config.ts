import { ipcMain } from 'electron';
import { IpcChannels } from '@minimal-agent/shared-types';
import type { ConfigStore } from '@minimal-agent/storage';
import { encryptSecret } from '../security/safeStorage';

// TEACHING: The API key is a secret-at-rest. `config:get` never returns it to
// the renderer (only a "is it set" flag), and `config:set` encrypts it before
// it touches SQLite.

export function registerConfigHandlers(config: ConfigStore): void {
  ipcMain.handle(IpcChannels.configGet, () => {
    const c = config.get();
    return { model: c.model, tokenBudget: c.tokenBudget, hasApiKey: c.apiKey !== '' };
  });

  ipcMain.handle(
    IpcChannels.configSet,
    (_event, next: { apiKey?: string; model: string; tokenBudget: number }) => {
      const current = config.get();
      // An empty/omitted key means "keep the stored one".
      const apiKey = next.apiKey && next.apiKey.trim() !== '' ? encryptSecret(next.apiKey) : current.apiKey;
      config.set({ apiKey, model: next.model, tokenBudget: next.tokenBudget });
      return true;
    },
  );
}
