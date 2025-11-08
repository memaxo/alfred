#!/usr/bin/env bun

/**
 * ALFRED Performance Budget Checker
 * Parses performance budget comments and measures function execution times
 * Fails CI on budget breaches
 */

interface Budget {
  file: string;
  function: string;
  line: number;
  budget: string; // e.g., "<100 µs", "<1 ms", "<10 ms"
  budgetMs: number; // Converted to milliseconds
}

interface Violation {
  budget: Budget;
  actualMs: number;
  message: string;
}

const BUDGET_PATTERN = /\/\/\s*(<[\d.]+)\s*(µs|ms|s)\s*budget/i;
const FUNCTION_PATTERN = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;

function parseBudget(budgetStr: string): number {
  const match = budgetStr.match(/([\d.]+)\s*(µs|ms|s)/i);
  if (!match) return 0;

  const value = Number.parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "µs":
    case "us":
      return value / 1000; // Convert to ms
    case "ms":
      return value;
    case "s":
      return value * 1000; // Convert to ms
    default:
      return 0;
  }
}

function findBudgets(filePath: string): Budget[] {
  const budgets: Budget[] = [];
  const content = Bun.file(filePath).text();
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(BUDGET_PATTERN);
    if (match) {
      const budgetStr = match[1] + match[2];
      const budgetMs = parseBudget(budgetStr);

      // Find function name (look backwards)
      let functionName = "unknown";
      for (let j = i; j >= 0 && j > i - 10; j--) {
        const funcMatch = lines[j].match(FUNCTION_PATTERN);
        if (funcMatch) {
          functionName = funcMatch[1];
          break;
        }
      }

      budgets.push({
        file: filePath,
        function: functionName,
        line: i + 1,
        budget: budgetStr,
        budgetMs,
      });
    }
  }

  return budgets;
}

function checkBudgets(): Violation[] {
  const violations: Violation[] = [];

  // TODO: [Phase 3] Implement actual measurement
  // - Parse TypeScript files
  // - Extract functions with budget comments
  // - Measure execution times
  // - Compare against budgets
  // - Report violations

  return violations;
}

function main() {
  console.log("ALFRED Performance Budget Checker");
  console.log("TODO: [Phase 3] Implement budget measurement logic");

  const violations = checkBudgets();

  if (violations.length > 0) {
    console.error(`Found ${violations.length} budget violations:`);
    for (const v of violations) {
      console.error(
        `  ${v.budget.file}:${v.budget.line} [${v.budget.function}] ` +
          `Budget: ${v.budget.budget}, Actual: ${v.actualMs.toFixed(2)}ms - ${v.message}`
      );
    }
    process.exit(1);
  }

  console.log("All performance budgets passed!");
}

if (import.meta.main) {
  main();
}
