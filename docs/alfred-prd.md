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

### Phase 3 — Runtime Integration Layer 🔥 (CRITICAL - IN PROGRESS)

**Goal**: Create the composition layer that makes all packages work together as a cohesive intelligence system.

#### 3.1 Create Runtime Package (Week 1-2)

- [ ] Create `packages/runtime/` package structure
- [ ] Implement `CoreRuntime` class that composes cognitive/knowledge/learning/policy
- [ ] Implement `buildExecutionContext()` to gather multi-domain context
- [ ] Create context builders for each domain (Proxmox, Git, Development, etc.)
- [ ] Add runtime metrics and instrumentation
- [ ] Write comprehensive unit tests for runtime composition

**Deliverable**: A working composition layer that can be imported and used by API routers.

#### 3.2 Implement Real AI SDK v6 Streaming (Week 2-3)

- [ ] Implement `WorkflowRuntime` extending `CoreRuntime`
- [ ] Replace placeholder runner with real `streamText` integration
- [ ] Wire tool registry (`buildTools()`) to AI SDK streaming
- [ ] Implement event normalization (AI SDK events → WorkflowEvents)
- [ ] Add real-time knowledge graph updates during execution
- [ ] Add cognitive state transitions during workflow phases
- [ ] Test end-to-end tool execution with real AI models

**Deliverable**: Workflows that actually execute tools via AI SDK v6 and integrate with all domain packages.

#### 3.3 Close the Learning Loop (Week 3-4)

- [ ] Implement outcome recording to learning system
- [ ] Add pattern extraction from successful workflows
- [ ] Create feedback collection mechanism
- [ ] Build mistake analysis and correction suggestions
- [ ] Integrate learnings into future context building
- [ ] Add learning-based tool selection optimization

**Deliverable**: System that improves over time based on past outcomes.

#### 3.4 Domain-Specific Runtimes (Week 4-5)

- [ ] Create `packages/runtime/src/domains/` directory
- [ ] Implement `ProxmoxRuntime` with infrastructure-specific context
- [ ] Implement `DevelopmentRuntime` for Git/Docker workflows
- [ ] Implement `ProductivityRuntime` for notes/tasks/reminders
- [ ] Add domain-specific pattern recognition
- [ ] Wire domain runtimes to appropriate routers

**Deliverable**: Specialized execution contexts for each major domain.

#### 3.5 Restructure Agent Package (Week 5-6)

- [ ] Rename `agent/orchestrator/tool/` → `agent/src/tools/orchestrator/`
- [ ] Move `agent/assistant/src/tool/` → `agent/src/tools/assistant/`
- [ ] Extract orchestration logic to runtime package
- [ ] Update all import paths across codebase
- [ ] Update package documentation
- [ ] Run full test suite to verify no regressions

**Deliverable**: Clear package boundaries with orchestration separated from tool definitions.

### Phase 4 — Personalization & Memory Enhancement (Week 6-8)

#### 4.1 RAG System Implementation

- [ ] Implement `ingest()` function in `packages/rag/src/doc.ts`
- [ ] Implement `retrieve()` with semantic search
- [ ] Implement `embed()` with caching
- [ ] Wire RAG to knowledge graph for hybrid search
- [ ] Add automatic RAG embedding on note save
- [ ] Integrate RAG into runtime context building

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

#### 5.1 Linear Integration Completion

- [ ] Implement Linear Agent Activities emission (thought, action, response, error)
- [ ] Add 10-second acknowledgment requirement
- [ ] Implement session initialization (delegate, state, external URL)
- [ ] Complete webhook handler for bidirectional sync
- [ ] Add workflow cancellation on issue completion
- [ ] Add Linear context to domain-specific runtimes

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

#### 6.1 Chat Interface

- [ ] Complete chat component with agent switcher (Assistant/Orchestrator)
- [ ] Implement streaming message rendering
- [ ] Add cache handoff visualization
- [ ] Implement message history with infinite scroll
- [ ] Add message editing and regeneration
- [ ] Wire to both assistant and orchestrator routers

