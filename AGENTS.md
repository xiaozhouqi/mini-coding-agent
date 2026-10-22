# AGENTS.md — Minimal Coding Agent (Teaching Edition)

> Minimal, modular, teaching-first desktop coding agent. Read this before
> building; only keep what's not derivable from the code.

## Project

- **What this is:** A minimal, open-source desktop coding agent for teaching — it demonstrates the ReAct loop, tool calling, inter-process communication, and sandbox safety by being small enough to read and modify end-to-end.
- **Who it is for:** Developers, students, and tech enthusiasts learning AI-agent development (primary: junior devs with JS/TS basics, 0–3 yrs).

## Commands

None are verified yet — the repo is pre-scaffold (docs only). Proposed from the Tech Design:

- `pnpm dev` — Electron dev mode with hot reload (electron-vite).
- `pnpm build` — build all workspace packages (Vite + tsup).
- `pnpm test` — unit tests (Vitest).
- `pnpm typecheck` — global TypeScript typecheck (`strict: true`, `noImplicitAny`).

## Read first — when relevant

- Product scope & acceptance criteria: `docs/PRD-Minimal-Coding-Agent-MVP.md`
- Architecture, data model, security: `docs/technical-Minimal-Coding-Agent-MVP.md`
- Build-facing scope summary: `agent_docs/project_brief.md`
- Stack & exact setup: `agent_docs/tech_stack.md`
- Verification flows: `agent_docs/testing.md`
- Conventions: `agent_docs/code_patterns.md`

Read only the documents needed for the task. Current progress lives in `MEMORY.md`, not here.

## Gotchas

- **Teaching-first, not production-first.** Code stays minimal, modular, and heavily commented. Every core module has a header comment stating responsibility, the teaching concept it maps to, dependencies, and extension points. Use the `// TEACHING:` prefix for inline annotations.
- **One-way package dependency.** `shared-types → agent-core → storage → desktop`. No reverse or circular imports.
- **The agent runs in a child process**, not in the Electron main/renderer. It talks over stdio as newline-delimited JSONL frames. Don't collapse this into the main process — the process boundary is itself a teaching point.
- **Every `write_file` needs a user confirmation.** No batch-approve, no allowlist. Approval round-trips: agent child → main → renderer modal → back.
- **The sandbox is non-negotiable.** All file tools resolve `realpath` and check the workspace prefix; reads block a sensitive-file blacklist. Symlink escapes and `..` traversal must be rejected, not just warned.
- **LLM provider is Deepseek**, not Anthropic (PRD and Tech Design disagreed; Deepseek was confirmed as final). Default model is `deepseek-v4-pro`.

## Protected areas

- Keep secrets, credentials, private logs, and production data out of commits and unapproved transmissions.
- The API key is stored encrypted via Electron `safeStorage`; never write it to logs or send it anywhere except the LLM API.
- File content sent to the LLM must be desensitized first (mask `sk-…`, `api_key=…`, `password=…`).

Within scope, continue through local implementation, affected checks, and fixes without repeated approval. Changing auth/billing/infrastructure/migration *source* differs from applying it to a live system. Confirm before external sends, deployment, charges, production migrations, destructive data operations, or access changes.

## AI features

The product *is* an AI agent.

- **Model can see:** user messages + workspace file contents read by tools (after desensitization).
- **Never send:** the raw API key, secrets/tokens, `.env`/`.pem`/key material (blocked by blacklist), private logs.
- **AI can do:** read files in the workspace, list/search files, propose writes (pending approval). Forbidden: directory traversal, sensitive-file reads, any external network except the LLM API, terminal commands.
- **Needs approval:** every `write_file` (per-write user confirmation).
- **How to verify behavior:** see `agent_docs/testing.md` security cases (traversal, symlink, `.env` block, masking).
- **Fallback:** on API failure show an error and allow retry; the app must not crash.

## Done means

Complete the requested behavior, run checks appropriate to the changed area (unit tests via Vitest, typecheck, build), and fix failures caused by the change. For UI/runtime work, exercise the user journey in the running Electron app when possible. Report actual checks and limitations; never present an unchecked implementation as finished.
