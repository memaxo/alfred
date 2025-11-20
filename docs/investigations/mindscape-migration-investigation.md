# Investigation: Migration from Traditional UI to Symbiotic Mindscape

**Date:** 2025-01-27  
**Status:** Investigation Required  
**Objective:** Analyze migration path from traditional route-based UI to spatial computing paradigm

---

## Context

ALFRED currently operates with **two parallel UI systems**:

### Old System: Traditional Desktop UI (`docs/audits/ui-user-journey-wireframe.md`)
- **Routes**: `/ai`, `/note`, `/remind`, `/todos`, `/workflows`, `/preferences`, etc.
- **Pattern**: Header navigation → Route components → PaneLayout/Forms
- **Architecture**: TanStack Start file-based routing with `/_authed` protection
- **Components**: `ChatContainer`, `PaneLayout`, `NotePane`, `RemindPane`, standard form inputs
- **State**: TanStack Query + tRPC for data fetching
- **Status**: Production-ready, fully functional

### New System: Symbiotic Mindscape (`docs/strategy/symbiotic-mindscape.md`)
- **Route**: `/mindscape` (experimental, accessible via Cmd+M)
- **Pattern**: Infinite spatial canvas with nodes as "holographic artifacts"
- **Architecture**: React Flow canvas + Zustand store + node components
- **Components**: `MindscapeCanvas`, `ChatNode`, `WorkflowNode`, `NoteNode`, `OrbNode`
- **State**: Zustand store (`apps/web/src/store/mindscape.ts`) synced with tRPC
- **Status**: Functional core complete (v1), see `docs/implementation/mindscape-v1-summary.md`

---

## Investigation Scope

### 1. Route-by-Route Migration Analysis

For each route in the old system, determine:

**a) Migration Feasibility**
- Can this route's functionality be represented as a Mindscape node?
- What data/state needs to persist?
- Are there interactions that don't map to spatial paradigm?

**b) Node Type Requirements**
- Does a node type already exist? (Check `apps/web/src/components/mindscape/nodes/`)
- What new node types need to be created?
- How should node data be structured?

**c) User Flow Changes**
- How does user access this feature in Mindscape?
- What replaces direct navigation?
- Are there discoverability concerns?

**Routes to Analyze:**
- `/ai` → Chat Node (✅ exists, needs integration)
- `/note` → Note Node (✅ exists, needs full CRUD)
- `/remind` → Reminder Node (✅ exists, needs full CRUD)
- `/todos` → Todo Node (❌ needs creation)
- `/timer` → Timer Node (❌ needs creation)
- `/book` → Bookmark Node (❌ needs creation)
- `/workflows` → Workflow Node (✅ exists, needs list view)
- `/orchestrator/run` → Workflow Node (✅ exists, needs form integration)
- `/preferences` → Settings Node (❌ needs creation)
- `/privacy` → Privacy Node (❌ needs creation)
- `/profile` → Profile Node (❌ needs creation)
- `/integrations` → Integration Node (❌ needs creation)
- `/deployments` → Deployment Node (❌ needs creation)
- `/dashboard` → Dashboard Node (❌ needs creation)

### 2. Component Mapping & Reusability

**Investigate:**
- Which old components can be reused inside nodes? (e.g., `ChatContainer` logic → `ChatNode`)
- Which components need refactoring for node context?
- Which components are obsolete in spatial paradigm?

**Key Components to Map:**
- `ChatContainer` → `ChatNode` (partial migration exists)
- `PaneLayout` → Node creation patterns
- `NotePane` → `NoteNode` rendering
- `RemindPane` → `ReminderNode` rendering
- Form components → Node input patterns
- Settings components → Settings Node

### 3. State Management Consolidation

**Current State:**
- Old system: TanStack Query + tRPC (server state)
- New system: Zustand (`mindscape.ts`) + tRPC (spatial state)

**Investigate:**
- How to sync TanStack Query cache with Zustand node data?
- Should nodes subscribe to tRPC queries directly?
- How to handle optimistic updates in spatial context?
- What state belongs in Zustand vs. TanStack Query?

### 4. Navigation & Discovery

**Old System:**
- Header navigation with explicit links
- Direct route access via URL
- Breadcrumbs/back navigation

**New System:**
- Spatial navigation (pan/zoom)
- Node-based access
- No traditional URLs

**Investigate:**
- How do users discover features without header nav?
- Should there be a "command palette" (Cmd+K) to spawn nodes?
- How to handle deep linking to specific nodes?
- What replaces the header navigation?

### 5. Authentication & Route Protection

**Current:**
- `/_authed` layout route with `beforeLoad` guard
- Redirects to `/login` if unauthenticated

**Investigate:**
- Should `/mindscape` be protected the same way?
- How to handle auth redirects in spatial context?
- Should Mindscape be the default authenticated view?

### 6. Performance & Bundle Size

**Investigate:**
- React Flow bundle size impact
- Zustand vs. TanStack Query overhead
- Node component code splitting strategy
- Lazy loading for node types

### 7. Accessibility Concerns

**Old System:**
- Standard keyboard navigation
- Screen reader friendly
- ARIA labels on all interactive elements

