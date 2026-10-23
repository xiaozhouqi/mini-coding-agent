import { startStdioServer } from './stdio-server';

// Entry point the Electron main process spawns as a separate Node child
// process (`node <tsx> packages/agent-core/src/stdio-main.ts`). It never talks
// to the network on its own; everything it knows comes from stdin.
startStdioServer(process.stdin, (frame) => {
  process.stdout.write(`${JSON.stringify(frame)}\n`);
});
