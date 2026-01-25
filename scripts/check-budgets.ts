#!/usr/bin/env bun

/**
 * ALFRED Performance Budget Checker
 *
 * Hybrid enforcement (ALF-141):
 * - This script validates that required budget categories have deterministic perf-test coverage.
 * - Perf tests themselves are the ground truth for measurement and failure.
 *
 * Coverage markers (place in perf tests):
 *   // budget: state-transition
 *   // budget: graph-lookup
 *   // budget: fact-extraction
 *   // budget: plan-generation
 */

import { BUDGET_DEFAULTS } from "@alfred/test-kit/performance/budget";

type BudgetCategory = keyof typeof BUDGET_DEFAULTS;

const REQUIRED_CATEGORIES: BudgetCategory[] = [
  "state-transition",
  "graph-lookup",
  "fact-extraction",
  "plan-generation",
  "state-reconstruction",
];

// Future candidates (not required yet):
// - "db-query": often involves Postgres, can be flaky/noisy in CI until isolated/harnessed.
// - "workflow-stream": depends on streaming harness stability and CI environment variance.
// - "ui-render": belongs in browser/E2E perf profiling rather than unit perf tests.

const MARKER_PATTERN = /^\s*\/\/\s*budget:\s*([a-z0-9-]+)\s*$/i;

async function collectPerfTestFiles(): Promise<string[]> {
  const patterns = [
    "packages/**/test/**/*.perf.test.ts",
    "packages/**/test/**/*performance*.test.ts",
    "tests/perf/**/*.test.ts",
  ] as const;

  const files = new Set<string>();

  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern);
    for await (const path of glob.scan(".")) {
      files.add(path);
    }
  }

  // Explicit inclusions (stable even if naming changes)
  files.add("packages/cognitive/test/performance-budget.test.ts");
  files.add("packages/agent/test/multi/performance.test.ts");
  files.add("packages/runtime/test/performance.test.ts");

  return [...files].sort();
}

function isBudgetCategory(value: string): value is BudgetCategory {
  return Object.hasOwn(BUDGET_DEFAULTS, value);
}

async function collectCoverage(
  files?: string[]
): Promise<{ coverage: Map<BudgetCategory, string[]>; files: string[] }> {
  const coverage = new Map<BudgetCategory, string[]>();
  for (const category of REQUIRED_CATEGORIES) {
    coverage.set(category, []);
  }

  const perfFiles = files ?? (await collectPerfTestFiles());

  // Read files in parallel for speed
  const fileContents = await Promise.allSettled(
    perfFiles.map(async (file) => {
      try {
        const text = await Bun.file(file).text();
        return { file, text };
      } catch {
        return null;
      }
    })
  );

  for (const result of fileContents) {
    if (result.status !== "fulfilled" || !result.value) {
      continue;
    }
    const { file, text } = result.value;
    const lines = text.split("\n");

    for (const line of lines) {
      const match = line.match(MARKER_PATTERN);
      if (!match) {
        continue;
      }
      const raw = match[1]?.toLowerCase();
      if (!raw) {
        continue;
      }
      if (!isBudgetCategory(raw)) {
        continue;
      }
      if (!REQUIRED_CATEGORIES.includes(raw)) {
        continue;
      }
      const bucket = coverage.get(raw);
      if (bucket && !bucket.includes(file)) {
        bucket.push(file);
      }
    }
  }

  return { coverage, files: perfFiles };
}

