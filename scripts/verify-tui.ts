#!/usr/bin/env bun
/**
 * TUI Verification Script
 *
 * Smoke tests TUI components, modes, and rendering without a running server.
 *
 * Usage: bun scripts/verify-tui.ts
 */

type TestResult = {
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
};

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
    const message = (error as Error).message;
    const result = { name, passed: false, message, durationMs: duration };
    results.push(result);
    log(`❌ ${name}: ${message}`);
    return result;
  }
}

// ─── Component Tests ──────────────────────────────────────────────────────────

async function testInputLineComponent() {
  const { createInputLineState, createInputLineActions } = await import(
    "../packages/tui/src/tui/components/input"
  );

  let state = createInputLineState("placeholder");
  const actions = createInputLineActions(
    () => state,
    (s) => {
      state = s;
    }
  );

  // Test insert
  actions.insert("hello");
  if (state.value !== "hello") {
    throw new Error(`Expected "hello", got "${state.value}"`);
  }

  // Test submit
  const submitted = actions.submit();
  if (submitted !== "hello") {
    throw new Error(`Expected submitted "hello", got "${submitted}"`);
  }
  if (state.value !== "") {
    throw new Error("Expected empty value after submit");
  }
}

async function testMessageHistoryComponent() {
  const { createMessageHistoryState, createMessageHistoryActions } =
    await import("../packages/tui/src/tui/components/history");

  let state = createMessageHistoryState();
  const actions = createMessageHistoryActions(
    () => state,
    (s) => {
      state = s;
    }
  );

  // Test add message
  const id = actions.addMessage({ role: "user", content: "Test" });
  if (!id) {
    throw new Error("Expected message ID");
  }
  if (state.messages.length !== 1) {
    throw new Error(`Expected 1 message, got ${state.messages.length}`);
  }

  // Test append
  actions.appendToMessage(id, " appended");
  if (state.messages[0]?.content !== "Test appended") {
    throw new Error(
      `Expected "Test appended", got "${state.messages[0]?.content}"`
    );
  }

  // Test scroll
  actions.scrollUp(5);
  if (state.scrollOffset !== 5) {
    throw new Error(`Expected scrollOffset 5, got ${state.scrollOffset}`);
  }
  if (state.autoScroll !== false) {
    throw new Error("Expected autoScroll false after scrollUp");
  }
}

async function testStreamComponent() {
  const { createStreamState, createStreamActions } = await import(
    "../packages/tui/src/tui/components/stream"
  );

  let state = createStreamState();
  const actions = createStreamActions(
    () => state,
    (s) => {
      state = s;
    }
  );

  if (state.isStreaming !== false) {
    throw new Error("Expected initial isStreaming false");
  }

  actions.setStreaming(true);
  if (state.isStreaming !== true) {
    throw new Error("Expected isStreaming true after setStreaming(true)");
  }

  actions.setStreaming(false);
  if (state.isStreaming !== false) {
    throw new Error("Expected isStreaming false after setStreaming(false)");
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
  const { LOGO_FULL, coloredLogo } = await import(
    "../packages/tui/src/tui/intro/logo"
  );

  if (!LOGO_FULL) {
    throw new Error("Expected LOGO_FULL to be defined");
  }
  if (typeof LOGO_FULL !== "string") {
    throw new Error("Expected LOGO_FULL to be a string");
  }

  // Test coloredLogo function
  const coloredLines = coloredLogo("full");
  if (!Array.isArray(coloredLines)) {
    throw new Error("Expected coloredLogo to return an array");
  }
  if (coloredLines.length === 0) {
    throw new Error("Expected coloredLogo to have content");
  }
}

async function testIntroGreeting() {
  const { getGreeting } = await import(
    "../packages/tui/src/tui/intro/greeting"
  );

  const greeting = getGreeting();
  if (typeof greeting !== "string") {
    throw new Error("Expected greeting to be a string");
  }
  if (greeting.length === 0) {
    throw new Error("Expected greeting to have content");
  }
}

// ─── Panel Tests ──────────────────────────────────────────────────────────────

async function testBasePanelImport() {
  const { BasePanel } = await import("../packages/tui/src/tui/panels/base");

  if (!BasePanel) {
    throw new Error("Expected BasePanel class to be exported");
  }
  if (typeof BasePanel !== "function") {
    throw new Error("Expected BasePanel to be a class");
  }
}

async function testCognitivePanelImport() {
  const { CognitivePanel } = await import(
    "../packages/tui/src/tui/panels/cognitive"
  );

  if (!CognitivePanel) {
    throw new Error("Expected CognitivePanel class to be exported");
  }
}

// ─── Mode Tests ───────────────────────────────────────────────────────────────

async function testBaseModeImport() {
  const { BaseMode } = await import("../packages/tui/src/tui/modes/base");

  if (!BaseMode) {
    throw new Error("Expected BaseMode class to be exported");
  }
  if (typeof BaseMode !== "function") {
    throw new Error("Expected BaseMode to be a class");
  }
}

// ─── Registry Tests ───────────────────────────────────────────────────────────

async function testRegistryImport() {
  const { getRegistry } = await import("../packages/tui/src/registry");

  if (typeof getRegistry !== "function") {
    throw new Error("Expected getRegistry to be a function");
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log("\n🖥️  TUI Verification\n");

  log("Components:");
  await runTest("InputLine component", testInputLineComponent);
  await runTest("MessageHistory component", testMessageHistoryComponent);
  await runTest("Stream component", testStreamComponent);

  log("\nTypography:");
  await runTest("Typography utilities", testTypography);

  log("\nTheme:");
  await runTest("Theme colors", testTheme);

  log("\nIntro:");
  await runTest("Logo import", testIntroLogo);
  await runTest("Greeting generator", testIntroGreeting);

  log("\nPanels:");
  await runTest("BasePanel import", testBasePanelImport);
  await runTest("CognitivePanel import", testCognitivePanelImport);

  log("\nModes:");
  await runTest("BaseMode import", testBaseModeImport);

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
