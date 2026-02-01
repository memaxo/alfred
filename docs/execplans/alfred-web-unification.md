# Alfred web unification

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Maintain this document in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

Sir, the goal of this plan is to make **apps/web** the “desktop shell” promised in `README.md`: a single management surface that can (1) run **text chat** and **voice calls**, (2) start/stream/resume/cancel **workflows and multi-agent orchestration**, and (3) provide a windowed “app” for every ALFRED backend domain (knowledge, RAG, reviews, deploy, docker, AgentFS, etc.).

The key outcome is **deep integration**: every backend capability is reachable in two ways:

1. **Human UI** (TanStack Start desktop windows)
2. **Agent tools** (AI SDK v6 tools) so ALFRED can do the same actions from chat/voice, gated by policy.

How you will see it working (end state):

- Run `bun run dev`, open `http://localhost:3000`.
- Start a chat; ask for a concrete action (“deploy preview for branch X”, “summarize recent PRs”, “create a note and link it to the current workflow run”).
- You see streaming responses, explicit tool calls, and a visible run timeline.
- You can switch to voice mode, talk naturally, and get spoken replies.
- You can open domain apps (Workflow, Reviews, Knowledge, RAG, AgentFS, Deploy, Docker, Linear, Settings, Voice, Metrics, Policy) and manage the system without leaving the desktop UI.

## Progress

- [x] (2026-01-25) Drafted master ExecPlan aligning web desktop, tools, orchestration, and voice with README vision.
- [x] (2026-01-27) Milestone 0 (partial): removed major web-layer boundary violation by extracting Linear webhook handler into `packages/api` and making `apps/web` route a thin wrapper.
- [x] (2026-01-27) Milestone 0 (partial): added boundary test enforcing zero `@alfred/db` imports under `apps/web/src/**`.
- [x] (2026-01-27) Milestone 0 (partial): added missing `@alfred/*` workspace deps to `apps/web/package.json` and updated `apps/web/vite.config.ts` SSR externalization (`@alfred/auth`).
- [x] (2026-01-27) Milestone 0: `apps/web` tests pass under Bun after inlining `apps/web/tsconfig.json` (no `extends`) and resolving a Zod v3/v4 mismatch in `@tanstack/router-generator` by switching Vite to Node.
- [x] (2026-01-27) Milestone 0: `bun run typecheck` passes after fixing native Jest test typing issues.
- [x] (2026-01-27) Milestone 0: stabilized repo validators after test churn (fixed `datetime-local` test format, native Jest matcher typing, and minor pipeline/context type errors).
- [x] (2026-01-27) Milestone 1: established capability registry (`@alfred/type` + `@alfred/agent`) exposed via `@alfred/api` and rendered as a new `apps/web` desktop window.
- [x] (2026-01-27) Milestone 0: removed remaining web-layering violations by eliminating `@alfred/agent` imports from non-test `apps/web/src/**` (use `@alfred/type/stream` UIMessage) and adding a boundary test for `@alfred/agent`.
- [x] (2026-01-27) Milestone 0: extracted `/api/assistant`, `/api/orchestrator`, and `/api/genui` handlers into `packages/api` (apps/web routes are now thin wrappers).
- [x] (2026-01-27) Milestone 3 (partial): enabled assistant/orchestrator “transport parity” in web chat (endpoint swaps between `/api/assistant` and `/api/orchestrator`, with a regression test).
- [x] (2026-01-28) Milestone 2: Created intent-based tool routing (`packages/agent/src/routing/`) with small catalogs (≤5 tools each) covering all capabilities.
- [x] (2026-01-28) Milestone 2: Added `uiOnly` markers for admin-only capabilities (settings, policy) and expanded capability registry with full domain coverage.
- [x] (2026-01-28) Milestone 2: Added import-safety tests (`routing-import-safety.test.ts`) and capability parity tests (`capability-parity.test.ts`).
- [x] (2026-01-28) Milestone 3: Added transport parity tests (`transport-parity.test.ts`, `use-chat-logic.transport.test.ts`) verifying endpoint swapping and streaming compatibility.
- [x] (2026-01-28) Milestone 4 (Week 1): Workflow lifecycle endpoints exist; added compilation view, event inspector, run list components, lifecycle tests, and MAX_TRANSITIONS tests. (start/stream/resume/cancel + review/approval + compilation).
- [x] (2026-01-29) Milestone 5 (Phase 2): Comprehensive Reviews app with 3 sections (ReviewQueue, PRReviews, CodeReviews) + Standalone Deploy app with 3 sections (Deployments, Create Preview, Health Monitor) - fully type-safe with full backend integration.
- [ ] **Milestone 6** — Voice End-to-End (mic select, waveform, transcript, TTS playback, same tools).
- [ ] **Milestone 7** — Security/Audit so risky tools are always gated and explainable.
- [ ] **Milestone 8** — CI Hardening: bundle scan, import safety tests, capability parity tests, integration-health.
- [ ] **Milestone 9** — Final Verification: typecheck + tests + build verification + manual smoke flows.