async function runPerformanceTests(files?: string[]): Promise<boolean> {
  const testFiles = files ?? (await collectPerfTestFiles());

  if (testFiles.length === 0) {
    console.warn("No performance test files found");
    return true;
  }

  console.log(`Running ${testFiles.length} performance test file(s)...`);

  const strictLocal = process.argv.includes("--local");

  // Perf tests are inherently noisy on shared runners and multi-core execution.
  // Keep them stable by forcing a low concurrency runner and using CI-style budgets by default.
  // We run a single `bun test` invocation for speed; use `--isolate` to run per-file if needed.
  const isolate = process.argv.includes("--isolate");

  const env: Record<string, string> = {
    ...process.env,
    ...(strictLocal ? {} : { CI: process.env.CI ?? "1" }),
  } as Record<string, string>;

  const argsBase = ["bun", "test", "--max-concurrency=1", "--timeout=30000"];

  if (!isolate) {
    console.log(
      `\n[budgets] bun test ${testFiles.length} file(s) (single process)`
    );
    const proc = Bun.spawn([...argsBase, ...testFiles], {
      stdout: "inherit",
      stderr: "inherit",
      env,
    });

    // Hard timeout: kill after 45s (tests should complete in <30s)
    const killTimer = setTimeout(() => {
      console.error("\n[budgets] Timeout: killing test process after 45s");
      try {
        proc.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, 45_000);

    const exitCode = await Promise.race([
      proc.exited,
      new Promise<number>((resolve) => {
        setTimeout(() => resolve(124), 45_000);
      }),
    ]).finally(() => clearTimeout(killTimer));
    if (exitCode !== 0) {
      console.error("\nPerformance tests failed. Budget violations detected.");
      console.error(
        "Fix: Optimize the violating code paths or adjust budgets if justified."
      );
      console.error(
        "Hint: `bun scripts/check-budgets.ts --isolate` runs each file separately for debugging."
      );
      console.error(
        "Hint: `bun scripts/check-budgets.ts --local` uses strict local budgets."
      );
      return false;
    }

    return true;
  }

  for (const file of testFiles) {
    console.log(`\n[budgets] bun test ${file}`);
    const proc = Bun.spawn([...argsBase, file], {
      stdout: "inherit",
      stderr: "inherit",
      env,
    });

    // Hard timeout: kill after 35s per file
    const killTimer = setTimeout(() => {
      console.error(
        `\n[budgets] Timeout: killing test process for ${file} after 35s`
      );
      try {
        proc.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, 35_000);

    const exitCode = await Promise.race([
      proc.exited,
      new Promise<number>((resolve) => {
        setTimeout(() => resolve(124), 35_000);
      }),
    ]).finally(() => clearTimeout(killTimer));
    if (exitCode !== 0) {
      console.error("\nPerformance tests failed. Budget violations detected.");
      console.error(`Failed file: ${file}`);
      console.error(
        "Fix: Optimize the violating code paths or adjust budgets if justified."
      );
      console.error(
        "Hint: run `bun scripts/check-budgets.ts --local` to use strict local budgets."
      );
      return false;
    }
  }

  return true;
}

async function main(): Promise<void> {
  console.log("ALFRED Performance Budget Coverage Gate");

  const { coverage, files } = await collectCoverage();

  const missing = REQUIRED_CATEGORIES.filter(
    (category) => (coverage.get(category) ?? []).length === 0
  );

  if (missing.length > 0) {
    console.error("Missing performance budget coverage:");
    for (const category of missing) {
      const budgetMs = BUDGET_DEFAULTS[category];
      console.error(`- ${category} (default budget: ${budgetMs}ms)`);
    }
    console.error("");
    console.error(
      "Fix: add `// budget: <category>` markers to deterministic perf tests."
    );
    console.error(
      "Example: `// budget: graph-lookup` in a test that asserts graph lookup performance."
    );
    setTimeout(() => process.exit(1), 10);
    return;
  }

  console.log("All required budget categories have perf-test coverage:");
  for (const category of REQUIRED_CATEGORIES) {
    const files = coverage.get(category) ?? [];
    console.log(`- ${category}: ${files.length} file(s)`);
  }

  // Run performance tests to verify budgets (unless skipped)
  if (process.argv.includes("--skip-tests")) {
    console.log("\nSkipping test execution (coverage check only).");
    console.log("Run without --skip-tests to verify budgets.");
    setTimeout(() => process.exit(0), 10);
    return;
  }
  console.log("\nRunning performance tests to verify budgets...");
  const testsPassed = await runPerformanceTests(files);

  if (!testsPassed) {
    setTimeout(() => process.exit(1), 10);
    return;
  }

  console.log("All performance budgets met!");
  setTimeout(() => process.exit(0), 10);
}

if (import.meta.main) {
  // Safety timeout: force exit after 2 minutes if something hangs
  const safetyTimer = setTimeout(() => {
    console.error("\n[FATAL] Script hung - forcing exit after 2 minutes");
    setTimeout(() => process.exit(124), 10);
  }, 120_000);

  try {
    await main();
    clearTimeout(safetyTimer);
    // If we reach here, main() didn't call exit - force it
    setTimeout(() => process.exit(0), 10);
  } catch (error) {
    clearTimeout(safetyTimer);
    console.error("Fatal error:", error);
    setTimeout(() => process.exit(1), 10);
  }
}
