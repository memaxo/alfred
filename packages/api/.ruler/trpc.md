# API & tRPC Standards

1. **Router Structure.** Keep routers thin. Delegate business logic to domain services or repos.

2. **Middleware.** Apply `requireAuthMiddleware` to all protected procedures. Use `loggingMiddleware` for audit trails of sensitive operations.

3. **Input Validation.** Every procedure must validate input using Zod schemas. Use `.inputValidator()` for server functions.

4. **Error Classification.** Use `toTRPCError()` to wrap unknown errors. Classification: `transient` (retry), `permanent` (don't retry), `system` (infra failure).
