# Delegate Linear Tickets to Cursor Agents

## Overview

Bulk assign Linear tickets to Cursor agents for automated execution. This command handles delegation, begin prompt creation, and validation of blocking relationships.

## Prerequisites

- Linear MCP tools configured
- Cursor delegate ID: `5497cebb-b66c-4675-bd54-fc650cf94d27`
- Tickets must have clear descriptions and acceptance criteria

## Workflow

### Phase 1: Identify Tickets

Determine which tickets to delegate:

**Option A: Specific Issue IDs**

```
Tickets: ALF-308, ALF-309, ALF-310, ALF-311, ALF-312
```

**Option B: Query by Label/Project**

```typescript
Use Linear MCP: list_issues
Arguments: {
  "team": "Alfred-ops",
  "label": "infrastructure",
  "state": "Backlog",
  "limit": 50
}
```

**Option C: Query by Epic**

```typescript
// Get all issues blocked by an epic
Use Linear MCP: get_issue with includeRelations
Then filter for issues in the `blocks` array
```

### Phase 2: Validate Tickets

Before delegating, verify each ticket has:

- ✅ Clear description with context
- ✅ Specific file paths or implementation guidance
- ✅ Acceptance criteria defined
- ✅ Proper labels (ui, api, database, infrastructure, etc.)
- ✅ Appropriate priority (1=Urgent, 2=High, 3=Medium, 4=Low)

Warn if tickets are missing critical information.

### Phase 3: Assign Cursor Delegate

For each validated ticket:

```typescript
Use Linear MCP: update_issue
Arguments: {
  "id": "<issue-id>",
  "delegate": "Cursor"
}
```

### Phase 4: Add Begin Prompts (Optional)

Create detailed begin prompts as comments:

```typescript
Use Linear MCP: create_comment
Arguments: {
  "issueId": "<issue-id>",
  "body": "@cursor\n\n## Begin Prompt\n\n<detailed-context-and-tasks>"
}
```

**Begin Prompt Template:**

````markdown
@cursor

## Begin Prompt

<Brief description of the task>

**Context:**

- Current state: <what exists now>
- Target state: <what should exist>
- Reference files: <paths-to-similar-implementations>

**Tasks:**

1. <Specific task with code example if relevant>
2. <Next task>
3. <Final task>

**Pattern:**

```typescript
// Before
<current-code-snippet>

// After
<target-code-snippet>
```
````

**Acceptance:**

- <Criterion 1>
- <Criterion 2>
- <Criterion 3>

**Commands:**

```bash
cd <relevant-directory>
bun test <test-path>
```

```

### Phase 5: Report Summary
Output:
- ✅ Total tickets delegated
- ✅ Tickets with begin prompts added
- ✅ Any validation warnings
- ✅ Recommended execution order (based on blocking relationships)

## Input Patterns

### Pattern 1: List of IDs
```

Delegate these tickets to Cursor: ALF-308, ALF-309, ALF-310

```

### Pattern 2: Epic Children
```

Delegate all sub-tasks of ALF-307 to Cursor

```

### Pattern 3: Filter Criteria
```

Delegate all "infrastructure" tickets in "Backlog" state to Cursor

```

### Pattern 4: Priority Range
```

Delegate all Urgent and High priority tickets to Cursor

````

## Begin Prompt Generation

When creating begin prompts, include:

1. **Context Section:**
   - What currently exists
   - What's missing or broken
   - Reference implementations

2. **Tasks Section:**
   - Numbered list of specific actions
   - Code examples where helpful
   - File paths to create/modify

3. **Pattern/Example Section:**
   - Before/after code snippets
   - Common anti-patterns to avoid
   - Testing patterns

4. **Acceptance Section:**
   - Measurable criteria
   - Coverage requirements
   - Performance budgets (if applicable)

5. **Commands Section:**
   - How to run tests
   - How to validate changes
   - How to check coverage

## Best Practices

1. **Validate before delegating** - Ensure tickets have enough context for autonomous execution
2. **Check dependencies** - Don't delegate blocked tickets without delegating blockers first
3. **Prioritize clearly** - Use Linear priority field (1=Urgent, 2=High, 3=Medium, 4=Low)
4. **Add begin prompts for complex tasks** - Simple tasks may not need detailed prompts
5. **Link related tickets** - Use `relatedTo` to connect similar work
6. **Set estimates** - Use story points (1, 2, 3, 5, 8) for capacity planning

## Example Output

```markdown
## Delegation Summary

✅ Delegated 5 tickets to Cursor:
- ALF-308: Create privacy router test suite (Priority: Urgent)
- ALF-309: Create deploy router test suite (Priority: Urgent)
- ALF-310: Create fs/terminal router security tests (Priority: Urgent)
- ALF-311: Create sanitization repository tests (Priority: Urgent)
- ALF-312: Build reusable testing infrastructure (Priority: High)

✅ Added begin prompts to all 5 tickets

⚠️  Dependency Chain:
1. Start with ALF-312 (unblocks others)
2. Then parallel: ALF-308, 309, 310, 311

## Next Steps
Cursor agents can now pick up these tickets. Monitor progress in Linear.
````

## Common Issues

### Issue: Ticket missing context

**Solution:** Add more detail to description before delegating, or add comprehensive begin prompt

### Issue: Blocking relationships unclear

**Solution:** Use Linear `blocks` field to enforce execution order

### Issue: Begin prompt too generic

**Solution:** Include specific file paths, code examples, and validation commands

## Related Commands

- `/investigate-ticket` - Deep dive into a single ticket before delegation
- `/update-linear` - Update ticket status after completion
- `/implement-feature` - Full implementation workflow (complements delegation)

## Example Usage

### Example 1: Delegate Epic Children

```
/delegate-to-cursor all sub-tasks of ALF-307
```

### Example 2: Delegate Specific Tickets

```
/delegate-to-cursor ALF-308, ALF-309, ALF-310 with begin prompts
```

### Example 3: Delegate by Filter

```
/delegate-to-cursor all "infrastructure" tickets in "Backlog"
```

### Example 4: Validate Only (Dry Run)

```
/delegate-to-cursor --dry-run ALF-308, ALF-309, ALF-310
```
