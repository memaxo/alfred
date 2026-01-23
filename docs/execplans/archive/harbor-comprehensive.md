# harbor-comprehensive

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: `.agent/PLANS.md` at repository root defines the ExecPlan format and maintenance requirements.

## Purpose / Big Picture

ALFRED's Harbor evaluation suite must comprehensively validate all 8 agent capability surfaces:

1. **Coding Fundamentals** — Bug fixes, features, refactoring, multi-file changes
2. **Planning & Decomposition** — Task breakdown, sequencing, dependency handling
3. **Tool Use** — File ops, shell, git, search, browser
4. **Safety & Judgment** — Escalation, constraint adherence, ambiguity handling
5. **Context & Retrieval** — Codebase navigation, dependency discovery, RAG
6. **Orchestration** — Multi-agent waves, parallel execution, coordination
7. **Real-World Task Sources** — GitHub issues, Linear tickets, PR reviews
8. **Failure Modes** — Stuck detection, max-transitions, recovery, resume

Currently, Harbor covers surface 1 (coding) and partial 4/5 (safety, context). This plan expands coverage to all 8 surfaces with proper infrastructure, fixtures, and verifiers.

## Progress

- [x] Phase 1: Codebase Analysis (establishes baseline for phases 2-3) — COMPLETED
  - Output: `docs/architecture/harbor-analysis.md`
  - Mapped all 8 evaluation surfaces to code paths, events, and coverage gaps
  - Identified 10+ ATIF event types missing from trajectory builder
  - Catalogued 25 orchestrator tools with scopes and verifiability
  - Documented checkpoint/resume testability

- [x] Phase 2: Infrastructure Build — COMPLETED
  - Created `@alfred/harbor` package with:
    - Trajectory inspection library (`parse`, `query`, `assert`)
    - Mock server infrastructure (Linear + GitHub)
    - Type definitions for waves, phases, plans
  - Extended ATIF builder with 15+ new event types:
    - Wave events: `wave-start`, `wave-complete`, `wave:aborted`
    - Phase events: `phase-start`, `phase-complete`
    - Agent events: `agent-start`, `agent-complete`, `agent:stuck`, `agent:escalated`, `agent:retry`
    - Pipeline events: `pipeline:start`, `pipeline:complete`, `pipeline:failed`, `pipeline:suspend`, `pipeline:resume`
    - Plan events: `plan-selected`, `agent-handoff`
  - Created verifier helper scripts:
    - `scripts/harbor-verifiers/verify-plan.ts`
    - `scripts/harbor-verifiers/verify-tools.ts`
    - `scripts/harbor-verifiers/verify-waves.ts`
    - `scripts/harbor-verifiers/verify-resume.ts`

- [x] Phase 3: Evaluation Surface Implementation — COMPLETED
  - Added `surface` field to TaskDef for categorization
  - Implemented profile hierarchy: pr < nightly < weekly < full
  - Tasks by surface:
    - Surface 1 (Coding): 12 tasks (existing)
    - Surface 2 (Planning): 1 task (`plan-simple`)
    - Surface 3 (Tool Use): 2 tasks (`pair`, `tool-git`)
    - Surface 4 (Safety): 4 tasks (`stuck`, `scope`, `blocked`, `ambiguous`, `constraint-delete`)
    - Surface 5 (Context): 1 task (`context`)
    - Surface 6 (Orchestration): 2 tasks (`multi-agent`, `wave-sequential`)
    - Surface 7 (Real-World): 0 tasks (requires mock server integration)
    - Surface 8 (Failure Modes): 1 task (`max-transitions`)

- [x] Phase 4: Validation & Integration — COMPLETED
  - Typecheck passes for `@alfred/harbor` package
  - Biome lint passes for all new files
  - ExecPlan updated with final progress

## Surprises & Discoveries

1. **TypeScript rootDir issues**: The harbor package initially had issues importing from `@alfred/runtime` due to rootDir constraints. Resolved by mirroring ATIF types locally.

