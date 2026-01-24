# Harbor Comprehensive Analysis

Phase 1 output from `docs/execplans/harbor-comprehensive.md`.

## 1. Capability Inventory

### Surface 1: Coding Fundamentals

| Capability   | Code Path                                       | Tests           | Observable Events             | Harbor Coverage |
| ------------ | ----------------------------------------------- | --------------- | ----------------------------- | --------------- |
| Bug fixes    | `packages/agent/src/orchestrator/tool/droid.ts` | `droid.test.ts` | `tool-call`, `tool-result`    | `failtest`      |
| Type errors  | TypeScript/Bun type system                      | -               | `stdout`, `stderr`            | `typecheck`     |
| Lint fixes   | Biome integration                               | -               | `stdout`, `stderr`            | `lintfix`       |
| Build errors | Bun build                                       | -               | `stdout`, `stderr`            | `build`         |
| Multi-file   | Multi-agent waves                               | `waves.ts`      | `wave-start`, `wave-complete` | `multifile`     |
| Regression   | Test suite execution                            | -               | `tool-result`                 | `regress`       |
| Feature impl | `droid.ts`, `codex/`                            | -               | `tool-call`, `tool-result`    | **MISSING**     |
| Refactoring  | Same as feature                                 | -               | Same                          | **MISSING**     |

### Surface 2: Planning & Decomposition

| Capability          | Code Path                                            | Tests | Observable Events               | Harbor Coverage |
| ------------------- | ---------------------------------------------------- | ----- | ------------------------------- | --------------- |
| Task decomposition  | `packages/agent/src/orchestrator/multi/decompose.ts` | -     | `plan-selected`                 | **MISSING**     |
| Dependency analysis | `packages/runtime/src/orchestrator/dependencies.ts`  | -     | -                               | **MISSING**     |
| Wave planning       | `packages/agent/src/orchestrator/multi/spawn.ts`     | -     | `wave-start`, `wave-complete`   | **MISSING**     |
| Phased planning     | `packages/plan/src/generate/`                        | -     | `phase-start`, `phase-complete` | **MISSING**     |

### Surface 3: Tool Use

| Capability         | Code Path                                         | Tests           | Observable Events       | Harbor Coverage |
| ------------------ | ------------------------------------------------- | --------------- | ----------------------- | --------------- |
| Git operations     | `packages/agent/src/orchestrator/tool/git.ts`     | -               | `tool-call:git.*`       | **MISSING**     |
| Browser automation | `packages/agent/src/orchestrator/tool/browser.ts` | -               | `tool-call:browser.*`   | **MISSING**     |
| Shell execution    | `packages/agent/src/orchestrator/tool/droid.ts`   | `droid.test.ts` | `tool-call:droid`       | Implicit        |
| Knowledge query    | `packages/agent/src/orchestrator/tool/knowledge/` | -               | `tool-call:knowledge_*` | **MISSING**     |
| RAG operations     | `packages/agent/src/orchestrator/tool/rag/`       | -               | `tool-call:rag_*`       | **MISSING**     |

### Surface 4: Safety & Judgment

| Capability           | Code Path                                        | Tests | Observable Events           | Harbor Coverage |
| -------------------- | ------------------------------------------------ | ----- | --------------------------- | --------------- |
| Stuck detection      | `packages/agent/src/orchestrator/multi/stuck.ts` | -     | `agent:stuck`               | `stuck`         |
| Escalation           | `packages/runtime/src/orchestrator/agent.ts`     | -     | `agent:escalated`, `notice` | Partial         |
| Scope gating         | `packages/auth/src/token.ts`                     | -     | `require-scope`             | `scope`         |
| Constraint adherence | -                                                | -     | -                           | **MISSING**     |
| Biometric elevation  | `packages/auth/src/token.ts`                     | -     | `require-scope`             | **MISSING**     |

### Surface 5: Context & Retrieval

| Capability      | Code Path                                     | Tests         | Observable Events     | Harbor Coverage |
| --------------- | --------------------------------------------- | ------------- | --------------------- | --------------- |
| Code context    | `packages/runtime/src/context.ts`             | -             | `context:*`           | `context`       |
| Web search      | `packages/agent/src/orchestrator/tool/exa.ts` | -             | `tool-call:exa_*`     | **MISSING**     |
| RAG retrieval   | `packages/rag/src/`                           | `rag.test.ts` | `tool-call:rag_query` | **MISSING**     |
| Bundle building | `packages/runtime/src/context.ts`             | -             | `data-cache-handoff`  | **MISSING**     |

