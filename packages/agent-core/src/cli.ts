import { existsSync } from 'node:fs';
import { AgentLoop } from './agent/AgentLoop';
import { PromptManager } from './agent/PromptManager';
import { DeepseekAdapter } from './llm/DeepseekAdapter';
import { createToolExecutor } from './tools/registry';

// Load .env so `pnpm smoke` picks up DEEPSEEK_API_KEY from the project root.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// One-shot smoke runner: `pnpm smoke -- <workspace> <model> <message>` with
// DEEPSEEK_API_KEY set in the environment or .env. Streams the agent reply.
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [workspace, model, ...messageParts] = args;
  const message = messageParts.join(' ');
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!workspace || !message) {
    console.error('Usage: pnpm smoke -- <workspace> <model> <message>');
    process.exit(1);
  }
  if (!apiKey) {
    console.error('Set DEEPSEEK_API_KEY to run a live smoke test.');
    process.exit(1);
  }

  const llm = new DeepseekAdapter({ apiKey, model: model ?? 'deepseek-chat' });
  const loop = new AgentLoop(llm, createToolExecutor(), new PromptManager());

  for await (const event of loop.run(message, workspace)) {
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
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