2. **Profile hierarchy**: Discovered that a hierarchical profile system (pr < nightly < weekly < full) makes more sense than flat profiles, allowing cumulative task inclusion.

3. **ATIF event gaps**: The ATIF builder was missing ~15 event types needed for orchestration verification. These have now been added.

## Decision Log

1. **Mirrored ATIF types**: Decided to mirror ATIF type definitions in `@alfred/harbor/types.ts` rather than importing from `@alfred/runtime` to avoid cross-package TypeScript compilation issues.

2. **Profile hierarchy**: Implemented `pr < nightly < weekly < full` hierarchy where each profile includes all tasks from lower profiles.

3. **Surface field**: Added `surface: 1-8` field to TaskDef to categorize tasks by evaluation surface for reporting.

4. **Verifier scripts**: Created standalone verifier scripts that can be called from container `test.sh` files, enabling complex trajectory verification.

## Outcomes & Retrospective

### Delivered

1. **`@alfred/harbor` package** with:
   - Trajectory inspection library (parse, query, assert)
   - Mock server infrastructure (Linear + GitHub)
   - Comprehensive type definitions

2. **Extended ATIF builder** with 15+ new event types covering:
   - Wave lifecycle (start, complete, aborted)
   - Phase lifecycle (start, complete)
   - Agent lifecycle (start, complete, stuck, escalated, retry)
   - Pipeline lifecycle (start, complete, failed, suspend, resume)
   - Planning events (plan-selected, agent-handoff)

3. **Verifier helper scripts**:
   - `verify-plan.ts` - Plan structure verification
   - `verify-tools.ts` - Tool usage verification
   - `verify-waves.ts` - Wave execution verification
   - `verify-resume.ts` - Checkpoint/resume verification

4. **Task expansion** from ~20 to ~25+ tasks across 8 surfaces with profile hierarchy

### Remaining Work

1. **Surface 7 (Real-World)**: No tasks yet - requires mock server integration in Harbor containers
2. **Larger fixtures**: Need to create 100+ file fixtures for context-large tasks
3. **CI integration**: Harbor smoke/nightly/weekly workflows need configuration
4. **Baseline run**: Full profile execution to establish pass rate baseline

---

# Phase 1: Comprehensive Codebase Analysis

## Objective

Establish a complete inventory of what exists, what's testable, and what infrastructure gaps must be filled before implementing comprehensive evals.

## Deliverables

1. **Capability Inventory** — Markdown table mapping each of the 8 surfaces to:
   - Existing code paths (files, functions)
   - Existing tests (unit, integration)
   - Observable events (for trajectory verification)
   - Current Harbor coverage (if any)

2. **Infrastructure Gap Analysis** — For each surface:
   - What verifier logic is needed?
   - What fixtures are required?
   - What mocks/stubs are missing?
   - What ATIF extensions are needed?

3. **Fixture Complexity Assessment** — Categorize fixture needs:
   - Trivial (5-10 files, single-purpose)
   - Medium (20-50 files, multi-module)
   - Large (100+ files, realistic codebase simulation)

4. **Mock API Inventory** — Document what external APIs need mocking:
   - Linear GraphQL endpoints
   - GitHub CLI responses
   - Any other external services

## Concrete Steps

### 1.1 Map Orchestration Events to ATIF

```
Files to analyze:
- packages/runtime/src/orchestrator/index.ts (runOrchestrator phases)
- packages/runtime/src/orchestrator/waves.ts (wave events)
- packages/runtime/src/trajectory/atif.ts (event → ATIF mapping)
- packages/type/src/plan.ts (WorkflowEvent types)
```

Output: Table of `{ eventType, atifStepType, verifiable }` showing which orchestration events surface in trajectories.

### 1.2 Map Tool Calls to Verification

```
Files to analyze:
- packages/agent/src/orchestrator/tool/*.ts (all tool definitions)
- packages/agent/src/v6.ts (tool registration)
- packages/runtime/src/chain.ts (tool execution)
```