## Surprises & Discoveries

- (2026-01-27) Bun does not reliably resolve TypeScript `paths` when `apps/web/tsconfig.json` uses `extends`; inlining the config + all `paths` mappings fixed `@/…` imports in `apps/web` tests.
- (2026-01-27) The repo uses Zod v4, but `@tanstack/router-generator` depends on Zod v3; Bun module resolution can pick the wrong Zod version at runtime.
- (2026-01-27) Pragmatic fix: run Vite under Node (so nested deps resolve correctly) and patch `@tanstack/router-generator` to detect v3 vs v4 Zod APIs at runtime.

## Decision Log

- Decision: The web app is UI only; it must not bypass the API layer.
  Rationale: The repo’s architecture contract is `DB → repo → API → app`. Even server-side route code under `apps/web/src/routes/**` should call `packages/api` services/routers rather than importing `@alfred/db` directly, to avoid drift and bundling hazards.
  Date/Author: 2026-01-25 / Droid

- Decision: “Expose everything as tools” means **capability parity**, not “give one agent 40+ tools at once”.
  Rationale: AI SDK tool hygiene requires small catalogs per agent; we will implement tool routing (intent classification) and multiple specialized agents with ≤5 tools each, while still ensuring every backend capability is reachable by _some_ tool path.
  Date/Author: 2026-01-25 / Droid

- Decision: Use a single capability registry as the source of truth for: (1) web “Apps” list, (2) tool definitions, (3) risk/policy metadata, (4) docs/tests.
  Rationale: This eliminates drift where a router exists but no tool/UI exists (or vice versa). It also makes “integration-health” meaningful at the product level.
  Date/Author: 2026-01-25 / Droid

- Decision: AI SDK v6 streaming protocol is the only supported chat/voice stream format.
  Rationale: The codebase explicitly forbids bespoke message conversion and ad-hoc streaming. We will converge assistant and orchestrator transports on the same UIMessage stream event model and swap endpoints based on the active backend.
  Date/Author: 2026-01-25 / Droid

- Decision: Provide DOM test environment via Bun preload (single entrypoint) and remove per-test `import "@/test/dom"` lines.
  Rationale: The web test script already preloads `apps/web/src/test/dom.ts`; keeping explicit imports is redundant and currently blocks test execution due to Bun path-alias resolution issues.
  Date/Author: 2026-01-27 / Droid

## Outcomes & Retrospective

