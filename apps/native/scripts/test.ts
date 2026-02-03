#!/usr/bin/env bun

/**
 * Jest runner that respects ALFRED test scopes.
 *
 * Turbo runs `bun run test` for every workspace package. Native uses Jest, so we
 * need to skip or scope-select suites based on `ALFRED_TEST_SCOPE` to avoid:
 * - perf runs executing the full Jest suite
 * - perf runs failing due to unrelated unit/integration tests
 */

type Scope = "unit" | "integration" | "e2e" | "perf" | "slow" | "all";

function normalizeScope(raw: string | undefined): Scope | null {
  const v = raw?.trim().toLowerCase();
  if (!v) {
    return null;
  }
  if (v === "unit") {
    return "unit";
  }
  if (v === "integration") {
    return "integration";
  }
  if (v === "e2e") {
    return "e2e";
  }
  if (v === "perf") {
    return "perf";
  }
  if (v === "slow") {
    return "slow";
  }
  if (v === "all") {
    return "all";
  }
  return "unit";
}

async function run(argv: string[]): Promise<never> {
  const proc = Bun.spawn(argv, {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  });
  const code = await proc.exited;
  process.exit(code);
}

const scope = normalizeScope(process.env.ALFRED_TEST_SCOPE);
const extraArgs = process.argv.slice(2);

// If the repo isn't providing a scope (local dev), preserve existing behavior:
// `bun run test` should run the full Jest suite.
if (!scope) {
  await run(["jest", ...extraArgs]);
}

switch (scope) {
  case "unit": {
    await run([
      "jest",
      "--testPathPatterns=test-jest/(components|hooks|lib)",
      ...extraArgs,
    ]);
  }
  case "integration": {
    await run(["jest", "--testPathPatterns=test-jest/integration", ...extraArgs]);
  }
  case "all": {
    await run(["jest", ...extraArgs]);
  }
  case "e2e":
  case "perf":
  case "slow": {
    // Native perf/e2e suites (if added) should be explicitly wired here.
    process.exit(0);
  }
}

