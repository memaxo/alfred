# TUI Package Linear Issue Breakdown

**ExecPlan**: `docs/execplans/tui-package-ideation.md`  
**Total Estimated Effort**: 6-7 weeks  
**Priority**: P2 (High)  
**Owner**: infra

---

## Issue Structure Summary

```
Epic (1)
├── Phase 0: Debugger Foundations (1 phase issue + 9 task issues)
├── Phase 0.5: Better Auth Setup (1 phase issue + 8 task issues)
├── Phase 1: CLI Foundation (1 phase issue + 7 task issues)
├── Phase 2: TUI Core (1 phase issue + 5 task issues)
├── Phase 3: Package Panels (1 phase issue + 5 task issues)
├── Phase 4: Interactive Modes (1 phase issue + 3 task issues)
├── Phase 5: Package Integration (1 phase issue + 4 task issues)
└── Phase 6: MCP Integration (1 phase issue + 5 task issues)

Total: 1 Epic + 8 Phase Issues + 46 Task Issues = 55 Linear Issues
```

---

## Required Linear Metadata

### Epic Level

| Field | Value | Notes |
|-------|-------|-------|
| **Title** | `Epic: TUI Package — Unified CLI/TUI Infrastructure` | |
| **Description** | Full ExecPlan summary + link to `docs/execplans/tui-package-ideation.md` | |
| **Team** | `Alfred-ops` | |
| **Project** | `ExecPlans Tracking` | Links to ExecPlans Tracking project |
| **Priority** | `High` (P2) | |
| **Status** | `Backlog` → `Todo` → `In Progress` → `Done` | |
| **Labels** | `["epic", "infrastructure", "Feature"]` | |
| **Estimate** | `13` (Fibonacci: large epic) | |
| **Assignee** | `Jack M` (or infra owner) | |
| **Delegate** | `Cursor` | For AI assistance |
| **Due Date** | 7 weeks from start | |

### Phase Issue Level

| Field | Value | Notes |
|-------|-------|-------|
| **Title** | `Phase N: [Phase Name]` | e.g., "Phase 0: Debugger Foundations" |
| **Description** | Phase checklist + dependencies | |
| **Team** | `Alfred-ops` | |
| **Project** | `ExecPlans Tracking` | |
| **Priority** | `High` (P2) | |
| **Status** | `Backlog` → `Todo` → `In Progress` → `Done` | |
| **Labels** | `["infrastructure"]` + phase-specific labels | |
| **Estimate** | `5` or `8` (Fibonacci) | Based on task count |
| **Parent** | Epic issue ID | Links to parent epic |
| **Blocks** | Next phase issue ID | Sequential dependencies |
| **Assignee** | `Jack M` | |
| **Delegate** | `Cursor` | |

### Task Issue Level

| Field | Value | Notes |
|-------|-------|-------|
| **Title** | Specific task description | e.g., "Add parentId to EventEnvelope" |
| **Description** | Task details + acceptance criteria | |
| **Team** | `Alfred-ops` | |
| **Project** | `ExecPlans Tracking` | |
| **Priority** | `High` or `Medium` | Based on phase priority |
| **Status** | `Backlog` → `Todo` → `In Progress` → `Done` | |
| **Labels** | `["infrastructure"]` + domain labels | e.g., `["database"]` for migrations |
| **Estimate** | `1`, `2`, `3`, or `5` (Fibonacci) | Most tasks: 1-2 points |
| **Parent** | Phase issue ID | Links to parent phase |
| **Blocks** | Dependent task IDs | If any |
| **Assignee** | `Jack M` | |
| **Delegate** | `Cursor` | |

---

## Detailed Issue Breakdown

### Epic: TUI Package

**Issue**: `Epic: TUI Package — Unified CLI/TUI Infrastructure`

**Metadata**:
- **Estimate**: `13` (large epic)
- **Labels**: `["epic", "infrastructure", "Feature"]`
- **Description**: Link to ExecPlan + summary

