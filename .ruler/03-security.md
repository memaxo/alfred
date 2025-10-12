# Security Expectations

1. **Secrets in env.** All sensitive keys (Better Auth, Ed25519, Redis, third-party APIs) must come from environment variables. Never hardcode secrets or commit generated keys.
2. **Token issuance.** `@alfred/auth/token` is the single source for signing and verifying tool tokens. Always validate scopes plus `elevated`/`mfa` claims at tool entry points.
3. **Biometric elevation.** Elevated operations require a fresh bio-ticket (`requireRecentBiometric`). The ticket TTL is short (≤2 minutes) and must be enforced before performing dangerous actions.
4. **Input validation.** Use `zod` for all external inputs (HTTP, tRPC, CLI). Ensure DB writes rely on strongly typed objects from Drizzle schema helpers.
5. **Least privilege.** tRPC procedures should scope queries by `ctx.session.user.id` unless explicitly intended otherwise. Avoid returning raw DB models that include unrelated user data.
6. **Dependency hygiene.** Prefer audited, maintained packages. Add new crypto dependencies only after confirming licence compatibility and security posture.
