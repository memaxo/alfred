# Explore Patterns

## Overview
Before implementing a new feature, systematically explore the codebase to find existing patterns to follow. This ensures consistency and reduces reinvention.

## Search Strategy

### 1. Find Similar Implementations
Use Grep to find files with similar functionality:
```
Grep: pattern="<keyword>" path="packages/" output_mode="files_with_matches"
```

Examples:
- Adding a tool? Search for `toolTicket`, `toolWeb`
- Adding a router? Search for `createTRPCRouter`
- Adding a schema? Search for `z.object`

### 2. Explore File Structure
Use Glob to understand directory organization:
```
Glob: glob_pattern="**/*.ts" target_directory="packages/<package>/src"
```

Check for patterns like:
- Single files vs folder structure
- Index files for exports
- Test file locations

### 3. Read Reference Implementations
Once you find similar code, read the full files:
```
Read: path="packages/<package>/src/<file>.ts"
```

Look for:
- Import patterns
- Export conventions
- Error handling approaches
- Logging patterns

### 4. Check Rules and Docs
Search `.ruler/` for relevant conventions:
```
Grep: pattern="<topic>" path=".ruler/"
```

Check `docs/architecture/` for design decisions:
```
Glob: glob_pattern="*.md" target_directory="docs/architecture"
```

## Pattern Checklist

For any new implementation, identify:

### Structure
- [ ] File naming convention
- [ ] Directory placement
- [ ] Export pattern (default vs named)

### Dependencies
- [ ] Which packages to import
- [ ] How to wire dependencies
- [ ] What to mock in tests

### Error Handling
- [ ] Error code format
- [ ] Logging conventions
- [ ] What to throw vs return

### Testing
- [ ] Test file location
- [ ] Mocking approach
- [ ] Test categories (unit, integration)

## Common Pattern Locations

| Pattern | Reference File |
|---------|----------------|
| Agent tools | `packages/agent/src/orchestrator/tool/ticket.ts` |
| tRPC routers | `packages/api/src/routers/note.ts` |
| DB repos | `packages/db/src/repo/rag.ts` |
| Zod schemas | `packages/type/src/stream.zod.ts` |
| Tests | `packages/agent/test/rag.test.ts` |

## Output
After exploration, document:
1. Which existing file to use as template
2. Which conventions apply
3. Which `.ruler/` rules are relevant
4. What tests to model after
