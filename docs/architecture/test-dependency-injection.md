# Test Dependency Injection Pattern

## Problem

Bun's `mock.module()` is process-global and pollutes other test files in the same run. Tests that pass in isolation fail when run together.

## Solution

Replace `mock.module()` with dependency injection via tRPC context.

## Implementation (packages/api/src/deps.ts)

The `RouterDeps` type and utilities are defined in `packages/api/src/deps.ts`:

```typescript
// Dependency interfaces
export type EmbedDeps = {
  embedMany: (texts: string[]) => Promise<number[][]>;
  cosineSimilarity: (a: number[], b: number[]) => number;
};

export type CognitiveDeps = {
  cognitiveRepo: CognitiveRepo;
};

export type PolicyDeps = {
  evaluate: (
    resource: unknown,
    context: unknown
  ) => Promise<{ allow: boolean; obligations: unknown[] }>;
};

// Combined type
export type RouterDeps = {
  embed?: Partial<EmbedDeps>;
  cognitive?: Partial<CognitiveDeps>;
  policy?: Partial<PolicyDeps>;
  runtime?: Partial<RuntimeDeps>;
  workflow?: Partial<WorkflowDeps>;
  plan?: Partial<PlanDeps>;
};

// Create mocks for testing
export function createMockDeps(overrides: Partial<RouterDeps> = {}): RouterDeps;
```

## Context Integration (packages/api/src/context.ts)

```typescript
export type Context = {
  session: AuthSession | null;
  runtime: RuntimeMetadata;
  runtimeContext: RuntimeContext;
  policy?: { obligations: Obligation[] };
  deps?: RouterDeps; // Injectable dependencies
};
```

## Test Caller (packages/api/test/utils/trpc.ts)

```typescript
type CreateCallerOptions = {
  userId?: string;
  deps?: RouterDeps; // Pass deps here
};

const caller = await createTestCaller({
  deps: {
    embed: {
      embedMany: vi.fn().mockResolvedValue([[1, 0]]),
      cosineSimilarity: vi.fn().mockReturnValue(0.8),
    },
  },
});
```

## Router Usage Pattern

```typescript
// In router: Use ctx.deps with fallback to direct import
export const cognitiveRouter = router({
  feedback: authedProcedure.mutation(async ({ ctx, input }) => {
    // Use injected dep or fall back to direct import
    const embedFn = ctx.deps?.embed?.embedMany ?? embedMany;
    const vectors = await embedFn([input.expected, input.actual]);
    // ...
  }),
});
```

## Migration Priority

Skipped tests that need DI migration (in priority order):

| Package           | Test File                                                | Dependencies to Inject                                        |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| `@alfred/api`     | `cognitive.router.test.ts`                               | `@alfred/runtime`, `@alfred/policy`, `@alfred/embed`          |
| `@alfred/api`     | `deploy.router.test.ts`                                  | `@alfred/db/repo/deploy`, `@alfred/agent/orchestrator/tool/*` |
| `@alfred/api`     | `workflow.runtime-stream-provenance.integration.test.ts` | `@alfred/runtime`, `@alfred/rag`                              |
| `@alfred/runtime` | `lifecycle-learning.test.ts`                             | `@alfred/db`, `@alfred/plan`                                  |
| `@alfred/runtime` | `supervisor.integration.test.ts`                         | Cognitive/workflow modules                                    |
| `@alfred/runtime` | `review.persistence.test.ts`                             | `@alfred/db`, `@alfred/plan`                                  |

## Alternative: File Isolation

For tests that cannot be easily migrated to DI, use:

```bash
ALFRED_TEST_ISOLATE_FILES=1 bun test packages/api
```

This runs each test file in a separate process, preventing `mock.module()` pollution.

## Rules

1. **Prefer DI over mock.module()** for new tests
2. **Inject via context** not constructor parameters
3. **Default deps** should be production implementations
4. **Test deps** should be explicit mocks with assertions
5. **Never mix** mock.module() and DI in the same test file
