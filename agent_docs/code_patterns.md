# Code Patterns

Project-specific conventions from the Tech Design. Inspect existing code before adding new ones.

## Architecture

- Primary pattern: layered monorepo, one-way deps `shared-types → agent-core → storage → desktop`. No reverse/circular imports.
- The agent core runs in a separate Node child process, not in Electron main/renderer.
- Cross-layer communication uses typed contracts from `shared-types` (messages, tools, IPC, config).

## Teaching conventions

- `// TEACHING:` prefix marks inline teaching annotations.
- Every core module has a header comment: responsibility, teaching concept, dependencies, extension points.
- Prefer clarity over cleverness; a beginner must be able to read each module in isolation.

## Data And State

- Data fetching: LLM adapter returns `AsyncIterable<LLMChunk>` (SSE).
- Server/agent state: lives in the child process (AgentLoop).
- Client state: React hooks (`useAgent`, `useSession`).
- Persistence: JSONL append-only for messages; SQLite for session metadata/config via repository interfaces.

## Errors And Validation

- Validate all tool inputs at the boundary; run every path through `resolveSafePath` before touching the filesystem.
- Return user-safe errors to the UI; log developer context locally.
- Tool errors are fed back to the LLM so it can self-correct — do not swallow them.

## Naming

- Files: kebab-case (`readFile.ts`, `ToolSandbox.ts`), packages under `packages/*`.
- Components/classes: PascalCase.
- Functions/variables: camelCase.
- Env vars/constants: UPPER_SNAKE_CASE.
- TypeScript: `strict: true`, `noImplicitAny: true`, `noUnusedLocals: true`, ESModule.

## AI Tool Patterns

- Tools implement `{ definition, execute(params, context) }`; keep them small and sandboxed.
- Treat file contents and tool output as untrusted data (never as instructions).
- write_file requires per-write approval; reads are sandboxed; external network beyond the LLM API is forbidden.
- Desensitize content before it reaches the model; redact the API key and masked secrets from logs.