---

### Phase 0: Debugger Foundations (Week 0-1)

**Phase Issue**: `Phase 0: Debugger Foundations`

**Metadata**:
- **Estimate**: `8` (9 tasks, foundational work)
- **Labels**: `["infrastructure", "database", "cognitive"]`
- **Blocks**: Phase 0.5, Phase 1

**Task Issues** (9 total):

1. **Add `parentId`, `seq`, `source` to `EventEnvelope`**
   - Estimate: `2`
   - Labels: `["infrastructure"]`
   - Files: `packages/type/src/envelope.ts`

2. **Create `@alfred/type/events.ts` consolidating event types**
   - Estimate: `3`
   - Labels: `["infrastructure"]`
   - Consolidates: `cognitive/state/types.ts`, `plan.ts`, `stream.ts`, `voice.ts`

3. **Consolidate duplicate `makeEventId` implementations**
   - Estimate: `2`
   - Labels: `["infrastructure"]`
   - Files: `packages/api/src/utils/event-id.ts`, `packages/agent/src/utils/event-id.ts`

4. **Add `parentId` column to `workflow_events` (migration)**
   - Estimate: `2`
   - Labels: `["database", "infrastructure"]`
   - Migration: `packages/db/migrations/XXXX_add_parent_id_to_workflow_events.sql`

5. **Add `seq` column to `workflow_events` (migration)**
   - Estimate: `2`
   - Labels: `["database", "infrastructure"]`
   - Migration: `packages/db/migrations/XXXX_add_seq_to_workflow_events.sql`

6. **Create `workflow_snapshots` table (migration)**
   - Estimate: `3`
   - Labels: `["database", "infrastructure"]`
   - Migration: `packages/db/migrations/XXXX_create_workflow_snapshots.sql`

7. **Extract `StateReconstructor` interface from cognitive loop**
   - Estimate: `3`
   - Labels: `["infrastructure", "cognitive"]`
   - Files: `packages/type/src/reconstruct.ts`, `packages/runtime/src/loops/cognitive.ts`

8. **Export `stableStringify` from `@alfred/type`**
   - Estimate: `1`
   - Labels: `["infrastructure"]`
   - Files: `packages/type/src/serialize.ts`

9. **Migrate discriminants: `WorkflowEvent`, `StreamEvent`, `VoiceStreamServerEvent` from `type` to `_`**
   - Estimate: `5`
   - Labels: `["infrastructure"]`
   - Files: `packages/type/src/plan.ts`, `packages/type/src/stream.ts`, `packages/type/src/voice.ts`

**Total Phase 0 Estimate**: `23` points (sum of tasks)

---

### Phase 0.5: Better Auth Setup (Week 0-1)

**Phase Issue**: `Phase 0.5: Better Auth Setup`

**Metadata**:
- **Estimate**: `8` (8 tasks, auth integration)
- **Labels**: `["infrastructure", "api", "security"]`
- **Blocks**: Phase 1
- **Can run parallel with Phase 0**: Yes

**Task Issues** (8 total):

1. **Add `deviceAuthorization` plugin to `@alfred/auth`**
   - Estimate: `3`
   - Labels: `["infrastructure", "security"]`
   - Files: `packages/auth/src/index.ts`

2. **Add `oauthProvider` + `jwt` plugins for MCP support**
   - Estimate: `3`
   - Labels: `["infrastructure", "security"]`
   - Files: `packages/auth/src/index.ts`

3. **Create `/device` verification page in `apps/web`**
   - Estimate: `2`
   - Labels: `["ui", "infrastructure"]`
   - Files: `apps/web/src/routes/device.tsx`

4. **Create `/consent` page for OAuth consent**
   - Estimate: `2`
   - Labels: `["ui", "infrastructure"]`
   - Files: `apps/web/src/routes/consent.tsx`

