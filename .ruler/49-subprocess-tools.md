# Subprocess Tool Patterns

## Core Principle

Subprocess-based tools must be deterministic, sandboxed, and debuggable under Bun and CI.

## Rules

1. **Policy first.** Enforce `requireToolScopesAndPolicy()` before spawning any external process.
2. **Bun.spawn only.** Use `Bun.spawn` for subprocess tools with piped stdout/stderr and ignored stdin.
3. **Avoid fd-based cwd for wrappers.** Do not use fd-based cwd wrappers when the command is a script wrapper or when the CLI spawns/execs other binaries; use a validated path `cwd` string instead.
4. **Read streams immediately.** Begin reading stdout/stderr before awaiting `proc.exited` so output is not lost.
5. **Minimal env.** Pass a minimal `env` map, always including `PATH` and `HOME`, and only the tool-prefixed env vars needed for configuration.
6. **Opt-in integration tests.** Gate external-CLI integration tests behind an explicit env var and set a generous per-test timeout; always cleanup sessions/processes in `finally`.