#### 6.2 Management Panes

- [ ] Complete Notes pane with CRUD operations
- [ ] Complete Reminders pane with live updates
- [ ] Complete Timers pane with controls
- [ ] Complete Bookmarks pane with organization
- [ ] Add pane state persistence

#### 6.3 Settings & Configuration

- [ ] Profile management page
- [ ] Preferences page (remember/correct)
- [ ] Privacy controls page (forget/export)
- [ ] Autonomy level controls with visualizations
- [ ] Linear connection management UI
- [ ] Tool authorization management

#### 6.4 Workflow Monitoring

- [ ] Workflow run viewer with real-time streaming
- [ ] Workflow history with filtering
- [ ] Tool execution visualization
- [ ] Performance metrics dashboard
- [ ] Error analysis and debugging UI

### Phase 7 — Voice & Mobile (Week 15-16)

#### 7.1 Speech-to-Speech Interface

- [ ] Implement STT with Faster-Whisper (local) or OpenAI Whisper API
- [ ] Implement TTS with Piper TTS (local) or OpenAI TTS
- [ ] Add voice activity detection (VAD)
- [ ] Implement streaming audio playback
- [ ] Add voice session management
- [ ] Wire voice to assistant router

#### 7.2 Mobile-Optimized UI

- [ ] Complete React Native app setup
- [ ] Implement mobile chat interface
- [ ] Add drive mode with large controls
- [ ] Implement voice-first interaction flow
- [ ] Add offline queue for requests
- [ ] Implement mobile notifications for reminders

### Phase 8 — Hardening & Observability (Week 17-18)

- [ ] Wire Prometheus metrics to production dashboards
- [ ] Add OpenTelemetry tracing for AI SDK streaming
- [ ] Add structured logging around tool execution
- [ ] Complete workflow run registry with Redis persistence
- [ ] Implement evaluation harness with AI SDK v6
- [ ] Add performance budgets and enforcement
- [ ] Create comprehensive integration test suite
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
- ✅ All domain packages (cognitive, knowledge, learning) actively used in workflows
- ✅ Context building includes preferences, memories, and learnings
- ✅ Outcomes recorded and patterns extracted automatically

### Learning Effectiveness
- ✅ Measurable improvement in task success rate over time
- ✅ User preferences automatically inferred and applied
- ✅ Domain-specific patterns recognized and utilized

### User Experience
- ✅ Sub-second response latency for assistant interactions
- ✅ Real-time streaming for workflow execution
- ✅ Seamless suspend/resume for biometric elevation
- ✅ Natural voice interaction with low latency

### Production Readiness
- ✅ 99.9% uptime for core services
- ✅ All critical paths instrumented with metrics
- ✅ Comprehensive error handling and recovery
- ✅ Automated backup and disaster recovery

## Architecture Decision Log

### 2025-01: Runtime Package Creation
**Decision**: Create dedicated `packages/runtime/` for composition layer
**Rationale**: Packages have excellent separation but lack integration. Runtime provides clean composition without violating boundaries.
**Alternatives Considered**: Merge packages (rejected - violates SRP), keep in API layer (rejected - wrong abstraction level)
**Impact**: Enables actual integration while maintaining clean architecture

### 2025-01: Agent Package Restructuring
**Decision**: Separate tools from orchestration logic
**Rationale**: Current `agent/orchestrator/` is misleadingly named - contains tools, not orchestration
**Alternatives Considered**: Leave as-is (rejected - confusing), merge all tools (rejected - loses assistant/orchestrator distinction)
**Impact**: Clearer boundaries, easier to reason about

## Notes

- Phase 1-2 complete (~70-80% of original plan)
- Phase 3 is critical: all other phases depend on runtime integration
- Phases can overlap once runtime foundation is solid
- Focus on proving integration patterns before expanding to all domains
- Single-user context allows aggressive personalization and learning
