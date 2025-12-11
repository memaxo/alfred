# Update Linear Ticket

## Overview
Update a Linear ticket to reflect implementation progress using the Linear MCP tools.

## Available Actions

### Get Issue Details
```
Use Linear MCP: get_issue
Arguments: { "id": "ALF-XXX" }
```

### Update Issue Status
```
Use Linear MCP: update_issue
Arguments: {
  "id": "ALF-XXX",
  "state": "In Progress" | "Done" | "Cancelled"
}
```

### Add Comment
```
Use Linear MCP: create_comment
Arguments: {
  "issueId": "ALF-XXX",
  "body": "Implementation complete. See commit abc123."
}
```

## Workflow States

### Starting Work
```
state: "In Progress"
```

### Implementation Complete
```
state: "Done"
```
Add comment with:
- Summary of what was implemented
- Files created/modified
- Test coverage
- Any follow-up items

### Blocked
```
state: "Blocked"
```
Add comment explaining:
- What is blocking
- What needs to be resolved
- Who can help

## Comment Templates

### Implementation Complete
```markdown
## Implementation Complete

### Changes
- Created `packages/agent/src/orchestrator/tool/rag/`
- Added 4 new tools: rag_ingest, rag_query, rag_list, rag_delete
- Added 20 unit tests

### Test Results
All tests passing: `bun test packages/agent/test/rag.test.ts`

### Commit
`feat(agent): add RAG document management tools` (abc123)

### Follow-up
- [ ] Integration tests with real database
- [ ] Performance testing with large documents
```

### Progress Update
```markdown
## Progress Update

### Completed
- [x] Schema definitions
- [x] Policy enforcement

### In Progress
- [ ] Execution logic

### Blocked By
None
```

## Best Practices

1. **Update early** - Move to "In Progress" when starting
2. **Comment on blockers** - Don't leave tickets stale
3. **Link commits** - Reference commit hashes in comments
4. **Close promptly** - Move to "Done" once merged
