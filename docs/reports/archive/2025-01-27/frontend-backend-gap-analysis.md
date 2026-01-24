# Frontend-Backend Gap Analysis

**Date**: 2025-01-27  
**Purpose**: Identify all disconnects between backend tRPC routers and frontend consumers  
**Scope**: Complete audit of 29 routers across web and native apps

## Summary

- **Total Routers**: 29
- **Routers Without Frontend Usage**: 12 (41%)
- **Partial Integrations**: 5 (17%)
- **Frontend Features Without Backend**: 3
- **Priority Disconnects**: 8 (High), 7 (Medium), 5 (Low)
- **Linear Tickets Tracking Gaps**: 4 tickets found (ALF-78, ALF-81, ALF-82, ALF-306), 1 discrepancy (ALF-53)

---

## Backend Routers Without Frontend Usage

### book (packages/api/src/routers/book.ts) - **HIGH PRIORITY**

- **Procedures**: `create`, `list`, `delete`
- **Status**: Router exists, no UI route found
- **Expected Location**: `apps/web/src/routes/_protected/book.tsx` (missing)
- **PRD Reference**: `docs/reports/prd-implementation-status.md` line 59
- **Impact**: Bookmark management feature mentioned in PRD but not accessible to users
- **Security**: Uses `authedProcedure` - safe for frontend integration
- **Linear Ticket**: [ALF-306](https://linear.app/alfred-ops/issue/ALF-306) - Create bookmark management UI route (Status: Backlog, Priority: High, Estimate: 3 Points)

### fs (packages/api/src/routers/fs.ts) - **MEDIUM PRIORITY**

- **Procedures**: `read`, `write`
- **Status**: Router exists, no frontend usage found
- **Security Note**: Path validation implemented (`validatePath` ensures project root containment)
- **Use Case**: File editing within project workspace
- **Risk**: High - file system access requires careful UI design
- **Recommendation**: Consider if needed for code editor integration

### eval (packages/api/src/routers/eval.ts) - **LOW PRIORITY**

- **Procedures**: `define`, `list`, `dataset.create`, `dataset.add`, `dataset.list`, `run.start`, `run.get`, `run.list`, `run.scores`
- **Status**: Router exists, no frontend usage found
- **Note**: `run.start` throws `NOT_IMPLEMENTED` error (line 209)
- **Use Case**: Evaluation framework for agent testing
- **Impact**: Developer/admin tool, not user-facing
- **Recommendation**: Admin UI or CLI tool

### deploy (packages/api/src/routers/deploy.ts) - **MEDIUM PRIORITY**

- **Procedures**: `list`, `get`, `removeRecord`, `createPreview`, `promote`, `probe`, `healthStream`, `remove`
- **Status**: Router exists, no frontend usage found
- **Use Case**: Preview/production deployment management
- **Impact**: DevOps workflow integration
- **Security**: Requires policy checks (`deploy.preview`, `deploy.promote`, `deploy.remove`)
- **Recommendation**: Admin dashboard or workflow integration

### tune (packages/api/src/routers/tune.ts) - **LOW PRIORITY**

- **Procedures**: `start`
- **Status**: Router exists, no frontend usage found
- **Use Case**: Fine-tuning job management
- **Impact**: Developer/admin tool
- **Recommendation**: Admin UI or CLI tool

### codex (packages/api/src/routers/codex.ts) - **MEDIUM PRIORITY**

- **Procedures**: `run`, `stream`, `listRuns`, `getRun`, `events`, `searchEvents`, `streamEvents`, `listSessions`, `getSession`, `terminateSession`
- **Status**: Router exists, no direct frontend usage found
- **Note**: Used internally by orchestrator/workflow system
- **Use Case**: Code execution and session management
- **Impact**: Could enable direct codex UI for power users
- **Security**: Requires authz tokens and policy checks
- **Recommendation**: Consider exposing via workflow UI or admin panel

### codexIntent (packages/api/src/routers/codex-intent.ts) - **MEDIUM PRIORITY**

- **Procedures**: `run`
- **Status**: Router exists, no frontend usage found
- **Use Case**: Intent-based codex API for mobile/simplified clients
- **Impact**: Mobile app integration opportunity
- **Recommendation**: Connect to mobile chat interface

### cognitive (packages/api/src/routers/cognitive.ts) - **LOW PRIORITY**

- **Procedures**: `feedback`
- **Status**: Router exists, used indirectly via `useCognitiveFeedback` hook
- **Note**: Not directly called from UI components, wrapped in hook abstraction
- **Impact**: Functional but not directly exposed
- **Recommendation**: Current abstraction is acceptable

### jwks (packages/api/src/routers/jwks.ts) - **N/A**

- **Procedures**: `get`
- **Status**: Public endpoint, used by auth library
- **Note**: Infrastructure endpoint, not user-facing
- **Impact**: None - correctly abstracted

### token (packages/api/src/routers/token.ts) - **LOW PRIORITY**

- **Procedures**: `issue`, `elevate`
- **Status**: Router exists, no frontend usage found
- **Use Case**: Tool token issuance for elevated operations
- **Impact**: Used internally by workflow system
- **Security**: Requires biometric elevation for `elevate`
- **Recommendation**: Keep internal, document for admin use

### profile (packages/api/src/routers/profile.ts) - **MEDIUM PRIORITY**

- **Procedures**: `get`, `update`
- **Status**: Router exists, no frontend usage found
- **Use Case**: User profile management
- **Impact**: Missing user settings/profile page
- **Security**: Uses policy checks (`profile.write`)
- **Recommendation**: Add profile page in settings

### project (packages/api/src/routers/project.ts) - **MEDIUM PRIORITY**

- **Procedures**: `detect`, `linkLinear`, `get`, `list`
- **Status**: Router exists, no frontend usage found
- **Use Case**: Project detection and Linear integration
- **Impact**: Workflow/project management features
- **Recommendation**: Integrate into workflow or project management UI

### privacy (packages/api/src/routers/privacy.ts) - **HIGH PRIORITY**

- **Procedures**: `facts`, `deleteFact`, `events`
- **Status**: Router exists, no frontend usage found
- **Use Case**: Privacy controls and fact management
- **Impact**: Missing privacy dashboard mentioned in PRD
- **Security**: Requires policy checks (`privacy.purge`)
- **Recommendation**: Add privacy controls UI in settings
- **Linear Ticket**: [ALF-53](https://linear.app/alfred-ops/issue/ALF-53) - Settings Pages (Profile, Preferences, Privacy) - **Note**: Ticket marked "Fully implemented" but privacy router has no frontend usage

---

## Partial Integrations

### timer (packages/api/src/routers/timer.ts) - **COMPLETE** ✅

- **Router**: `packages/api/src/routers/timer.ts`
- **Frontend**: `apps/web/src/routes/_protected/timer.tsx` ✅
- **Procedures Used**: `create`, `active`, `done`, `cancel` (all procedures used)
- **Status**: Fully integrated
- **Note**: Previously reported as missing in PRD status, but implementation exists

### graph (packages/api/src/routers/graph.ts) - **PARTIAL**

- **Router**: `packages/api/src/routers/graph.ts`
- **Frontend Usage**: `apps/web/src/hooks/use-focused-context.ts` (line 216) - uses `graph.runQuery`
- **Procedures Available**: `ensureMirrors`, `getEdges`, `connect`, `explainedBy`, `watchEdges`, `runQuery`
- **Procedures Used**: `runQuery` only
- **Missing**: Graph visualization UI, edge creation UI, node connection UI
- **Impact**: Graph features exist but limited UI exposure
- **Recommendation**: Add graph visualization component

### knowledge (packages/api/src/routers/knowledge.ts) - **PARTIAL**

- **Router**: `packages/api/src/routers/knowledge.ts`
- **Frontend Usage**: `apps/web/src/hooks/use-knowledge-visualize.ts` (line 13) - uses `knowledge.visualize`
- **Procedures Available**: `visualize` only
- **Procedures Used**: `visualize` ✅
- **Status**: Fully integrated (only one procedure exists)

### admin (packages/api/src/routers/admin.ts) - **PARTIAL**

- **Router**: `packages/api/src/routers/admin.ts`
- **Frontend Usage**: `apps/web/src/routes/_protected/admin/voice.tsx` (lines 55, 66, 80)
- **Procedures Available**: `getVoiceStats`, `restartVoicePool`, `clearVoiceSessions`
- **Procedures Used**: All procedures ✅
- **Status**: Fully integrated (admin-only route)

### droid (packages/api/src/routers/droids.ts) - **PARTIAL**

- **Router**: `packages/api/src/routers/droids.ts`
- **Frontend Usage**: `apps/web/src/components/biometric-challenge-dialog.tsx` (line 80) - uses `droid.resume`
- **Procedures Available**: `run`, `stream`, `resume`
- **Procedures Used**: `resume` only
- **Missing**: Direct droid execution UI
- **Impact**: Droid execution handled via workflow/orchestrator, not directly exposed
- **Recommendation**: Current abstraction acceptable, document for admin use

---

## Frontend Features Without Backend Integration

### Mobile Chat Interface - **HIGH PRIORITY**

- **Location**: `apps/native/app/(drawer)/(tabs)/index.tsx`
- **Status**: Placeholder only ("Tab One")
- **Required Backend**: `trpc.assistant.stream` or `trpc.orchestrator.stream`
- **Reference**: Web implementation at `apps/web/src/components/chat-container.tsx`
- **PRD Reference**: `docs/reports/prd-implementation-status.md` line 83
- **Impact**: Core mobile app functionality missing
- **Recommendation**: Implement chat interface using same pattern as web app
- **Linear Ticket**: [ALF-82](https://linear.app/alfred-ops/issue/ALF-82) - Implement mobile chat interface (Status: Backlog, Priority: Medium, Estimate: 5 Points)

### Message Editing/Regeneration - **HIGH PRIORITY**

- **Location**: Chat components (`apps/web/src/components/chat-container.tsx`, `apps/web/src/components/windows/chat/chat-window.tsx`)
- **Status**: Not implemented
- **PRD Reference**: `docs/reports/prd-implementation-status.md` line 53
- **Required Backend**:
  - Message update endpoint (or message regeneration via assistant stream)
  - Message history modification
- **Impact**: User cannot edit or regenerate assistant responses
- **Note**: Comment found in `apps/web/src/components/windows/workflow/workflow-window.tsx` line 148: "For now, just regenerate. Ideally we'd pass feedback."
- **Recommendation**: Add message editing UI with backend support
- **Linear Ticket**: [ALF-78](https://linear.app/alfred-ops/issue/ALF-78) - Implement message editing and regeneration UI (Status: Backlog, Priority: Medium, Estimate: 2 Points)

### Performance Metrics Dashboard - **MEDIUM PRIORITY**

- **Location**: No UI component found
- **Status**: Metrics collection exists (`packages/api/src/metrics.ts`), Prometheus endpoint exists (`apps/web/src/routes/api/metrics.ts`)
- **PRD Reference**: `docs/reports/prd-implementation-status.md` line 74
- **Required Backend**: Metrics already exposed via `/api/metrics`
- **Impact**: No user-facing performance monitoring
- **Recommendation**: Create dashboard component consuming Prometheus metrics
- **Linear Ticket**: [ALF-81](https://linear.app/alfred-ops/issue/ALF-81) - Create Performance Metrics Dashboard UI (Status: Backlog, Priority: Medium, Estimate: 5 Points)

---

## Routers With Complete Integration ✅

These routers are fully integrated with frontend consumers:

1. **assistant** - Used in chat components (`trpc.assistant.generate`, `trpc.assistant.getConfig`, `trpc.assistant.stream`)
2. **orchestrator** - Used in workflow components (`trpc.orchestrator.stream`)
3. **workflow** - Used extensively (`trpc.workflow.get`, `trpc.workflow.events`, `trpc.workflow.reasoning`, `trpc.workflow.listRuns`, `trpc.workflow.resume`)
4. **plan** - Used in workflow window (`trpc.plan.generate`, `trpc.plan.approve`, `trpc.plan.reject`)
5. **note** - Full CRUD (`trpc.note.*`)
6. **remind** - Full CRUD with live updates (`trpc.remind.*`)
7. **todo** - Full CRUD (`trpc.todo.getAll`, `trpc.todo.create`, `trpc.todo.toggle`, `trpc.todo.delete`)
8. **timer** - Full CRUD (`trpc.timer.*`)
9. **terminal** - Session management (`trpc.terminal.createSession`, `trpc.terminal.write`, `trpc.terminal.resize`, `trpc.terminal.events`)
10. **visual** - Settings integration (`trpc.visual.*`)
11. **voice** - Voice features (`trpc.voice.*`)
12. **preference** - Settings (`trpc.preference.*`)
13. **user** - Settings (`trpc.user.getPreferences`, `trpc.user.setPreference`)
14. **linear** - Integration management (`trpc.linear.getStatus`, `trpc.linear.getAuthorizeUrl`)

---

## Priority Ranking

### High Priority (User-Facing Features)

1. **book** - Bookmark pane missing (PRD requirement)
2. **privacy** - Privacy controls missing (PRD requirement)
3. **Mobile Chat Interface** - Core mobile functionality
4. **Message Editing/Regeneration** - User experience improvement

### Medium Priority (Feature Enhancements)

1. **fs** - File system access (requires careful security design)
2. **deploy** - Deployment management (DevOps workflow)
3. **codex** - Direct codex UI (power user feature)
4. **codexIntent** - Mobile integration opportunity
5. **profile** - User profile management
6. **project** - Project management features
7. **Performance Metrics Dashboard** - Observability

### Low Priority (Admin/Developer Tools)

1. **eval** - Evaluation framework (admin tool)
2. **tune** - Fine-tuning jobs (admin tool)
3. **token** - Token management (internal use)
4. **cognitive** - Already abstracted via hooks

---

## Recommendations

### Immediate Actions

1. **Create bookmark UI route** (`apps/web/src/routes/_protected/book.tsx`)
   - Use `trpc.book.create`, `trpc.book.list`, `trpc.book.delete`
   - Follow pattern from `note.tsx` or `remind.tsx`
   - **Linear Ticket**: [ALF-306](https://linear.app/alfred-ops/issue/ALF-306)

2. **Implement mobile chat interface**
   - Copy pattern from `apps/web/src/components/chat-container.tsx`
   - Use `trpc.assistant.stream` or `trpc.orchestrator.stream`
   - Update `apps/native/app/(drawer)/(tabs)/index.tsx`

3. **Add privacy controls UI**
   - Create `apps/web/src/routes/_protected/settings/privacy.tsx`
   - Use `trpc.privacy.facts`, `trpc.privacy.deleteFact`, `trpc.privacy.events`
   - Integrate into settings navigation

4. **Add message editing/regeneration**
   - Extend chat components with edit UI
   - Add backend endpoint for message updates or use regeneration flow
   - Follow AI SDK v6 patterns for message manipulation

### Short-Term Enhancements

1. **Profile management page**
   - Create `apps/web/src/routes/_protected/settings/profile.tsx`
   - Use `trpc.profile.get`, `trpc.profile.update`

2. **Performance metrics dashboard**
   - Create `apps/web/src/routes/_protected/admin/metrics.tsx`
   - Consume `/api/metrics` endpoint
   - Visualize Prometheus metrics

3. **Graph visualization UI**
   - Expose `graph.connect`, `graph.getEdges`, `graph.watchEdges`
   - Create graph visualization component

### Long-Term Considerations

1. **Deployment management UI** (if needed for DevOps workflows)
2. **Codex direct UI** (power user feature)
3. **Evaluation framework UI** (admin tool)

---

## Testing Recommendations

For each new integration:

1. **Type Safety**: Ensure full TypeScript inference (no `as any` casts)
2. **Error Handling**: Add proper error states and loading indicators
3. **Security**: Verify policy checks and authentication
4. **Mobile Parity**: Ensure mobile app gets same features where applicable
5. **Performance**: Test with subscriptions (`terminal.events`, `workflow.events`) for proper cleanup

---

## File Reference Summary

### Backend Routers

- Router registry: `packages/api/src/routers/index.ts`
- All routers: `packages/api/src/routers/*.ts`

### Frontend tRPC Setup

- Web client: `apps/web/src/lib/trpc-client.ts`
- Native client: `apps/native/utils/trpc.ts`
- React Query wrapper: `apps/web/src/router.tsx`

### Existing Connected Patterns

- Timer: `apps/web/src/routes/_protected/timer.tsx`
- Visual: `apps/web/src/routes/_protected/settings/visual.tsx`
- Terminal: `apps/web/src/components/windows/terminal/terminal-window.tsx`
- Notes: `apps/web/src/routes/note.tsx`
- Reminders: `apps/web/src/routes/remind.tsx`

### PRD References

- Status report: `docs/reports/prd-implementation-status.md`
- PRD: `docs/alfred-prd.md`

---

## Linear Ticket Summary

### Tickets Tracking Identified Gaps

1. **[ALF-78](https://linear.app/alfred-ops/issue/ALF-78)** - Implement message editing and regeneration UI
   - Status: Backlog
   - Priority: Medium
   - Estimate: 2 Points
   - Tracks: Message editing/regeneration feature

2. **[ALF-81](https://linear.app/alfred-ops/issue/ALF-81)** - Create Performance Metrics Dashboard UI
   - Status: Backlog
   - Priority: Medium
   - Estimate: 5 Points
   - Tracks: Performance metrics dashboard

3. **[ALF-82](https://linear.app/alfred-ops/issue/ALF-82)** - Implement mobile chat interface
   - Status: Backlog
   - Priority: Medium
   - Estimate: 5 Points
   - Tracks: Mobile chat interface

### Tickets with Discrepancies

4. **[ALF-53](https://linear.app/alfred-ops/issue/ALF-53)** - Settings Pages (Profile, Preferences, Privacy)
   - Status: Backlog (marked "Fully implemented" in description)
   - Priority: Medium
   - Estimate: 3 Points
   - Issue: Privacy router has no frontend usage, but ticket claims privacy controls are implemented
   - Recommendation: Verify privacy UI implementation or update ticket status

### Newly Created Tickets

5. **[ALF-306](https://linear.app/alfred-ops/issue/ALF-306)** - Create bookmark management UI route
   - Status: Backlog
   - Priority: High
   - Estimate: 3 Points
   - Tracks: Bookmark UI route
   - Created: 2025-12-25

### Other Related Tickets

- **[ALF-30](https://linear.app/alfred-ops/issue/ALF-30)** - API Layer & Routers (parent issue for all routers)
- **[ALF-31](https://linear.app/alfred-ops/issue/ALF-31)** - Web Application Interface (parent issue for all web UI)
- **[ALF-32](https://linear.app/alfred-ops/issue/ALF-32)** - Native Mobile Application (parent issue for mobile app)