- (2026-01-27) Boundary-remediation pattern is working: large `apps/web` route handlers can be moved into `packages/api` (DB-safe, reusable), leaving routes as thin wrappers.
- (2026-01-27) Milestone 0 baseline is now enforceable: `bun --cwd apps/web test` passes and `bun run typecheck` passes.
- (2026-01-27) Follow-up: native Jest tests now have an explicit compat matcher for `toHaveBeenCalledOnce()` and the pipeline signals classifier reads `projectId` from serializable context storage.
- (2026-01-27) Capability registry shipped end-to-end (types → registry → tRPC router → web window) with router + parity tests.
- (2026-01-28) Milestone 2: Intent-based tool routing is functional with 8 small catalogs (≤5 tools each) covering all 14 capabilities. Each catalog targets a specific intent category (personal, voice, code_edit, infrastructure, knowledge, git, workflow).
- (2026-01-28) Milestone 2: Capability registry now distinguishes tool-capable vs uiOnly capabilities. Admin actions (settings, policy) are correctly marked uiOnly.
- (2026-01-28) Milestone 3: Transport parity is tested end-to-end. Both `/api/assistant` and `/api/orchestrator` endpoints produce compatible UIMessage streams, and the web UI can switch between them without message loss.
- (2026-01-28) Milestone 4: Workflow lifecycle (start/stream/resume/cancel) is production-ready. Compilation persistence follows `.ruler/59-work-compilation.md`. New UI components: `CompilationView`, `EventInspector`, `RunList`. Tests added for lifecycle and MAX_TRANSITIONS safeguards.
- (2026-01-29) Milestone 4 Week 2: Workflow window now integrated with CompilationView (shows workflow summary, file changes, agent outcomes), EventInspector (filterable event log with JSON payloads), and RunList (browse all runs with status filtering, resume/cancel controls). View switcher in header allows quick navigation between list/canvas/compilation/events/runs views.
- (2026-01-29) Phase 2 Complete: Reviews app (`apps/web/src/components/apps/reviews/`) provides unified review management with 3 sections: ReviewQueue (AI action approval), PRReviews (GitHub integration), CodeReviews (local diff viewing). Deploy app (`apps/web/src/components/apps/deploy/`) provides standalone deployment management with 3 sections: Deployments (preview/prod management), Create Preview (deployment form), Health Monitor (real-time status). Both apps follow sections pattern per `.ruler/58-desktop-app-organization.md` and are fully type-safe with tRPC integration.

## Context and Orientation

This repository is a Bun + Turborepo monorepo.

ALFRED’s intended layering is:

- **apps/web** (TanStack Start) and **apps/native** (Expo) are “interfaces”.
- **packages/api** is the transport + auth + policy boundary (tRPC routers and HTTP streaming).
- **packages/runtime** is the integration/execution engine (workflows, orchestration, event emission).
- **packages/agent** defines AI SDK v6 tools and orchestrator behavior.
- Domain packages (`packages/knowledge`, `packages/rag`, `packages/learning`, `packages/cognitive`, …) implement core logic.
- Infra packages (`packages/db`, `packages/auth`, `packages/policy`, `packages/metrics`, …) provide persistence, security, and observability.

Key web locations:

- `apps/web/src/routes/api/**` — server routes for auth, tRPC, streaming endpoints.
- `apps/web/src/components/windows/**` — the “desktop shell” window system.
- `apps/web/src/components/apps/**` — per-domain app panels (e.g. RAG, PR review, docker).
- `apps/web/vite.config.ts` — SSR externalization and “server-only” bundling guards.

Key backend locations:

- `packages/api/src/routers/**` — tRPC procedures that web calls.
- `packages/api/src/voice/**` — WebRTC voice session support.
- `packages/runtime/src/**` — workflow runtime, orchestrator, telemetry.
- `packages/agent/src/**` and `packages/agent/assistant/src/tool/**` — tool catalogs.

Definitions (plain language):

- **Workflow**: A single user-requested run with phases (scan/plan/act/report) that streams events and writes a durable record.
- **Orchestrator**: A workflow executor that can spawn multiple agents in “waves” to solve complex tasks.
- **Tool**: An AI SDK v6 `tool()` definition with a validated input schema; server code executes the action and returns a typed tool-result.
- **Capability**: A user-facing action in ALFRED (e.g., “create note”, “run deploy”, “search graph”). Capabilities are exposed via UI and/or tools and always have risk + policy metadata.
- **Desktop app (web)**: A window/panel inside the TanStack Start desktop shell that uses tRPC to manage one domain.

Related ExecPlans you should treat as “sub-plans” (read them before implementing the matching milestones):

- `docs/execplans/ai-native-workflow.md` — end-to-end workflow system and streaming shape.
- `docs/execplans/desktop-evolution.md` and `docs/execplans/desktop-evolution-prd.md` — desktop shell/window patterns.
- `docs/execplans/reviews-web-components.md` and `docs/execplans/alfred-reviews-implementation.md` — review gate UX and components.
- `docs/execplans/voice-experience.md` and `docs/execplans/voice-admin-dashboard.md` — voice UX and backend/admin expectations.
- `docs/execplans/backend-frontend-audit.md` — known boundary violations and remediation tactics.

This master plan is the “spine”: it sequences and integrates these efforts and adds missing glue (capability registry, parity tests, web dependency hygiene, and unified run UX).

## Plan of Work

### Milestone 0 — Baseline + guardrails (no behavior change)

