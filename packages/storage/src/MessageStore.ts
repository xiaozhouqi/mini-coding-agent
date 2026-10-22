import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import * as path from 'node:path';
import type { Message } from '@minimal-agent/shared-types';

// TEACHING: Event-sourced message log — each message is appended as one JSON
// line (JSONL). Append-only means history is a replayable sequence of events.
export class MessageStore {
  constructor(private readonly messagesDir: string) {}

  private filePath(sessionId: string): string {
    return path.join(this.messagesDir, `${sessionId}.jsonl`);
  }

  append(sessionId: string, message: Message): void {
    mkdirSync(this.messagesDir, { recursive: true });
    appendFileSync(this.filePath(sessionId), JSON.stringify(message) + '\n', 'utf-8');
  }

  read(sessionId: string): Message[] {
    const file = this.filePath(sessionId);
    if (!existsSync(file)) return [];
    return readFileSync(file, 'utf-8')
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as Message);
  }

  delete(sessionId: string): void {
    const file = this.filePath(sessionId);
    if (existsSync(file)) unlinkSync(file);
  }
}