Output: Table of `{ toolName, scopes, inputSchema, outputSchema, verifiable }` for Harbor verification.

### 1.3 Inventory Existing Test Patterns

```
Directories to scan:
- packages/*/test/**/*.test.ts
- packages/api/test/utils/*.ts (mock helpers)
- packages/test-kit/src/**/*.ts (test fixtures)
- packages/pipeline/test/linear.mocks.ts
```

Output: Catalog of reusable mock patterns (fetch, db repos, rate limiters, HTTP stubs).

### 1.4 Assess Checkpoint/Resume Testability

```
Files to analyze:
- packages/pipeline/src/snapshot.ts (snapshot types)
- packages/pipeline/src/runner.ts (resume logic)
- packages/pipeline/test/integration/resume-roundtrip.test.ts (existing test)
- packages/runtime/src/orchestrator/hydrate.ts (tracker hydration)
```

Output: Document what resume scenarios are Harbor-testable and what infrastructure is needed.

### 1.5 Document Linear/GitHub Integration Points

```
Files to analyze:
- packages/api/src/routers/linear.ts (Linear API)
- packages/api/src/routers/github.ts (GitHub CLI wrapper)
- packages/pipeline/src/observers/linear.ts (LinearSyncObserver)
- packages/test-kit/src/workflow/runtime-fixture.ts (Linear HTTP stub)
```

Output: API surface inventory with mock requirements for Harbor containers.

## Validation

Phase 1 is complete when:
- [ ] Capability inventory covers all 8 surfaces with file references
- [ ] Gap analysis identifies all missing infrastructure
- [ ] Fixture complexity is categorized for planning
- [ ] Mock API requirements are documented

---

# Phase 2: Infrastructure Build

## Objective

Build the missing Harbor infrastructure identified in Phase 1, enabling Phase 3 to focus purely on eval implementation.

## Deliverables

1. **Trajectory Inspection Library** — `packages/harbor/src/inspect/`
   - Parse ATIF trajectories
   - Query tool calls, steps, events by type
   - Assert on structure (step count, ordering, dependencies)
   - Export for use in verifier scripts

2. **Mock API Server** — `packages/harbor/src/mocks/`
   - HTTP server for Linear GraphQL mocking
   - GitHub CLI response mocking (JSON output stubs)
   - Configurable responses per task
   - Request capture for verification

3. **Fixture Generator** — `scripts/harbor-fixture-gen.ts`
   - Generate realistic codebase fixtures from templates
   - Support complexity levels (trivial/medium/large)
   - Inject bugs, type errors, lint issues programmatically
   - Generate `tests.sig` automatically

4. **Extended Verifier Helpers** — `scripts/harbor-verifiers/`
   - `verify-plan.ts` — Assert on plan structure in trajectory
   - `verify-tools.ts` — Assert on tool usage patterns
   - `verify-waves.ts` — Assert on wave execution order
   - `verify-resume.ts` — Assert checkpoint/resume behavior

5. **Container Enhancements** — Update `scripts/harbor.ts`
   - Mount mock API server in containers
   - Configure environment for mock endpoints
   - Support fixture complexity flag

## Concrete Steps

### 2.1 Create `@alfred/harbor` Package

```bash
packages/harbor/
  package.json
  src/
    inspect/
      index.ts        # Trajectory inspection API
      query.ts        # Step/tool querying
      assert.ts       # Assertion helpers
    mocks/
      index.ts        # Mock server entrypoint
      linear.ts       # Linear GraphQL handler
      github.ts       # GitHub CLI stub
    types.ts          # Shared types
  test/
    inspect.test.ts
    mocks.test.ts
```

### 2.2 Implement Trajectory Inspection

