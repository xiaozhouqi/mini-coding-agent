// TEACHING: Secret masking. File contents are untrusted data that may contain
// credentials (a checked-in `.env.example`, a config file, a sample token). The
// agent's read tools return that content, and it flows both to the LLM and to
// the UI, so we scrub the obvious secrets *before* it leaves the tool boundary.
//
// Responsibility: deterministic masking of secret values. This is plain code,
// never a model decision — the sandbox and desensitization layers must not
// depend on the model to protect itself.
//
// Extension points: add patterns here as new secret shapes show up.

// Common secret field names whose *value* we mask while keeping the name, so a
// reader can still tell a secret was present. Group 1 captures the field name;
// the value alternation below is non-capturing so `$1` is always the field.
const SECRET_FIELDS = '(api[_-]?key|pass(?:word|wd)?|secret|token)';

export function desensitize(content: string): string {
  return content
    // Bare API-key tokens: Deepseek/OpenAI/Anthropic-style "sk-…".
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, 'sk-***')
    // Field assignments: `api_key=…`, `password: …`, quoted or unquoted.
    .replace(
      new RegExp(`\\b${SECRET_FIELDS}\\s*[:=]\\s*(?:"[^"]*"|'[^']*'|[^\\s,;"']+)`, 'gi'),
      '$1=***',
    )
    // Authorization headers: `Bearer <token>`.
    .replace(/\b(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1***');
}
