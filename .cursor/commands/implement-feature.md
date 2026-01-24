# Implement Feature

## Overview

Execute a complete feature implementation workflow from investigation through documentation. This command orchestrates the full development cycle.

## Prerequisites

- Linear ticket ID or clear feature description
- Access to relevant MCP tools (Linear, browser if needed)

## Workflow Phases

### Phase 1: Investigation

1. **Fetch ticket context** from Linear (if applicable)
2. **Search codebase** for similar patterns and conventions
3. **Read existing implementations** to understand structure
4. **Identify touchpoints**: files to create, modify, and test

### Phase 2: Planning

1. **Create task list** with TodoWrite breaking work into discrete steps
2. **Identify the first task** to start (mark as `in_progress`)
3. **Note blockers or questions** that need resolution

### Phase 3: Implementation

For each task:

1. **Follow existing patterns** - match codebase conventions
2. **Implement incrementally** - one logical change at a time
3. **Mark task complete** when done, move to next

### Phase 4: Validation

1. **Check for lint errors** with ReadLints
2. **Run relevant tests** with `bun test <path>`
3. **Fix failures immediately** before proceeding
4. **Verify type safety** if applicable

### Phase 5: Commit

1. **Stage relevant files** - only changes for this feature
2. **Write clear commit message** following conventional format:
   - `feat(scope): description` for features
   - `fix(scope): description` for fixes
   - Include `Resolves: ALF-XXX` if applicable
3. **Commit atomically** - one logical change per commit

### Phase 6: Documentation (if significant)

1. **Reflect on learnings** - what patterns emerged?
2. **Update docs** if user-facing or architectural changes
3. **Consider new rules** for `.ruler/` if patterns should be codified

## Success Criteria

- All tasks completed
- Tests passing
- Lints clean
- Changes committed with clear messages
- Documentation updated (if needed)

## Example Usage

```
/implement-feature ALF-127: Add RAG document management tools
```
