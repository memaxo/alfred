# Playwright AI Infrastructure

AI-optimized Playwright test infrastructure with structured output, timeout handling, crash detection, and performance budgets.

## Features

### 1. AI-Compact Reporter

Structured JSON output optimized for AI coding agent consumption.

**Location:** `apps/web/.tests/reporters/ai-compact-reporter.ts`

**Output format:**
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

**Features:**
- Token-efficient error messages (truncated to 500 chars)
- Screenshot path references in failures
- Single-line failure summaries for quick scanning
- Metrics integration (`e2e_tests_total`, `e2e_test_duration_seconds`)

### 2. Structured Timeout Handling

Deterministic timeout handling with hang detection and structured error context.

**Location:** `packages/test-kit/src/playwright/timeout.ts`

**Usage:**
```typescript
import { withTimeout, waitForWithHangDetection } from "@alfred/test-kit/playwright";

// Wrap action with timeout
await withTimeout(page, "navigate-home", 5000, async () => {
  await page.goto("/");
});

// Wait for element with hang detection (logs every 5s)
await waitForWithHangDetection(page, '[data-testid="workflow"]', {
  timeout: 30000,
  state: "visible"
});
```

**Features:**
- Structured `TimeoutError` with operation context
- Progress logging every 5s for hang detection
- Page URL and selector in error messages
- Matches `alfred_test_file_start` pattern from `scripts/test-bun.ts`

### 3. Crash Detection & Recovery

Browser/page crash monitoring with structured reporting.

**Location:** `packages/test-kit/src/playwright/crash.ts`

**Usage:**
```typescript
import { createCrashMonitor } from "@alfred/test-kit/playwright";

test("my test", async ({ page, context }, testInfo) => {
  const crashMonitor = createCrashMonitor(page, context, testInfo);

  // Test actions...

  await crashMonitor.attachReport();
  if (crashMonitor.hasCrashed()) {
    console.log(crashMonitor.getReport());
  }
});
```

**Features:**
- Monitors `page.on("crash")`, `context.on("close")`
- Collects console/network errors for context
- Attaches structured crash report to test artifacts
- Follows test-kit fixture handle pattern

### 4. AI Test Harness

Unified fixture combining all capabilities.

**Location:** `apps/web/.tests/helpers/ai-harness.ts`

**Usage:**
```typescript
import { test, expect } from "./helpers/ai-harness";

test("workflow renders", async ({ page, screenshots, safeAction, safeAssert }) => {
  // Safe action with timeout and screenshot on failure
  await safeAction("navigate", async () => {
    await page.goto("/");
  });

  await screenshots.capturePageLoad("home");

  // Safe assertion with screenshot on failure
  await safeAssert("workflow-visible", async () => {
    await expect(page.locator('[data-testid="workflow"]')).toBeVisible();
  });
});
```

**Fixture Properties:**
- `screenshots` - Screenshot manager for visual captures
- `errors` - Error monitor for runtime error detection
- `crashes` - Crash monitor for browser/page crash detection
- `safeAction` - Wrap action with timeout and screenshot on failure
- `safeAssert` - Assert with automatic screenshot capture on failure

### 5. Performance Budgets

E2E-specific performance budget categories.

**Location:** `packages/test-kit/src/performance/budget.ts`

**Categories:**
- `e2e-navigation`: 5000ms - Page navigation operations
- `e2e-action`: 2000ms - User actions (clicks, inputs)
- `e2e-assertion`: 1000ms - Assertion checks

**Usage:**
```typescript
import { withDefaultBudget, assertDefaultBudget } from "@alfred/test-kit/performance";

const { result, withinBudget } = await withDefaultBudget(
  "e2e-navigation",
  async () => page.goto("/")
);
expect(withinBudget).toBe(true);
```

## Configuration

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `PLAYWRIGHT_AI_MODE` | Enable AI-optimized output | `1` (enabled) |
| `PLAYWRIGHT_FAIL_FAST` | Stop on first failure | `1` (enabled) |
| `PLAYWRIGHT_SCREENSHOTS` | Capture all screenshots | `0` |