Goal: get a clean, enforceable baseline so future work can’t silently regress boundaries.

Work:

1. Ensure `apps/web/package.json` declares every `@alfred/*` package it imports.
2. Ensure `apps/web/vite.config.ts` externalizes every server-only package used by SSR routes per repo rule (`@alfred/db`, `@alfred/agent`, `@alfred/policy`, etc.).
3. Remove any direct imports of `@alfred/db` (and other server-only packages) from `apps/web/src/**` by pushing the needed functionality down into `packages/api` routers/services.
4. Add/extend bundle validation so CI fails if server-only strings leak into client bundles (prefer using or extending `scripts/verify-build.ts`).
5. Add a fast check that searches for forbidden imports in `apps/web/src/**` (a script, a test, or both).

Acceptance:

- `bun run typecheck` passes.
- `bun scripts/verify-build.ts` passes.
- `bun scripts/verify-integration-health.ts --fail` passes.
- `rg "@alfred/db" apps/web/src` returns no matches.

### Milestone 1 — Capability registry (the unifying contract)

Goal: define a single source of truth for “what ALFRED can do”, with metadata sufficient to drive:

- web “Apps” launcher + per-capability UI affordances,
- tool exposure (which agent/toolset can do it),
- policy gating and risk UX,
- parity tests.

Design constraints:

- The registry must be import-safe (no side effects).
- It must not create circular dependencies between `packages/api` and `packages/agent`.
- UI should consume it via the API (not direct imports), so the server can filter capabilities by auth/policy.

Implementation sketch:

1. In `packages/type/src/` add a pure type definition (example names):
   - `CapabilityId` (string brand)
   - `CapabilityRisk` (`low|medium|high`)
   - `CapabilityDescriptor` (id, title, summary, category, risk, requiresElevation, telemetryTags)

2. In `packages/agent/src/` add a registry module (example path):
   - `packages/agent/src/capability/registry.ts`
   - Export `capabilities: CapabilityDescriptor[]`.
   - Keep “how to execute” details (schemas, tool builders) close to tool definitions, but keep the _descriptor_ stable.

3. In `packages/api/src/routers/` add a router to list capabilities:
   - `packages/api/src/routers/capability.ts` with `capability.list`.
   - Apply auth/policy filtering here (e.g., hide high-risk capabilities if user is unauthenticated).

4. In `apps/web/src/components/apps/` add a “Tools / Capabilities” app that lists capabilities, shows risk badges, and deep-links to the owning app/window.

5. Add a parity test in `packages/api/test/` asserting:
   - `capability.list` returns non-empty stable data.
   - Every top-level web app/window (manifest entry) is represented by ≥1 capability.

Acceptance:

- A new web window exists that renders a live capability list via tRPC.
- A new API router test fails before this milestone and passes after.

### Milestone 2 — Unified tool exposure (chat + voice)

Goal: make “capability parity” real for agents.

Work:

1. Define a small set of tool catalogs in `packages/agent` (assistant and orchestrator) that each stay ≤5 tools, but collectively cover the capability registry.
2. Implement tool routing based on intent classification (use the repo’s LLM-first classification utilities under `packages/plan/src/classify/**` where applicable).
3. Ensure every capability has at least one of:
   - a tool implementation (agent can do it), or
   - an explicit `uiOnly: true` marker with rationale (human-only admin action).

4. Ensure every tool enforces policy via the existing policy hooks (`requireToolScopesAndPolicy()` before any subprocess spawn; router PEP checks for API actions).

5. Add tests:
   - Tool import-safety: importing tool catalogs does not start timers/workers.
   - Capability parity: registry entries without tool coverage must be explicitly marked.

Acceptance:

- A chat request can be routed to the right tool catalog (observable via logs + tool-call parts).
- A high-risk tool triggers elevation/approval rather than silently executing.

### Milestone 3 — Unified streaming transport + “transport parity”

Goal: a single web chat UI can switch between “assistant” and “orchestrator/workflow” backends and still stream AI SDK v6 UIMessage events correctly.

Work:

1. Converge `apps/web/src/hooks/use-assistant-stream.ts` and related code on AI SDK v6 primitives (`useChat`, `DefaultChatTransport`, `convertToModelMessages`).
2. Ensure the server endpoints (`apps/web/src/routes/api/**`) return AI SDK-compatible streaming responses.
3. Implement “transport parity”: when the user toggles between assistant vs orchestrator modes, the client swaps the transport endpoint (and the UI clearly shows which mode is active).
4. Add a web test (or API integration test) proving streaming works end-to-end for both endpoints.