5. **Create `/elevate` page for biometric step-up**
   - Estimate: `2`
   - Labels: `["ui", "infrastructure", "security"]`
   - Files: `apps/web/src/routes/elevate.tsx`

6. **Run `npx @better-auth/cli migrate` for new tables**
   - Estimate: `1`
   - Labels: `["database", "infrastructure"]`

7. **Add `.well-known/oauth-authorization-server` endpoint**
   - Estimate: `2`
   - Labels: `["api", "infrastructure"]`
   - Files: `apps/web/src/routes/.well-known/oauth-authorization-server.ts`

8. **Test device authorization flow end-to-end**
   - Estimate: `3`
   - Labels: `["testing", "infrastructure"]`
   - Files: `packages/tui/test/auth.test.ts`

**Total Phase 0.5 Estimate**: `18` points

---

### Phase 1: CLI Foundation (Week 1-2)

**Phase Issue**: `Phase 1: CLI Foundation`

**Metadata**:
- **Estimate**: `8` (7 tasks, core CLI)
- **Labels**: `["infrastructure", "Feature"]`
- **Blocks**: Phase 2

**Task Issues** (7 total):

1. **Create `packages/tui` package structure**
   - Estimate: `2`
   - Labels: `["infrastructure"]`
   - Files: `packages/tui/package.json`, `tsconfig.json`, `src/index.ts`

2. **Integrate `trpc-cli` with `appRouter`**
   - Estimate: `5`
   - Labels: `["infrastructure", "api"]`
   - Files: `packages/tui/src/cli/index.ts`

3. **Implement Device Authorization login flow**
   - Estimate: `3`
   - Labels: `["infrastructure", "security"]`
   - Files: `packages/tui/src/cli/auth.ts`

4. **Implement credential storage (`~/.alfred/credentials.json`)**
   - Estimate: `2`
   - Labels: `["infrastructure", "security"]`
   - Files: `packages/tui/src/cli/credentials.ts`

5. **Implement biometric elevation with polling**
   - Estimate: `3`
   - Labels: `["infrastructure", "security"]`
   - Files: `packages/tui/src/cli/biometric.ts`

6. **Add tab completion via omelette**
   - Estimate: `3`
   - Labels: `["infrastructure"]`
   - Files: `packages/tui/src/cli/completions.ts`

7. **Create `alfred --help` and procedure discovery**
   - Estimate: `2`
   - Labels: `["infrastructure"]`
   - Files: `packages/tui/src/cli/index.ts`

**Total Phase 1 Estimate**: `20` points

---

### Phase 2: TUI Core (Week 2-3)

**Phase Issue**: `Phase 2: TUI Core`

**Metadata**:
- **Estimate**: `5` (5 tasks, TUI infrastructure)
- **Labels**: `["infrastructure", "ui", "Feature"]`
- **Blocks**: Phase 3

**Task Issues** (5 total):

1. **Integrate `@opentui/core`**
   - Estimate: `3`
   - Labels: `["infrastructure", "ui"]`
   - Files: `packages/tui/src/tui/renderer.ts`

2. **Create base panel system**
   - Estimate: `5`
   - Labels: `["infrastructure", "ui"]`
   - Files: `packages/tui/src/tui/panels/base.ts`

3. **Implement main dashboard layout**
   - Estimate: `5`
   - Labels: `["infrastructure", "ui"]`
   - Files: `packages/tui/src/tui/views/dashboard.ts`

4. **Add keyboard navigation**
   - Estimate: `3`
   - Labels: `["infrastructure", "ui"]`
   - Files: `packages/tui/src/tui/layout.ts`

5. **Real-time updates via tRPC subscriptions**
   - Estimate: `5`
   - Labels: `["infrastructure", "api", "ui"]`
   - Files: `packages/tui/src/tui/index.ts`

**Total Phase 2 Estimate**: `21` points

---

### Phase 3: Package Panels (Week 3-4)

**Phase Issue**: `Phase 3: Package Panels`

