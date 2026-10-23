import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

// electron-vite builds three targets: main, preload and renderer. The main and
// preload processes run under Node, so Node builtins and `electron` stay
// external; our workspace packages are TypeScript source, so we bundle them in
// (exclude them from externalization) rather than requiring them at runtime.
const workspacePackages = ['@minimal-agent/agent-core', '@minimal-agent/storage', '@minimal-agent/shared-types'];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
    build: {
      rollupOptions: {
        // Electron loads CommonJS preload scripts synchronously, before the
        // page runs, so `window.api` is guaranteed to exist when React mounts.
        // ESM preloads (.mjs) instead run *after* page load, which would race
        // the renderer's first `window.api` access — so we emit CJS here.
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
    server: {
      // Bind to IPv4 loopback explicitly. Node 24 resolves `localhost` to IPv6
      // `::1` first, but Electron's Chromium connects over IPv4 `127.0.0.1`,
      // which otherwise fails with ERR_CONNECTION_REFUSED on Windows.
      host: '127.0.0.1',
    },
  },
});