**New System:**
- Spatial navigation (mouse/trackpad primary)
- Canvas-based interactions

**Investigate:**
- How to maintain keyboard accessibility?
- Screen reader support for spatial layout?
- Focus management in node context?

### 8. Migration Strategy Options

**Option A: Gradual Migration**
- Keep both systems running in parallel
- Migrate routes one-by-one
- Users can toggle between old/new via preference

**Option B: Complete Replacement**
- Remove old routes entirely
- Make Mindscape the default authenticated view
- Migrate all functionality at once

**Option C: Hybrid Approach**
- Mindscape as primary interface
- Old routes as "fallback" or "classic mode"
- Feature flag to switch between modes

**Investigate:**
- Pros/cons of each approach
- User impact assessment
- Technical complexity comparison
- Timeline estimates

---

## Deliverables

### 1. Migration Analysis Document
Create `docs/execplans/mindscape-migration-plan.md` with:
- Route-by-route migration feasibility matrix
- Component reuse mapping
- State management consolidation strategy
- Navigation/discovery recommendations
- Performance impact assessment

### 2. Technical Debt Inventory
List:
- Components that need refactoring
- Routes that can be deprecated
- State management conflicts
- Bundle size concerns
- Accessibility gaps

### 3. Migration Phases Proposal
Break migration into phases:
- **Phase 1**: Core routes (chat, notes, reminders)
- **Phase 2**: Management routes (todos, timers, bookmarks)
- **Phase 3**: Settings & admin routes
- **Phase 4**: Advanced features (workflows, deployments)

Each phase should include:
- Routes/components affected
- New node types required
- State management changes
- User-facing changes
- Rollback plan

### 4. Code Audit Report
For each old route component (`apps/web/src/routes/_authed/*`):
- Identify reusable logic
- Identify node component candidates
- Identify obsolete code
- Suggest refactoring approach

### 5. User Experience Impact Assessment
- How will users discover features?
- What replaces direct URL access?
- How to handle bookmarks/favorites?
- Migration communication plan

---

## Key Files to Review

### Old System
- `apps/web/src/routes/_authed/ai.tsx` - Chat route
- `apps/web/src/routes/_authed/note.tsx` - Notes route
- `apps/web/src/routes/_authed/remind.tsx` - Reminders route
- `apps/web/src/components/chat-container.tsx` - Chat container
- `apps/web/src/components/pane-layout.tsx` - Pane wrapper
- `apps/web/src/components/autonomy-slider.tsx` - Settings component

### New System
- `apps/web/src/components/mindscape/canvas.tsx` - Main canvas
- `apps/web/src/components/mindscape/nodes/chat-node.tsx` - Chat node
- `apps/web/src/components/mindscape/nodes/note-node.tsx` - Note node
- `apps/web/src/components/mindscape/nodes/workflow-node.tsx` - Workflow node
- `apps/web/src/store/mindscape.ts` - Zustand store
- `apps/web/src/components/mindscape/initializer.tsx` - Data sync logic

### Documentation
- `docs/audits/ui-user-journey-wireframe.md` - Old system wireframe
- `docs/strategy/symbiotic-mindscape.md` - New system vision
- `docs/implementation/mindscape-v1-summary.md` - Current implementation status

---

## Constraints & Considerations

### Technical Constraints
- Must maintain TanStack Start routing architecture
- Must preserve tRPC API contracts
- Must maintain type safety (`@alfred/type`)
- Must follow design system (`docs/design-system.md`)

### User Constraints
- Cannot break existing workflows
- Must maintain accessibility standards
- Must preserve data persistence
- Must support gradual adoption

### Business Constraints
- Migration should not block new features
- Should minimize user retraining
- Should improve UX, not just change it

---

## Success Criteria

The investigation is complete when:

1. ✅ **Feasibility**: Clear understanding of what can/cannot migrate
2. ✅ **Strategy**: Recommended migration approach with rationale
3. ✅ **Phases**: Detailed phase breakdown with dependencies
4. ✅ **Impact**: User experience impact assessment
5. ✅ **Technical**: State management consolidation plan
6. ✅ **Timeline**: Rough estimates for each phase

---

## Questions to Answer

1. **Can all routes be represented as nodes?** If not, which ones and why?
2. **How do users navigate without header nav?** Command palette? Search? Spatial memory?
3. **What happens to URLs?** Do we keep routes for deep linking? Or use node IDs?
4. **How to handle authentication redirects?** Redirect to `/mindscape` instead of `/login`?
5. **What's the performance impact?** React Flow + Zustand vs. current stack?
6. **How to maintain accessibility?** Keyboard nav, screen readers, focus management?
7. **What's the migration risk?** Can we roll back? Feature flags?
8. **What's the user learning curve?** How much retraining needed?

---

## Next Steps After Investigation

1. Review investigation deliverables
2. Stakeholder approval of migration strategy
3. Create detailed implementation plan (ExecPlan)
4. Begin Phase 1 migration (core routes)
5. User testing & feedback loops
6. Iterate based on feedback

---

**Investigation Deadline:** TBD  
**Assigned To:** AI Assistant  
**Status:** 🔍 In Progress

