# E2E Testing Standards

1. **AI-first output.** E2E tests default to AI-optimized output (`PLAYWRIGHT_AI_MODE=1`, `PLAYWRIGHT_FAIL_FAST=1`). Set `=0` to disable for human debugging.

2. **Structured errors.** Timeout errors must include operation name, elapsed time, page URL, and selector context for AI parsing.

3. **Screenshot references.** Error messages must include direct file paths to screenshots using `[SCREENSHOT] path` format for AI navigation.

4. **Hang detection.** Long-running operations (>5s) must log progress at 5-second intervals to prevent silent hangs.

5. **Crash monitoring.** Tests must attach crash reports (browser, page, context) with console/network error context when failures occur.

6. **Compact reporters.** Custom reporters for E2E must emit parseable JSON summaries bounded by `--- AI-PARSEABLE-SUMMARY-START/END ---` markers.

7. **Fail-fast default.** E2E test runs default to single worker, no parallelism, and `maxFailures: 1` for fastest feedback. Disable for full suite runs.

8. **Token efficiency.** Reporter error messages truncate at 500 characters with ellipsis; full errors remain in attachments.

9. **Performance budgets.** E2E operations have explicit budgets: navigation (5s), actions (2s), assertions (1s). Violations are logged but don't fail tests.

10. **Test harness fixtures.** Prefer unified test harness fixtures (`safeAction`, `safeAssert`) over raw Playwright APIs for automatic timeout/screenshot handling.

11. **Package boundaries.** E2E test utilities in `apps/*/` may import from `packages/test-kit` but test-kit must not import from `apps/*`. Use generic interfaces for cross-boundary types.

12. **Metrics integration.** E2E reporters must emit metrics to the global registry (`e2e_tests_total`, `e2e_test_duration_seconds`) using `safeRegisterCounter`/`safeRegisterHistogram`.