### Surface 6: Orchestration

| Capability         | Code Path                                      | Tests                      | Observable Events                                              | Harbor Coverage |
| ------------------ | ---------------------------------------------- | -------------------------- | -------------------------------------------------------------- | --------------- |
| Multi-agent waves  | `packages/runtime/src/orchestrator/waves.ts`   | -                          | `wave-start`, `wave-complete`, `agent-start`, `agent-complete` | **MISSING**     |
| Parallel execution | `packages/runtime/src/utils/concurrency.ts`    | -                          | -                                                              | **MISSING**     |
| Handoff            | `packages/runtime/src/orchestrator/handoff.ts` | -                          | `agent-handoff`                                                | **MISSING**     |
| Checkpoint         | `packages/pipeline/src/snapshot.ts`            | `resume-roundtrip.test.ts` | `context:set`                                                  | **MISSING**     |
| Resume             | `packages/pipeline/src/runner.ts`              | `resume-roundtrip.test.ts` | `pipeline:resume`                                              | **MISSING**     |

### Surface 7: Real-World Task Sources

| Capability     | Code Path                            | Tests                   | Observable Events  | Harbor Coverage |
| -------------- | ------------------------------------ | ----------------------- | ------------------ | --------------- |
| Linear tickets | `packages/api/src/routers/linear.ts` | `linear.router.test.ts` | `tool-call:ticket` | **MISSING**     |
| GitHub issues  | `packages/api/src/routers/github.ts` | -                       | `tool-call:git.*`  | **MISSING**     |
| PR reviews     | `packages/api/src/routers/github.ts` | -                       | -                  | **MISSING**     |

### Surface 8: Failure Modes

| Capability       | Code Path                                        | Tests                 | Observable Events | Harbor Coverage |
| ---------------- | ------------------------------------------------ | --------------------- | ----------------- | --------------- |
| Stuck detection  | `packages/agent/src/orchestrator/multi/stuck.ts` | -                     | `agent:stuck`     | `stuck`         |
| MAX_TRANSITIONS  | `packages/pipeline/src/guards.ts`                | `transitions.test.ts` | `pipeline:failed` | **MISSING**     |
| Timeout recovery | `packages/agent/src/orchestrator/tool/*.ts`      | -                     | `error`           | **MISSING**     |
| Error recovery   | `packages/pipeline/src/runner.ts`                | -                     | `agent:retry`     | **MISSING**     |

---

## 2. Event → ATIF Mapping

### Currently Mapped (in `buildAtifTrajectory`)

| Event Type      | ATIF Step Type                   | Source                      |
| --------------- | -------------------------------- | --------------------------- |
| `ui-message`    | Text/tool steps                  | `user` / `agent` / `system` |
| `tool-call`     | `tool_calls` array               | `agent`                     |
| `tool-result`   | `observation.results`            | `agent`                     |
| `stdout`        | Message step                     | `system`                    |
| `stderr`        | Message step                     | `system`                    |
| `assistant`     | Message step                     | `agent`                     |
| `notice`        | Message step                     | `system`                    |
| `error`         | Message step                     | `system`                    |
| `require-scope` | Message step with `scopes` extra | `system`                    |

### NOT Mapped (gaps)

| Event Type          | Proposed ATIF Mapping                     |
| ------------------- | ----------------------------------------- |
| `wave-start`        | System step with `waveId` in extra        |
| `wave-complete`     | System step with `waveId` in extra        |
| `agent-start`       | System step with `agentId`, `phaseId`     |
| `agent-complete`    | System step with `agentId`, outcome       |
| `phase-start`       | System step with `phaseId`, phase details |
| `phase-complete`    | System step with `phaseId`, result        |
| `plan-selected`     | System step with plan structure           |
| `agent-handoff`     | System step with handoff data             |
| `pipeline:start`    | System step (session init)                |
| `pipeline:complete` | System step with summary                  |
| `pipeline:failed`   | System step with error                    |
| `pipeline:suspend`  | System step                               |
| `pipeline:resume`   | System step with fromStage                |
| `agent:stuck`       | System step with reason                   |
| `agent:escalated`   | System step with reason                   |
| `agent:retry`       | System step with attempt info             |

---

## 3. Tool Inventory

### Orchestrator Tools (25 tools)

