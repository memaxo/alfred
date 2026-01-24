<!-- Source: .ruler/streaming.md -->

# Streaming & Scheduling

1. **Schedulers.** Export `start<Domain>Scheduler` functions and keep them idempotent. Callers decide when to start based on env flags.
2. **Intervals.** Introduce jitter (> zero) to avoid synchronized wake-ups. Document limitations for multi-instance deployments.
3. **tRPC streams.** When adding streaming procedures, surface an incremental payload (`{ type: "data" | "error" | "done" }`). Keep payloads JSON serialisable.
4. **Notifications.** Record fired reminders and timers through repos before emitting events downstream (websocket, SSE, etc.).

<!-- Source: .ruler/trpc-patterns.md -->

# tRPC Patterns

1. **Authed procedures.** Use `authedProcedure` for routes that require a session. Always scope queries to `ctx.session.user.id`.
2. **Input schemas.** Define input schemas with `zod` next to each procedure. Reuse shared schemas by extracting helpers into `packages/type`.
3. **Metrics middleware.** All procedures already pass through timing/error middlewares—no manual counter increments. When adding routers, reuse `router({...})`.
4. **Error handling.** Throw `TRPCError` with explicit codes (`UNAUTHORIZED`, `FORBIDDEN`, `BAD_REQUEST`). Never propagate raw errors to clients.
5. **Token-aware procedures.** Sensitive mutations should require elevated tokens and check `requireRecentBiometric` as needed.
