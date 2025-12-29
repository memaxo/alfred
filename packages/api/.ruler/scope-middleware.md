# Scope Enforcement Middleware

## Core Principle

OAuth scopes protect API procedures for MCP clients. Middleware validates scopes before procedure execution. Use presets for common operations.

## Rules

1. **Scope middleware factory.** Use `requireScopes({ required, requireAll?, message? })` from `middleware/scopes.ts`. Returns tRPC middleware.

2. **Single scope.** For single scope: `.use(requireScopes({ required: "read:todos" }))`. Grants access when user has that exact scope.

3. **Multiple scopes (AND).** For all scopes required: `.use(requireScopes({ required: ["read:todos", "write:todos"], requireAll: true }))`.

4. **Multiple scopes (OR).** For any scope sufficient: `.use(requireScopes({ required: ["read:todos", "read:notes"], requireAll: false }))`.

5. **SCOPE_REQUIREMENTS presets.** Use presets for common operations: `SCOPE_REQUIREMENTS.readTodos`, `SCOPE_REQUIREMENTS.writeTodos`. Write operations require both read and write scopes.

6. **Admin scope biometric.** Admin scopes (`admin:*`) require recent biometric verification unless `BIO_AUTH_BYPASS=true`.

7. **Error format.** Denied access throws `TRPCError` with `code: "FORBIDDEN"` and message `scope_required: <scopes>`.

8. **Context augmentation.** Successful middleware adds `ctx.scopes` array for downstream access. Use `ScopedContext` type.

9. **Testing middleware.** Create test tRPC instance with mock context. Use `router.createCaller(ctx)` to invoke procedures. Never call middleware directly.

10. **Scope sources.** Middleware reads scopes from `ctx.session?.user?.scopes` via `getSessionUserScopes()`. Works for both session auth and OAuth tokens.

## See Also

- `packages/type/src/scopes.ts` for scope type definitions
- `.ruler/03-security.md` in `packages/auth` for security patterns
