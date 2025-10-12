# ALFRED PRD

A phased, end-to-end checklist to build ALFRED (Mastra-first runtime, domain-driven layout, tRPC API, Drizzle+Postgres+pgvector, Proxmox deployment, observability, policy-based security).

Notes
- Phase 1: Scaffold everything (files/modules with TODOs, function signatures, wiring only; no logic).
- Phase 2: Scaffold all tests (Vitest); define expected behavior and flow (no real IO).
- Phase 3+: Implement logic in coherent slices per domain; integrate and harden.

## Phase 1 — Scaffold (files, folders, signatures, wiring only; no logic)

- [ ] Init monorepo with Turborepo, bun, workspace packages, root scripts, and lint/format configs
- [x] Add tsconfig.base.json with path aliases for @alfred/* (api, assistant, orchestrator, auth, policy, db, rag, ui, type)
- [ ] Add turbo.json with build/dev/test/migrate/publish pipeline tasks
- [x] Add docker/postgres/docker-compose.yml for Postgres+pgvector container
- [ ] Add docker/monitoring/docker-compose.yml placeholders (prometheus, grafana, loki, promtail, alertmanager, cadvisor, blackbox)
- [ ] Scaffold apps/web TanStack Start project and base routes
- [ ] Add apps/web/src/routes/api/trpc/$.ts tRPC fetchRequestHandler skeleton
- [ ] Add apps/web/src/routes/api/auth/$.ts Better Auth handler skeleton
- [ ] Add apps/web/src/routes/api/linear/webhook.ts Linear webhook handler skeleton
- [x] Add apps/web/src/routes/api/metrics.ts Prometheus metrics endpoint skeleton
- [ ] Add apps/web/src/routes/healthz.ts liveness/health endpoint skeleton
- [ ] Add packages/api/src/t.ts initTRPC factory skeleton
- [x] Add packages/api/src/ctx.ts createContext (session + RuntimeContext) skeleton
- [x] Add packages/api/src/root.ts appRouter registry skeleton
- [ ] Add packages/api/src/gate.ts policy PEP middleware skeleton
- [ ] Add packages/api/src/rpc/assistant.ts assistant router (generate/stream/escalate) skeleton
- [ ] Add packages/api/src/rpc/orchestrator.ts orchestrator router (generate/stream) skeleton
- [ ] Add packages/api/src/rpc/flow.ts workflow start/stream/resume router skeleton
- [x] Add packages/api/src/rpc/note.ts notes router CRUD skeleton
- [x] Add packages/api/src/rpc/remind.ts reminders router (create/list) skeleton
- [x] Add packages/api/src/rpc/timer.ts timers router (start/cancel/list) skeleton
- [x] Add packages/api/src/rpc/book.ts bookmarks router (add/list/remove) skeleton
- [ ] Add packages/api/src/rpc/slack.ts Slack OAuth and inbox read router skeleton
- [ ] Add packages/api/src/rpc/home.ts Home control router skeleton
- [ ] Add packages/api/src/rpc/deploy.ts deploy router (preview/promote/remove) skeleton
- [ ] Add packages/api/src/rpc/linear.ts Linear OAuth actor=app router skeleton
- [ ] Add packages/api/src/rpc/voice.ts STT/TTS router skeleton
- [ ] Add packages/api/src/rpc/profile.ts profile get/update router skeleton
- [ ] Add packages/api/src/rpc/preference.ts preference set/list router skeleton
- [ ] Add packages/api/src/rpc/privacy.ts purge/export router skeleton
- [ ] Add packages/api/src/rpc/jwks.ts JWKS router skeleton
- [ ] Add packages/api/src/rpc/token.ts token exchange router skeleton
- [x] Add packages/api/src/metrics.ts prom-client registry skeleton and metric declarations
- [ ] Add packages/agent/index.ts compose Mastra instance from Assistant and Orchestrator (skeleton)
- [ ] Add packages/agent/assistant/src/agent.ts class Assistant with system prompt, model, memory, and tool registry (no logic)
- [ ] Add packages/agent/assistant/src/tool/note.ts Note tool signatures (no logic)
- [ ] Add packages/agent/assistant/src/tool/remind.ts Remind tool signatures (no logic)
- [ ] Add packages/agent/assistant/src/tool/timer.ts Timer tool signatures (no logic)
- [ ] Add packages/agent/assistant/src/tool/book.ts Book tool signatures (no logic)
- [ ] Add packages/agent/assistant/src/tool/slack.ts Slack inbox read tool signatures (no logic)
- [ ] Add packages/agent/assistant/src/tool/home.ts Home control/read tool signatures (no logic)
- [ ] Add packages/agent/assistant/src/tool/focus.ts Focus tool signatures (no logic)
- [ ] Add packages/agent/assistant/src/tool/web.ts Web fetch tool signatures (no logic)
- [ ] Add packages/agent/assistant/src/tool/handoff.ts Handoff tool signatures (no logic)
- [ ] Add packages/agent/assistant/src/mem/store.ts Assistant memory store config skeleton
- [ ] Add packages/agent/assistant/src/mem/preference.ts Preference extractor processor skeleton
- [ ] Add packages/agent/assistant/src/mem/sum.ts Tool event summarizer processor skeleton
- [ ] Add packages/agent/assistant/src/flow/digest.ts Learn/distill workflow skeleton with steps
- [ ] Add packages/agent/orchestrator/src/agent.ts class Orchestrator with system prompt, model, memory, and tool registry (no logic)
- [ ] Add packages/agent/orchestrator/src/tool/droid.ts Droid exec tool skeleton with streaming contract
- [ ] Add packages/agent/orchestrator/src/tool/git.ts Git tool skeleton for branch/worktree/commit/push
- [ ] Add packages/agent/orchestrator/src/tool/proxmox.ts Proxmox LXC tool lifecycle skeleton
- [ ] Add packages/agent/orchestrator/src/tool/router.ts Reverse proxy route tool skeleton
- [ ] Add packages/agent/orchestrator/src/tool/ticket.ts Ticket tool (Linear) skeleton
- [ ] Add packages/agent/orchestrator/src/tool/web.ts Orchestrator web fetch tool skeleton
- [ ] Add packages/agent/orchestrator/src/flow/plan.ts Orchestrator plan workflow skeleton with steps and stream events
- [ ] Add packages/auth/src/auth.ts Better Auth instance scaffold (drizzle adapter + passkey) with placeholders
- [ ] Add packages/auth/src/token.ts Ed25519 issuance/verification and claims skeleton
- [ ] Add packages/auth/src/jwks.ts JWKS generator skeleton
- [ ] Add packages/auth/src/key.ts key load skeleton and env contracts
- [ ] Add packages/policy/src/pdp.ts PDP evaluate() signatures and types
- [ ] Add packages/policy/src/rule.ts rule types and matcher signatures
- [ ] Add packages/policy/src/load.ts YAML loader signatures
- [ ] Add packages/policy/src/decide.ts evaluation composition skeleton
- [ ] Add packages/db/src/client.ts drizzle client bootstrap skeleton
- [ ] Add packages/db/src/schema/user.ts user_profiles/preferences/facts/events/autonomy/feedback schema skeleton
- [ ] Add packages/db/src/schema/rag.ts ragDocuments/ragChunks schema skeleton with vector types
- [ ] Add packages/db/src/schema/graph.ts memoryNodes/memoryEdges schema skeleton
- [x] Add packages/db/src/schema/assistant.ts assistant tasks/notes/events/reminders/bookmarks/timers schema skeleton
- [ ] Add packages/db/src/schema/linear.ts linearInstallations schema skeleton
- [ ] Add packages/db/src/schema/deploy.ts deployments schema skeleton
- [ ] Add packages/db/src/schema/policy.ts auditLogs/approvals schema skeleton
- [ ] Add packages/db/src/migrations/0000_extensions.sql pgcrypto and vector extension SQL
- [ ] Add packages/db/src/migrations/0001_init.sql rag and graph base SQL
- [ ] Add packages/db/src/migrations/0002_linear.sql linear installations SQL
- [ ] Add packages/db/src/migrations/0003_assistant.sql assistant core SQL
- [ ] Add packages/db/src/migrations/0004_deployments.sql deployments SQL
- [ ] Add packages/db/src/migrations/0005_personalization.sql personalization tables SQL
- [ ] Add packages/db/src/migrations/0006_policy_audit.sql audit and approvals SQL
- [ ] Add packages/db/src/migrations/0007_assistant_productivity.sql reminders/bookmarks/timers SQL
- [ ] Add packages/db/src/repo/user.ts user repo skeleton (profile/preferences/facts/events/autonomy/feedback)
- [ ] Add packages/db/src/repo/rag.ts rag repo skeleton (insert/query)
- [ ] Add packages/db/src/repo/graph.ts graph repo skeleton (nodes/edges)
- [x] Add packages/db/src/repo/assistant.ts assistant repo skeleton (notes/tasks/reminders/bookmarks/timers)
- [ ] Add packages/db/src/repo/linear.ts linear repo skeleton (install upsert/get)
- [ ] Add packages/db/src/repo/deploy.ts deploy repo skeleton (upsert/get)
- [ ] Add packages/db/src/repo/policy.ts policy repo skeleton (audit/approvals)
- [x] Add packages/db/scripts/migrate.ts ordered migration runner skeleton
- [ ] Add packages/rag/src/doc.ts RAG chunk/embed/store/retrieve signatures
- [ ] Add packages/ui/src/chat/chat.tsx chat shell with agent switcher placeholders
- [ ] Add packages/ui/src/chat/orb.tsx orb animation shell placeholders
- [ ] Add packages/ui/src/pane/note.tsx notes pane shell placeholders
- [ ] Add packages/ui/src/pane/remind.tsx reminders pane shell placeholders
- [ ] Add packages/ui/src/pane/slack.tsx slack inbox pane shell placeholders
- [ ] Add packages/ui/src/pane/home.tsx home pane shell placeholders
- [ ] Add packages/type/src/plan.ts zod schemas for ImplementationPlan/ModulePlan (shape only)
- [ ] Add packages/type/src/msg.ts message type declarations (shape only)
- [ ] Add config/policy.yaml baseline roles/scopes/rules with comments
- [ ] Add config/env.example with required env keys and descriptions
- [ ] Add README.md stubs per package with purpose and wiring notes
- [ ] Add scripts/check-names.ts CI name rule stub (single-word file/class/param) placeholders
- [ ] Wire Mastra to tRPC endpoints with placeholder adapters and runtimeContext propagation comments
- [ ] Wire policy PEP middleware to deploy/proxmox/droid routes with TODO obligations handling
- [ ] Wire Stream-to-Cache handoff event contract in agents/tools/workflows (comments only)
- [x] Wire apps/web .env.local placeholders and dev instructions

## Phase 2 — Test scaffold (Vitest; expected behaviors; no real IO)

- [ ] Add root Vitest config with workspaces and coverage thresholds placeholders
- [ ] Add packages/api/test/trpc.ctx.test.ts expected session/runtimeContext behavior tests (mocks)
- [ ] Add packages/api/test/trpc.routers.shape.test.ts router procedure input/output shape tests
- [ ] Add packages/api/test/gate.policy.test.ts PEP decision/obligation behavior with PDP mocks
- [ ] Add packages/auth/test/token.issue-verify.test.ts token issuance/verification claim tests with fixtures
- [ ] Add packages/auth/test/jwks.expose-verify.test.ts JWKS exposure and jose verification tests
- [ ] Add packages/policy/test/pdp.evaluate.test.ts RBAC/ABAC rule matching and obligations tests
- [ ] Add packages/policy/test/load.parse-validate.test.ts YAML parse/validate error tests
- [ ] Add packages/db/test/migrate.ordering.test.ts migrations apply order and idempotency tests
- [ ] Add packages/db/test/repo.user.test.ts profile/preferences/facts/events/autonomy repo contract tests
- [x] Add packages/db/test/repo.assistant.test.ts notes/reminders/timers/bookmarks repo contract tests
- [ ] Add packages/db/test/repo.linear.test.ts linear installation upsert/get contract tests
- [ ] Add packages/db/test/repo.deploy.test.ts deployments upsert/get contract tests
- [ ] Add packages/db/test/repo.policy.test.ts audit/approvals insert/update contract tests
- [ ] Add packages/rag/test/doc.retrieval-shape.test.ts retrieve shape and vector dim checks with stub embeddings
- [ ] Add packages/agent/assistant/test/agent.shape.test.ts tools exist and signatures valid tests
- [ ] Add packages/agent/assistant/test/tool.contracts.test.ts note/remind/timer/book/slack/home/focus/web/handoff contract tests
- [ ] Add packages/agent/assistant/test/flow.digest.test.ts learn workflow step sequence tests
- [ ] Add packages/agent/orchestrator/test/agent.shape.test.ts tools exist and signatures valid tests
- [ ] Add packages/agent/orchestrator/test/tool.contracts.test.ts droid/git/proxmox/router/ticket/web contract tests
- [ ] Add packages/agent/orchestrator/test/flow.plan.test.ts orchestrator plan workflow step/order tests
- [ ] Add packages/api/test/stream.handoff.test.ts handoff event structure and client setQueryData tests
- [ ] Add packages/api/test/linear.oauth-webhook.shape.test.ts OAuth/webhook payload shape tests
- [ ] Add packages/api/test/voice.routes.shape.test.ts STT/TTS route contract tests
- [ ] Add packages/ui/test/chat.render-shape.test.ts chat shell renders and agent switch stub tests
- [ ] Add packages/ui/test/pane.render-shape.test.ts note/remind/slack/home pane shells mount with mocks
- [ ] Add apps/web/test/routes.handlers.shape.test.ts trpc/auth/metrics/health/webhook route shape tests
- [ ] Add packages/api/test/metrics.registry-shape.test.ts prom-client registry and metric presence tests

## Phase 3 — Core platform logic (auth, db, policy, wiring)

- [ ] Implement Better Auth with drizzle adapter, passkey plugin, and session retrieval in createContext
- [ ] Implement tRPC createContext with session to RuntimeContext propagation and IP/time metadata
- [ ] Implement agent-to-tool JWT sign/verify with Ed25519, claims (roles,mfa,elevated,maxAuto), and JWKS exposure
- [ ] Implement Redis/in-memory token cache and jti replay defense helper
- [ ] Implement PDP evaluate() for RBAC/ABAC with obligations (require_biometric, limit_autonomy, require_manual)
- [ ] Implement audit logging for policy decisions with traceId and async writes
- [ ] Apply PEP to deploy/proxmox/droid routes and enforce obligations in handlers
- [x] Implement ordered migrations runner and apply all core migrations to local DB
- [x] Implement db repo logic for user/rag/graph/assistant/linear/deploy/policy with Drizzle (assistant done; others pending)
- [x] Implement /metrics registry wiring and default Node metrics collection
- [ ] Implement /healthz and optional /healthz/deps checks for DB/Redis connectivity

## Phase 4 — Orchestrator + Droids (core SWE execution)

- [ ] Implement droid exec tool spawn with flags, stdout/stderr streaming, timeout, and abort handling
- [ ] Implement git tool for branch/worktree/commit/push with safe cwd scoping
- [ ] Implement router tool for Caddy/Traefik API calls (register/update/remove)
- [ ] Implement ticket tool using Linear client with JWT scope checks
- [ ] Implement orchestrator workflow plan→expand→schedule (parallel/sequential)→execute→review/merge→docs→finalize
- [ ] Implement worktree cleanup on finalize or abort and safe rollback paths
- [ ] Implement streaming events and cache handoff for run/module summaries

## Phase 5 — Personal Assistant (daily workflows)

- [ ] Implement note tool CRUD and optional RAG embed on save
- [ ] Implement remind tool create/list with scheduler hooks
- [ ] Implement timer tool start/cancel with alerts
- [ ] Implement book tool add/list/remove with tags
- [ ] Implement slack tool for inbox read with OAuth install flow
- [ ] Implement home tool read/control with entity allowlist and PDP obligations for sensitive entities
- [ ] Implement focus tool to set drive/focus mode and memory hints
- [ ] Implement handoff tool to escalate requirements to orchestrator with optional elevated token

## Phase 6 — Schedulers and notifications

- [x] Implement in-process scheduler loop for due reminders and misfire catch-up
- [ ] Implement notifications subscription and in-app reminder alerts
- [ ] Implement optional Slack DM notification channel for fired reminders

## Phase 7 — Integrations (Linear, Slack, Home)

- [ ] Implement Linear OAuth actor=app exchange and state validation storing organization id
- [ ] Implement Linear webhook signature verification with raw body buffer
- [ ] Implement Linear Agent Activities for thought/action/response/error during runs
- [ ] Implement Slack OAuth install and token storage with inbox read APIs
- [ ] Implement Home Assistant read/control via token and base URL with safe payloads

## Phase 8 — RAG and memory

- [ ] Implement RAG ingest with recursive chunker and OpenAI embeddings using cosine index
- [ ] Implement RAG retrieve with topK and score normalization
- [ ] Implement memory processors (preference extractor and tool summarizer) and wire to Assistant memory
- [ ] Implement learn/distill workflows to consolidate preferences and profile JSON

## Phase 9 — Policy hardening and elevation flow

- [ ] Implement biometric elevation endpoint to issue short-lived elevated token after passkey verification
- [ ] Implement workflow suspend/resume logic when PDP returns require_biometric obligation
- [ ] Implement requireToolScopesAndPolicy helper in tools and enforce obligations strictly
- [ ] Finalize policy.yaml roles, scopes, and ABAC rules for deploy/proxmox/droid/home/slack

## Phase 10 — Proxmox + App provisioning

- [ ] Implement Proxmox LXC tool (create/start/stop/destroy/snapshot/rollback) with API token
- [ ] Implement Docker tool (build/run/stop/rm) for app containers with safe spawn and timeouts
- [ ] Implement Router tool for dynamic subdomain routing via Caddy/Traefik
- [ ] Implement deploy router flows (create preview, promote, remove) and DB tracking
- [ ] Implement health checks and rollback when promote fails

## Phase 11 — Observability and monitoring

- [ ] Wire OTEL to Laminar for AI tracing with SensitiveDataFilter and serviceName tags
- [ ] Tag traces with experimentId/variant and agent/tool/auto/exit_code metadata
- [ ] Implement Prometheus counters/histograms for tRPC, workflows, droids, webhooks, scheduler
- [ ] Deploy monitoring stack (prometheus, grafana, loki, alertmanager, promtail, cadvisor, blackbox) on alfred-core VM
- [ ] Add dashboards for Node, Postgres, Redis, Docker, Reverse Proxy, App, and PVE
- [ ] Add alert rules for CPU/mem/disk, 5xx errors, droid failure rate, and backup recency

## Phase 12 — Voice and drive mode

- [ ] Implement STT via Faster-Whisper wrapper with shape normalization
- [ ] Implement TTS via Piper/Coqui with base64/url streaming responses
- [ ] Add drive mode UI (large controls, short responses, voice-first flow)
- [ ] Add policy to auto-enable short responses when drive/focus mode is active

## Phase 13 — UI wiring and UX polish

- [ ] Implement chat stream rendering with agent switcher (Assistant/Orchestrator) and cache handoff
- [ ] Implement panes for Notes, Reminders, Slack, and Home with CRUD and live updates
- [ ] Implement "Send to Orchestrator" CTA and run viewer with progress stream
- [ ] Implement settings pages for Profile, Preferences, Privacy, and Autonomy sliders
- [ ] Implement Linear connection UI and Slack install UI

## Phase 14 — Laminar self-improvement

- [ ] Instrument traces with experimentId/variant for A/B evaluation
- [ ] Implement dataset curation from Laminar SQL queries and export pipelines
- [ ] Implement eval workflow to run variants on datasets and push results to Laminar
- [ ] Implement PR proposal generator for prompt/memory/tool/policy diffs gated by biometric approval
- [ ] Add dashboards for eval score trends and variant comparison

## Phase 15 — Security and ops

- [ ] Harden env and secret management on alfred-core VM with file permissions and masked logs
- [ ] Add JWKS rotation process and KID rollover steps for agent-to-tool JWT
- [ ] Add backup scripts for pg_dump and vzdump with Pushgateway last_success metrics
- [ ] Add CI lint/name-checks and type checks for all packages
- [ ] Add production build pipeline scripts and PM2/systemd unit templates

## Phase 16 — E2E validation and launch

- [ ] Run full migration on clean DB and smoke test route handlers
- [ ] Validate Personal Assistant workflows and reminders with scheduler firing
- [ ] Validate Orchestrator plan→execute with droid exec read/low and elevation for medium/high
- [ ] Validate Linear webhook run loop and agent activities timeline
- [ ] Validate app deploy preview→promote and dynamic route registration
- [ ] Validate monitoring dashboards and alerting pipelines end-to-end
- [ ] Validate voice interactions and drive mode safety and brevity controls
- [ ] Validate policy obligations and audit logs across high-risk flows
- [ ] Finalize documentation and operational runbooks for deployment and maintenance