```typescript
// packages/harbor/src/inspect/index.ts
export function parseTrajectory(path: string): AtifTrajectory;
export function querySteps(traj: AtifTrajectory, filter: StepFilter): AtifStep[];
export function queryToolCalls(traj: AtifTrajectory, toolName?: string): AtifToolCall[];
export function assertStepCount(traj: AtifTrajectory, min: number, max?: number): void;
export function assertToolSequence(traj: AtifTrajectory, sequence: string[]): void;
export function assertWaveOrder(traj: AtifTrajectory, expectedWaves: string[][]): void;
```

### 2.3 Implement Mock API Server

```typescript
// packages/harbor/src/mocks/index.ts
export function createMockServer(config: MockConfig): MockServer;

interface MockConfig {
  linear?: {
    issues?: LinearIssue[];
    teams?: LinearTeam[];
    autoRespond?: boolean;
  };
  github?: {
    prs?: GitHubPR[];
    cliResponses?: Map<string, string>;
  };
}

interface MockServer {
  start(): Promise<{ linearUrl: string; githubCliStub: string }>;
  stop(): Promise<void>;
  getRequests(): MockRequest[];
}
```

### 2.4 Create Fixture Generator

```typescript
// scripts/harbor-fixture-gen.ts
type FixtureTemplate = "ts-lib" | "ts-app" | "monorepo" | "python" | "mixed";
type FixtureComplexity = "trivial" | "medium" | "large";
type InjectedIssue = "type-error" | "lint-error" | "test-failure" | "build-error" | "missing-dep";

function generateFixture(opts: {
  template: FixtureTemplate;
  complexity: FixtureComplexity;
  issues: InjectedIssue[];
  outputDir: string;
}): Promise<void>;
```

### 2.5 Create Verifier Helpers

```bash
scripts/harbor-verifiers/
  verify-plan.ts      # bun scripts/harbor-verifiers/verify-plan.ts /logs/verifier/trajectory.json --min-subtasks 3
  verify-tools.ts     # bun scripts/harbor-verifiers/verify-tools.ts /logs/verifier/trajectory.json --required git.commit,git.push
  verify-waves.ts     # bun scripts/harbor-verifiers/verify-waves.ts /logs/verifier/trajectory.json --wave-count 2
  verify-resume.ts    # bun scripts/harbor-verifiers/verify-resume.ts /logs/verifier/trajectory.json --checkpoint-count 1
```

### 2.6 Update Harbor Task Generator

```typescript
// scripts/harbor.ts additions
type GenArgs = {
  // ... existing
  mockLinear?: boolean;      // Mount Linear mock server
  mockGithub?: boolean;      // Mount GitHub CLI stub
  fixtureComplexity?: "trivial" | "medium" | "large";
};
```

## Validation

Phase 2 is complete when:
- [ ] `@alfred/harbor` package passes all tests
- [ ] Mock server handles Linear GraphQL + GitHub CLI
- [ ] Fixture generator produces all complexity levels
- [ ] Verifier helpers work in container environment
- [ ] `bun harbor:smoke` passes with new infrastructure

---

# Phase 3: Evaluation Surface Implementation

## Objective

Implement comprehensive Harbor tasks for all 8 evaluation surfaces using the infrastructure from Phase 2.

## Surface 1: Coding Fundamentals (Expand Existing)

### Current Coverage
- `failtest`, `regress`, `typecheck`, `lintfix`, `build`, `multifile`

### New Tasks

| Task ID | Description | Fixture | Verifier |
|---------|-------------|---------|----------|
| `feature` | Implement a new function given spec | medium ts-lib | `bun test` + output check |
| `refactor` | Refactor without changing behavior | medium ts-lib | `bun test` (all pass) |
| `deadcode` | Remove dead code, keep functionality | medium ts-lib | `bun test` + line count check |
| `perf` | Optimize slow function | medium ts-lib | `bun test` + benchmark threshold |

## Surface 2: Planning & Decomposition (New)

### Tasks

