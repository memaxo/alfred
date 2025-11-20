# Prompt: Investigate Migration from Traditional UI to Symbiotic Mindscape

## Objective

Investigate the migration path from ALFRED's traditional route-based UI system to the new Symbiotic Mindscape spatial computing interface. Determine feasibility, strategy, and implementation approach.

## Context

ALFRED currently has **two parallel UI systems**:

1. **Old System** (Production): Traditional desktop UI with routes (`/ai`, `/note`, `/remind`, etc.) using TanStack Start routing, PaneLayout patterns, and standard form-based interfaces. See `docs/audits/ui-user-journey-wireframe.md` for complete wireframe.

2. **New System** (Experimental): Symbiotic Mindscape at `/mindscape` - an infinite spatial canvas where features exist as interactive nodes. See `docs/strategy/symbiotic-mindscape.md` for vision and `docs/implementation/mindscape-v1-summary.md` for current implementation status.

## Current State

- **Old routes**: Fully functional, production-ready (`apps/web/src/routes/_authed/*`)
- **Mindscape**: Functional core complete, accessible via `/mindscape` or Cmd+M shortcut
- **Coexistence**: Both systems run in parallel, no migration yet

## Investigation Tasks

### 1. Route Migration Analysis
For each route in the old system (`/ai`, `/note`, `/remind`, `/todos`, `/timer`, `/book`, `/workflows`, `/preferences`, `/privacy`, `/profile`, `/integrations`, `/deployments`, `/dashboard`):

- Can this route's functionality be represented as a Mindscape node?
- What node type is needed? (Check existing: `apps/web/src/components/mindscape/nodes/`)
- How does user access change? (direct URL → spatial discovery)
- What state/data needs to persist?

### 2. Component Reusability
Map old components to new node patterns:
- `ChatContainer` → `ChatNode` (partial exists)
- `PaneLayout` → Node creation patterns
- Form components → Node input patterns
- Settings components → Settings Node

Identify: reusable logic, refactoring needs, obsolete code.

### 3. State Management Consolidation
- Old: TanStack Query + tRPC (server state)
- New: Zustand (`apps/web/src/store/mindscape.ts`) + tRPC (spatial state)

Determine: sync strategy, query subscription patterns, optimistic updates, state ownership.

### 4. Navigation & Discovery
Old system uses header navigation with explicit links. New system uses spatial navigation.

Investigate:
- How do users discover features without header nav?
- Should there be a command palette (Cmd+K) to spawn nodes?
- How to handle deep linking to specific nodes?
- What replaces header navigation?

### 5. Migration Strategy Options
Evaluate three approaches:

**A. Gradual Migration**: Keep both systems, migrate routes one-by-one, user toggle
**B. Complete Replacement**: Remove old routes, Mindscape as default
**C. Hybrid Approach**: Mindscape primary, old routes as "classic mode" fallback

Assess: pros/cons, user impact, technical complexity, timeline.

## Deliverables

Create `docs/execplans/mindscape-migration-plan.md` with:

1. **Migration Feasibility Matrix**: Route-by-route analysis with node type requirements
2. **Component Mapping**: Reuse opportunities and refactoring needs
3. **State Management Strategy**: Consolidation approach for TanStack Query + Zustand
4. **Navigation Recommendations**: Discovery patterns, command palette design, deep linking
5. **Migration Phases**: Break into phases (Core → Management → Settings → Advanced)
6. **Technical Debt Inventory**: Components to refactor, routes to deprecate, accessibility gaps
7. **User Experience Impact**: Discovery patterns, learning curve, migration communication

## Key Files to Review

**Old System:**
- `apps/web/src/routes/_authed/*` - All protected routes
- `apps/web/src/components/chat-container.tsx`
- `apps/web/src/components/pane-layout.tsx`
- `docs/audits/ui-user-journey-wireframe.md`

**New System:**
- `apps/web/src/components/mindscape/canvas.tsx`
- `apps/web/src/components/mindscape/nodes/*` - All node types
- `apps/web/src/store/mindscape.ts`
- `docs/strategy/symbiotic-mindscape.md`
- `docs/implementation/mindscape-v1-summary.md`

## Constraints

- Must maintain TanStack Start routing architecture
- Must preserve tRPC API contracts
- Must maintain type safety (`@alfred/type`)
- Must follow design system (`docs/design-system.md`)
- Cannot break existing workflows
- Must maintain accessibility standards

## Success Criteria

Investigation complete when:
- ✅ Clear feasibility assessment (what can/cannot migrate)
- ✅ Recommended migration strategy with rationale
- ✅ Detailed phase breakdown with dependencies
- ✅ User experience impact assessment
- ✅ State management consolidation plan
- ✅ Rough timeline estimates per phase

## Questions to Answer

1. Can all routes be represented as nodes? If not, which ones and why?
2. How do users navigate without header nav? Command palette? Search? Spatial memory?
3. What happens to URLs? Keep routes for deep linking? Or use node IDs?
4. How to handle authentication redirects? Redirect to `/mindscape` instead of `/login`?
5. What's the performance impact? React Flow + Zustand vs. current stack?
6. How to maintain accessibility? Keyboard nav, screen readers, focus management?
7. What's the migration risk? Can we roll back? Feature flags?
8. What's the user learning curve? How much retraining needed?

---

**Start by reading the referenced documentation files, then analyze the codebase structure. Focus on understanding the current implementation before proposing migration strategies.**

