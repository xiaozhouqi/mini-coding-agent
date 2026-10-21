# Project Brief

## Product

- One-line vision: A minimal, open-source desktop coding agent that teaches the ReAct loop, tool calling, inter-process communication, and sandbox safety by being small enough to read and modify end-to-end.
- Target users: Developers, students, and tech enthusiasts learning AI-agent development (primary: junior devs with JS/TS basics, 0–3 yrs).
- Primary user outcome: Run a working coding agent locally, watch each tool call and its result, and modify the system prompt/tools to see behavior change.

## Scope

- Must ship (P0):
  - Agent Loop & LLM Integration — ReAct loop, streaming, autonomous tool-call scheduling via Deepseek.
  - File System Toolkit — read_file, write_file, glob_files, search_code, all sandboxed.
  - Desktop Chat Interface — Electron + React, streaming render, tool-call cards, workspace picker.
  - Workspace Sandbox & Safety Guardrails — path validation, write approval, sensitive-file blocking, key masking.
  - Session Persistence — JSONL messages + SQLite metadata, restore on restart.
- Not in v1: Terminal/Bash tool (→v0.2), MCP protocol, Git integration, multi-agent orchestration, lint feedback/shadow workspace, voice input, enterprise security/DLP.

## Principles

- Solve the user story before adding polish.
- Teaching-first: minimal, modular, heavily commented code; `// TEACHING:` annotations.
- Prefer boring, maintainable choices.
- Keep generated docs short and current.
- Verify user-visible work in the real running app.

## AI Position

- AI is used for: the core agent — turning user messages into tool calls and final answers.
- AI is not used for: sandbox enforcement, path validation, or write approval (deterministic code, not model decisions).
- Human approval required for: every file write.
