# Memory

Shared project handoff. Update after major decisions, completed phases, or bugs future agents need to know about. Keep short.

## Current State

- Current task: Scaffold the Minimal Coding Agent (Teaching Edition) MVP
- Current phase: Core MVP flow verified live (`pnpm smoke` runs chat → read_file tool-call → result). Content desensitization (P0 #4) now implemented in read_file + search_code. `pnpm typecheck` clean, `pnpm test` 59 passed + 1 skipped, `pnpm build` clean.
- Next step: Launch checks — exercise the full user journey in the running Electron app (chat UI → tool call → approval modal → result), then final verification.
- Blocked by: none

## Decisions

- [2026-10-16] PRD scope locked: 5 P0 features (agent loop, file toolkit, chat UI, sandbox, session persistence); bash/MCP/git/multi-agent out of scope for v0.1.
- [2026-10-19] Tech Design finalized: Electron 30 + React 18 + TS + Tailwind, pnpm 9 monorepo, agent in a Node child process over stdio JSONL, hybrid persistence (JSONL messages + SQLite metadata), direct tool calling (no MCP).
- [2026-10-21] LLM provider resolved to **Deepseek**. PRD said Anthropic Claude Sonnet 4; Tech Design said Deepseek. User confirmed Deepseek is final.
- [2026-10-22] Deepseek model names changed: `deepseek-chat` is no longer accepted by the API, which now serves `deepseek-v4-pro` (capable, default) and `deepseek-flash` (fast). Updated the default in cli.ts, tests, and docs.
- [2026-10-22] **Storage uses Node's built-in `node:sqlite` (`DatabaseSync`), not better-sqlite3.** better-sqlite3 v13 dropped prebuilt binaries and compiles from source, which needs Visual Studio C++ Build Tools (absent here). `node:sqlite` gives the same sync API (`prepare/get/all/run`, `@name` params) with zero native build. Note `db.pragma()` is replaced by `db.exec('PRAGMA …;')`.
- [2026-10-22] `@types/node` bumped 20 → 24 and `engines` 20 → 24 to match the Node 24 runtime and provide `node:sqlite` types.
- [2026-10-22] Vitest bumped 2.1.1 → 4.1.12. Vite 5's resolver strips the `node:` prefix for `node:sqlite` (a Node builtin newer than Vite 5) and fails with "Failed to load url sqlite". Vitest 4 requires Vite 6+, which recognizes `node:sqlite`.
- [2026-10-23] Desktop stack pinned: electron 45.0.0, electron-vite 6.0.0, @vitejs/plugin-react 6.1.2 (peer vite ^8), react 18.3.1, vite 8.3.5. React 18 (not 19) to match docs. Plain CSS; Tailwind deferred.
- [2026-10-23] Desktop preload is emitted as **CommonJS `.cjs`**, not ESM `.mjs`. Electron loads CJS preload synchronously (before the page runs), so `window.api` exists when React mounts; an ESM `.mjs` preload runs after page load and would race the renderer. Forced via `preload.build.rollupOptions.output.format: 'cjs'` + `entryFileNames: '[name].cjs'`; main references `../preload/index.cjs`.
- [2026-10-23] Desktop dev agent spawn: `spawn('node', [require.resolve('tsx/cli'), require.resolve('@minimal-agent/agent-core/stdio-main')])`. `agent-core` is NOT bundled into main — it runs as a child process; main only `require.resolve`-s its path. Fine for dev; a packaged app would need the agent bundled.
- [2026-10-24] Content desensitization ("key masking") is a **deterministic regex layer in the tool boundary**, not a model decision: `security/desensitize.ts` masks bare `sk-…`, secret-field assignments (`api_key=`, `password:`, `token=`, …), and `Bearer` tokens before `read_file`/`search_code` results reach the LLM or UI. Verified live — the model echoes back `api_key=***` and never sees the raw value.

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
- [x] Desktop (Electron main + React renderer)
- [x] Core MVP flow (chat → tool call → result) + content desensitization
- [ ] Launch checks
