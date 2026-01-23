#!/usr/bin/env bun

/**
 * Run tests grouped by module and identify failures.
 *
 * Usage:
 *   bun scripts/test-by-module.ts [--scope unit|integration|e2e|perf|all] [--module <name>]
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { Glob } from "bun";

const exec = promisify(spawn);

interface TestFile {
  path: string;
  module: string;
  kind: "unit" | "integration" | "e2e" | "perf";
}

interface TestFailure {
  module: string;
  testFile: string;
  testName?: string;
  error: string;
  failureType:
    | "assertion"
    | "timeout"
    | "exception"
    | "mock"
    | "type"
    | "unknown";
  stack?: string;
}

interface ModuleResult {
  module: string;
  totalTests: number;
  passed: number;
  failed: number;
  failures: TestFailure[];
  duration: number;
}

function kindOfFile(p: string): TestFile["kind"] {
  const s = p.toLowerCase();
  const base = path.basename(s);
  if (
    s.includes(".perf.") ||
    s.includes(".performance.") ||
    s.includes(`${path.sep}perf${path.sep}`) ||
    base.includes("performance") ||
    base.startsWith("perf.")
  ) {
    return "perf";
  }
  if (
    s.includes(".e2e.") ||
    s.includes("-e2e.") ||
    s.includes(`${path.sep}e2e${path.sep}`)
  ) {
    return "e2e";
  }
  if (
    s.includes(".integration.") ||
    s.includes("-integration.") ||
    s.includes(".postgres.") ||
    s.includes(`${path.sep}integration${path.sep}`)
  ) {
    return "integration";
  }
  return "unit";
}

function isTestFile(p: string): boolean {
  const s = p.toLowerCase();
  return (
    s.endsWith(".test.ts") ||
    s.endsWith(".test.tsx") ||
    s.endsWith(".spec.ts") ||
    s.endsWith(".spec.tsx") ||
    (s.includes(`${path.sep}__tests__${path.sep}`) &&
      (s.endsWith(".ts") || s.endsWith(".tsx")))
  );
}

function shouldSkipPath(p: string): boolean {
  const parts = p.split(path.sep);
  for (const part of parts) {
    if (part.startsWith(".") && part !== "." && part !== "..") {
      return true;
    }
  }
  const s = p.toLowerCase();
  return (
    s.includes(`${path.sep}node_modules${path.sep}`) ||
    s.includes(`${path.sep}dist${path.sep}`) ||
    s.includes(`${path.sep}build${path.sep}`) ||
    s.includes(`${path.sep}vendor${path.sep}`) ||
    s.includes(`${path.sep}playwright-report${path.sep}`) ||
    s.includes(`${path.sep}test-results${path.sep}`)
  );
}

async function discoverTestFiles(
  cwd: string
): Promise<Map<string, TestFile[]>> {
  const globs = [
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/__tests__/**/*.ts",
    "**/__tests__/**/*.tsx",
  ];

  const byModule = new Map<string, TestFile[]>();

  for (const pat of globs) {
    const g = new Glob(pat);
    for await (const rel of g.scan({ cwd, onlyFiles: true })) {
      const abs = path.resolve(cwd, rel);
      if (!isTestFile(abs) || shouldSkipPath(abs)) {
        continue;
      }

      // Extract module name
      let module = "";
      if (abs.includes(`${path.sep}packages${path.sep}`)) {
        const match = abs.match(/packages[/\\]([^/\\]+)/);
        module = match ? match[1] : "unknown";
      } else if (abs.includes(`${path.sep}apps${path.sep}`)) {
        const match = abs.match(/apps[/\\]([^/\\]+)/);
        module = match ? match[1] : "unknown";
      } else {
        continue;
      }

      if (!byModule.has(module)) {
        byModule.set(module, []);
      }

      byModule.get(module)!.push({
        path: abs,
        module,
        kind: kindOfFile(abs),
      });
    }
  }

  return byModule;
}