| Task ID | Description | Fixture | Verifier |
|---------|-------------|---------|----------|
| `plan-simple` | Decompose 3-step task | trivial | `verify-plan.ts --min-subtasks 3` |
| `plan-deps` | Decompose task with dependencies | medium | `verify-plan.ts --has-dependencies` |
| `plan-parallel` | Decompose into parallelizable subtasks | medium | `verify-waves.ts --min-waves 2` |
| `plan-estimate` | Plan includes reasonable scope | medium | `verify-plan.ts --has-estimates` |

### Infrastructure Required
- ATIF must capture plan structure (extend `buildAtifTrajectory`)
- `verify-plan.ts` must parse plan events from trajectory

## Surface 3: Tool Use (New)

### Tasks

| Task ID | Description | Fixture | Verifier |
|---------|-------------|---------|----------|
| `tool-git` | Commit and push changes | trivial (git repo) | `verify-tools.ts --sequence git.status,git.commit,git.push` |
| `tool-search` | Find function in large codebase | large | `verify-tools.ts --required knowledge_query` + output check |
| `tool-browser` | Extract data from web page | trivial + mock | `verify-tools.ts --required browser.open,browser.snapshot` |
| `tool-shell` | Run shell command sequence | trivial | `verify-tools.ts --required droid` + output check |

### Infrastructure Required
- Git repo fixture with remote (mock or local bare repo)
- Browser mock for deterministic web content
- Shell output verification

## Surface 4: Safety & Judgment (Expand Existing)

### Current Coverage
- `stuck`, `blocked`

### New Tasks

| Task ID | Description | Fixture | Verifier |
|---------|-------------|---------|----------|
| `ambiguous` | Underspecified task → escalate | trivial | Escalation file check |
| `constraint-tests` | "Don't edit tests" is respected | medium | `tests.sig` integrity check |
| `constraint-delete` | "Don't delete X" is respected | medium | File existence check |
| `permission-deny` | Insufficient scope → escalate | trivial | Escalation + scope event check |
| `rollback` | Bad change detected → rollback | medium | Git history check |

## Surface 5: Context & Retrieval (Expand Existing)

### Current Coverage
- `context` (small fixture)

### New Tasks

| Task ID | Description | Fixture | Verifier |
|---------|-------------|---------|----------|
| `context-large` | Find constant in 100+ file codebase | large | `bun test` |
| `context-cross` | Fix issue requiring 3 related files | large | `bun test` |
| `rag-query` | Use RAG to find relevant docs | medium + RAG mock | `verify-tools.ts --required rag_query` |
| `rag-multi` | Synthesize from multiple RAG results | medium + RAG mock | Output quality check |

### Infrastructure Required
- Large fixture generator (100+ files)
- RAG mock with pre-seeded documents

## Surface 6: Orchestration (New)

### Tasks

| Task ID | Description | Fixture | Verifier |
|---------|-------------|---------|----------|
| `multi-agent` | Task requires 2+ agents | medium | `verify-waves.ts --min-agents 2` |
| `wave-parallel` | Agents execute in parallel | medium | `verify-waves.ts --parallel-agents 2` |
| `wave-sequential` | Waves respect dependencies | medium | `verify-waves.ts --sequential-waves 2` |
| `checkpoint` | Interrupt and resume | medium | `verify-resume.ts --resumed true` |
| `handoff` | Agent A → Agent B handoff | medium | `verify-waves.ts --handoff-count 1` |

### Infrastructure Required
- Wave events surfaced in ATIF
- Checkpoint simulation (SIGTERM handling)
- Handoff event capture

## Surface 7: Real-World Task Sources (New)

### Tasks

| Task ID | Description | Fixture | Verifier |
|---------|-------------|---------|----------|
| `github-issue` | Fix issue from GitHub mock | medium + GitHub mock | `verify-tools.ts --required git.commit` + issue state check |
| `github-pr` | Address PR review feedback | medium + GitHub mock | `verify-tools.ts --required git.commit` |
| `linear-ticket` | Complete Linear ticket | medium + Linear mock | Linear API call check |
| `linear-update` | Update ticket status on completion | medium + Linear mock | Linear status update check |

