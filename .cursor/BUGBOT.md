# Bugbot Rules for ALFRED

## Scope Exclusion

Bugbot should **NOT** review documentation files. Skip all markdown files:

```text
Exclude files matching: **/*.md, **/*.mdx, **/docs/**, **/.cursor/**/*.md
```

## Code Quality Rules

### Type Safety: No `any` Types

```text
For files matching **/*.{ts,tsx}:
If a changed file contains /\b:\s*any\b|\bas\s+any\b|:\s*any\s*[,\[\]\)]|any\[\]/ and does NOT contain "as any" with a comment explaining JSONB limitation, then:
- Add a blocking Bug titled "Unsafe `any` type usage"
- Body: "TypeScript `any` types bypass type checking. Use `unknown` for truly unknown data, or define proper types. Exception: JSONB fields with documented `as any` pattern are allowed."
- Apply label "type-safety"
```

### Type Safety: No Type Suppressions

```text
For files matching **/*.{ts,tsx}:
If a changed file contains /@ts-(ignore|expect-error|nocheck)/, then:
- Add a blocking Bug titled "TypeScript suppression directive found"
- Body: "Type suppressions (`@ts-ignore`, `@ts-expect-error`) indicate type errors that should be fixed. Fix the root cause instead of suppressing. See `.ruler/09-purity-and-performance.md` rule 9."
- Apply label "type-safety"
```

### Error Handling: No Swallowed Errors

```text
For files matching **/*.{ts,tsx,js,jsx}:
If a changed file contains /catch\s*\([^)]*\)\s*\{\s*\}/ or /catch\s*\([^)]*\)\s*\{\s*\/\/.*\s*\}/, then:
- Add a blocking Bug titled "Swallowed error in catch block"
- Body: "Empty catch blocks hide errors. Log errors with context or re-throw with additional information. See `.ruler/16-error-handling.md`."
- Apply label "error-handling"
```

### Error Handling: Missing Error Context

```text
For files matching **/*.{ts,tsx}:
If a changed file contains /throw\s+new\s+Error\(["']\w+["']\)/ (simple string errors without context), then:
- Add a non-blocking Bug titled "Error message lacks context"
- Body: "Error messages should include context (IDs, operation names, input values). Use structured error codes: `<domain>_<reason>`. See `.ruler/16-error-handling.md`."
- Apply label "error-handling"
```

### Code Quality: Console Statements

```text
For files matching **/*.{ts,tsx,js,jsx}:
If a changed file contains /console\.(log|warn|error|debug|info)\(/ and is NOT in a test file (**/*.test.ts, **/*.spec.ts), then:
- Add a blocking Bug titled "Console statement in production code"
- Body: "Use structured logging (`@alfred/logger`) instead of console statements. Console statements should only appear in tests. See `.ruler/09-purity-and-performance.md`."
- Apply label "code-quality"
```

### Code Quality: Function Length

```text
For files matching **/*.{ts,tsx}:
If a changed file contains functions exceeding 50 lines (30 for `.hot.ts` files), then:
- Add a non-blocking Bug titled "Function exceeds length limit"
- Body: "Functions should be ≤50 lines (≤30 for hot paths). Extract logic into smaller, focused functions. See `.ruler/09-purity-and-performance.md` rule 10."
- Apply label "code-quality"
```

### Code Quality: File Length

```text
For files matching **/*.{ts,tsx}:
If a changed file exceeds 500 lines, then:
- Add a non-blocking Bug titled "File exceeds length limit"
- Body: "Files should be ≤500 lines. Consider splitting into focused modules. See `.ruler/09-purity-and-performance.md` rule 10."
- Apply label "code-quality"
```

### Naming Conventions: Multi-Word Files

```text
For files matching packages/**/*.{ts,tsx}:
If a changed file path contains /[a-z]+-[a-z]+/ (kebab-case) and is NOT in apps/** or a framework-reserved file (_layout.tsx, +not-found.tsx), then:
- Add a non-blocking Bug titled "Naming convention violation"
- Body: "Files must use single-word names (e.g., `remind.ts`, not `create-remind.ts`). See `.ruler/01-naming-conventions.md` rule 1."
- Apply label "naming"
```

### Security: Dangerous Dynamic Execution

```text
For files matching **/*.{ts,tsx,js,jsx,py}:
If a changed file contains /\beval\s*\(|\bexec\s*\(|Function\s*\(/, then:
- Add a blocking Bug titled "Dangerous dynamic execution"
- Body: "Usage of eval/exec/Function constructor is dangerous. Replace with safe alternatives or justify with detailed comment and tests. See `.ruler/03-security.md`."
- Apply label "security"
```

### Security: Hardcoded Secrets

```text
For files matching **/*.{ts,tsx,js,jsx}:
If a changed file contains /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/i, then:
- Add a blocking Bug titled "Potential hardcoded secret"
- Body: "Secrets must come from environment variables, never hardcoded. Use `process.env` or `Bun.env`. See `.ruler/03-security.md` rule 1."
- Apply label "security"
```