Acceptance:

- In the web UI, switching modes changes the backend endpoint.
- Both modes produce streaming UIMessage parts with tool-call/tool-result parts preserved.

### Milestone 4 — Workflow run UX: start/stream/resume/cancel + review + compilation

Goal: the web desktop has a first-class Workflow app where runs are visible, debuggable, resumable, and safe.

Work:

1. Backend:
   - Ensure `packages/api` exposes run lifecycle endpoints (start, stream, resume, cancel).
   - Ensure durable “work compilation” is stored per `.ruler/59-work-compilation.md` under `workflow_runs.stateData.compilation`.
   - Ensure review-gate events are surfaced with enough data for UI to render diffs/approvals.

2. Frontend:
   - Implement/finish `apps/web` Workflow app window: run list + live timeline + event inspector + resume/cancel + compilation view.
   - Reuse existing review components where available.

3. Tests:
   - Router tests for lifecycle endpoints.
   - Runtime tests for success, escalation, and MAX_TRANSITIONS safeguards (repo mandate).

Acceptance:

- A user can run a multi-step workflow from the UI, refresh the page, and still inspect (and resume, if applicable) the run.
- A blocked run that needs approval can be approved in-UI and continues.

### Milestone 5 — Web desktop “apps for every backend domain”

Goal: every backend domain ALFRED exposes is manageable in the web desktop.

Approach:

1. Define a single manifest for web apps/windows (either extend an existing manifest plan such as `docs/execplans/component-manifest-integration.md`, or create `apps/web/src/components/apps/manifest.ts`).
2. For each domain category below, ensure there is:
   - a tRPC router or router section in `packages/api/src/routers/**`,
   - at least one capability entry (Milestone 1),
   - a web desktop window entry + UI.

Domain categories to cover (grouped for implementation order):

- Tier 1 (daily use): Chat, Notes, Reminders, Todos, Inbox.
- Tier 2 (execution): Workflow, Reviews, Terminal/Docker, Deploy, Linear.
- Tier 3 (intelligence): Knowledge Graph, RAG (chunk browser, similarity), Context Lens, Cortex/Mindscape.
- Tier 4 (system): Voice, Settings/Integrations, Metrics/Status, Policy/Security, AgentFS/Audit.

Follow the repo’s “sections” organization rule for complex apps (5+ categories) under `sections/`.

Acceptance:

- There is an obvious in-UI launcher listing all apps.
- Every category above has at least one working window connected to real backend data.

### Milestone 6 — Voice calls end-to-end (web)

Goal: the web desktop supports voice-first interaction “while driving” (CarPlay parity later), using the same tool and workflow infrastructure.

Work:

1. Backend:
   - Validate `packages/api/src/voice/**` can create and manage a WebRTC session and stream transcripts.
   - Ensure TTS playback is supported (local models when configured, otherwise fallback).

2. Frontend:
   - Ensure mic selection, waveform UI, transcript viewer, and voice indicators work.
   - Ensure voice input produces the same UIMessage stream flow as text chat.

3. Tests:
   - Add targeted API tests for voice session endpoints.
   - Add an opt-in E2E test (Playwright) gated behind an env flag, per repo testing standards.

Acceptance:

- A user can start a voice session, speak, see transcripts, and receive spoken responses.
- A voice request that requires tools triggers the same review/elevation UI as text.

### Milestone 7 — Security, elevation, and audit

Goal: “Local & Secure” is not marketing; it is enforced.

Work:

1. Ensure every high-risk capability/tool:
   - declares risk metadata,
   - is gated by policy,
   - is explainable in the UI (why it was blocked/allowed).

2. Ensure the web desktop has an Audit view (AgentFS + tool invocations + run history).
3. Ensure consent/elevation routes are wired for real flows.

Acceptance:

- Attempting a dangerous operation always prompts elevation or denies safely.
- The audit surface shows what happened, when, and why.

### Milestone 8 — Release hardening

Goal: CI-safe, regression-resistant integration.

Work:

1. Add/extend validators:
   - integration-health (`scripts/verify-integration-health.ts --fail`)
   - bundle/build scan (`scripts/verify-build.ts`)
   - tool import-safety tests (no import-time work)
   - capability parity tests