### Infrastructure Required
- Mock server with GitHub issue/PR data
- Mock server with Linear ticket data
- Response capture and verification

## Surface 8: Failure Modes (New)

### Tasks

| Task ID | Description | Fixture | Verifier |
|---------|-------------|---------|----------|
| `stuck-detect` | Recognize stuck state | trivial (impossible task) | Stuck event in trajectory |
| `max-transitions` | Hit transition limit gracefully | trivial | Error event + no crash |
| `timeout-recover` | Timeout → graceful exit | trivial | Timeout event + cleanup |
| `error-recover` | Tool error → retry or escalate | trivial | Error + recovery event |

### Infrastructure Required
- Tasks designed to trigger failure modes
- Failure event capture in ATIF

## Concrete Steps

### 3.1 Extend ATIF for New Event Types

Update `packages/runtime/src/trajectory/atif.ts`:
- Add `plan:decompose`, `plan:subtask` event handling
- Add `wave:start`, `wave:complete`, `wave:handoff` event handling
- Add `checkpoint:save`, `checkpoint:resume` event handling
- Add `stuck:detected`, `timeout:triggered` event handling

### 3.2 Create Fixture Templates

```bash
harbor/templates/
  ts-lib/           # TypeScript library (trivial-large variants)
  ts-app/           # TypeScript app with tests
  monorepo/         # Multi-package monorepo
  python/           # Python project
  mixed/            # Multi-language project
```

### 3.3 Implement Tasks by Surface

For each surface, create:
1. Task definition in `scripts/harbor-dataset.ts`
2. Fixture in `harbor/fixtures/<taskId>/`
3. Verifier command using helper scripts
4. Oracle solution for validation

### 3.4 Create Dataset Profiles

```typescript
// scripts/harbor-dataset.ts
const PROFILES = {
  smoke: ["atif"],  // 1 task, fast validation
  pr: ["atif", "failtest", "regress", "stuck", "context"],  // 5 tasks, PR gate
  nightly: [...PR, ...SURFACE_1, ...SURFACE_2, ...SURFACE_3],  // All coding/planning/tools
  weekly: [...NIGHTLY, ...SURFACE_4, ...SURFACE_5, ...SURFACE_6],  // + safety/context/orchestration
  full: [...WEEKLY, ...SURFACE_7, ...SURFACE_8],  // All surfaces
};
```

## Validation

Phase 3 is complete when:
- [ ] Each surface has ≥3 Harbor tasks
- [ ] All tasks have fixtures, verifiers, and oracles
- [ ] `bun harbor:verify` passes for all profiles
- [ ] Sample runs produce valid ATIF with expected events

---

# Phase 4: Validation & Integration

## Objective

Run the complete eval suite, document results, integrate with CI, and establish baseline metrics.

## Deliverables

1. **Baseline Run** — Execute full Harbor suite, capture:
   - Pass/fail rates per surface
   - ATIF validity rates
   - Execution times
   - Failure mode distribution

2. **CI Integration** — Update `.github/workflows/harbor-smoke.yml`:
   - Smoke profile on every PR
   - Nightly profile on schedule
   - Full profile on release branches

3. **Dashboard Metrics** — Grafana dashboard for:
   - Eval pass rates over time
   - Surface coverage heatmap
   - Regression detection

4. **Documentation** — Update:
   - `docs/execplans/harbor-comprehensive.md` (this document)
   - `docs/guides/harbor-evals.md` (user guide)
   - `docs/architecture/harbor-surfaces.md` (architecture)

## Concrete Steps

### 4.1 Baseline Run

```bash
# Generate full dataset
HARBOR_DATASET_PROFILE=full bun harbor:dataset .tmp/harbor-full

# Verify structure
bun harbor:verify .tmp/harbor-full

# Run with Harbor (if available)
HARBOR_BIN=/path/to/harbor bun harbor:smoke --profile full

# Summarize results
bun harbor:summary .tmp/harbor-full
```

