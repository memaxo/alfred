#!/usr/bin/env bun
/**
 * TUI Verification Script
 *
 * Smoke tests TUI components, modes, and rendering without a running server.
 *
 * Usage: bun scripts/verify-tui.ts
 */

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

const results: TestResult[] = [];

function log(message: string, indent = 0) {
  const prefix = "  ".repeat(indent);
  console.log(`${prefix}${message}`);
}

async function runTest(
  name: string,
  fn: () => Promise<void>
): Promise<TestResult> {
  const start = performance.now();
  try {
    await fn();
    const duration = performance.now() - start;
    const result = { name, passed: true, message: "OK", durationMs: duration };
    results.push(result);
    log(`✅ ${name} (${duration.toFixed(1)}ms)`);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    const { message } = error as Error;
    const result = { name, passed: false, message, durationMs: duration };
    results.push(result);
    log(`❌ ${name}: ${message}`);
    return result;
  }
}

// ─── React TUI Tests ─────────────────────────────────────────────────────────

async function testReactTuiEntrypoint() {
  const react = await import("../packages/tui/src/tui/react");
  if (typeof react.createReactTui !== "function") {
    throw new TypeError("Expected createReactTui to be a function");
  }
  if (typeof react.Dashboard !== "function") {
    throw new TypeError("Expected Dashboard to be exported");
  }
}

async function testTuiEntrypoint() {
  const tui = await import("../packages/tui/src/tui");
  if (typeof tui.runTui !== "function") {
    throw new TypeError("Expected runTui to be a function");
  }
}

async function testCommands() {
  const { fuzzyMatch, searchCommands, createStandardCommands } =
    await import("../packages/tui/src/tui/input/commands");

  if (fuzzyMatch("qt", "Quit") <= 0) {
    throw new Error("Expected fuzzyMatch to match basic patterns");
  }
  if (fuzzyMatch("zzz", "Quit") !== 0) {
    throw new Error("Expected fuzzyMatch to return 0 when no match");
  }

  const commands = createStandardCommands({
    quit: () => {},
    help: () => {},
    refresh: () => {},
    focusPanel: () => {},
    toggleFocusMode: () => {},
    openMode: () => {},
  });

  const matches = searchCommands(commands, "quit");
  if (matches.length === 0 || matches[0]?.id !== "quit") {
    throw new Error("Expected searchCommands to find quit");
  }
}

async function testHeadlessDashboardRun() {
  const proc = Bun.spawn(
    [
      "bun",
      "../packages/tui/src/bin/alfred.ts",
      "tui",
      "--headless",
      "--skip-intro",
    ],
    {
      cwd: import.meta.dir,
      env: {
        ...process.env,
        TERM: process.env.TERM ?? "xterm-256color",
        COLUMNS: process.env.COLUMNS ?? "120",
        LINES: process.env.LINES ?? "40",
        ALFRED_AUTH_BYPASS: process.env.ALFRED_AUTH_BYPASS ?? "true",
        ALFRED_API_AUTO_INIT: process.env.ALFRED_API_AUTO_INIT ?? "false",
      },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  const timeoutMs = 12_000;
  const timeout = setTimeout(() => proc.kill(), timeoutMs);
  timeout.unref?.();

  const exitCode = await proc.exited;
  clearTimeout(timeout);

  if (exitCode !== 0) {
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    throw new Error(
      `Expected headless tui to exit 0, got ${exitCode}.\nstdout:\n${stdout}\nstderr:\n${stderr}`
    );
  }
}

// ─── Typography Tests ─────────────────────────────────────────────────────────

async function testTypography() {
  const typography = await import("../packages/tui/src/tui/typography");

  // Test truncate - note: truncate preserves ANSI codes so visible length matters
  const truncated = typography.truncate("Hello World", 8);
  const visibleLen = typography.visibleLength(truncated);
  if (visibleLen > 8) {
    throw new Error(
      `Expected visible truncated length <= 8, got ${visibleLen}`
    );
  }

  // Test padRight - check visible length, not raw length (may include ANSI reset)
  const padded = typography.padRight("Hi", 5);
  const paddedVisible = typography.visibleLength(padded);
  if (paddedVisible !== 5) {
    throw new Error(`Expected visible padded length 5, got ${paddedVisible}`);
  }

  // Test progressBar
  const bar = typography.progressBar(0.5, 10);
  if (!(bar.includes("█") || bar.includes("░"))) {
    throw new Error("Expected progress bar to contain fill characters");
  }
}

// ─── Theme Tests ──────────────────────────────────────────────────────────────

async function testTheme() {
  const theme = await import("../packages/tui/src/tui/theme");

  // Verify theme has required colors (based on actual theme.ts)
  const requiredColors = [
    "primary",
    "success",
    "warning",
    "error",
    "text",
    "muted",
    "dim",
    "border",
  ];

  for (const color of requiredColors) {
    if (!(color in theme.colors)) {
      throw new Error(`Missing required color: ${color}`);
    }
  }
}

// ─── Intro Tests ──────────────────────────────────────────────────────────────

async function testIntroLogo() {
  const { LOGO_FULL, coloredLogo } =
    await import("../packages/tui/src/tui/intro/logo");

  if (!LOGO_FULL) {
    throw new Error("Expected LOGO_FULL to be defined");
  }
  if (typeof LOGO_FULL !== "string") {
    throw new TypeError("Expected LOGO_FULL to be a string");
  }

  // Test coloredLogo function
  const coloredLines = coloredLogo("full");
  if (!Array.isArray(coloredLines)) {
    throw new TypeError("Expected coloredLogo to return an array");
  }
  if (coloredLines.length === 0) {
    throw new Error("Expected coloredLogo to have content");
  }
}

async function testIntroGreeting() {
  const { getGreeting } =
    await import("../packages/tui/src/tui/intro/greeting");

  const greeting = getGreeting();
  if (typeof greeting !== "string") {
    throw new TypeError("Expected greeting to be a string");
  }
  if (greeting.length === 0) {
    throw new Error("Expected greeting to have content");
  }
}

// ─── Registry Tests ───────────────────────────────────────────────────────────

async function testRegistryImport() {
  const { getRegistry } = await import("../packages/tui/src/registry");

  if (typeof getRegistry !== "function") {
    throw new TypeError("Expected getRegistry to be a function");
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log("\n🖥️  TUI Verification\n");

  log("React TUI:");
  await runTest("React entrypoint import", testReactTuiEntrypoint);
  await runTest("TUI entrypoint import", testTuiEntrypoint);
  await runTest("Commands module", testCommands);
  await runTest("Headless dashboard run", testHeadlessDashboardRun);

  log("\nTypography:");
  await runTest("Typography utilities", testTypography);

  log("\nTheme:");
  await runTest("Theme colors", testTheme);

  log("\nIntro:");
  await runTest("Logo import", testIntroLogo);
  await runTest("Greeting generator", testIntroGreeting);

  log("\nRegistry:");
  await runTest("Registry import", testRegistryImport);

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.durationMs, 0);

  log(`\n${"─".repeat(50)}`);
  log(
    `Summary: ${passed} passed, ${failed} failed (${totalTime.toFixed(1)}ms total)\n`
  );

  if (failed > 0) {
    log("❌ TUI verification failed.");
    process.exit(1);
  }

  log("✅ TUI verification passed.");
  process.exit(0);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