function classifyFailure(
  error: string,
  stack?: string
): TestFailure["failureType"] {
  const lower = error.toLowerCase();
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "timeout";
  }
  if (lower.includes("mock") || lower.includes("mock.module")) {
    return "mock";
  }
  if (
    lower.includes("type") &&
    (lower.includes("error") || lower.includes("not assignable"))
  ) {
    return "type";
  }
  if (
    lower.includes("expected") ||
    lower.includes("assertion") ||
    lower.includes("to be")
  ) {
    return "assertion";
  }
  if (stack || lower.includes("error:") || lower.includes("exception")) {
    return "exception";
  }
  return "unknown";
}

function parseBunTestOutput(output: string, module: string): TestFailure[] {
  const failures: TestFailure[] = [];
  const lines = output.split("\n");

  let currentFile: string | null = null;
  let currentTest: string | null = null;
  let collectingError = false;
  let errorBuffer: string[] = [];
  let stackBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || "";

    // Detect test file
    if (line.includes(".test.ts:") || line.includes(".spec.ts:")) {
      const match = line.match(/([^:]+\.(test|spec)\.ts)/);
      if (match) {
        currentFile = match[1];
        collectingError = false;
        errorBuffer = [];
        stackBuffer = [];
      }
    }

    // Detect test name (pass/fail)
    if (line.includes("(fail)") || line.includes("(error)")) {
      const match =
        line.match(/\(fail\)\s+(.+?)(?:\s|$)/) ||
        line.match(/\(error\)\s+(.+?)(?:\s|$)/);
      if (match) {
        currentTest = match[1].trim();
        collectingError = true;
        errorBuffer = [];
        stackBuffer = [];
      }
    }

    // Collect error message
    if (collectingError) {
      if (
        line.trim().startsWith("Error:") ||
        line.trim().startsWith("TypeError:") ||
        line.trim().startsWith("ReferenceError:")
      ) {
        errorBuffer.push(line.trim());
      } else if (line.trim() && !line.trim().startsWith("at ")) {
        errorBuffer.push(line.trim());
      } else if (line.trim().startsWith("at ")) {
        stackBuffer.push(line.trim());
      }

      // End of error block
      if (
        line.trim() === "" &&
        errorBuffer.length > 0 &&
        i < lines.length - 1 &&
        !lines[i + 1]?.trim().startsWith("at ")
      ) {
        if (currentFile && currentTest) {
          failures.push({
            module,
            testFile: currentFile,
            testName: currentTest,
            error: errorBuffer.join(" "),
            failureType: classifyFailure(
              errorBuffer.join(" "),
              stackBuffer.join("\n")
            ),
            stack: stackBuffer.length > 0 ? stackBuffer.join("\n") : undefined,
          });
        }
        collectingError = false;
        errorBuffer = [];
        stackBuffer = [];
      }
    }
  }

  // Handle last error if still collecting
  if (collectingError && currentFile && currentTest && errorBuffer.length > 0) {
    failures.push({
      module,
      testFile: currentFile,
      testName: currentTest,
      error: errorBuffer.join(" "),
      failureType: classifyFailure(
        errorBuffer.join(" "),
        stackBuffer.join("\n")
      ),
      stack: stackBuffer.length > 0 ? stackBuffer.join("\n") : undefined,
    });
  }

  return failures;
}

