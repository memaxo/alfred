# ALFRED Codebase Integration Audit

**Date**: 2026-01-25  
**Purpose**: Map what's wired together vs disconnected in the ALFRED monorepo

## Executive Summary

The ALFRED codebase has **strong core integration** with domain packages (cognitive, knowledge, learning, policy, agent) well-wired through the runtime layer. A smaller set of packages remain **disconnected or partially integrated**, creating architectural debt and unclear execution paths.

**Key Findings:**

- ✅ **Core domain packages**: Fully integrated via runtime (17 packages)
- ✅ **API layer**: Well-wired with 50+ routers
- ⚠️ **Pipeline vs Runtime**: Duplicate execution paths
- ⚠️ **Some packages**: Standalone tooling or partially integrated features (graph/query overlap, client-only packages)

---

## Integration Status Map

### 🟢 Fully Integrated (Core Domain)

These packages are actively used in the main execution paths:

| Package              | Integration Points                                                                                                         | Status    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------- |
| `@alfred/cognitive`  | Runtime (`packages/runtime/src/core.ts`), API (`packages/api/src/routers/cognitive.ts`)                                    | ✅ Active |
| `@alfred/knowledge`  | Runtime engines (`packages/runtime/src/engines/knowledge.ts`), API (`packages/api/src/routers/knowledge.ts`)               | ✅ Active |
| `@alfred/learning`   | Runtime engines (`packages/runtime/src/engines/learning.ts`), Agent (`packages/agent/src/orchestrator/learning-worker.ts`) | ✅ Active |
| `@alfred/policy`     | Runtime engines (`packages/runtime/src/engines/policy.ts`), API middleware                                                 | ✅ Active |
| `@alfred/agent`      | Runtime orchestrator (`packages/runtime/src/orchestrator/agent.ts`), Pipeline (`packages/pipeline/src/stages/execute.ts`)  | ✅ Active |
| `@alfred/plan`       | Pipeline stages (`packages/pipeline/src/stages/plan.ts`), Runtime phases                                                   | ✅ Active |
| `@alfred/db`         | All packages via repos, no direct imports in domain packages                                                               | ✅ Active |
| `@alfred/auth`       | API context (`packages/api/src/context.ts`), All routers                                                                   | ✅ Active |
| `@alfred/rag`        | Runtime knowledge engine, API routers                                                                                      | ✅ Active |
| `@alfred/embed`      | RAG, Cortex, Runtime                                                                                                       | ✅ Active |
| `@alfred/rerank`     | Runtime knowledge engine (`packages/runtime/src/engines/knowledge.ts`)                                                     | ✅ Active |
| `@alfred/voice`      | API router (`packages/api/src/routers/voice.ts`), Native app                                                               | ✅ Active |
| `@alfred/runtime`    | API workflow routers (`packages/api/src/routers/workflow/stream.ts`)                                                       | ✅ Active |
| `@alfred/pipeline`   | API phase execution (`packages/api/src/routers/workflow/phase/execute.ts`)                                                 | ✅ Active |
| `@alfred/resilience` | Pipeline runner safeguards (`packages/pipeline/src/runner.ts`)                                                             | ✅ Active |
| `@alfred/type`       | All packages (shared types)                                                                                                | ✅ Active |
| `@alfred/logger`     | All packages                                                                                                               | ✅ Active |
| `@alfred/metrics`    | Runtime, API, Agent                                                                                                        | ✅ Active |

### 🟡 Partially Integrated

These packages have some integration but gaps exist:

