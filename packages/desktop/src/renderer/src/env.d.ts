import type { DesktopApi } from '@minimal-agent/shared-types';

// TEACHING: Type the preload bridge for the renderer. `window.api` is injected
// by contextBridge in the preload script; this declaration makes it visible to
// TypeScript (it exists only at runtime, inside Electron).

declare global {
  interface Window {
    api: DesktopApi;
  }
}

export {};
