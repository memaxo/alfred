# Verification Patterns Guide

**Owner:** Infrastructure  
**Last Updated:** 2025-11-26

## Purpose

This guide documents systematic patterns for verifying ExecPlan completion status, searching the codebase, syncing Linear issues, and documenting evidence.

## When to Verify

Verify ExecPlan status when:

- Marking ExecPlans as complete
- Updating Linear issue status
- Before creating new features (check if already implemented)
- During code reviews (verify claimed completion)

## Verification Workflow

### 1. Read the ExecPlan

Understand what needs to be verified:

- Read `Purpose` and `Plan` sections
- Note specific features/components mentioned
- Identify key functions, files, or patterns

### 2. Search the Codebase

Use systematic search patterns:

**Find Files:**

```bash
# Find files by name pattern
fd "pattern" packages/

# List directory structure
lsd packages/agent/src/
```

**Search Code:**

```bash
# Exact string search
rg "functionName" packages/

# Case-insensitive search
rg -i "pattern" packages/

# Search with context
rg -A 5 -B 5 "pattern" packages/
```

**Semantic Search:**

```typescript
codebase_search("What does X do?", target_directories: ["packages/agent"])
```

**Find Tests:**

```bash
# Find test files
fd "*test.ts" packages/

# Search test descriptions
rg "describe.*featureName" packages/
```

### 3. Verify Implementation

For each ExecPlan item:

1. **Find the code:**
   - Locate function/class definitions
   - Check integration points
   - Verify test coverage

2. **Check completeness:**
   - Is it fully implemented or skeleton?
   - Are there TODOs or placeholders?
   - Is it integrated or isolated?

3. **Document evidence:**
   - File paths
   - Line numbers
   - Function names
   - Integration points

### 4. Update ExecPlan

Update the ExecPlan immediately:

1. **Mark Progress:**

   ```markdown
   - [x] Feature implemented (`packages/agent/src/feature.ts` lines 10-50)
   ```

2. **Update Status:**

   ```markdown
   **Status:** Complete ✅
   ```

3. **Add to Outcomes:**

   ```markdown
   ## Outcomes & Retrospective

   **Status**: ✅ Complete

   - Feature implemented in `packages/agent/src/feature.ts`
   - Integrated into workflow runner (`packages/api/src/routers/workflow.ts` line 123)
   - Test coverage: `packages/agent/test/feature.test.ts`
   ```

### 5. Sync Linear Issue

Update corresponding Linear issue:

1. **Update Status:**
   - Mark as "Done" if complete
   - Mark as "In Progress" if mostly complete
   - Update description with evidence

2. **Add Evidence:**

   ```markdown
   ## Implementation

   - ✅ Feature implemented (`packages/agent/src/feature.ts` lines 10-50)
   - ✅ Integrated (`packages/api/src/routers/workflow.ts` line 123)
   - ✅ Tests (`packages/agent/test/feature.test.ts`)
   ```

## Common Search Patterns

### Finding Function Implementations

```bash
# Find function definitions
rg "export (function|const|class) functionName"

# Find async functions
rg "export async function functionName"

# Find in specific package
rg "functionName" packages/agent/
```

### Finding Usages

```bash
# Find function calls
rg "functionName\("

# Find imports
rg "from.*functionName"

# Find in specific context
rg "functionName" -A 10 packages/api/
```

### Finding Integration Points

```bash
# Find where feature is used
rg "import.*feature" packages/

# Find router integration
rg "feature" packages/api/src/routers/

# Find test integration
rg "feature" packages/*/test/
```

### Finding Database Schemas

```bash
# Find schema definitions
rg "export const.*Table" packages/db/src/schema/

# Find migrations
fd "*migration*.sql" packages/db/src/migrations/

# Find repository functions
rg "export.*function.*name" packages/db/src/repo/
```

## Evidence Documentation Standards

### File References

Always include:

- File path (relative to repo root)
- Line numbers (if specific)
- Function/class names

**Example:**

```markdown
- ✅ Implemented in `packages/agent/src/orchestrator/linear.ts` lines 30-93
- ✅ Integrated into workflow runner (`packages/api/src/routers/workflow.ts` line 320)
```

### Status Indicators

Use consistent status markers:

- ✅ Complete
- ⚠️ Mostly Complete (with pending items listed)
- ❌ Not Found / Not Implemented
- 🚧 In Progress

### Evidence Format

```markdown
## Implementation Evidence

- **Function**: `emitLinearActivity` (`packages/agent/src/orchestrator/linear.ts` lines 30-93)
- **Integration**: Workflow runner (`packages/api/src/routers/workflow.ts` lines 320-350)
- **Tests**: Unit tests (`packages/agent/test/linear.test.ts`)
- **Metrics**: Prometheus metrics (`packages/api/src/metrics.ts` lines 447-486)
```

## Linear Sync Workflow

### When to Sync

Sync Linear issues when:

- ExecPlan status changes
- Implementation evidence is found
- Features are completed

### How to Sync

1. **Get Linear Issue:**

   ```typescript
   mcp_Linear_get_issue({ id: "issue-id" });
   ```

2. **Update Status:**

   ```typescript
   mcp_Linear_update_issue({
     id: "issue-id",
     state: "Done", // or "In Progress"
     description: "Updated description with evidence",
   });
   ```

3. **Update Description:**
   - Include implementation evidence
   - Link to ExecPlan file
   - List file paths and line numbers

## Common Pitfalls

### Assuming Completion

❌ **Don't:** Mark complete based on file existence alone  
✅ **Do:** Verify actual implementation, integration, and tests

### Incomplete Evidence

❌ **Don't:** "Feature implemented"  
✅ **Do:** "Feature implemented (`packages/agent/src/feature.ts` lines 10-50)"

### Missing Integration Checks

❌ **Don't:** Only check if function exists  
✅ **Do:** Verify it's called from routers/runtime/integration points

### Ignoring Tests

❌ **Don't:** Mark complete without test coverage  
✅ **Do:** Verify tests exist and pass

## Related Documentation

- [ExecPlan Verification Rules](../../.ruler/32-execplan-verification.md) - Detailed rules
- [Developer Onboarding](./developer-onboarding.md) - Getting started guide
- [ExecPlan Maintenance](./execplan-maintenance.md) - ExecPlan workflow