| Package                 | Integration Points                                             | Gaps                                                  | Status         |
| ----------------------- | -------------------------------------------------------------- | ----------------------------------------------------- | -------------- |
| `@alfred/sense`         | API routers (`capture.ts`, `receipt.ts`), native + web clients | Native voice capture now wired; photo capture pending | ⚠️ Partial     |
| `@alfred/graph`         | API service (`packages/api/src/services/graph.ts`), API router | Overlaps with `@alfred/knowledge` (now documented)    | ⚠️ Partial     |
| `@alfred/history`       | Runtime (`packages/runtime/src/orchestrator/index.ts`), API    | Lightweight, minimal usage                            | ⚠️ Partial     |
| `@alfred/persona`       | Web app (`apps/web/package.json`)                              | Not used by runtime/API                               | ⚠️ Client-only |
| `@alfred/ui`            | Native app (`apps/native/package.json`)                        | Not used by web app                                   | ⚠️ Native-only |
| `@alfred/pacer`         | Web app, API observers                                         | Not used in core runtime                              | ⚠️ Partial     |
| `@alfred/code-analysis` | API review router (`packages/api/src/routers/review.ts`)       | Only `raw_diff` supported; PR/local diff fetch TODO   | ⚠️ Partial     |

### 🟣 Tooling / Intentionally Standalone

These packages are **intentionally not on the main Pipeline/Runtime execution path**.
They are kept because they support developer workflows, offline analysis, or client-only UX.

| Package             | Integration Points                                                               | Classification     | Status             |
| ------------------- | -------------------------------------------------------------------------------- | ------------------ | ------------------ |
| `@alfred/evals`     | `scripts/verify-executors-live.ts` (wrapper), `bun run @alfred/evals/cli -- ...` | Tooling (dev/CI)   | ✅ Wired (scripts) |
| `@alfred/harbor`    | `scripts/harbor-*.ts`, `scripts/harbor-verifiers/*`                              | Tooling (analysis) | ✅ Wired (scripts) |
| `@alfred/tui`       | `scripts/verify-tui.ts`, web terminal “TUI mode” UI                              | Tooling (UI)       | ✅ Wired           |
| `@alfred/summarize` | **No callsites** (allowed disconnected)                                          | Standalone utility | 🟣 Standalone      |

### ✅ No Unapproved Orphans (per integration-health)

Per `scripts/verify-integration-health.ts`, there are **no packages with zero callsites**
except those explicitly declared **standalone** (see table above).

---

## Architecture Patterns

### ✅ Well-Wired Patterns

**1. Runtime → Domain Packages**

```
packages/runtime/
├── src/core.ts → imports cognitive, knowledge, learning, policy
├── src/engines/knowledge.ts → uses knowledge, rag, rerank
├── src/engines/learning.ts → uses learning
├── src/engines/policy.ts → uses policy
└── src/orchestrator/agent.ts → uses agent
```

**2. API → Runtime/Pipeline**

```
packages/api/src/routers/
├── workflow/stream.ts → uses runtime
├── workflow/phase/execute.ts → uses pipeline
└── assistant.ts → uses runtime
```

**3. Apps → API**

```
apps/web/src/router.tsx → tRPC client → packages/api
apps/native/ → tRPC client → packages/api
```

**4. DB → Repos Pattern**

```
packages/db/src/repo/ → All packages use repos, no direct DB imports in domain packages
```

### ⚠️ Architectural Issues

**1. Pipeline vs Runtime Duplication**

Two separate execution paths exist:

- **Pipeline**: Stage-based (`packages/pipeline`) - 8 sequential stages
- **Runtime**: Phase-based (`packages/runtime`) - 4 phases (scan, plan, act, report)

**Current Usage:**

- Pipeline: Used by `packages/api/src/routers/workflow/phase/execute.ts`
- Runtime: Used by `packages/api/src/routers/workflow/stream.ts`

**Issue**: Unclear which to use when. Both orchestrate workflows but with different models.

**Recommendation**:

- Document when to use Pipeline vs Runtime
- Consider consolidating or making boundaries explicit
- See `docs/execplans/runtime-integration.md` for context

**2. Graph vs Knowledge Overlap**

- `@alfred/knowledge`: Pure in-memory hypergraph with persistence
- `@alfred/graph`: Graph query utilities using DB repos

**Issue**: Overlapping functionality; boundaries need to stay explicit.

**Recommendation**:

- Document separation: `knowledge` = in-memory hypergraph, `graph` = DB query layer
- Or consolidate if overlap is too high

**3. Sense Native Integration (Status)**

- `@alfred/sense`: Capture/inbox/receipt system exists
- Native capture now calls sense routers (voice capture); photo capture remains pending.

