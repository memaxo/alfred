# Code Quality Corrections

## Overview

This document captures common code quality issues detected by linters or human review, codified from actual corrections made during package development.

## Core Principle

Write code that passes linters and human review on first attempt by following these specific patterns. These are not style preferences—they prevent real bugs and improve maintainability.

## Rules

### TypeScript Specifics

1. **Readonly class properties.** Mark class properties `readonly` if they should never be reassigned after initialization. This prevents accidental mutation bugs.

```typescript
// ✅ Correct: readonly prevents reassignment
class Detector {
  private readonly handlers: Handler[] = [];
}

// ❌ Wrong: allows accidental reassignment
class Detector {
  private handlers: Handler[] = [];
}
```

2. **No redundant async.** Don't mark functions `async` if they only return a Promise without using `await` internally. The async keyword adds overhead and hides the synchronous nature.

```typescript
// ✅ Correct: returns Promise directly
export function race<T>(a: Promise<T>, b: Promise<T>): Promise<T> {
  return Promise.race([a, b]);
}

// ❌ Wrong: unnecessary async wrapper
export async function race<T>(a: Promise<T>, b: Promise<T>): Promise<T> {
  return Promise.race([a, b]);
}
```

3. **Explicit .js extensions in exports.** ESM requires explicit file extensions even when importing TypeScript files. Always use `.js` extensions in `export` statements.

```typescript
// ✅ Correct: explicit .js extensions
export * from "./abort.js";
export * from "./transitions.js";

// ❌ Wrong: missing extensions
export * from "./abort";
export * from "./transitions";
```

4. **Alphabetize exports.** Sort module exports alphabetically to reduce merge conflicts and improve scanability.

```typescript
// ✅ Correct: alphabetical order
export * from "./abort.js";
export * from "./escalation.js";
export * from "./transitions.js";

// ❌ Wrong: random order
export * from "./abort.js";
export * from "./transitions.js";
export * from "./escalation.js";
```

### Function Formatting

5. **Multi-line type signatures.** Break long type signatures across lines at logical boundaries (after parameter names or return types).

```typescript
// ✅ Correct: broken at parameter
export type Handler = (
  event: EscalationEvent
) => void | Promise<void>;

// ❌ Wrong: long single line
export type Handler = (event: EscalationEvent) => void | Promise<void>;
```

### Class Design

6. **Readonly collections.** Mark private collections `readonly` unless the collection reference itself needs to change. Items can still be added/removed from readonly arrays/maps.

```typescript
// ✅ Correct: readonly reference, mutable contents
class Store {
  private readonly items: Item[] = [];
  
  add(item: Item) {
    this.items.push(item); // Works fine
  }
}

// ❌ Wrong: allows accidental reassignment of entire array
class Store {
  private items: Item[] = [];
  
  reset() {
    this.items = []; // Dangerous - easy to do by mistake
  }
}
```

## Detection and Prevention

### Pre-commit Checks

These issues are caught by:

- **Biome linter** - Catches async/readonly/formatting issues
- **Lefthook pre-commit** - Runs formatters automatically
- **TypeScript compiler** - Catches missing .js extensions

### Manual Review Patterns

When reviewing code, check for:

1. Class properties that could be `readonly`
2. `async` functions that don't use `await`
3. Missing `.js` extensions in exports
4. Non-alphabetical export ordering
5. Long type signatures on single lines

### IDE Configuration

Configure your IDE to:

- Auto-add `.js` extensions on imports
- Highlight `async` functions without `await`
- Sort exports alphabetically on save
- Suggest `readonly` modifiers

## Migration Guide

To fix existing code:

```bash
# Run Biome linter with auto-fix
bun run lint --fix

# Check for missing .js extensions
rg "from ['\"]\./" packages/*/src/index.ts

# Check for non-readonly class properties
rg "private \w+:" packages/*/src/*.ts
```

## Rationale

### Why readonly matters

```typescript
class Guard {
  private maxCount = 50; // Oops, reassignable
  
  someMethod() {
    this.maxCount = 100; // Accidental mutation
  }
}
```

With `readonly`, the compiler prevents this bug.

### Why async matters

```typescript
async function wrapper() {
  return Promise.race([a, b]);
}

// Creates: async wrapper -> Promise -> Promise (nested!)
// Instead of: wrapper -> Promise (direct)
```

The extra promise wrapper adds overhead and makes stack traces harder to read.

### Why .js extensions matter

```typescript
// Works in TypeScript, breaks in Node ESM
import { foo } from "./bar";

// Works everywhere
import { foo } from "./bar.js";
```

Node's ESM loader doesn't do extension resolution—you must be explicit.

## Enforcement

Add to CI:

```yaml
- name: Check code quality
  run: |
    bun run lint --check
    bun run typecheck
```

This catches all these issues before merge.
