# Memory

Shared project handoff. Update after major decisions, completed phases, or bugs future agents need to know about. Keep short.

## Current State

- Current task: Scaffold the Minimal Coding Agent (Teaching Edition) MVP
- Current phase: agent-core + storage slices complete (ReAct loop + four tools + sandbox + Deepseek adapter + SQLite/JSONL persistence)
- Next step: Desktop package (Electron main + React renderer + stdio child-process wiring + write-approval modal + safeStorage), then core MVP flow + launch checks
- Blocked by: none

## Decisions

- [2026-10-16] PRD scope locked: 5 P0 features (agent loop, file toolkit, chat UI, sandbox, session persistence); bash/MCP/git/multi-agent out of scope for v0.1.
- [2026-10-19] Tech Design finalized: Electron 30 + React 18 + TS + Tailwind, pnpm 9 monorepo, agent in a Node child process over stdio JSONL, hybrid persistence (JSONL messages + SQLite metadata), direct tool calling (no MCP).
- [2026-10-21] LLM provider resolved to **Deepseek**. PRD said Anthropic Claude Sonnet 4; Tech Design said Deepseek. User confirmed Deepseek is final.
- [2026-10-22] Deepseek model names changed: `deepseek-chat` is no longer accepted by the API, which now serves `deepseek-v4-pro` (capable, default) and `deepseek-flash` (fast). Updated the default in cli.ts, tests, and docs.
- [2026-10-22] **Storage uses Node's built-in `node:sqlite` (`DatabaseSync`), not better-sqlite3.** better-sqlite3 v13 dropped prebuilt binaries and compiles from source, which needs Visual Studio C++ Build Tools (absent here). `node:sqlite` gives the same sync API (`prepare/get/all/run`, `@name` params) with zero native build. Note `db.pragma()` is replaced by `db.exec('PRAGMA …;')`.
- [2026-10-22] `@types/node` bumped 20 → 24 and `engines` 20 → 24 to match the Node 24 runtime and provide `node:sqlite` types.
- [2026-10-22] Vitest bumped 2.1.1 → 4.1.12. Vite 5's resolver strips the `node:` prefix for `node:sqlite` (a Node builtin newer than Vite 5) and fails with "Failed to load url sqlite". Vitest 4 requires Vite 6+, which recognizes `node:sqlite`.

## AI / Tooling Decisions

- Provider: Deepseek (`deepseek-v4-pro` default), via Fetch API + SSE streaming.
- Runtime: Electron + Node 24 child process; direct tool calling, not MCP.
- Retention: PRD states "do-not-store" intent; verify against Deepseek's current policy before launch.
- Cost ceiling: per-session token budget, default 100000 (PRD value to confirm).

## Known Issues

- `research-minimal-coding-agent.md` is empty; PRD references `docs/research-minimal-coding-agent.md`. Research findings not yet written.
- Symlink-escape test is skipped on this Windows machine (symlink creation needs Developer Mode/admin). The `resolveSafePath` protection is implemented; the test runs on macOS/Linux or Windows with Developer Mode.
- `node:sqlite` emits `ExperimentalWarning: SQLite is an experimental feature` at test runtime (harmless, on stderr).

## Completed

- [x] Initial scaffold (pnpm monorepo + shared-types package)
- [x] Agent core — ReAct loop + read_file/write_file/glob_files/search_code + sandbox + Deepseek adapter
- [x] Storage (SessionRepository + MessageStore JSONL + ConfigStore, via node:sqlite)
- [ ] Desktop (Electron main + React renderer)
- [ ] Core MVP flow (chat → tool call → result)
- [ ] Launch checks
