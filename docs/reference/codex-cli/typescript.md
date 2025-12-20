# Codex runner (Rust CLI JSONL)

ALFRED runs Codex via the Rust `codex` CLI in non-interactive JSONL mode (`codex exec --json`).

The in-repo surface for typed events is `@alfred/codex` (server-only): it owns the `ThreadEvent` / `ThreadItem` schemas and exports a small runner that consumes Codex’s JSONL stream.

## Preferred entry point (ALFRED)

Use the orchestrator tool (`@alfred/agent/orchestrator/tool/codex`) rather than calling Codex directly. It enforces:

- secure working directory handles (no string `cwd`)
- env allowlists (`CODEX_ENV_ALLOWLIST`, `MCP_ENV_ALLOWLIST`)
- session binding (`sessionId` + `userId` + working directory)
- stable UI streaming chunks (`stdout`, `stderr`, `notice`, `codex_event`)

## Low-level API (internal)

`@alfred/codex` is intended for internal use. It requires callers to provide a spawn function so ALFRED can enforce **secure cwd** semantics (see `packages/agent/src/security/secure-spawn.ts`).

`runStreamed()` yields typed Codex events:

- `thread.started`
- `turn.started`, `turn.completed`, `turn.failed`
- `item.started`, `item.updated`, `item.completed`
- `error`

## Structured output

When you pass `outputSchema` (a JSON Schema object or `true`), `@alfred/codex` writes a temporary schema file and runs Codex with `--output-schema <path>`, relying on Codex’s native validation.