async function runModuleTests(
  module: string,
  scope: string,
  testFiles: TestFile[]
): Promise<ModuleResult> {
  const start = Date.now();
  const filter = module.startsWith("@alfred/") ? module : `@alfred/${module}`;

  console.log(`\n${"=".repeat(80)}`);
  console.log(`Testing module: ${module} (${testFiles.length} test files)`);
  console.log(`${"=".repeat(80)}\n`);

  const proc = Bun.spawn(
    [
      "bunx",
      "turbo",
      "run",
      "test",
      `--filter=${filter}`,
      "--cache=local:r,remote:r",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ALFRED_TEST_SCOPE: scope,
        ALFRED_TEST_TIMEOUT_MS: "60000",
      },
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;

  const output = stdout + "\n" + stderr;
  const failures = parseBunTestOutput(output, module);

  // Parse test counts from output
  const passMatch = output.match(/(\d+)\s+pass/);
  const failMatch = output.match(/(\d+)\s+fail/);
  const totalMatch = output.match(/Ran\s+(\d+)\s+tests/);

  const passed = passMatch ? Number.parseInt(passMatch[1], 10) : 0;
  const failed = failMatch
    ? Number.parseInt(failMatch[1], 10)
    : failures.length;
  const totalTests = totalMatch
    ? Number.parseInt(totalMatch[1], 10)
    : passed + failed;

  return {
    module,
    totalTests,
    passed,
    failed,
    failures,
    duration: Date.now() - start,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const scope = args.includes("--scope")
    ? args[args.indexOf("--scope") + 1] || "unit"
    : process.env.ALFRED_TEST_SCOPE || "unit";
  const moduleFilter = args.includes("--module")
    ? args[args.indexOf("--module") + 1]
    : null;

  const cwd = process.cwd();
  const testFilesByModule = await discoverTestFiles(cwd);

  // Filter by scope
  const filtered = new Map<string, TestFile[]>();
  for (const [module, files] of testFilesByModule) {
    if (moduleFilter && module !== moduleFilter) {
      continue;
    }
    const scopedFiles =
      scope === "all" ? files : files.filter((f) => f.kind === scope);
    if (scopedFiles.length > 0) {
      filtered.set(module, scopedFiles);
    }
  }

  console.log(`\nFound ${filtered.size} modules with ${scope} tests\n`);

  const results: ModuleResult[] = [];

  // Run tests sequentially to avoid resource conflicts
  for (const [module, files] of filtered) {
    try {
      const result = await runModuleTests(module, scope, files);
      results.push(result);
    } catch (error) {
      console.error(`Error running tests for ${module}:`, error);
      results.push({
        module,
        totalTests: 0,
        passed: 0,
        failed: 0,
        failures: [
          {
            module,
            testFile: "unknown",
            error: error instanceof Error ? error.message : String(error),
            failureType: "exception",
          },
        ],
        duration: 0,
      });
    }
  }

  // Generate report
  console.log(`\n${"=".repeat(80)}`);
  console.log("TEST RESULTS SUMMARY");
  console.log(`${"=".repeat(80)}\n`);

  const totalModules = results.length;
  const modulesWithFailures = results.filter((r) => r.failed > 0).length;
  const totalTests = results.reduce((sum, r) => sum + r.totalTests, 0);
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Modules tested: ${totalModules}`);
  console.log(`Modules with failures: ${modulesWithFailures}`);
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Total duration: ${(totalDuration / 1000).toFixed(2)}s\n`);

  if (totalFailed > 0) {
    console.log(`\n${"=".repeat(80)}`);
    console.log("FAILURES BY MODULE");
    console.log(`${"=".repeat(80)}\n`);

    for (const result of results) {
      if (result.failed > 0) {
        console.log(`\n## ${result.module}`);
        console.log(`Failed: ${result.failed}/${result.totalTests} tests`);
        console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s\n`);

        for (const failure of result.failures) {
          console.log(`### ${failure.testFile}`);
          if (failure.testName) {
            console.log(`Test: ${failure.testName}`);
          }
          console.log(`Type: ${failure.failureType}`);
          console.log(
            `Error: ${failure.error.substring(0, 200)}${failure.error.length > 200 ? "..." : ""}`
          );
          if (failure.stack) {
            console.log(
              `Stack: ${failure.stack.split("\n").slice(0, 3).join("\n")}...`
            );
          }
          console.log("");
        }
      }
    }

    // Failure analysis
    console.log(`\n${"=".repeat(80)}`);
    console.log("FAILURE ANALYSIS");
    console.log(`${"=".repeat(80)}\n`);

    const byType = new Map<TestFailure["failureType"], number>();
    for (const result of results) {
      for (const failure of result.failures) {
        byType.set(
          failure.failureType,
          (byType.get(failure.failureType) || 0) + 1
        );
      }
    }

    console.log("Failures by type:");
    for (const [type, count] of byType) {
      console.log(`  ${type}: ${count}`);
    }

    process.exit(1);
  } else {
    console.log("✅ All tests passed!");
    process.exit(0);
  }
}

await main();
