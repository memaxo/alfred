# E2E Test Infrastructure Architecture

## Purpose

ALFRED's E2E test infrastructure is optimized for AI coding agent consumption, providing structured error output, deterministic timeout handling, and automatic crash detection. This enables AI agents to quickly identify failures, understand context, and debug issues without human intervention.

## Design Principles

1. **AI-First Output** - Default to compact, structured output optimized for token efficiency
2. **Fail-Fast Feedback** - Stop on first failure for immediate iteration cycles
3. **Structured Context** - Every error includes operation name, timing, URL, and screenshot references
4. **Deterministic Behavior** - Explicit timeouts, hang detection, and crash monitoring prevent silent failures
5. **Package Boundaries** - Core utilities in `@alfred/test-kit`, app-specific harness in `apps/web`

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Playwright Test Runner                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ AI Test Harness (apps/web/.tests/helpers/)          │  │
│  │                                                      │  │
│  │  • Screenshots (existing)                           │  │
│  │  • Error Monitor (existing)                         │  │
│  │  • Crash Monitor (test-kit/playwright)             │  │
│  │  • Timeout Handler (test-kit/playwright)           │  │
│  │  • safeAction() wrapper                            │  │
│  │  • safeAssert() wrapper                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ AI-Compact Reporter (.tests/reporters/)             │  │
│  │                                                      │  │
│  │  • Structured JSON output                           │  │
│  │  • 500-char error truncation                        │  │
│  │  • Screenshot path references                       │  │
│  │  • Metrics emission                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ @alfred/test-kit/playwright                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  • timeout.ts - Structured timeout handling                 │
│  • crash.ts - Browser crash detection                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ @alfred/metrics                                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  • e2e_tests_total (counter)                                │
│  • e2e_test_duration_seconds (histogram)                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. AI-Compact Reporter

**Location:** `apps/web/.tests/reporters/ai-compact-reporter.ts`

**Purpose:** Transform verbose Playwright output into token-efficient JSON summaries for AI consumption.

**Key Decisions:**

- Truncate errors at 500 chars (full text in attachments)
- Use AI-parseable markers for section boundaries
- Emit single-line failure summaries for quick scanning
- Integrate with Prometheus metrics registry

**Output Format:**

```json
{
  "status": "failed",
  "total": 15,
  "passed": 12,
  "failed": 3,
  "duration": 45231,
  "failures": [
    {
      "test": "workflow renders",
      "file": "./tests/workflow.e2e.spec.ts",
      "error": "Expected visible but got hidden...",
      "screenshot": "./test-results/error-workflow.png",
      "duration": 3241
    }
  ]
}
```

### 2. Structured Timeout Handling

**Location:** `packages/test-kit/src/playwright/timeout.ts`

**Purpose:** Provide deterministic timeout behavior with hang detection and structured error context.

**Key Decisions:**

- Custom `TimeoutError` class with full operation context
- 5-second progress logging for hang detection (matches `scripts/test-bun.ts` pattern)
- Wrap native Playwright timeouts to add context
- Support shared timeouts for multi-step workflows

**API:**

```typescript
// Single action with timeout
await withTimeout(page, "navigate-home", 5000, async () => {
  await page.goto("/");
});

// Element wait with hang detection
await waitForWithHangDetection(page, '[data-testid="workflow"]', {
  timeout: 30000,
  state: "visible",
});

// Multiple actions with shared timeout
await withSharedTimeout(page, "complete-workflow", 10000, [
  async () => page.goto("/"),
  async () => page.click("button"),
  async () => expect(page.locator(".result")).toBeVisible(),
]);
```

### 3. Crash Monitor

**Location:** `packages/test-kit/src/playwright/crash.ts`

**Purpose:** Detect and report browser/page crashes with structured context.

**Key Decisions:**

- Monitor `page.on("crash")`, `context.on("close")` events
- Collect console errors and network failures for context
- Follow test-kit fixture handle pattern for consistency
- Support optional screenshot integration via generic interface

**API:**

```typescript
const crashMonitor = createCrashMonitor(page, context, testInfo, screenshots);

// After test execution
await crashMonitor.attachReport();
if (crashMonitor.hasCrashed()) {
  console.log(crashMonitor.getReport());
}
```

### 4. AI Test Harness

**Location:** `apps/web/.tests/helpers/ai-harness.ts`

**Purpose:** Unified fixture combining all AI-optimized capabilities.

**Key Decisions:**

- Extend base Playwright test with custom fixtures
- Integrate existing screenshot/error monitoring
- Add `safeAction()` and `safeAssert()` wrappers for automatic error handling
- Keep app-specific to avoid package boundary violations

**API:**

