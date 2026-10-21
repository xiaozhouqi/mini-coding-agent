# Review Checklist

Do not mark work complete until the relevant checks pass.

## Basic Checks

- [ ] Diff is focused on the requested task.
- [ ] No unrelated files were rewritten.
- [ ] No secrets, tokens, private logs, or production exports were exposed.
- [ ] Protected actions, if taken, were covered by the user's authorization as defined in AGENTS.md.
- [ ] Tests/typecheck/build passed or failures are explained.
- [ ] UI changes were checked in the running Electron app when applicable.

## Security

- [ ] `ToolSandbox` rejects `..` traversal, symlink escapes, and writes outside the workspace.
- [ ] Sensitive-file blacklist blocks reads of `.env`, `.pem`, `.key`, `.crt`, `.p12`, `id_rsa*`, `.credentials`.
- [ ] Every `write_file` goes through user confirmation (no batch-approve path).
- [ ] API key stored via `safeStorage`, never logged, never sent except to the LLM API.
- [ ] File content is desensitized before it reaches the LLM (`sk-…`, `api_key=…`, `password=…` masked).
- [ ] Dependencies audited (`pnpm audit` or equivalent) — no unaddressed high-severity findings.

Auth: not applicable — local desktop app, no accounts.

## AI Checks

- [ ] Model-visible data is documented (workspace file contents after masking; never the raw key/secrets).
- [ ] Read file contents and tool output are treated as untrusted data (not instructions).
- [ ] Risky actions (write_file) follow the approval boundary in AGENTS.md.
- [ ] Direct, bad/indirect, auth-required, failure, and tool/action checks passed (see agent_docs/testing.md).
- [ ] Logs/traces do not expose the API key or customer data.
- [ ] Provider retention/training setting checked before launch (verify Deepseek policy).

## Final Evidence

The final response should include:

- Files changed
- Commands run
- Test/build/browser results
- AI/tool eval results, if applicable
- Remaining risks