### Playwright Config

The `playwright.config.ts` automatically adjusts based on environment variables:

**AI Mode (`PLAYWRIGHT_AI_MODE=1`):**
- Shorter timeouts (60s test, 10s expect)
- Dot reporter + AI-compact reporter
- JSON output for programmatic access

**Fail-Fast Mode (`PLAYWRIGHT_FAIL_FAST=1`):**
- Single worker for deterministic output
- No parallelism
- Stop on first failure (`maxFailures: 1`)

## Running Tests

```bash
# Standard E2E run (AI mode, fail-fast by default)
bun run test:e2e

# Traditional verbose mode (disable AI optimizations)
PLAYWRIGHT_AI_MODE=0 PLAYWRIGHT_FAIL_FAST=0 bun run test:e2e

# Full debugging with all screenshots
PLAYWRIGHT_SCREENSHOTS=1 bun run test:e2e

# Specific test with AI mode
bunx playwright test ai-harness-example.e2e.spec.ts
```

## Metrics Integration

The AI-compact reporter automatically records metrics to the global registry:

- `e2e_tests_total` (counter) - Total tests by status
- `e2e_test_duration_seconds` (histogram) - Test duration by name and status

These metrics are available at `/api/metrics` endpoint.

## Examples

### Basic AI Harness Usage

See `apps/web/.tests/ai-harness-example.e2e.spec.ts` for a complete example.

### Timeout Handling

```typescript
import { withTimeout, TimeoutError } from "@alfred/test-kit/playwright";

try {
  await withTimeout(page, "slow-operation", 5000, async () => {
    await page.waitForSelector(".slow-element");
  });
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log(`Operation: ${error.context.operation}`);
    console.log(`Elapsed: ${error.context.elapsed}ms`);
    console.log(`Page URL: ${error.context.pageUrl}`);
  }
}
```

### Crash Monitoring

```typescript
import { createCrashMonitor } from "@alfred/test-kit/playwright";

test("crash-prone test", async ({ page, context }, testInfo) => {
  const crashMonitor = createCrashMonitor(page, context, testInfo);

  // Risky operations...

  if (crashMonitor.hasCrashed()) {
    const crashes = crashMonitor.getCrashes();
    console.log(`Detected ${crashes.length} crashes`);
  }

  await crashMonitor.attachReport();
});
```

## Architecture

```
packages/test-kit/src/playwright/
├── index.ts           # Exports
├── timeout.ts         # Structured timeout handling
└── crash.ts           # Crash detection/recovery

apps/web/.tests/
├── reporters/
│   └── ai-compact-reporter.ts    # AI-optimized reporter
└── helpers/
    ├── screenshot.ts              # Screenshot utilities (existing)
    └── ai-harness.ts             # Unified AI test harness
```

## Integration Points

### Test-Kit Module Pattern

Follows the existing pattern from `@alfred/test-kit` with modules like `voice/`, `workflow/`, `cognitive/`.

### Performance Budget Pattern

Extends `BUDGET_DEFAULTS` with E2E categories matching cognitive/workflow budgets.

### Metrics Registry

Uses `safeRegisterCounter` and `safeRegisterHistogram` from `@alfred/metrics`.

### Protocol Events

Event structure matches patterns from `@alfred/protocol/events`.

## Benefits for AI Coding Agents

1. **Compact Output** - JSON summaries with truncated errors reduce token usage
2. **Structured Errors** - TimeoutError includes full context for debugging
3. **Quick Scanning** - Single-line failure summaries enable fast failure identification
4. **Screenshot References** - Direct paths to visual evidence in error messages
5. **Fail-Fast** - Stop on first failure for faster feedback cycles
6. **Hang Detection** - Progress logs every 5s prevent silent hangs
7. **Crash Reports** - Structured crash data with console/network context
8. **Performance Budgets** - Built-in assertions for operation timing