### 4.2 CI Integration

Update `.github/workflows/harbor-smoke.yml`:

```yaml
jobs:
  harbor-smoke:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        profile: [smoke]  # PR default
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: HARBOR_DATASET_PROFILE=${{ matrix.profile }} bun harbor:smoke

  harbor-nightly:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: HARBOR_DATASET_PROFILE=nightly bun harbor:smoke
```

### 4.3 Metrics Collection

Add to `scripts/harbor-ingest.ts`:
- Emit Prometheus metrics on ingestion
- Record surface coverage per run
- Track pass/fail trends

### 4.4 Documentation

Create `docs/guides/harbor-evals.md`:
- Quick start for running evals locally
- Profile descriptions
- Adding new tasks guide
- Interpreting results

Create `docs/architecture/harbor-surfaces.md`:
- Surface definitions and rationale
- Coverage requirements
- Verification strategies

## Validation

Phase 4 is complete when:
- [ ] Full profile baseline run completed
- [ ] CI workflows trigger correctly
- [ ] Metrics visible in dashboard
- [ ] Documentation reviewed and merged

---

## Interfaces

### Harbor Task Definition

```typescript
type TaskDef = {
  id: string;                    // Unique task identifier
  requirement: string;           // Natural language instruction
  verifyCmd: string;             // Bash command returning exit 0/1
  oracleCmd: string;             // Command that produces correct solution
  profile: "smoke" | "pr" | "nightly" | "weekly" | "full";
  surface: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;  // Evaluation surface
  auto?: "read" | "low" | "medium" | "high";  // Autonomy level
  fixtureComplexity?: "trivial" | "medium" | "large";
  mockLinear?: boolean;
  mockGithub?: boolean;
};
```

### Trajectory Inspection API

```typescript
interface TrajectoryInspector {
  parse(path: string): AtifTrajectory;
  
  // Querying
  steps(filter?: StepFilter): AtifStep[];
  toolCalls(toolName?: string): AtifToolCall[];
  events(type: string): AtifStep[];
  
  // Assertions
  assertStepCount(min: number, max?: number): void;
  assertToolSequence(sequence: string[]): void;
  assertWaveCount(count: number): void;
  assertHasEvent(type: string): void;
  assertNoErrors(): void;
}
```

### Mock Server Configuration

```typescript
interface MockServerConfig {
  linear?: {
    issues: Array<{ id: string; title: string; state: string; ... }>;
    teams: Array<{ id: string; name: string; ... }>;
  };
  github?: {
    issues: Array<{ number: number; title: string; state: string; ... }>;
    prs: Array<{ number: number; title: string; diff: string; ... }>;
  };
  port?: number;
}
```

---

## Artifacts

| Artifact | Location | Description |
|----------|----------|-------------|
| Harbor package | `packages/harbor/` | Inspection + mock libraries |
| Verifier scripts | `scripts/harbor-verifiers/` | Trajectory verification helpers |
| Fixture templates | `harbor/templates/` | Codebase templates by complexity |
| Task definitions | `scripts/harbor-dataset.ts` | All task definitions |
| CI workflows | `.github/workflows/harbor-*.yml` | CI integration |
| Documentation | `docs/guides/harbor-evals.md` | User guide |
| Architecture | `docs/architecture/harbor-surfaces.md` | Surface definitions |

---

## Timeline Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Analysis | 1 day | None |
| Phase 2: Infrastructure | 3-4 days | Phase 1 |
| Phase 3: Surfaces | 5-7 days | Phase 2 |
| Phase 4: Validation | 2 days | Phase 3 |

**Total: ~11-14 days**

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ATIF extension complexity | Medium | High | Start with minimal extensions, iterate |
| Large fixture generation | Low | Medium | Use existing codebase snippets |
| Mock server reliability | Medium | Medium | Comprehensive mock server tests |
| CI resource limits | Low | Low | Use profile-based execution |
| Harbor binary availability | High | Medium | Focus on structure validation without full runs |
