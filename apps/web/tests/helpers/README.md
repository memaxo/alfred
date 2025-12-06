# E2E Test Helpers

Comprehensive testing utilities following SOLID automation principles for visual regression and screenshot-based testing.

## Screenshot System Architecture

### SOLID Principles Applied

1. **Single Responsibility**: Each class handles one concern
   - `ScreenshotManager` - orchestrates capture and metadata
   - `StandardScreenshot` - basic capture strategy
   - `TimelineScreenshot` - sequenced captures
   - `ScreenshotMetadata` - data structure only

2. **Open/Closed**: Extensible through composition
   - Add new strategies by implementing `ScreenshotCapture`
   - Extend `ScreenshotStrategy` for custom behaviors
   - Compose helpers for complex flows

3. **Liskov Substitution**: Consistent interfaces
   - All strategies implement `ScreenshotCapture`
   - Interchangeable in `ScreenshotManager`

4. **Interface Segregation**: Focused contracts
   - `CaptureOptions` - only capture-related options
   - `ScreenshotMetadata` - only metadata fields
   - `TestPhase` - constrained phase values

5. **Dependency Inversion**: Abstract dependencies
   - Depend on Playwright's `Page` and `TestInfo`
   - Strategy pattern for capture behavior

## Quick Start

### Basic Usage

```typescript
import { test as base } from "@playwright/test";
import { createScreenshotManager, type ScreenshotManager } from "./helpers/screenshot";

const test = base.extend<{ screenshots: ScreenshotManager }>({
  screenshots: async ({ page }, use, testInfo) => {
    const manager = createScreenshotManager(page, testInfo);
    await use(manager);
  },
});

test("my test", async ({ page, screenshots }) => {
  await page.goto("/my-page");
  
  // Capture page load
  await screenshots.capturePageLoad("my_page");
  
  // Capture before/after action
  await screenshots.captureBeforeAction("click_button");
  await page.click("button");
  await screenshots.captureAfterAction("click_button");
  
  // Capture milestone
  await screenshots.captureMilestone("test_complete");
});
```

### Flow Capture Pattern

```typescript
import { createFlowCapture } from "./helpers/screenshot";

test("complete flow", async ({ page, screenshots }) => {
  const flow = createFlowCapture(screenshots);
  
  // Automatic before/after screenshots
  await flow.step("login", async () => {
    await page.fill("#email", "test@example.com");
    await page.click("#submit");
  });
  
  // Named milestones
  await flow.milestone("logged_in");
  
  // Checkpoint with assertion
  await flow.checkpoint("dashboard_loaded", async () => {
    await expect(page.getByText("Welcome")).toBeVisible();
  });
});
```

### Error Capture

```typescript
import { withErrorCapture } from "./helpers/screenshot";

test("error handling", async ({ page, screenshots }) => {
  await withErrorCapture(screenshots, "risky_operation", async () => {
    // If this throws, error screenshot is captured
    await page.click(".risky-button");
  });
});
```

## Configuration

### Environment Variables

```bash
# Enable screenshots on all tests (default: only-on-failure)
PLAYWRIGHT_SCREENSHOTS=1

# Slow down tests for visual debugging
PLAYWRIGHT_SLOW_MO=100
```

### Playwright Config

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    screenshot: process.env.PLAYWRIGHT_SCREENSHOTS === "1" 
      ? "on" 
      : "only-on-failure",
  },
  expect: {
    toHaveScreenshot: {
      threshold: 0.2,
      maxDiffPixelRatio: 0.05,
    },
  },
});
```

## Capture Options

```typescript
type CaptureOptions = {
  selector?: string;      // Capture specific element
  fullPage?: boolean;     // Full page screenshot
  mask?: string[];        // Mask elements (hide dynamic content)
  animations?: "disabled" | "allow";
  delay?: number;         // Wait before capture
  clip?: { x, y, width, height };
};
```

## Test Phases

Screenshots are organized by phase for analysis:

- `setup` - Initial page load, configuration
- `action` - User interactions
- `assertion` - Verification points
- `teardown` - Cleanup
- `error` - Failure states
- `milestone` - Key checkpoints

## Output Structure

```
test-results/
├── html-report/          # Playwright HTML report
├── results.json          # JSON test results
└── [test-name]/
    ├── screenshot-metadata.json
    ├── 001_page_loaded.png
    ├── 002_before_click.png
    ├── 003_after_click.png
    └── ...
```

## Visual Regression Testing

### Baseline Comparison

```typescript
import { expectVisualMatch } from "./helpers/screenshot";

test("visual match", async ({ page }) => {
  await page.goto("/my-page");
  
  // Compare against baseline
  await expectVisualMatch(page, "my_page_baseline", {
    threshold: 0.1,
    maxDiffPixels: 100,
  });
});
```

### Element Comparison

```typescript
await expectVisualMatch(page, "header", {
  selector: "header",
  threshold: 0.2,
});
```

## Best Practices

1. **Naming**: Use descriptive, lowercase names with underscores
2. **Timing**: Add delays for animations before capture
3. **Masking**: Mask dynamic content (timestamps, random IDs)
4. **Phases**: Set appropriate phase before captures
5. **Milestones**: Mark key test points for debugging
6. **Cleanup**: Screenshots auto-attach to test reports

## Running Tests

```bash
# Run all E2E tests with screenshots
PLAYWRIGHT_SCREENSHOTS=1 bun run test:e2e

# Run visual regression suite
bun run playwright test visual-regression

# Run with slow motion for debugging
PLAYWRIGHT_SLOW_MO=100 bun run test:e2e
```

## Files

- `screenshot.ts` - Core screenshot utilities
- `auth.ts` - Authentication helpers
- `mindscape.ts` - Mindscape-specific helpers