2. Add a manual smoke checklist (kept short) that a human can run after `bun run dev`.

Acceptance:

- Typecheck + tests pass.
- CI validators pass.
- Manual smoke flows succeed.

## Concrete Steps

This section is intentionally repetitive: it’s how a novice executes the plan.

0. In repo root, install and boot the system:
   - `bun install`
   - `cp config/env.example .env`
   - `bun scripts/gen-keys.ts >> .env`
   - `bun run db:start`
   - `bun run db:migrate`
   - `bun run dev`

1. Before and after every milestone, run the fast validators:
   - `bun run typecheck`
   - `bun scripts/test-bun.ts` (use filters to scope to changed packages)
   - `bun scripts/verify-integration-health.ts --fail`
   - `bun scripts/verify-build.ts` (when bundle safety might be affected)

2. When a milestone changes workflow runtime/orchestrator behavior, add and run targeted tests that cover:
   - success path
   - escalation path
   - MAX_TRANSITIONS path

   Then re-run the scoped test suite and `bun run typecheck`.

## Validation and Acceptance

At the end of the plan, all of the following must be true:

- The web desktop can run both assistant and orchestrator modes with correct streaming.
- The Workflow app can start, stream, resume, cancel, and display compilation results.
- Voice sessions work end-to-end (mic → transcript → response → TTS).
- Every major backend domain has a corresponding web window and at least one capability entry.
- High-risk actions are gated, and the UI explains the gate.
- CI validators pass with `--fail` settings enabled.

## Idempotence and Recovery

- Prefer additive migrations and feature-gated rollouts for large refactors.
- Any DB migration should be safe to re-run via `bun run db:migrate`.
- Any new background worker/scheduler must be behind an env flag to avoid duplicate execution.
- If a change breaks streaming, keep a temporary dual-path endpoint (old + new) behind an env toggle long enough to prove parity, then delete the old path in a follow-up milestone.

## Artifacts and Notes

When implementing, keep this plan updated with:

- short transcripts of “before vs after” behavior (especially for streaming and workflow runs),
- links to the tests you added (paths), and
- any “gotchas” discovered (e.g., SSR bundling pitfalls, WebRTC platform quirks).

## Interfaces and Dependencies

Minimum stable interfaces that must exist by the end:

1. Capability descriptor type (shared via `@alfred/type`).
2. Capability registry value exported from `packages/agent` (import-safe).
3. `capability.list` API endpoint returning descriptors filtered by auth/policy.
4. Web desktop manifest that maps “apps/windows” to capability categories.
5. Tool routing that chooses a small tool catalog for a request while preserving full capability coverage.

Any new dependency must already exist in the repo or be explicitly justified; do not introduce new frameworks for state management or streaming in the web app.

## Systematic Implementation Schedule

### Phase 1: Workflow Foundation (Weeks 1-2)

**Goal:** Complete Milestone 4 core functionality.

**Week 1: ✅ COMPLETE**

- [x] Backend: Run lifecycle endpoints (start, stream, resume, cancel) - Already implemented
- [x] Backend: Work compilation persistence in `workflow_runs.stateData.compilation` - Already implemented with `CompilationObserver`
- [x] Backend: Review-gate event surfacing for UI - Already implemented in `ReviewStage`
- [x] Tests: Router tests for lifecycle endpoints (`workflow.lifecycle.test.ts`)
- [x] Tests: MAX_TRANSITIONS safeguard tests (`max-transitions.test.ts`)
- [x] UI Components: `CompilationView`, `EventInspector`, `RunList`

**Week 2: ✅ COMPLETE**

- [x] Frontend: Integrate new components into Workflow app window - Added `CompilationView`, `EventInspector`, `RunList` with view switcher
- [x] Frontend: Add resume/cancel controls to run list - Integrated with `cancelMutation`
- [x] Frontend: Event inspector integration - Full event viewing with filters and JSON payload viewer

**Dependencies:** `docs/execplans/ai-native-workflow.md`

---

### Phase 2: Web Desktop Expansion (Weeks 3-4) ✅ COMPLETE

**Goal:** Complete Milestone 5 Tier 1-2 domains.

**Week 3:**

