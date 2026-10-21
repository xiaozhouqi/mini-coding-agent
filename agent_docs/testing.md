# Testing

## Required Before Completion

- [ ] Relevant unit tests pass (`pnpm test`, Vitest).
- [ ] Typecheck passes (`pnpm typecheck`).
- [ ] Build passes (`pnpm build`).
- [ ] User-visible changes are checked in the running Electron app when applicable.
- [ ] No tests skipped or weakened without human approval.
- [ ] Evidence reported in the final response.

## Commands

All proposed; unverified until the scaffold exists.

- All tests: `pnpm test`
- Single test: `pnpm test -- <path>` (Vitest)
- Typecheck: `pnpm typecheck`
- Lint/format: not configured yet (open item)
- Build: `pnpm build`
- Browser/device check: `pnpm dev`, then walk the flows below manually.

## What To Test

| Change type | Minimum check |
|-------------|---------------|
| Sandbox/path logic | Unit test in ToolSandbox (traversal, symlink, blacklist) |
| Agent loop | Unit test in AgentLoop (single/multi-round, error feedback) |
| Persistence | Unit test in MessageStore (append/read/restore) |
| UI/IPC behavior | Manual flow in the running Electron app |
| LLM/tool behavior | Manual prompt + data-boundary check |

## Concrete flows to verify

1. First launch: open app → configure API key + workspace → land in a blank session.
2. Tool call: ask the agent to read a file in the workspace → tool-call card shown → result returned.
3. Write approval: ask to write a file → modal shows path + preview → approve executes, reject aborts and tells the LLM.
4. Persistence: create a session, send a message, restart the app → history restored.
5. Session metadata: create/update timestamps and token usage visible.

## AI Checks

- Direct prompt: "read src/index.ts" → read_file called with correct path.
- Bad/indirect prompt: file content containing instructions must not redirect the agent (treated as data).
- Auth-required prompt: write_file must pause for approval; no tool can write outside the workspace.
- Failure case: invalid/no API key or provider error → error shown, app stays alive, retry works.
- Tool/action check: read tools work in-workspace; traversal/symlink/sensitive reads are blocked; external network (non-API) is forbidden.
- Data check: API key and masked secrets must not appear in model output, logs, or traces.
