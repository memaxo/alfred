# ALFRED PRD

A phased, end-to-end checklist to build ALFRED on the AI SDK v6 runtime with domain-driven packages, tRPC APIs, Drizzle + Postgres + pgvector storage, and Proxmox deployment.

Notes
- Phase 1: Scaffold everything (files/modules with TODOs, function signatures, wiring only; no logic).
- Phase 2: Scaffold all tests (Vitest); define expected behavior and flow (no real IO).
- Phase 3+: Implement logic in coherent slices per domain; integrate and harden.

## Phase 1 — Scaffold

- [x] Init monorepo with Turborepo, bun, workspace packages, root scripts, and lint/format configs
- [x] Add `tsconfig.base.json` with path aliases for `@alfred/*` (api, auth, policy, db, rag, ui, type, agent)
- [x] Add `turbo.json` with build/dev/test/migrate/publish pipeline tasks
- [x] Add docker/postgres/docker-compose.yml for Postgres+pgvector container
- [x] Add docker/monitoring/docker-compose.yml placeholders (prometheus, grafana, loki, promtail, alertmanager, cadvisor, blackbox)
- [x] Scaffold apps/web TanStack Start project and base routes
- [x] Add apps/web/src/routes/api/trpc/$.ts tRPC fetchRequestHandler skeleton
- [x] Add apps/web/src/routes/api/auth/$.ts Better Auth handler skeleton
- [x] Add apps/web/src/routes/api/linear/webhook.ts Linear webhook handler skeleton
- [x] Add apps/web/src/routes/api/metrics.ts Prometheus metrics endpoint skeleton
- [x] Add apps/web/src/routes/api/jwks.ts JWKS endpoint skeleton
- [x] Add apps/web/src/routes/healthz.ts liveness/health endpoint skeleton
- [x] Add apps/web/src/routes/healthz/deps.ts dependency readiness endpoint skeleton
- [x] Add packages/api/src/index.ts initTRPC factory skeleton
- [x] Add packages/api/src/context.ts createContext (session + runtime metadata) skeleton
- [x] Add packages/api/src/routers root registry skeleton
- [x] Add packages/api/src/gate.ts policy PEP middleware skeleton
- [x] Add packages/api/src/routers/assistant.ts assistant router skeleton
- [x] Add packages/api/src/routers/orchestrator.ts orchestrator router skeleton
- [x] Add packages/api/src/routers/workflow.ts workflow start/stream/resume router skeleton
- [x] Add packages/api/src/routers/note.ts notes router CRUD skeleton
- [x] Add packages/api/src/routers/remind.ts reminders router skeleton
- [x] Add packages/api/src/routers/timer.ts timers router skeleton
- [x] Add packages/api/src/routers/book.ts bookmarks router skeleton
- [x] Add packages/api/src/routers/home.ts Home control router skeleton
- [x] Add packages/api/src/routers/deploy.ts deploy router skeleton
- [x] Add packages/api/src/routers/linear.ts Linear OAuth router skeleton
- [x] Add packages/api/src/routers/voice.ts STT/TTS router skeleton
- [x] Add packages/api/src/routers/profile.ts profile router skeleton
- [x] Add packages/api/src/routers/preference.ts preference router skeleton
- [x] Add packages/api/src/routers/privacy.ts purge/export router skeleton
- [x] Add packages/api/src/routers/jwks.ts JWKS router skeleton
- [x] Add packages/api/src/routers/token.ts token exchange router skeleton
- [x] Add packages/api/src/metrics.ts prom-client registry skeleton and metric declarations
- [x] Add packages/agent/src/v6.ts AI SDK tool registry helpers
- [x] Add packages/agent/assistant/src/tool/* skeletons for note, remind, timer, book, focus, web, handoff, home
- [x] Add packages/agent/orchestrator/src/tool/* skeletons for droid, git, router, ticket, web
- [x] Add packages/auth/src/auth.ts Better Auth instance scaffold (drizzle adapter + passkey) with placeholders
- [x] Add packages/auth/src/token.ts Ed25519 issuance/verification and claims skeleton
- [x] Add packages/auth/src/jwks.ts JWKS generator skeleton
- [x] Add packages/auth/src/key.ts key load skeleton and env contracts
- [x] Add packages/policy/src/pdp.ts PDP evaluate() signatures and types
- [x] Add packages/policy/src/rule.ts rule types and matcher signatures
- [x] Add packages/policy/src/load.ts YAML loader signatures
- [x] Add packages/policy/src/decide.ts evaluation composition skeleton
- [x] Add packages/db/src/client.ts drizzle client bootstrap skeleton
- [x] Add packages/db/src/schema/* skeletons (user, rag, graph, assistant)
- [x] Add packages/db/test harness skeleton
- [x] Add packages/ui/src/chat/chat.tsx shared chat component skeleton

## Phase 2 — Test Scaffolding

- [x] Create Vitest config for packages and app
- [x] Add unit test placeholders for assistant/orchestrator routers
- [x] Add integration test scaffolds for web API routes
- [x] Add policy evaluation tests
- [x] Add DB repo tests for core CRUD flows

## Phase 3 — Implementation Slices

- [ ] Implement AI SDK v6 assistant/orchestrator streaming in API routers
- [ ] Implement workflow runner atop AI SDK tool loops
- [ ] Implement deploy, git, docker tooling
- [ ] Implement linear OAuth + webhook resume flow
- [ ] Implement voice/STT/TTS integration
- [ ] Implement preference/profile/privacy flows end-to-end
- [ ] Implement home automation tool wiring
- [ ] Harden policy enforcement + audit logging
- [ ] Harden auth flows (passkey + token issuance)
- [ ] Implement reminder/timer/bookmark CRUD logic

## Phase 4 — Hardening & Observability

- [ ] Wire Prometheus metrics to production dashboards
- [ ] Add OTEL tracing for AI SDK streaming handlers
- [ ] Add structured logging around tool execution
- [ ] Add workflow run registry persistence (Redis backend)
- [ ] Add evaluation harness (AI SDK v6 native)

## Phase 5 — Deployment & Operations

- [ ] Provision Proxmox VMs and containers for web/API/db/redis
- [ ] Configure CI/CD (GitHub Actions) for lint/test/build/deploy
- [ ] Configure secret management (1Password / Vault)
- [ ] Document backup/restore procedures for Postgres + Redis
- [ ] Document incident response playbooks
