# ALFRED PRD

A phased, end-to-end checklist to build ALFRED on the AI SDK v6 runtime with domain-driven packages, tRPC APIs, Drizzle + Postgres + pgvector storage, and Proxmox deployment.

## Architectural Foundation

ALFRED is a **personal AI assistant** designed for deep single-user personalization across multiple domains: project management, software development, infrastructure administration, productivity, and home automation. The architecture prioritizes:

1. **Integration over Isolation**: Packages are well-separated but must compose seamlessly
2. **Learning over Static Behavior**: System improves through continuous feedback loops
3. **Context-Aware Execution**: Every action considers user preferences, past outcomes, and domain knowledge
4. **Safe Autonomy**: Security boundaries with biometric elevation for high-risk operations

## Development Phases

### Phase 1 — Scaffold ✅ (COMPLETE)

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
- [x] Add packages/agent/src/orchestrator/tool/* skeletons for droid, git, router, ticket, web
- [x] Add packages/auth/src/auth.ts Better Auth instance scaffold (drizzle adapter + passkey) with placeholders
- [x] Add packages/auth/src/token.ts Ed25519 issuance/verification and claims skeleton
- [x] Add packages/auth/src/jwks.ts JWKS generator skeleton
- [x] Add packages/auth/src/key.ts key load skeleton and env contracts
- [x] Add packages/policy/src/pdp.ts PDP evaluate() signatures and types
- [x] Add packages/policy/src/rule.ts rule types and matcher signatures
- [x] Add packages/policy/src/load.ts YAML loader signatures
- [x] Add packages/policy/src/decide.ts evaluation composition skeleton
- [x] Add packages/db/src/client.ts drizzle client bootstrap skeleton
- [x] Add packages/db/src/schema/* skeletons (user, rag, graph, assistant, workflow, deploy, eval)
- [x] Add packages/db/test harness skeleton
- [x] Add packages/ui/src/chat/chat.tsx shared chat component skeleton

### Phase 2 — Test Scaffolding ✅ (COMPLETE)

- [x] Create Vitest config for packages and app
- [x] Add unit test placeholders for assistant/orchestrator routers
- [x] Add integration test scaffolds for web API routes
- [x] Add policy evaluation tests
- [x] Add DB repo tests for core CRUD flows

### Phase 3 — Runtime Integration Layer ✅ (PHASES 3.1-3.5 COMPLETE)

**Goal**: Create the composition layer that makes all packages work together as a cohesive intelligence system.

**Status**: Runtime package complete with full observability. Ready for production deployment (Phase 3.6).

#### 3.1 Runtime Core ✅ (COMPLETE - 2025-11-17)

- [x] Create `packages/runtime/` package structure
- [x] Implement `WorkflowRuntime` class with AsyncGenerator interface
- [x] Implement phase orchestration (scan, plan, act, report)
- [x] Add cancellation support via AbortController
- [x] Add resume support via promise queue
- [x] Write comprehensive unit tests (42 tests passing)

**Deliverable**: Pure execution engine with dependency injection and testability.

#### 3.2 Domain Package Integration ✅ (COMPLETE - 2025-11-17)

- [x] Create engine wrappers (CognitiveEngine, KnowledgeEngine, LearningEngine, PolicyEngine)
- [x] Create AISDKAdapter for event mapping (AI SDK v6 compliant)
- [x] Create StorageAdapter for database operations
- [x] Implement ContextBuilder with caching (5-minute TTL, LRU eviction)
- [x] Add token budget validation
- [x] Write integration tests for adapters and engines

**Deliverable**: Clean domain integration without circular dependencies.

#### 3.3 Router Integration ✅ (COMPLETE - 2025-11-17)

- [x] Replace runPlanV6 with WorkflowRuntime in workflow router
- [x] Add feature flag infrastructure (USE_WORKFLOW_RUNTIME)
- [x] Update stream endpoint to consume runtime generator
- [x] Verify resume endpoint compatibility
- [x] Add dual-path integration tests (27 tests)
- [x] Mark runPlanV6 deprecated with migration guide

**Deliverable**: Production-ready feature flag deployment with zero breaking changes.

#### 3.4 Performance Optimization ✅ (COMPLETE - 2025-11-17)

- [x] Add 12 Prometheus metrics (execution, phases, context, AI SDK, knowledge)
- [x] Instrument context builder (duration, cache hits, token counts)
- [x] Instrument phase execution (per-phase duration and status)
- [x] Instrument AI SDK adapter (model-specific call tracking)
- [x] Add batch operations for knowledge persistence (100-item chunks)
- [x] Write performance tests validating budgets (<50ms cached, <5s uncached)

**Deliverable**: Full metric coverage with validated performance budgets.

#### 3.5 Observability & Monitoring ✅ (COMPLETE - 2025-11-17)

- [x] Add structured logging across all runtime components
- [x] Create distributed tracing support (nanosecond precision)
- [x] Write observability tests (12 tests validating metric emission)
- [x] Create Grafana dashboard documentation with PromQL queries
- [x] Add alert rules (critical and warning thresholds)
- [x] Document troubleshooting runbook

**Deliverable**: Production-ready observability with dashboards and alerts.

#### 3.6 Migration & Cleanup 🚀 (READY - SIMPLE CUTOVER)

- [ ] Enable runtime locally (set `USE_WORKFLOW_RUNTIME=true`)
- [ ] Test a few workflows to verify functionality
- [ ] Check Grafana dashboards show metrics
- [ ] Remove feature flag from code (make runtime the default)
- [ ] Delete runPlanV6 function
- [ ] Delete runner.ts file
- [ ] Update imports across codebase

**Deliverable**: Clean migration with deprecated code removed.

**Note**: Single-user system - no staged rollout needed. Just enable, test, and clean up.

### Phase 4 — Personalization & Memory Enhancement (Week 6-8)

#### 4.1 RAG System Implementation ✅ (CORE FUNCTIONS COMPLETE)

- [x] Implement `ingest()` function in `packages/rag/src/doc.ts`
- [x] Implement `retrieve()` with semantic search
- [x] Implement `embed()` with caching
- [ ] Wire RAG to knowledge graph for hybrid search (hybrid search exists in `packages/db/src/repo/rag.ts`)
- [ ] Add automatic RAG embedding on note save
- [ ] Integrate RAG into runtime context building (⚠️ runtime ready, needs integration)

#### 4.2 Preference-Driven Adaptation

- [ ] Create preference inference from past interactions
- [ ] Implement response style adaptation (verbosity, tone)
- [ ] Add domain-specific preference learning (Proxmox configs, Git workflows)
- [ ] Wire preferences into AI SDK system prompts
- [ ] Add preference update API based on feedback

#### 4.3 Complete Personal Assistant Tools

- [ ] Implement `focus.ts` tool with drive mode integration
- [ ] Implement `web.ts` tool for research (capped, read-only)
- [ ] Implement `home.ts` tool for Home Assistant integration
- [ ] Wire focus mode to response templates and policy
- [ ] Add tool usage tracking to learning system

### Phase 5 — Workflow Capabilities (Week 9-11)

#### 5.1 Linear Integration Completion ✅ (COMPLETE)

- [x] Implement Linear Agent Activities emission (thought, action, response, error)
- [x] Add 10-second acknowledgment requirement
- [x] Implement session initialization (delegate, state, external URL)
- [x] Complete webhook handler for bidirectional sync
- [x] Add workflow cancellation on issue completion
- [ ] Add Linear context to domain-specific runtimes (⚠️ runtime ready, needs integration)

**Status**: Fully implemented in `packages/agent/src/orchestrator/linear.ts`, integrated with runtime via `packages/api/src/routers/workflow.ts`. Ready for manual end-to-end validation.

#### 5.2 Suspend/Resume for Biometric Obligations

- [ ] Implement workflow suspension on PDP `requireBio` obligation
- [ ] Create resume endpoint in workflow router
- [ ] Add biometric challenge UI flow
- [ ] Implement workflow state persistence for suspension
- [ ] Add resume with elevated token verification
- [ ] Test end-to-end suspend/resume flow

#### 5.3 Tool Chaining & Dependencies

- [ ] Implement tool output passing to subsequent tools
- [ ] Add tool dependency resolution
- [ ] Create tool execution parallelization for independent tools
- [ ] Add tool fallback and retry logic
- [ ] Implement tool result validation

### Phase 6 — User Interface (Week 12-14)

#### 6.1 Chat Interface ✅ (COMPLETE)

- [x] Complete chat component with agent switcher (Assistant/Orchestrator)
- [x] Implement streaming message rendering
- [x] Add cache handoff visualization
- [ ] Implement message history with infinite scroll
- [ ] Add message editing and regeneration
- [x] Wire to both assistant and orchestrator routers

#### 6.2 Management Panes ✅ (PARTIALLY COMPLETE)

- [x] Complete Notes pane with CRUD operations (`apps/web/src/routes/note.tsx`)
- [x] Complete Reminders pane with live updates (`apps/web/src/routes/remind.tsx`)
- [ ] Complete Timers pane with controls
- [ ] Complete Bookmarks pane with organization
- [ ] Add pane state persistence

#### 6.3 Settings & Configuration ✅ (PARTIALLY COMPLETE)

- [x] Profile management page (`apps/web/src/routes/profile.tsx`)
- [x] Preferences page (remember/correct) (`apps/web/src/routes/preferences.tsx`)
- [x] Privacy controls page (forget/export) (`apps/web/src/routes/privacy.tsx`)
- [ ] Autonomy level controls with visualizations
- [ ] Linear connection management UI
- [ ] Tool authorization management

#### 6.4 Workflow Monitoring ✅ (PARTIALLY COMPLETE)

- [x] Workflow run viewer with real-time streaming (`apps/web/src/routes/orchestrator/run.tsx`)
- [ ] Workflow history with filtering
- [ ] Tool execution visualization
- [ ] Performance metrics dashboard
- [ ] Error analysis and debugging UI

### Phase 7 — Voice & Mobile (Week 15-16)

#### 7.1 Speech-to-Speech Interface ✅ (INFRASTRUCTURE COMPLETE)

- [x] Implement STT with Faster-Whisper (local) or OpenAI Whisper API (`packages/voice/src/process/stt_pool.ts`)
- [x] Implement TTS with Piper TTS (local) or OpenAI TTS (`packages/voice/src/process/tts_pool.ts`)
- [ ] Add voice activity detection (VAD)
- [ ] Implement streaming audio playback
- [ ] Add voice session management
- [ ] Wire voice to assistant router

#### 7.2 Mobile-Optimized UI ✅ (PARTIALLY COMPLETE)

- [x] Complete React Native app setup (`apps/native/`)
- [ ] Implement mobile chat interface
- [ ] Add drive mode with large controls
- [ ] Implement voice-first interaction flow
- [ ] Add offline queue for requests
- [ ] Implement mobile notifications for reminders

### Phase 8 — Hardening & Observability ✅ (SUBSTANTIALLY COMPLETE)

- [x] Wire Prometheus metrics to production dashboards (`packages/api/src/metrics.ts`, `packages/runtime/src/metrics.ts`)
- [x] Add distributed tracing for runtime execution (`packages/runtime/src/tracing.ts`)
- [x] Add structured logging around tool execution (`@alfred/api/utils/logger`)
- [x] Complete workflow run registry with Redis persistence (`packages/api/src/run-registry.ts`)
- [ ] Implement evaluation harness with AI SDK v6
- [x] Add performance budgets and enforcement (validated via tests)
- [x] Create comprehensive integration test suite (`packages/api/test/`, `packages/runtime/test/`)
- [ ] Add load testing for concurrent workflows

### Phase 9 — Deployment & Operations (Week 19-20)

- [ ] Provision Proxmox VMs and containers for web/API/db/redis
- [ ] Configure CI/CD (GitHub Actions) for lint/test/build/deploy
- [ ] Configure secret management (1Password / Vault)
- [ ] Document backup/restore procedures for Postgres + Redis
- [ ] Document incident response playbooks
- [ ] Set up monitoring alerts and runbooks
- [ ] Create disaster recovery procedures

## Critical Success Metrics

### Integration Quality
- ✅ Runtime package created with domain engine wrappers
- ✅ Context building infrastructure complete (caching, token validation)
- ✅ Outcomes recorded via LearningEngine (pattern extraction ready for integration)
- ⚠️ Active integration pending production deployment (Phase 3.6)

### Learning Effectiveness
- ✅ Learning engine ready for outcome recording and batch persistence
- ⚠️ Measurable improvement tracking (pending production data)
- ⚠️ User preferences automatically inferred and applied (blocked by Phase 4.2)
- ⚠️ Domain-specific patterns recognized and utilized (infrastructure ready)

### User Experience
- ✅ Runtime execution with phase-based progress tracking
- ✅ Real-time streaming for workflow execution
- ✅ Performance budgets validated (<50ms cached context, <5s uncached)
- ⚠️ Seamless suspend/resume for biometric elevation (blocked by Phase 5.2)
- ⚠️ Natural voice interaction with low latency (blocked by Phase 7.1 completion)

### Production Readiness
- ✅ All critical paths instrumented with 12 Prometheus metrics
- ✅ Distributed tracing support for debugging
- ✅ Grafana dashboards ready for deployment
- ✅ Comprehensive error handling and recovery
- ✅ Performance budgets enforced and tested
- ⚠️ 99.9% uptime for core services (blocked by Phase 9)
- ⚠️ Automated backup and disaster recovery (blocked by Phase 9)

## Architecture Decision Log

### 2025-11: Runtime Package Implementation
**Decision**: Create dedicated `packages/runtime/` as leaf package with dependency injection
**Rationale**: Avoids circular dependencies, enables testability via mocked dependencies, keeps domain packages pure
**Implementation**: AsyncGenerator interface for streaming, engine wrappers for domain integration, feature flag for safe migration
**Impact**: Complete runtime integration delivered in 3 weeks with zero breaking changes. Ready for production deployment.
**Status**: ✅ Complete (Phases 3.1-3.5)

### 2025-11: Hybrid State Management
**Decision**: Memory state for execution, database state for durability
**Rationale**: Memory state is fast, database enables replay/debugging. No complex rehydration needed since resume is in-flight only.
**Impact**: Simplified state management with clear persistence boundaries
**Status**: ✅ Implemented

### 2025-11: Performance Budgets & Observability
**Decision**: Instrument all runtime operations with Prometheus metrics, structured logging, and distributed tracing
**Rationale**: Production readiness requires comprehensive observability. Metrics for alerting, logs for debugging, traces for understanding flow.
**Implementation**: 12 Prometheus metrics, nanosecond-precision tracing, Grafana dashboard configuration
**Impact**: Complete visibility into runtime performance with validated budgets
**Status**: ✅ Complete (Phase 3.4-3.5)

### 2025-01: Agent Package Restructuring
**Decision**: Separate tools from orchestration logic
**Rationale**: Current `agent/orchestrator/` is misleadingly named - contains tools, not orchestration
**Alternatives Considered**: Leave as-is (rejected - confusing), merge all tools (rejected - loses assistant/orchestrator distinction)
**Impact**: Clearer boundaries, easier to reason about

### 2025-11: Linear Integration Implementation
**Decision**: Implement Linear Agent Activities with helper layer pattern
**Rationale**: Reuse existing `toolTicket` implementation, avoid cross-package dependencies via metrics adapter (`packages/agent/src/orchestrator/linearmetrics.ts`)
**Impact**: Complete Linear integration without violating package boundaries. Ready for production use.

## Notes

- Phase 1-2 complete (100%)
- **Phase 3.1-3.5 complete (100%)** - Runtime integration layer ready for production deployment
  - Runtime package created with 65+ passing tests
  - Full observability with 12 Prometheus metrics, tracing, and Grafana dashboards
  - Performance budgets validated (<50ms cached context, <5s uncached, <1s batch writes)
  - Feature flag infrastructure enables safe migration (Phase 3.6)
  - Zero breaking changes to event schema or router interface
- Phase 4.1 (RAG) complete - core functions implemented (`ingest`, `retrieve`, `embed`)
- Phase 5.1 (Linear) complete - fully implemented and integrated with runtime
- Phase 6.1 (Chat) complete - streaming UI functional
- Phase 6.2-6.4 partially complete - basic panes and settings exist
- Phase 7.1 partially complete - STT/TTS infrastructure exists
- **Phase 8 substantially complete** - metrics, logging, tracing, and performance budgets all implemented
- Phase 9 not started - deployment infrastructure needed
- **Next Priority: Phase 3.6** - Enable runtime locally, validate, and remove deprecated code
- Single-user context allows aggressive personalization and learning
- Documentation: See `docs/guides/runtime-migration-phase-3-6.md` for deployment plan
- Documentation: See `docs/observability/runtime-dashboard.md` for Grafana setup
- Documentation: See `docs/execplans/runtime-integration.md` for technical details
