# Test Dependency Injection Pattern

## Problem

Bun's `mock.module()` is process-global and pollutes other test files in the same run. Tests that pass in isolation fail when run together.

## Solution

Replace `mock.module()` with dependency injection via tRPC context.

## Pattern

### 1. Define Dependencies Interface

```typescript
// packages/api/src/deps.ts
import type { CognitiveRepo } from "@alfred/db";
import type { PolicyEvaluator } from "@alfred/policy";
import type { EmbedService } from "@alfred/embed";

export type RouterDeps = {
  cognitiveRepo: typeof import("@alfred/db").cognitiveRepo;
  policy: {
    evaluate: typeof import("@alfred/policy").evaluate;
  };
  embed: {
    embedMany: typeof import("@alfred/embed").embedMany;
    cosineSimilarity: typeof import("@alfred/embed").cosineSimilarity;
  };
  runtime: {
    runCognitiveLoop: typeof import("@alfred/runtime").runCognitiveLoop;
  };
};
```

### 2. Create Default Dependencies

```typescript
// packages/api/src/deps.ts
import { cognitiveRepo } from "@alfred/db";
import { evaluate } from "@alfred/policy";
import { embedMany, cosineSimilarity } from "@alfred/embed";
import { runCognitiveLoop } from "@alfred/runtime";

export const defaultDeps: RouterDeps = {
  cognitiveRepo,
  policy: { evaluate },
  embed: { embedMany, cosineSimilarity },
  runtime: { runCognitiveLoop },
};
```

### 3. Inject via Context

```typescript
// packages/api/src/context.ts
export type Context = {
  session: Session | null;
  runtime: RuntimeContext;
  deps: RouterDeps; // Add deps to context
};

export function createContext(opts: { deps?: Partial<RouterDeps> }): Context {
  return {
    session: null,
    runtime: createRuntimeContext(),
    deps: { ...defaultDeps, ...opts.deps },
  };
}
```

### 4. Use in Router

```typescript
// packages/api/src/routers/cognitive.ts
export const cognitiveRouter = router({
  state: authedProcedure
    .input(z.object({ streamId: z.string().default("default") }))
    .query(async ({ ctx, input }) => {
      // Use deps from context instead of direct imports
      const snapshot = await ctx.deps.cognitiveRepo.getLatestSnapshot(input.streamId);
      // ...
    }),

  feedback: authedProcedure
    .input(feedbackInput)
    .use(requirePolicy(mapResource, buildContext))
    .mutation(async ({ ctx, input }) => {
      // Use deps from context
      const vectors = await ctx.deps.embed.embedMany([input.expected, input.actual]);
      // ...
    }),
});
```

### 5. Test with Mock Dependencies

```typescript
// packages/api/test/cognitive.router.test.ts
import { describe, expect, it, vi } from "bun:test";
import { createTestCaller } from "./utils/trpc";

describe("cognitive router", () => {
  it("submits feedback", async () => {
    // Create mock deps
    const mockDeps = {
      cognitiveRepo: {
        getLatestSnapshot: vi.fn().mockResolvedValue(null),
        appendEvent: vi.fn().mockResolvedValue(undefined),
      },
      embed: {
        embedMany: vi.fn().mockResolvedValue([[1, 0], [0, 1]]),
        cosineSimilarity: vi.fn().mockReturnValue(0.8),
      },
      policy: {
        evaluate: vi.fn().mockResolvedValue({ allow: true, obligations: [] }),
      },
    };

    // Pass mock deps to test caller
    const caller = await createTestCaller({ deps: mockDeps });
    
    const result = await caller.cognitive.feedback({
      streamId: "test",
      expected: "hello",
      actual: "hi",
    });

    expect(mockDeps.embed.embedMany).toHaveBeenCalledWith(["hello", "hi"]);
  });
});
```

## Migration Priority

Skipped tests that need DI migration (in priority order):

| Package | Test File | Dependencies to Inject |
|---------|-----------|----------------------|
| `@alfred/api` | `cognitive.router.test.ts` | `@alfred/runtime`, `@alfred/policy`, `@alfred/embed` |
| `@alfred/api` | `deploy.router.test.ts` | `@alfred/db/repo/deploy`, `@alfred/agent/orchestrator/tool/*` |
| `@alfred/api` | `workflow.runtime-stream-provenance.integration.test.ts` | `@alfred/runtime`, `@alfred/rag` |
| `@alfred/runtime` | `lifecycle-learning.test.ts` | `@alfred/db`, `@alfred/plan` |
| `@alfred/runtime` | `supervisor.integration.test.ts` | Cognitive/workflow modules |
| `@alfred/runtime` | `review.persistence.test.ts` | `@alfred/db`, `@alfred/plan` |

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
