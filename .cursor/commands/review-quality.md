# Review Code Quality

## Overview

Review recent changes for code quality issues, type safety problems, and violations of ALFRED conventions.

## Scope

Review files changed in recent commits or currently staged:

```bash
git diff --name-only HEAD~3
git diff --staged --name-only
```

## Quality Checklist

### Type Safety

#### Critical (Must Fix)

- [ ] No `any` types (except JSONB `as any` which is documented)
- [ ] No `@ts-ignore` or `@ts-expect-error` without justification
- [ ] No implicit `any` from untyped imports
- [ ] Function return types explicit on public APIs
- [ ] Zod schemas match TypeScript types

#### Warning (Should Fix)

- [ ] Prefer `unknown` over `any` for truly unknown data
- [ ] Use type guards instead of type assertions
- [ ] Generic types have meaningful constraints
- [ ] Union types are exhaustively handled

### Code Quality

#### Structure

- [ ] Functions under 50 lines (30 for hot paths)
- [ ] Files under 500 lines
- [ ] Single responsibility per function
- [ ] No deeply nested conditionals (max 3 levels)

#### Naming

- [ ] Single-word file names (per `.ruler/01-naming-conventions.md`)
- [ ] Descriptive variable names (no single letters except loops)
- [ ] Consistent naming patterns with codebase

#### Error Handling

- [ ] Errors have descriptive codes: `<domain>_<reason>`
- [ ] Async errors are caught or propagated
- [ ] No swallowed errors (empty catch blocks)
- [ ] User-facing errors don't expose internals

### ALFRED Conventions

#### From `.ruler/`

- [ ] Pure functions where possible
- [ ] Side effects at boundaries only
- [ ] Policy enforcement for sensitive operations
- [ ] Structured logging with context

#### Imports

- [ ] No circular dependencies
- [ ] Server-only modules not in client bundles
- [ ] Relative imports within package
- [ ] Type imports use `import type`

## Review Process

### 1. Run Static Checks

```bash
bun run typecheck
bun run lint
```

### 2. Read Each Changed File

For each file, check:

- Type annotations complete?
- Error handling appropriate?
- Follows existing patterns?
- Tests exist?

### 3. Report Findings

#### Format

````markdown
## Quality Review: [feature/file]

### Critical Issues

1. **[File:Line]** - [Issue]

   ```typescript
   // Bad
   const data: any = response.body;

   // Good
   const data = responseSchema.parse(response.body);
   ```
````

### Warnings

1. **[File:Line]** - [Issue]
   - Suggestion: [Fix]

### Suggestions

1. **[File]** - [Improvement idea]

```

### 4. Fix or Flag
- Fix critical issues immediately
- Create TODOs for warnings
- Note suggestions for future
```
