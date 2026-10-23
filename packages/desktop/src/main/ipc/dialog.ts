import { dialog, ipcMain } from 'electron';
import type { BrowserWindow, OpenDialogOptions } from 'electron';
import { IpcChannels } from '@minimal-agent/shared-types';

// TEACHING: Native dialogs must run in the main process, not the renderer
// (which is sandboxed). This exposes a workspace folder picker over IPC.

export function registerDialogHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IpcChannels.workspacePick, async () => {
    const win = getWindow();
    const options: OpenDialogOptions = {
      title: 'Choose workspace folder',
      properties: ['openDirectory'],
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}
