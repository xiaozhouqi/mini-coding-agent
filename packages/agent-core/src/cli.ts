import { existsSync } from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline/promises';
import type { WriteApprovalRequest } from '@minimal-agent/shared-types';
import { AgentLoop } from './agent/AgentLoop';
import { PromptManager } from './agent/PromptManager';
import { readProjectInstructions } from './agent/projectInstructions';
import { DeepseekAdapter } from './llm/DeepseekAdapter';
import { createToolExecutor } from './tools/registry';

// Load .env so `pnpm smoke` picks up DEEPSEEK_API_KEY from the project root.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// One-shot smoke runner: `pnpm smoke <workspace> <model> <message>` with
// DEEPSEEK_API_KEY set in the environment or .env. Streams the agent reply.
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [workspace, model, ...messageParts] = args;
  const message = messageParts.join(' ');
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!workspace || !message) {
    console.error('Usage: pnpm smoke <workspace> <model> <message>');
    process.exit(1);
  }
  if (!apiKey) {
    console.error('Set DEEPSEEK_API_KEY to run a live smoke test.');
    process.exit(1);
  }

  const llm = new DeepseekAdapter({ apiKey, model: model ?? 'deepseek-v4-pro' });
  const loop = new AgentLoop(llm, createToolExecutor(), new PromptManager(undefined, readProjectInstructions(workspace)));

  // Terminal approval for write_file — prompt the user before writing.
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const approveWrite = async (request: WriteApprovalRequest): Promise<boolean> => {
    console.log(`\n[write approval] ${path.join(workspace, request.path)} (${request.exists ? 'OVERWRITE' : 'NEW'})`);
    console.log('--- preview ---');
    console.log(request.content.slice(0, 400));
    const answer = await rl.question('Approve? [y/N] ');
    return answer.trim().toLowerCase() === 'y';
  };

  try {
    for await (const event of loop.run(message, workspace, [], approveWrite)) {
      switch (event.type) {
        case 'text-delta':
          process.stdout.write(event.text);
          break;
        case 'tool-call':
          console.log(`\n[tool-call] ${event.toolCall.name} ${JSON.stringify(event.toolCall.arguments)}`);
          break;
        case 'tool-result':
          console.log(`\n[tool-result] ${event.toolResult.success ? 'ok' : 'error'}: ${event.toolResult.error ?? ''}`);
          break;
        case 'done':
          console.log('\n[done]');
          break;
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