| Tool                | Scopes                       | Actions                                                                                                | Verifiable |
| ------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------ | ---------- |
| `git`               | `repo.read`, `repo.write`    | branch.create/delete/update, worktree.add/remove, commit, push, merge, status, diff, fetch, reset.hard | Yes        |
| `droid`             | `droid.exec`                 | Execute code                                                                                           | Yes        |
| `codex`             | `droid.exec`                 | Run Codex CLI                                                                                          | Yes        |
| `opencode`          | `droid.exec`                 | Run OpenCode                                                                                           | Yes        |
| `browser`           | `web.read`, `web.write`      | open, snapshot, click, fill, type, press, wait, get.\*, screenshot, close                              | Yes        |
| `knowledge_query`   | `knowledge.read`             | Search graph                                                                                           | Yes        |
| `knowledge_extract` | `knowledge.write`            | Extract + persist                                                                                      | Yes        |
| `knowledge_connect` | `knowledge.write`            | Create connections                                                                                     | Yes        |
| `knowledge_correct` | `knowledge.write` + elevated | Correct errors                                                                                         | Yes        |
| `rag_ingest`        | `rag.write`                  | Save documents                                                                                         | Yes        |
| `rag_query`         | `rag.read`                   | Semantic search                                                                                        | Yes        |
| `rag_list`          | `rag.read`                   | List documents                                                                                         | Yes        |
| `rag_delete`        | `rag.write` + elevated       | Remove documents                                                                                       | Yes        |
| `learn_record`      | -                            | Record learning                                                                                        | Yes        |
| `learn_pattern`     | -                            | Record patterns                                                                                        | Yes        |
| `learn_mistake`     | -                            | Record mistakes                                                                                        | Yes        |
| `docker`            | `deploy.write`               | Container ops                                                                                          | Yes        |
| `proxmox`           | `deploy.write`               | VM management                                                                                          | Yes        |
| `router`            | `deploy.write`               | Caddy routes                                                                                           | Yes        |
| `runtime`           | `deploy.read/write`          | Monitor/recover                                                                                        | Yes        |
| `ticket`            | -                            | Linear ticket ops                                                                                      | Yes        |
| `web`               | `web.read`                   | Web requests                                                                                           | Yes        |
| `exa`               | `web.read`                   | Exa search                                                                                             | Yes        |
| `session`           | -                            | Session management                                                                                     | Yes        |
| `cognitive`         | -                            | Cognitive state                                                                                        | Yes        |

---

## 4. Infrastructure Gap Analysis

### Missing Verifier Infrastructure

| Surface       | Gap                                           | Required                  |
| ------------- | --------------------------------------------- | ------------------------- |
| Planning      | No way to verify plan structure in trajectory | `verify-plan.ts` script   |
| Tool Use      | No way to verify tool call sequences          | `verify-tools.ts` script  |
| Orchestration | No way to verify wave execution order         | `verify-waves.ts` script  |
| Resume        | No way to verify checkpoint/resume            | `verify-resume.ts` script |

### Missing ATIF Extensions

| Event Type             | Priority | Notes                                   |
| ---------------------- | -------- | --------------------------------------- |
| `wave-start/complete`  | High     | Critical for orchestration verification |
| `agent-start/complete` | High     | Critical for multi-agent verification   |
| `phase-start/complete` | Medium   | For phased plan verification            |
| `plan-selected`        | Medium   | For plan structure verification         |
| `pipeline:*`           | Low      | For lifecycle verification              |

### Missing Mock Infrastructure

| Service    | Current State                     | Required                          |
| ---------- | --------------------------------- | --------------------------------- |
| Linear API | HTTP stub in `runtime-fixture.ts` | Extend for GraphQL queries        |
| GitHub CLI | None                              | Mock `gh` JSON responses          |
| RAG        | Mock in `runtime-fixture.ts`      | Pre-seeded documents for fixtures |
| Browser    | None                              | Deterministic page content        |

### Missing Fixtures

| Fixture Type                | Complexity | Tasks                          |
| --------------------------- | ---------- | ------------------------------ |
| Large codebase (100+ files) | High       | `context-large`, `tool-search` |
| Git repo with remote        | Medium     | `tool-git`                     |
| Monorepo                    | High       | Future expansion               |
| Python project              | Medium     | Future expansion               |

---

## 5. Existing Test Pattern Inventory

### Test Kit Modules (`packages/test-kit/src/`)

