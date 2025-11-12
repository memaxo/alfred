# Architecture Guide

1. **Layered pipeline.** Keep the flow `DB → repo → API → app`. Schemas + migrations live in `@alfred/db`; repos encapsulate queries; API packages wrap repos with auth/context; apps talk to APIs via tRPC only.
2. **Import direction.** Dependencies may only point inward: `apps/* → packages/* → packages/type`. `packages/*` must never import from `apps/*`.
3. **Server/client split.** Never bundle server-only modules (`@alfred/db`, `pg`, Node APIs) into client builds. Provide explicit browser stubs where the client needs the symbol.
4. **Env ownership.** Each runnable package loads its own `.env`. Do not rely on sibling loaders or cross-package side effects.
5. **Background guards.** Schedulers and workers must be gated behind env flags (e.g. `SCHED_REMIND=1`) to prevent duplicate execution in multi-instance deployments. This is operational, not a feature flag—document multi-instance caveats alongside the flag. Core functionality (persistence, normalization, redaction) should never be gated.
6. **Operational endpoints.** Expose `/api/metrics` with Prometheus registry wiring (`packages/api/src/metrics.ts`) and increment `health_checks_total` in both `/healthz` and `/healthz/deps`. Add new metrics through the central registry only.
7. **Type graph.** Treat the monorepo as a composite TypeScript project. New packages join the root `tsconfig` references and ship a `typecheck` script (`tsc -b`) that CI can invoke via Turbo.
8. **API route handler reuse.** When API route handlers share >80% of code, extract shared logic into a reusable handler function. Pass only the varying parts (tool builders, error prefixes) as parameters. This reduces duplication and maintenance burden while maintaining type safety.
