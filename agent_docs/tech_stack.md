# Tech Stack

Last verified: 2026-10-23 — desktop slice implemented (Electron main + preload + React renderer). `pnpm typecheck` clean, `pnpm test` 53 passed + 1 skipped, desktop `electron-vite build` clean. See MEMORY.md.

## Stack

| Area | Choice | Notes |
|------|--------|-------|
| Frontend | React 18 + TypeScript + plain CSS | chat UI, tool cards, settings panel; Tailwind deferred |
| Desktop | Electron 45 + electron-vite | window mgmt, IPC, hot reload; preload emitted as CJS `.cjs` |
| Agent core | Node.js 24 + TypeScript | ReAct loop in a child process |
| Database | node:sqlite (metadata) + JSONL files (messages) | hybrid: event-sourced messages + relational metadata |
| Auth | none | local desktop app, no accounts |
| Styling | plain CSS | minimal, no design system |
| LLM | Deepseek API (`deepseek-v4-pro`) | Fetch + SSE streaming; resolved over PRD's Claude |
| Build | Vite + tsup | renderer + library builds |
| Package mgr | pnpm 9 + workspace | monorepo, one-way deps |

## Commands

- Setup: `pnpm install`
- Dev: `pnpm dev` (desktop: `pnpm --filter @minimal-agent/desktop dev`)
- Test: `pnpm test` (Vitest)
- Typecheck: `pnpm typecheck`
- Build: `pnpm build` (desktop: `pnpm --filter @minimal-agent/desktop build`)
- Browser/device check: run the Electron app (`pnpm dev`) and walk the flows in agent_docs/testing.md

## AI Runtime

- Provider/runtime: Deepseek (`deepseek-v4-pro` default), Fetch API + SSE streaming in agent-core.
- Model can see:
  - Public: user messages.
  - User-owned: workspace file contents read by tools, after desensitization.
  - Never send: raw API key, secrets/tokens, blocked sensitive files, private logs.
- Tools/actions: read (read_file/glob_files/search_code) unrestricted in workspace; write (write_file) gated per-write.
- Approval gates: every write_file pauses the agent loop for user confirmation.
- Retention/training setting to verify: Deepseek data-retention policy (PRD states "do-not-store" intent).
- Fallback: on API error, show message and allow retry; do not crash.

## Important Patterns

- Data fetching: Fetch API + SSE parsing in the LLM adapter (`AsyncIterable` chunks).
- State management: React hooks (`useAgent`, `useSession`); agent state in the child process.
- Forms/validation: minimal; settings panel for API key/model/workspace.
- Error handling: tool errors formatted and fed back to the LLM; no silent failures.
- Logging/monitoring: redact API key and masked secrets; local only.
