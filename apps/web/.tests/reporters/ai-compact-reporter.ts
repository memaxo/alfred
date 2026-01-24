/**
 * AI-Compact Playwright Reporter
 *
 * Outputs structured, token-efficient test summaries optimized for AI coding agents.
 * Follows ALFRED's naming conventions and integrates with metrics registry.
 */

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

import {
  safeRegisterCounter,
  safeRegisterHistogram,
} from "@alfred/metrics/registry";

type FailureSummary = {
  test: string;
  file: string;
  error: string;
  screenshot?: string;
  trace?: string;
  duration: number;
};

type AISummary = {
  status: "passed" | "failed" | "timedOut" | "interrupted";
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures: FailureSummary[];
};

// Metrics integration
const e2eTestsTotal = safeRegisterCounter({
  name: "e2e_tests_total",
  help: "Total E2E tests executed",
  labelNames: ["status"],
});

const e2eTestDuration = safeRegisterHistogram({
  name: "e2e_test_duration_seconds",
  help: "E2E test duration in seconds",
  labelNames: ["test", "status"],
  buckets: [1, 5, 10, 30, 60, 120],
});

export default class AICompactReporter implements Reporter {
  private summary: AISummary = {
    status: "passed",
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    failures: [],
  };
  private startTime = 0;

  private writeOut(s: string): void {
    try {
      process.stdout.write(s);
    } catch {
      // ignore
    }
  }

  onBegin(_config: FullConfig, _suite: Suite) {
    this.startTime = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.summary.total++;

    const durationSeconds = result.duration / 1000;

    if (result.status === "passed") {
      this.summary.passed++;
      e2eTestsTotal.inc({ status: "passed" });
      e2eTestDuration.observe(
        { test: test.title, status: "passed" },
        durationSeconds
      );
      return;
    }

    if (result.status === "skipped") {
      this.summary.skipped++;
      e2eTestsTotal.inc({ status: "skipped" });
      return;
    }

    this.summary.failed++;
    e2eTestsTotal.inc({ status: "failed" });
    e2eTestDuration.observe(
      { test: test.title, status: "failed" },
      durationSeconds
    );

    // Extract first error, truncate to 500 chars for AI context efficiency
    const errorMessage = result.errors[0]?.message ?? "Unknown error";
    const truncatedError =
      errorMessage.slice(0, 500) + (errorMessage.length > 500 ? "..." : "");

    // Find screenshot attachment path
    const screenshot = result.attachments.find(
      (a) => a.contentType === "image/png" && a.name.includes("error")
    );

    // Find trace attachment
    const trace = result.attachments.find((a) => a.name === "trace");

    this.summary.failures.push({
      test: test.title,
      file: test.location.file.replace(process.cwd(), "."),
      error: truncatedError,
      screenshot: screenshot?.path,
      trace: trace?.path,
      duration: result.duration,
    });
  }

  onEnd(result: FullResult) {
    this.summary.status = result.status;
    this.summary.duration = Date.now() - this.startTime;

    // Output compact JSON for AI parsing
    this.writeOut("\n--- AI-PARSEABLE-SUMMARY-START ---\n");
    this.writeOut(`${JSON.stringify(this.summary, null, 2)}\n`);
    this.writeOut("--- AI-PARSEABLE-SUMMARY-END ---\n");

    // Output human-readable single-line summary
    const { passed, failed, skipped, total, duration } = this.summary;
    this.writeOut(
      `\n[RESULT] ${result.status.toUpperCase()} | ` +
        `${passed}/${total} passed | ${failed} failed | ${skipped} skipped | ` +
        `${(duration / 1000).toFixed(1)}s\n`
    );

    // Output failure one-liners for quick AI scanning
    if (this.summary.failures.length > 0) {
      this.writeOut("\n[FAILURES]\n");
      for (const f of this.summary.failures) {
        const errorLine = f.error.split("\n")[0];
        this.writeOut(`  ${f.file}:${f.test} - ${errorLine}\n`);
        if (f.screenshot) {
          this.writeOut(`    Screenshot: ${f.screenshot}\n`);
        }
      }
    }
  }
}
