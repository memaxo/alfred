# ExecPlan Maintenance Guide

**Owner:** Infrastructure  
**Last Updated:** 2025-11-26

## Purpose

This guide explains how to create, update, and maintain ExecPlans. ExecPlans are detailed planning documents for significant features, refactors, and initiatives.

## What is an ExecPlan?

An ExecPlan is a living document that tracks:
- **Purpose** - What problem it solves
- **Plan** - Step-by-step implementation plan
- **Progress** - Current status of each step
- **Surprises & Discoveries** - Unexpected findings during implementation
- **Decision Log** - Key decisions and rationale
- **Outcomes & Retrospective** - Final status and lessons learned

**Template:** `.agent/PLANS.md`

## When to Create an ExecPlan

Create ExecPlans for:
- Significant features (multi-day effort)
- Major refactors
- Cross-cutting initiatives
- Complex integrations

**Don't create ExecPlans for:**
- Small bug fixes
- Simple feature additions (<1 day)
- Routine maintenance

## Creating an ExecPlan

### 1. Choose Location

- **Cross-cutting efforts:** `docs/execplans/`
- **Package-specific:** `packages/<package>/.ruler/` (if needed)

### 2. Use Template

Copy `.agent/PLANS.md` template structure:

```markdown
# ExecPlan: [Feature Name]

**Owner:** [Team/Package]
**Status:** Proposed

## Purpose

[What problem does this solve?]

## Plan

### Phase 1: [Description]
- [ ] Task 1
- [ ] Task 2

## Progress
- [ ] Phase 1
- [ ] Phase 2

## Surprises & Discoveries
*(To be filled during execution)*

## Decision Log
*(To be filled during execution)*

## Outcomes & Retrospective
*(To be filled upon completion)*
```

### 3. Fill Initial Sections

- **Purpose:** Clear problem statement
- **Plan:** Detailed, actionable steps
- **Progress:** Empty checkboxes initially

### 4. Create Linear Issue

Create corresponding Linear issue:
- Project: "ExecPlans Tracking"
- Link to ExecPlan file path
- Copy Purpose as description
- Set status: "Proposed" or "Backlog"

## Updating ExecPlans

### During Implementation

**After each subtask:**
1. Mark checkbox complete in `Progress`
2. Add to `Surprises & Discoveries` if unexpected
3. Log decisions in `Decision Log`
4. Update Linear issue if status changes

**Example:**
```markdown
## Progress
- [x] Phase 1: Event Persistence ✅
- [ ] Phase 2: Runtime Loop

## Surprises & Discoveries

- Found existing `cognitive_events` table from previous work
- Metrics need lazy loading to avoid circular dependencies

## Decision Log

- (2025-11-26) Decided to use variable-based dynamic imports for metrics to avoid circular dependencies
```

### On Completion

1. **Mark all items complete:**
   ```markdown
   ## Progress
   - [x] Phase 1 ✅
   - [x] Phase 2 ✅
   ```

2. **Update status:**
   ```markdown
   **Status:** Complete ✅
   ```

3. **Fill Outcomes:**
   ```markdown
   ## Outcomes & Retrospective
   
   **Status**: ✅ Complete
   
   - Feature implemented in `packages/agent/src/feature.ts`
   - Integrated into workflow runner (`packages/api/src/routers/workflow.ts`)
   - Test coverage: `packages/agent/test/feature.test.ts`
   ```

4. **Sync Linear:**
   - Update Linear issue to "Done"
   - Add implementation evidence to description

## Verifying Completion

When verifying ExecPlan completion:

1. **Search codebase systematically:**
   - Use `rg`, `grep`, `codebase_search`
   - Find function implementations
   - Check integration points
   - Verify test coverage

2. **Document evidence:**
   - File paths
   - Line numbers
   - Function names
   - Integration points

3. **Update ExecPlan:**
   - Mark items complete
   - Add evidence to Outcomes
   - Update status

4. **Sync Linear:**
   - Update issue status
   - Add evidence to description

**See:** `docs/guides/verification-patterns.md` for detailed workflow

## Status Values

- **Proposed** - Not started, planning phase
- **In Progress** - Actively being worked on
- **Complete ✅** - Fully implemented and verified
- **Mostly Complete ⚠️** - Mostly done, minor items pending
- **Cancelled** - No longer needed

## Best Practices

### Keep It Updated

- Update immediately after completing subtasks
- Don't batch updates for the end
- Update Linear issue when ExecPlan status changes

### Be Specific

- Include file paths and line numbers
- Reference specific functions/classes
- Link to related code

### Document Decisions

- Log why decisions were made
- Include alternatives considered
- Note trade-offs

### Learn from Surprises

- Document unexpected findings
- Update plan if needed
- Share learnings in retrospective

## Common Mistakes

### ❌ Don't

- Create ExecPlans for trivial changes
- Leave ExecPlans outdated
- Skip Linear sync
- Forget to verify before marking complete

### ✅ Do

- Create ExecPlans for significant work
- Update immediately after changes
- Sync Linear issues
- Verify implementation before marking complete

## Related Documentation

- [Verification Patterns](./verification-patterns.md) - How to verify completion
- [Developer Onboarding](./developer-onboarding.md) - Getting started
- [ExecPlan Verification Rules](../../.ruler/32-execplan-verification.md) - Detailed rules

