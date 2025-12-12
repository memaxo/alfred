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

import { BUDGET_DEFAULTS } from "@alfred/test-kit";

type BudgetCategory = keyof typeof BUDGET_DEFAULTS;

const REQUIRED_CATEGORIES: BudgetCategory[] = [
  "state-transition",
  "graph-lookup",
  "fact-extraction",
  "plan-generation",
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

  return Array.from(files).sort();
}

function isBudgetCategory(value: string): value is BudgetCategory {
  return Object.prototype.hasOwnProperty.call(BUDGET_DEFAULTS, value);
}

async function collectCoverage(): Promise<Map<BudgetCategory, string[]>> {
  const coverage = new Map<BudgetCategory, string[]>();
  for (const category of REQUIRED_CATEGORIES) {
    coverage.set(category, []);
  }

  const files = await collectPerfTestFiles();

  for (const file of files) {
    const bunFile = Bun.file(file);
    if (!(await bunFile.exists())) {
      continue;
    }
    const text = await bunFile.text();
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

  return coverage;
}

async function main(): Promise<void> {
  console.log("ALFRED Performance Budget Coverage Gate");

  const coverage = await collectCoverage();

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
    console.error("Fix: add `// budget: <category>` markers to deterministic perf tests.");
    console.error(
      "Example: `// budget: graph-lookup` in a test that asserts graph lookup performance."
    );
    process.exit(1);
  }

  console.log("All required budget categories have perf-test coverage:");
  for (const category of REQUIRED_CATEGORIES) {
    const files = coverage.get(category) ?? [];
    console.log(`- ${category}: ${files.length} file(s)`);
  }
}

if (import.meta.main) {
  await main();
}