- [x] Comprehensive Reviews app with 3-section architecture:
  - ReviewQueue: Pending/blocked AI action reviews (tools, memory, workflow, code)
  - PRReviews: GitHub PR review and merge (migrated from pr-review app)
  - CodeReviews: Local file and agent output reviews with diff viewer
- [x] Standalone Deploy app (separate from Docker) with sections:
  - Deployments: List and manage preview/production deployments
  - Create Preview: Form for new preview deployments
  - Health Monitor: Real-time deployment health status

**Week 4:**

- [x] Window registry integration for both apps (`reviews`, `deploy` window types)
- [x] Type-safe implementations with proper tRPC integration
- [x] Sections pattern following .ruler/58-desktop-app-organization.md

**Note:** Tier 1 apps (Notes, Reminders) already exist as legacy windows. Tier 2 Terminal/Docker and Linear integration already exist. The app launcher was already implemented. Phase 2 focused on creating the comprehensive Reviews and Deploy apps that were missing.

**Deliverables:**

- `apps/web/src/components/apps/reviews/` - Unified Reviews app with 3 sections
- `apps/web/src/components/apps/deploy/` - Standalone Deploy app with 3 sections
- Updated window registry and types for `reviews` and `deploy` types
- Type-safe implementations with full backend integration

**Dependencies:** `docs/execplans/desktop-evolution.md`, `docs/execplans/reviews-web-components.md`

---

### Phase 3: Voice Experience (Week 5-6)

**Goal:** Complete Milestone 6.

**Week 5:**

- [ ] Backend: WebRTC session validation
- [ ] Backend: TTS playback support
- [ ] Frontend: Mic selection UI

**Week 6:**

- [ ] Frontend: Waveform visualization
- [ ] Frontend: Transcript viewer
- [ ] Frontend: Voice indicators
- [ ] Tests: Voice session endpoint tests

**Dependencies:** `docs/execplans/voice-experience.md`, `docs/execplans/voice-admin-dashboard.md`

---

### Phase 4: Security & Audit (Week 7)

**Goal:** Complete Milestone 7.

- [ ] Policy gating for high-risk capabilities
- [ ] Elevation flow UI (biometric prompts)
- [ ] Audit trail viewer (AgentFS + tool invocations + run history)
- [ ] Consent/elevation route wiring

**Dependencies:** Policy system in `packages/auth`, `packages/policy`

---

### Phase 5: CI Hardening (Week 8)

**Goal:** Complete Milestone 8.

- [ ] Extend bundle scan in `scripts/verify-build.ts`
- [ ] Import-safety tests in CI
- [ ] Capability parity test enforcement
- [ ] Integration-health validator with `--fail`
- [ ] Manual smoke checklist

---

### Phase 6: Final Verification (Week 9)

**Goal:** Complete Milestone 9.

- [ ] Full typecheck pass
- [ ] Full test suite pass
- [ ] Build verification
- [ ] Manual smoke flows
- [ ] Documentation updates

---

## Current Status Tracking

**Completed:**

- [x] Milestone 0: Baseline + guardrails
- [x] Milestone 1: Capability registry
- [x] Milestone 2: Unified tool exposure
- [x] Milestone 3: Transport parity

**In Progress:**

- [ ] Milestone 4: Workflow run UX - Week 1 ✅ complete, Week 2 in progress

**Next:**

- [ ] Milestone 5: Web desktop apps
- [ ] Milestone 6: Voice end-to-end
- [ ] Milestone 7: Security/audit
- [ ] Milestone 8: CI hardening
- [ ] Milestone 9: Final verification

---

## Decision Log Additions

- **Decision:** Phase 1 prioritizes Workflow over Voice because Workflow unlocks multi-step orchestration which Voice will leverage.
  - Rationale: Voice needs the same tool infrastructure; better to solidify tools first.
  - Date/Author: 2026-01-28 / Droid

- **Decision:** Tier 1-2 domains before Tier 3-4 in Milestone 5.
  - Rationale: Daily-use apps (Notes, Reminders) provide immediate user value; system apps (Metrics, Policy) are admin-only.
  - Date/Author: 2026-01-28 / Droid

- **Decision:** Implement CI validators incrementally rather than all at once in Milestone 8.
  - Rationale: Each milestone should add its own validation; Milestone 8 is for enforcement and gaps.
  - Date/Author: 2026-01-28 / Droid