**Metadata**:
- **Estimate**: `8` (5 panels, substantial UI work)
- **Labels**: `["infrastructure", "ui", "Feature"]`
- **Blocks**: Phase 4

**Task Issues** (5 total):

1. **CognitiveStatePanel**
   - Estimate: `5`
   - Labels: `["infrastructure", "ui", "cognitive"]`
   - Files: `packages/tui/src/tui/panels/cognitive.ts`

2. **WorkflowPanel**
   - Estimate: `5`
   - Labels: `["infrastructure", "ui"]`
   - Files: `packages/tui/src/tui/panels/workflow.ts`

3. **MetricsPanel**
   - Estimate: `3`
   - Labels: `["infrastructure", "ui"]`
   - Files: `packages/tui/src/tui/panels/metrics.ts`

4. **VoicePanel**
   - Estimate: `5`
   - Labels: `["infrastructure", "ui", "voice"]`
   - Files: `packages/tui/src/tui/panels/voice.ts`

5. **KnowledgePanel**
   - Estimate: `5`
   - Labels: `["infrastructure", "ui", "knowledge-graph"]`
   - Files: `packages/tui/src/tui/panels/knowledge.ts`

**Total Phase 3 Estimate**: `23` points

---

### Phase 4: Interactive Modes (Week 4-5)

**Phase Issue**: `Phase 4: Interactive Modes`

**Metadata**:
- **Estimate**: `5` (3 modes, interactive features)
- **Labels**: `["infrastructure", "ui", "Feature"]`
- **Blocks**: Phase 5

**Task Issues** (3 total):

1. **Chat mode (`alfred tui chat`)**
   - Estimate: `5`
   - Labels: `["infrastructure", "ui"]`
   - Files: `packages/tui/src/tui/views/chat.ts`

2. **Planning mode (`alfred tui plan`)**
   - Estimate: `5`
   - Labels: `["infrastructure", "ui", "plan"]`
   - Files: `packages/tui/src/tui/views/plan.ts`

3. **Debug console (`alfred tui debug`)**
   - Estimate: `8`
   - Labels: `["infrastructure", "ui"]`
   - Files: `packages/tui/src/debug/index.ts` (see ExecPlan debugger section)

**Total Phase 4 Estimate**: `18` points

---

### Phase 5: Package Integration (Week 5-6)

**Phase Issue**: `Phase 5: Package Integration`

**Metadata**:
- **Estimate**: `5` (4 tasks, integration work)
- **Labels**: `["infrastructure", "Feature"]`
- **Blocks**: Phase 6

**Task Issues** (4 total):

1. **Define `CliManifest` interface**
   - Estimate: `2`
   - Labels: `["infrastructure"]`
   - Files: `packages/tui/src/registry/manifest.ts`

2. **Update all packages with manifests**
   - Estimate: `8`
   - Labels: `["infrastructure"]`
   - Files: `packages/*/src/cli.ts` (23 packages)

3. **Auto-discovery system**
   - Estimate: `5`
   - Labels: `["infrastructure"]`
   - Files: `packages/tui/src/registry/discover.ts`

4. **Documentation**
   - Estimate: `3`
   - Labels: `["documentation", "infrastructure"]`
   - Files: `packages/tui/README.md`, `docs/guides/tui.md`

**Total Phase 5 Estimate**: `18` points

---

### Phase 6: MCP Integration (Week 6-7)

**Phase Issue**: `Phase 6: MCP Integration`

**Metadata**:
- **Estimate**: `5` (5 tasks, OAuth/MCP)
- **Labels**: `["infrastructure", "security", "Feature"]`

**Task Issues** (5 total):

1. **Define MCP client scopes (`read:*`, `write:*`, `admin:*`)**
   - Estimate: `2`
   - Labels: `["infrastructure", "security"]`
   - Files: `packages/auth/src/scopes.ts`

