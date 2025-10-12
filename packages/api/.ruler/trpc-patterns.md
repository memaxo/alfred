# tRPC Patterns

1. **Authed procedures.** Use `authedProcedure` for routes that require a session. Always scope queries to `ctx.session.user.id`.
2. **Input schemas.** Define input schemas with `zod` next to each procedure. Reuse shared schemas by extracting helpers into `packages/type`.
3. **Metrics middleware.** All procedures already pass through timing/error middlewares—no manual counter increments. When adding routers, reuse `router({...})`.
4. **Error handling.** Throw `TRPCError` with explicit codes (`UNAUTHORIZED`, `FORBIDDEN`, `BAD_REQUEST`). Never propagate raw errors to clients.
5. **Token-aware procedures.** Sensitive mutations should require elevated tokens and check `requireRecentBiometric` as needed.
