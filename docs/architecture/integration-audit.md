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
| `@alfred/summarize`     | Pipeline stage (`packages/pipeline/src/stages/summarize.ts`)   | Python subprocess, may not be tested                  | ⚠️ Partial     |
| `@alfred/code-analysis` | API review router (`packages/api/src/routers/review.ts`)       | Only `raw_diff` supported; PR/local diff fetch TODO   | ⚠️ Partial     |

### 🔴 Disconnected/Orphaned

These packages exist but are not integrated into core workflows (or have code but aren't imported):

| Package             | Current Usage                                                    | Recommendation                                                      |
| ------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| `@alfred/codeprint` | Used by `packages/plan/src/research/codebase.ts` → `internal.ts` | **Status**: ✅ Integrated via plan package, used in research flows  |
| `@alfred/cortex`    | Web app hooks only (`apps/web/src/hooks/use-cortex-*.ts`)        | **Audit**: Integrate with backend or keep client-only               |
| `@alfred/tune`      | Has router (`packages/api/src/routers/tune.ts`)                  | **Audit**: Integrate into learning loops or keep standalone         |
| `@alfred/protocol`  | Web app codex client (`apps/web/src/lib/codex/stream-client.ts`) | **Audit**: Client protocol only, document as intentional            |
| `@alfred/mcp`       | Has router (`packages/api/src/routers/mcp.ts`)                   | **Audit**: External MCP server integration, document as intentional |
| `@alfred/harbor`    | Standalone scripts only (`scripts/harbor*.ts`)                   | **Audit**: Keep as scripts or integrate into API                    |
| `@alfred/util`      | Only docs/rules, no code                                         | **Delete**: Empty package, just documentation                       |
| `@alfred/tui`       | Terminal UI package                                              | **Audit**: Standalone tool or integrate with API                    |

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
@alfred/cortex ──→ (client-only) [🔴 Disconnected]
@alfred/codeprint ──→ (standalone) [🔴 Disconnected]
```

---

## Action Items

### Immediate (This Week)

1. **Audit Unused Packages**
   - [x] `@alfred/resilience` - Integrated into pipeline runner (`packages/pipeline/src/runner.ts`)
   - [x] `@alfred/code-analysis` - Integrated into review router (`packages/api/src/routers/review.ts`)
   - [ ] `@alfred/util` - Only docs/rules, no code. **Delete**: Empty package

2. **Document Disconnected Packages**
   - [ ] Add README to `@alfred/cortex` explaining client-only usage
   - [ ] Add README to `@alfred/protocol` explaining client protocol purpose
   - [ ] Add README to `@alfred/mcp` explaining external MCP integration

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
   - [ ] Decision: Integrate into workflow execution or keep standalone
   - [ ] If integrate: Add codeprint analysis to pipeline context stage
   - [ ] If standalone: Document as developer tool

7. **Integrate Cortex Backend**
   - [ ] Decision: Add backend integration or keep client-only
   - [ ] If integrate: Add cortex router to API, wire to runtime
   - [ ] If client-only: Document as intentional architecture decision

8. **Integrate Tune into Learning**
   - [ ] Wire tune into learning loops (`packages/runtime/src/engines/learning.ts`)
   - [ ] Or document as standalone fine-tuning service

---

## Metrics

**Package Count**: 30+ packages

- ✅ Fully integrated: 17 packages (including codeprint via plan)
- ⚠️ Partially integrated: 7 packages
- 🔴 Disconnected: 9 packages (resilience, code-analysis have code but unused)

**Integration Health**: 57% fully integrated, 23% partial, 30% disconnected

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
