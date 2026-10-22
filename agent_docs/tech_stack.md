# Tech Stack

Last verified: unverified — from Tech Design (Final, 2026-10-19); no scaffold exists yet.

## Stack

| Area | Choice | Notes |
|------|--------|-------|
| Frontend | React 18 + TypeScript + Tailwind CSS | chat UI, tool cards, settings panel |
| Desktop | Electron 30 + electron-vite | window mgmt, IPC, hot reload |
| Agent core | Node.js 20 + TypeScript | ReAct loop in a child process |
| Database | better-sqlite3 (metadata) + JSONL files (messages) | hybrid: event-sourced messages + relational metadata |
| Auth | none | local desktop app, no accounts |
| Styling | Tailwind CSS | minimal, no design system |
| LLM | Deepseek API (`deepseek-v4-pro`) | Fetch + SSE streaming; resolved over PRD's Claude |
| Build | Vite + tsup | renderer + library builds |
| Package mgr | pnpm 9 + workspace | monorepo, one-way deps |

## Commands

All proposed from the Tech Design; unverified until the scaffold is built.

- Setup: `pnpm install`
- Dev: `pnpm dev`
- Test: `pnpm test` (Vitest)
- Typecheck: `pnpm typecheck`
- Build: `pnpm build`
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
