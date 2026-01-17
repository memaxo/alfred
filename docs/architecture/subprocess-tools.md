# Subprocess Tools

Owner: orchestrator

## Purpose

Codify the canonical patterns for ALFRED tools that shell out to external CLIs (e.g., `agent-browser`, `git`, container tooling) so they remain deterministic, secure, and testable under Bun.

## Scope

- **In scope**: spawning external CLIs from orchestrator tools, sandboxing, output capture, env hygiene, test patterns.
- **Out of scope**: policy modeling (see `docs/architecture/tool-security-patterns.md`), workflow pipeline design, UI.

## Canonical patterns

### 1) Spawn contract

- Use `Bun.spawn` with explicit `stdout: "pipe"`, `stderr: "pipe"`, `stdin: "ignore"`.
- Prefer `cmd` + `args` arrays (no shell) unless the CLI requires a shell.

### 2) Sandbox contract

Subprocess tools must restrict where they execute:

- Validate the working directory against allow-prefixes (repo root + explicit opt-ins).
- Use a **validated path string** as `cwd` for `Bun.spawn`.

Rationale: some CLIs are invoked via a **script wrapper** that `exec`s a platform binary or spawns a daemon; fd-based cwd wrappers can break these flows or make failures opaque.

### 3) Output capture contract

- Start stdout/stderr reads **immediately** (before awaiting `proc.exited`) to avoid losing output.
- Treat output parsing as “best effort”: if the CLI claims success but outputs no JSON, surface raw stdout/stderr for debugging.

### 4) Environment hygiene

Tools must not leak the full parent environment into child processes:

- Always include `PATH` and `HOME`.
- Prefer an allow-list for tool-specific variables (`AGENT_BROWSER_*`, `PLAYWRIGHT_*`, etc.).
- Keep secrets out of logs and error messages.

### 5) Integration test contract (external deps)

External-CLI integration tests should be:

- **Opt-in** via env var (so default `bun test` remains fast and hermetic).
- **Timeout-safe** with a generous per-test timeout.
- **Cleanup-safe**: always close sessions / stop servers in `finally`.
- **Minimal assertions**: prefer “tool returns ok” over deep assertions on raw subprocess output, because Bun test environments can vary in stream behavior.

## Case study: agent-browser

`agent-browser` is representative of the tricky case:

- It is invoked via a **shell wrapper** (`node_modules/.bin/agent-browser`) that `exec`s an OS/arch binary.
- It can run via a persistent daemon for speed.
- It emits JSON when passed `--json`, but capturing that JSON inside `bun test` can be sensitive to how streams are drained and when reads start.

The correct posture is:

- treat it as an external boundary,
- keep subprocess execution simple (`Bun.spawn`, validated `cwd`, minimal env),
- and keep the integration test opt-in.

