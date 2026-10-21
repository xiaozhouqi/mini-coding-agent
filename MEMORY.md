# Memory

Shared project handoff. Update after major decisions, completed phases, or bugs future agents need to know about. Keep short.

## Current State

- Current task: Scaffold the Minimal Coding Agent (Teaching Edition) MVP
- Current phase: agent-core slice implemented (ReAct loop + read_file + sandbox + Deepseek adapter)
- Next step: Propose the next slice (write_file + approval flow, or glob_files/search_code, or storage)
- Blocked by: none

## Decisions

- [2026-10-16] PRD scope locked: 5 P0 features (agent loop, file toolkit, chat UI, sandbox, session persistence); bash/MCP/git/multi-agent out of scope for v0.1.
- [2026-10-19] Tech Design finalized: Electron 30 + React 18 + TS + Tailwind, pnpm 9 monorepo, agent in a Node child process over stdio JSONL, hybrid persistence (JSONL messages + SQLite metadata), direct tool calling (no MCP).
- [2026-10-21] LLM provider resolved to **Deepseek** (model `deepseek-chat`). PRD said Anthropic Claude Sonnet 4; Tech Design said Deepseek. User confirmed Deepseek is final.

## AI / Tooling Decisions

- Provider: Deepseek (`deepseek-chat` default), via Fetch API + SSE streaming.
- Runtime: Electron + Node 20 child process; direct tool calling, not MCP.
- Retention: PRD states "do-not-store" intent; verify against Deepseek's current policy before launch.
- Cost ceiling: per-session token budget, default 100000 (PRD value to confirm).

## Known Issues

- `research-minimal-coding-agent.md` is empty; PRD references `docs/research-minimal-coding-agent.md`. Research findings not yet written.
- Symlink-escape test is skipped on this Windows machine (symlink creation needs Developer Mode/admin). The `resolveSafePath` protection is implemented; the test runs on macOS/Linux or Windows with Developer Mode.

## Completed

- [x] Initial scaffold (pnpm monorepo + shared-types package)
- [ ] Agent core — ReAct loop + read_file + sandbox + Deepseek adapter done; write_file/glob_files/search_code pending
- [ ] Storage (SQLite + JSONL)
- [ ] Desktop (Electron main + React renderer)
- [ ] Core MVP flow (chat → tool call → result)
- [ ] Launch checks
