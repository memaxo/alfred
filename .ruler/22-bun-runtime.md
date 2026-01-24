# Bun Runtime Standards

## Rules

1. **Prefer Bun APIs.** Use `Bun.file`, `Bun.write`, `Bun.serve`, and `Bun.spawn` over Node compatibility APIs when possible.
2. **Subprocesses.** Use `Bun.spawn` with piped stdout/stderr and ignored stdin; read streams before awaiting `proc.exited`.
3. **Run TS directly.** Execute `.ts/.tsx` with `bun run`; use `tsc` for typechecking only.
4. **Web standards.** Prefer `fetch`, `Request/Response`, `URL`, `Headers`, and `WebSocket` over Node-specific APIs.
5. **Env loading.** Rely on Bun’s built-in `.env` loading; avoid `dotenv`.
6. **Lockfile.** Commit `bun.lock` and use frozen installs in CI.
7. **Optional deps.** Wrap heavy/optional deps in dynamic imports with clear failure messages.