```typescript
import { test, expect } from "./helpers/ai-harness";

test("workflow renders", async ({
  page,
  screenshots,
  safeAction,
  safeAssert,
}) => {
  await safeAction("navigate", async () => {
    await page.goto("/");
  });

  await safeAssert("workflow-visible", async () => {
    await expect(page.locator('[data-testid="workflow"]')).toBeVisible();
  });
});
```

### 5. Performance Budgets

**Location:** `packages/test-kit/src/performance/budget.ts`

**Purpose:** Define and track performance budgets for E2E operations.

**Key Decisions:**

- Extend existing cognitive/workflow budgets with E2E categories
- Navigation: 5000ms, Actions: 2000ms, Assertions: 1000ms
- Use existing `withBudget()` and `assertBudget()` infrastructure
- Violations logged but don't fail tests (informational only)

## Configuration

### Default Behavior

**AI Mode (default: enabled)**

- Shorter timeouts: 60s test, 10s expect
- Dot reporter for progress
- AI-compact reporter for structured output
- JSON reporter for programmatic access

**Fail-Fast (default: enabled)**

- Single worker (`workers: 1`)
- No parallelism (`fullyParallel: false`)
- Stop on first failure (`maxFailures: 1`)

### Override for Human Debugging

```bash
# Traditional verbose mode
PLAYWRIGHT_AI_MODE=0 PLAYWRIGHT_FAIL_FAST=0 bun run test:e2e

# Full screenshots
PLAYWRIGHT_SCREENSHOTS=1 bun run test:e2e
```

## Package Boundaries

### Test-Kit Module (`packages/test-kit/src/playwright/`)

**Can import:**

- `@playwright/test`
- Core utilities (no app-specific code)

**Cannot import:**

- `apps/web` code
- App-specific test helpers

**Exports:**

- `timeout.ts` - Structured timeout handling
- `crash.ts` - Browser crash detection
- Generic interfaces (e.g., `ScreenshotCapture`)

### App Test Helpers (`apps/web/.tests/helpers/`)

**Can import:**

- `@alfred/test-kit/playwright`
- `@playwright/test`
- App-specific screenshot utilities

**Exports:**

- `ai-harness.ts` - Unified AI test fixture
- `screenshot.ts` - Screenshot management (existing)

### Reporter (`apps/web/.tests/reporters/`)

**Can import:**

- `@playwright/test/reporter`
- `@alfred/metrics`

**Exports:**

- `ai-compact-reporter.ts` - AI-optimized reporter

## Integration with Existing Infrastructure

### Metrics

Reporter automatically emits to global registry:

- `e2e_tests_total` (counter, labels: status)
- `e2e_test_duration_seconds` (histogram, labels: test, status)

### Performance Budgets

E2E budgets extend existing categories in `@alfred/test-kit/performance`:

```typescript
{
  "e2e-navigation": 5000,
  "e2e-action": 2000,
  "e2e-assertion": 1000,
  // ... existing budgets
}
```

### Test-Kit Fixtures

Follows existing patterns from:

- `workflow/runtime-fixture.ts` - Handle pattern with cleanup
- `voice/runtime-fixture.ts` - Factory pattern with options
- `cognitive/vcr.ts` - Mock reset registry pattern

## Operational Considerations

### CI/CD

Default AI mode and fail-fast work well for CI:

- Fast feedback on failures
- Compact output doesn't flood logs
- Metrics available at `/api/metrics` endpoint

### Local Development

Developers can disable AI mode for verbose output:

```bash
PLAYWRIGHT_AI_MODE=0 PLAYWRIGHT_FAIL_FAST=0 bun run test:e2e
```

### Debugging Hangs

Hang detection logs appear every 5 seconds:

```
[HANG-CHECK] Waiting for "[data-testid="workflow"]" - 5s elapsed, 25s remaining
[HANG-CHECK] Waiting for "[data-testid="workflow"]" - 10s elapsed, 20s remaining
```

### Screenshot Storage

Screenshots remain in `test-results/` with full resolution. AI-compact reporter only references paths, not embeddings.

## Future Improvements

1. **Visual Regression** - Integrate with existing `expectVisualMatch()` helper
2. **Trace Analysis** - Parse Playwright traces for AI summarization
3. **Network Mocking** - VCR-style recording for deterministic E2E
4. **Parallel Execution** - Smart batching with fail-fast per batch
5. **Cost Tracking** - Token usage metrics for AI-compact reporter

## References

- Implementation: `apps/web/.tests/AI-INFRASTRUCTURE.md`
- Example: `apps/web/.tests/ai-harness-example.e2e.spec.ts`
- Rules: `apps/web/.ruler/e2e-testing.md`