**Issue**: Remaining capture types (e.g. photo) still need wiring + test coverage.

**Recommendation**:

- Complete integration per `docs/execplans/alfred-sense-mvp.md`
- Wire native capture → `trpc.capture.create.mutate()`

---

## Package Dependency Graph

```
apps/web ──┐
           ├──→ @alfred/api (tRPC client)
apps/native┘

@alfred/api ──→ @alfred/runtime ──→ @alfred/cognitive
              └─→ @alfred/pipeline ──→ @alfred/knowledge
                                      └─→ @alfred/learning
                                      └─→ @alfred/policy
                                      └─→ @alfred/agent
                                      └─→ @alfred/plan

@alfred/runtime ──→ @alfred/db (via repos)
                 └─→ @alfred/rag
                 └─→ @alfred/rerank

@alfred/sense ──→ @alfred/db (via repos) [⚠️ Partial]
@alfred/graph ──→ @alfred/db (via repos) [⚠️ Partial]
@alfred/cortex ──→ (client-only) [🟣 Client-only]
@alfred/codeprint ──→ (tooling via plan research) [🟣 Tooling]
```

---

## Action Items

### Immediate (This Week)

1. **Audit Unused Packages**
   - [x] `@alfred/resilience` - Integrated into pipeline runner (`packages/pipeline/src/runner.ts`)
   - [x] `@alfred/code-analysis` - Integrated into review router (`packages/api/src/routers/review.ts`)
   - [x] `@alfred/util` - Deleted (package no longer exists)

2. **Document Disconnected Packages**
   - [x] Document `@alfred/cortex` as client-only (plus API preset helpers)
   - [x] Document `@alfred/protocol` as core shared protocol
   - [x] Document `@alfred/mcp` as core runtime integration surface

### Short-Term (This Month)

3. **Complete Sense Integration**
   - [x] Wire native capture → `trpc.capture.create.mutate()` (`apps/native/lib/voice/capture.ts`)
   - [x] Test end-to-end: capture → inbox → triage (unit/integration coverage)
   - [ ] Update `docs/execplans/alfred-sense-mvp.md` with completion status

4. **Clarify Pipeline vs Runtime**
   - [ ] Document when to use Pipeline vs Runtime in `docs/architecture/pipeline.md`
   - [ ] Add decision tree: "Use Pipeline when...", "Use Runtime when..."
   - [ ] Update `packages/api/src/routers/workflow/` to clarify usage

5. **Audit Graph vs Knowledge**
   - [x] Document separation: `knowledge` = hypergraph, `graph` = DB queries (`docs/architecture/hypergraph.md`)
   - [ ] Or consolidate if overlap is too high

### Medium-Term (Next Quarter)

6. **Integrate Codeprint**
   - [x] Decision: Keep as tooling via plan research (`packages/plan/src/research/*`)

7. **Integrate Cortex Backend**
   - [x] Decision: Client-only rendering/engine; server uses only presets/config via API

8. **Integrate Tune into Learning**
   - [x] Decision: Keep as API-exposed tooling; do not wire into learning loops by default

---

## Metrics

**Package Count**: 30+ packages

- ✅ Fully integrated: (see integration-health scan)
- ⚠️ Partially integrated: (see integration-health scan)
- 🔴 Disconnected (unapproved): **0**
- 🟣 Standalone (approved disconnected): **`@alfred/summarize`**

**Integration Health**: run `bun run scripts/verify-integration-health.ts --json` for the source-of-truth numbers.

**Architectural Debt**:

- 2 duplicate execution paths (Pipeline vs Runtime)
- 1 overlap area (Graph vs Knowledge) — now documented + tested
- 1 incomplete area (Sense photo capture → inbox)

---

## References

- Core architecture: `docs/architecture/overview.md`
- Package structure: `docs/architecture/packages.md`
- Integration health script: `bun run scripts/verify-integration-health.ts`
- Pipeline docs: `packages/pipeline/README.md`
- Runtime docs: `packages/runtime/README.md`
- Sense ExecPlan: `docs/execplans/alfred-sense-mvp.md`
- Runtime integration: `docs/execplans/runtime-integration.md`