2. **Create trusted client registration for Cursor/Claude**
   - Estimate: `3`
   - Labels: `["infrastructure", "security"]`
   - Files: `packages/auth/src/oauth-clients.ts`

3. **Implement Resource Server endpoints (`/oauth2/introspect`, `/oauth2/revoke`)**
   - Estimate: `5`
   - Labels: `["api", "infrastructure", "security"]`
   - Files: `apps/web/src/routes/api/oauth2/introspect.ts`, `revoke.ts`

4. **Add `/.well-known/oauth-protected-resource` for API**
   - Estimate: `2`
   - Labels: `["api", "infrastructure"]`
   - Files: `apps/web/src/routes/.well-known/oauth-protected-resource.ts`

5. **Test MCP tool authentication flow**
   - Estimate: `3`
   - Labels: `["testing", "infrastructure", "security"]`
   - Files: `packages/tui/test/mcp.test.ts`

**Total Phase 6 Estimate**: `15` points

---

## Summary Statistics

| Level | Count | Total Estimate |
|-------|-------|----------------|
| **Epic** | 1 | 13 |
| **Phase Issues** | 8 | 52 (avg 6.5) |
| **Task Issues** | 46 | 136 (avg 2.96) |
| **TOTAL** | **55** | **201 points** |

**Estimated Velocity**: ~30 points/week (based on 2-week cycles)  
**Estimated Duration**: ~7 weeks (201 points ÷ 30 points/week)

---

## Linear Metadata Template

### Epic Template

```markdown
**Title**: Epic: TUI Package — Unified CLI/TUI Infrastructure

**Description**:
[Full ExecPlan summary from docs/execplans/tui-package-ideation.md]

**Team**: Alfred-ops
**Project**: ExecPlans Tracking
**Priority**: High (P2)
**Status**: Backlog
**Labels**: epic, infrastructure, Feature
**Estimate**: 13
**Assignee**: Jack M
**Delegate**: Cursor
**Due Date**: [7 weeks from start]
```

### Phase Issue Template

```markdown
**Title**: Phase N: [Phase Name]

**Description**:
## Phase Overview
[Phase description from ExecPlan]

## Tasks
- [ ] Task 1
- [ ] Task 2
...

**Team**: Alfred-ops
**Project**: ExecPlans Tracking
**Priority**: High (P2)
**Status**: Backlog
**Labels**: infrastructure, [phase-specific]
**Estimate**: [5 or 8]
**Parent**: [Epic issue ID]
**Blocks**: [Next phase issue ID]
**Assignee**: Jack M
**Delegate**: Cursor
```

### Task Issue Template

```markdown
**Title**: [Specific task description]

**Description**:
## Task
[Task details from ExecPlan checklist]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Files
- `path/to/file.ts`

**Team**: Alfred-ops
**Project**: ExecPlans Tracking
**Priority**: High/Medium
**Status**: Backlog
**Labels**: infrastructure, [domain-specific]
**Estimate**: [1, 2, 3, or 5]
**Parent**: [Phase issue ID]
**Blocks**: [Dependent task IDs if any]
**Assignee**: Jack M
**Delegate**: Cursor
```

---

## Implementation Notes

1. **Sequential Dependencies**: Phases 0-6 are sequential (each blocks the next)
2. **Parallel Work**: Phase 0 and Phase 0.5 can run in parallel
3. **Estimate Scale**: Using Fibonacci (1, 2, 3, 5, 8, 13)
4. **Labels**: Use domain-specific labels (`database`, `ui`, `security`, etc.) for filtering
5. **Project**: All issues link to "ExecPlans Tracking" project
6. **Sync**: Update ExecPlan Progress section as issues complete

---

## Next Steps

1. Create Epic issue in Linear
2. Create 8 Phase issues (link to Epic)
3. Create 46 Task issues (link to Phases)
4. Set up blocking relationships
5. Assign to team/cycle
6. Begin Phase 0 work
