# Architecture Guide

1. **Layered pipeline.** Keep the flow `DB → repo → API → app`. Schemas + migrations live in `@alfred/db`; repos encapsulate queries; API packages wrap repos with auth/context; apps talk to APIs via tRPC only.
2. **Import direction.** Dependencies may only point inward: `apps/* → packages/* → packages/type`. `packages/*` must never import from `apps/*`.
3. **Server/client split.** Never bundle server-only modules (`@alfred/db`, `pg`, Node APIs) into client builds. Provide explicit browser stubs where the client needs the symbol.
4. **Env ownership.** Each runnable package loads its own `.env`. Do not rely on sibling loaders or cross-package side effects.
5. **Background guards.** Every scheduler or worker must be disabled by default and gated behind an env flag (e.g. `SCHED_REMIND=1`). Document multi-instance caveats alongside the flag.
6. **Operational endpoints.** Expose `/api/metrics` with Prometheus registry wiring (`packages/api/src/metrics.ts`) and increment `health_checks_total` in both `/healthz` and `/healthz/deps`. Add new metrics through the central registry only.
7. **Type graph.** Treat the monorepo as a composite TypeScript project. New packages join the root `tsconfig` references and ship a `typecheck` script (`tsc -b`) that CI can invoke via Turbo.