| Module                        | Purpose                          | Reusable for Harbor                  |
| ----------------------------- | -------------------------------- | ------------------------------------ |
| `workflow/runtime-fixture.ts` | Workflow repo mocks, Linear stub | Yes - extend                         |
| `redis/index.ts`              | Redis env vars + mocks           | Yes                                  |
| `auth/token.ts`               | Auth token mocks                 | Yes                                  |
| `auth/session.ts`             | Session mocks                    | Yes                                  |
| `vcr/`                        | Record/replay HTTP               | Yes - for deterministic AI responses |
| `sandbox/`                    | Test sandbox utilities           | Yes                                  |
| `codex/`                      | Codex test utilities             | Partial                              |

### Mock Patterns

| Pattern          | Location             | Usage              |
| ---------------- | -------------------- | ------------------ |
| `mock.module()`  | `runtime-fixture.ts` | Module replacement |
| `vi.fn()`        | Throughout           | Function mocking   |
| HTTP stub server | `runtime-fixture.ts` | Linear API         |
| VCR cassettes    | `vcr/`               | HTTP replay        |
| Repo stubs       | `mock-db-client.ts`  | DB operations      |

### Fixture Patterns

| Pattern             | Location                       | Usage               |
| ------------------- | ------------------------------ | ------------------- |
| `tests.sig`         | `harbor/fixtures/*/workspace/` | Test file integrity |
| Workspace templates | `harbor/fixtures/`             | Task workspaces     |
| Minimal TS project  | `harbor/fixtures/failtest/`    | SWE-bench style     |

---

## 6. Checkpoint/Resume Testability

### Current State

- `PipelineSnapshot` captures state at stage boundaries
- `PipelineReconstructor` implements event sourcing
- `resume()` method in `PipelineRunner` supports resumption
- `hydrateTrackerContext()` supports wave-level resume

### Harbor Testability

| Scenario             | Testable | Notes                                         |
| -------------------- | -------- | --------------------------------------------- |
| Stage-level resume   | Yes      | Save snapshot, restore, verify skipped stages |
| Wave-level resume    | Yes      | Track `wave:*` events, verify hydration       |
| Context preservation | Yes      | Verify `contextEntries` restored              |
| Multi-agent resume   | Partial  | Need to simulate agent interruption           |

### Required Infrastructure

1. **Checkpoint injection** - Ability to pause execution mid-pipeline
2. **SIGTERM handling** - Graceful shutdown for container interruption
3. **Snapshot persistence** - Save/load from task directory
4. **Resume verification** - Check that skipped stages aren't re-executed

---

## 7. Summary: Coverage Gaps

### By Surface

| Surface          | Current Tasks | Missing Tasks         | Priority |
| ---------------- | ------------- | --------------------- | -------- |
| 1. Coding        | 6             | 2 (feature, refactor) | Medium   |
| 2. Planning      | 0             | 4                     | High     |
| 3. Tool Use      | 0             | 4                     | High     |
| 4. Safety        | 2             | 3                     | High     |
| 5. Context       | 1             | 4                     | Medium   |
| 6. Orchestration | 0             | 5                     | Critical |
| 7. Real-World    | 0             | 4                     | Medium   |
| 8. Failure Modes | 1             | 4                     | High     |

### By Infrastructure

| Component         | Status                  | Effort |
| ----------------- | ----------------------- | ------ |
| ATIF extensions   | Missing 10+ event types | Medium |
| Verifier scripts  | Missing 4 scripts       | Low    |
| Mock server       | Partial (Linear only)   | Medium |
| Fixture generator | Missing                 | Medium |
| Large fixtures    | Missing                 | High   |

---

## 8. Recommendations

### Phase 2 Priority Order

1. **ATIF Extensions** - Add wave/phase/agent/pipeline events to `buildAtifTrajectory`
2. **Verifier Scripts** - Create `verify-plan.ts`, `verify-tools.ts`, `verify-waves.ts`
3. **Mock Server** - Extend Linear stub, add GitHub CLI mock
4. **`@alfred/harbor` package** - Trajectory inspection library

### Phase 3 Priority Order

1. **Surface 6: Orchestration** - Critical for multi-agent verification
2. **Surface 2: Planning** - Validates decomposition quality
3. **Surface 4: Safety** - Validates constraint adherence
4. **Surface 3: Tool Use** - Validates tool invocation patterns
5. **Surface 8: Failure Modes** - Validates error handling
6. **Surface 5: Context** - Validates retrieval quality
7. **Surface 7: Real-World** - Validates integration
8. **Surface 1: Coding** - Expand existing coverage