### Performance: Missing AbortSignal Propagation

```text
For files matching **/*.{ts,tsx}:
If a changed file contains async functions that accept `AbortSignal` but don't propagate it to nested async calls (fetch, db queries, etc.), then:
- Add a non-blocking Bug titled "AbortSignal not propagated"
- Body: "Always propagate abort signals through async chains. Pass `signal` to fetch, database queries, and other cancellable operations. See `.ruler/13-streaming-patterns.md` rule 10."
- Apply label "performance"
```

### Performance: Unbounded Array Operations

```text
For files matching **/*.{ts,tsx}:
If a changed file contains /\.(map|filter|forEach)\(.*\)\.(map|filter|forEach)\(/ (chained array operations without intermediate limits), then:
- Add a non-blocking Bug titled "Potential unbounded array operations"
- Body: "Chained array operations without limits can cause performance issues. Consider `.slice()` limits or batch processing for large datasets."
- Apply label "performance"
```

### Testing: Missing Tests for Critical Changes

```text
If the PR modifies files in {packages/**/src/**/*.ts, packages/**/src/**/*.tsx} and there are no changes in {**/*.test.ts, **/*.spec.ts, **/__tests__/**}, then:
- Add a non-blocking Bug titled "Missing tests for code changes"
- Body: "This PR modifies source code but includes no accompanying tests. Please add or update tests. See `.ruler/05-testing.md`."
- Apply label "testing"
```

### Architecture: Server Code in Client Bundle

```text
For files matching apps/web/src/**/*.{ts,tsx}:
If a changed file imports from {@alfred/db, @alfred/agent, @alfred/policy, pg, drizzle-orm} without dynamic import, then:
- Add a blocking Bug titled "Server-only module imported in client code"
- Body: "Server-only packages must be dynamically imported or externalized. Use `await import()` or ensure Vite externalization. See `.ruler/02-architecture.md` rule 3."
- Apply label "architecture"
```

### Architecture: Circular Dependencies

```text
For files matching packages/**/*.{ts,tsx}:
If a changed file imports from a package that imports back (creating circular dependency), then:
- Add a blocking Bug titled "Circular dependency detected"
- Body: "Circular dependencies cause runtime errors. Use dynamic imports or extract shared code to `@alfred/type`. See `.ruler/02-architecture.md` rule 11."
- Apply label "architecture"
```

### Database: Raw SQL Instead of Drizzle

```text
For files matching packages/db/**/*.{ts,tsx}:
If a changed file contains /db\.execute\(sql`/ or /db\.query\(sql`/ instead of Drizzle query builder, then:
- Add a non-blocking Bug titled "Raw SQL instead of Drizzle query builder"
- Body: "Use Drizzle's type-safe query builder (`db.select().from(table).where(...)`) instead of raw SQL. See `.ruler/19-drizzle-patterns.md` rule 1."
- Apply label "database"
```

### React: Missing Key Props

```text
For files matching **/*.{tsx,jsx}:
If a changed file contains /\.map\(.*=>\s*<[A-Z]\w+.*\)/ without `key` prop in the mapped JSX, then:
- Add a blocking Bug titled "Missing key prop in list rendering"
- Body: "React requires `key` props for list items. Use stable, unique identifiers. Never use array indices. See `.ruler/12-component-development.md`."
- Apply label "react"
```

### React: Side Effects in Render

```text
For files matching **/*.{tsx,jsx}:
If a changed file contains side effects (mutations, API calls, state updates) directly in component body (not in useEffect), then:
- Add a blocking Bug titled "Side effects in render function"
- Body: "Side effects belong in `useEffect` hooks, not in render functions. Render functions must be pure. See `.ruler/12-component-development.md` rule 2."
- Apply label "react"
```

### Async: Missing Error Handling

```text
For files matching **/*.{ts,tsx}:
If a changed file contains /await\s+\w+\(/ without try-catch or `.catch()` handler in the same function, then:
- Add a non-blocking Bug titled "Unhandled async operation"
- Body: "Async operations can fail. Wrap in try-catch or use `.catch()` to handle errors gracefully. See `.ruler/16-error-handling.md`."
- Apply label "async"
```

### Memory: Potential Memory Leaks

```text
For files matching **/*.{ts,tsx}:
If a changed file contains `setInterval`, `setTimeout`, or event listeners without cleanup in useEffect return or finally block, then:
- Add a blocking Bug titled "Potential memory leak"
- Body: "Timers and event listeners must be cleaned up. Return cleanup function from `useEffect` or clear in `finally` blocks."
- Apply label "memory"
```

## Bug Classification

- **Blocking**: Type safety, security, architecture violations, memory leaks
- **Non-blocking**: Code quality, performance, testing gaps, naming conventions

## Rule Priority

1. Security issues (blocking)
2. Type safety violations (blocking)
3. Architecture violations (blocking)
4. Memory leaks (blocking)
5. Error handling issues (blocking for swallowed errors, non-blocking for context)
6. Code quality (non-blocking)
7. Testing gaps (non-blocking)
