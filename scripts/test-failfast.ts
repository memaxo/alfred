#!/usr/bin/env bun

import { Glob } from "bun";
import path from "node:path";

type Kind = "unit" | "integration" | "e2e" | "perf" | "slow";

function writeOut(s: string): void {
  try {
    process.stdout.write(s);
  } catch {}
}

function parseScope(v: string | undefined): Kind {
  const s = (v ?? "unit").trim().toLowerCase();
  if (s === "integration") {
    return "integration";
  }
  if (s === "e2e") {
    return "e2e";
  }
  if (s === "perf") {
    return "perf";
  }
  if (s === "slow") {
    return "slow";
  }
  return "unit";
}

function kindOfFile(p: string): Kind {
  const s = p.toLowerCase();
  const base = path.basename(s);
  if (
    s.includes(".perf.") ||
    s.includes(".performance.") ||
    s.includes(`${path.sep}perf${path.sep}`) ||
    s.includes(`${path.sep}performance${path.sep}`) ||
    base.includes("performance") ||
    base.startsWith("perf.") ||
    base.includes(".perf.") ||
    base.includes("-perf.") ||
    base.includes("_perf.")
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
    s.includes("-postgres.") ||
    s.includes(`${path.sep}integration${path.sep}`)
  ) {
    return "integration";
  }
  if (s.includes(".slow.") || s.includes("-slow.")) {
    return "slow";
  }
  return "unit";
}

function isHiddenPath(p: string): boolean {
  const parts = p.split(path.sep);
  for (const part of parts) {
    if (part.startsWith(".") && part !== "." && part !== "..") {
      return true;
    }
  }
  return false;
}

function shouldSkipPath(p: string): boolean {
  if (isHiddenPath(p)) {
    return true;
  }
  const s = p.toLowerCase();
  if (s.includes(`${path.sep}node_modules${path.sep}`)) {
    return true;
  }
  if (s.includes(`${path.sep}dist${path.sep}`)) {
    return true;
  }
  if (s.includes(`${path.sep}build${path.sep}`)) {
    return true;
  }
  if (s.includes(`${path.sep}vendor${path.sep}`)) {
    return true;
  }
  if (s.includes(`${path.sep}playwright-report${path.sep}`)) {
    return true;
  }
  if (s.includes(`${path.sep}test-results${path.sep}`)) {
    return true;
  }
  if (s.includes(`${path.sep}test-jest${path.sep}`)) {
    return true;
  }
  if (
    s.includes(`${path.sep}__tests__${path.sep}`) &&
    s.includes(`${path.sep}api${path.sep}`)
  ) {
    return true;
  }
  if (
    s.includes(`${path.sep}apps${path.sep}native${path.sep}tests${path.sep}`)
  ) {
    return true;
  }
  return false;
}

function isTestFile(p: string): boolean {
  const s = p.toLowerCase();
  if (
    s.endsWith(".test.ts") ||
    s.endsWith(".test.tsx") ||
    s.endsWith(".test.js") ||
    s.endsWith(".test.jsx") ||
    s.endsWith(".spec.ts") ||
    s.endsWith(".spec.tsx") ||
    s.endsWith(".spec.js") ||
    s.endsWith(".spec.jsx")
  ) {
    return true;
  }
  if (s.includes(`${path.sep}__tests__${path.sep}`)) {
    return (
      s.endsWith(".ts") ||
      s.endsWith(".tsx") ||
      s.endsWith(".js") ||
      s.endsWith(".jsx")
    );
  }
  return false;
}

async function discoverTests(cwd: string): Promise<string[]> {
  const globs = [
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.test.js",
    "**/*.test.jsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/*.spec.js",
    "**/*.spec.jsx",
    "**/__tests__/**/*.ts",
    "**/__tests__/**/*.tsx",
    "**/__tests__/**/*.js",
    "**/__tests__/**/*.jsx",
  ];

  const found = new Set<string>();
  for (const pat of globs) {
    const g = new Glob(pat);
    for await (const rel of g.scan({ cwd, onlyFiles: true })) {
      const abs = path.resolve(cwd, rel);
      if (!isTestFile(abs)) {
        continue;
      }
      if (shouldSkipPath(abs)) {
        continue;
      }
      found.add(abs);
    }
  }
  return [...found].sort();
}

function formatRelative(file: string, cwd: string): string {
  const rel = path.relative(cwd, file);
  return rel.length < file.length ? rel : file;
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.floor(ms / 60_000)}m${Math.floor((ms % 60_000) / 1000)}s`;
}

const PER_TEST_TIMEOUT_MS = Number(
  process.env.ALFRED_TEST_FILE_TIMEOUT_MS ?? 120_000
);

async function runTest(
  file: string,
  quiet: boolean
): Promise<{ code: number; output: string }> {
  const proc = Bun.spawn(["bun", "test", file], {
    stdin: "ignore",
    stdout: quiet ? "pipe" : "inherit",
    stderr: quiet ? "pipe" : "inherit",
    env: process.env,
  });

  let output = "";

  if (quiet) {
    // Drain piped streams to prevent backpressure hangs.
    // Capture output so we don't need to re-run on failure.
    const drainStream = async (stream: ReadableStream<Uint8Array> | null) => {
      if (!stream) {
        return "";
      }
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          buf += decoder.decode(value, { stream: true });
        }
      } catch {
        // ignore read errors on closed streams
      } finally {
        reader.releaseLock();
      }
      return buf;
    };

    const [stdout, stderr] = await Promise.all([
      drainStream(proc.stdout),
      drainStream(proc.stderr),
    ]);
    output = stdout + (stderr ? `\n${stderr}` : "");
  }

  // Race the exit against a timeout
  const code = await Promise.race([
    proc.exited,
    new Promise<number>((resolve) =>
      setTimeout(() => {
        try {
          proc.kill();
        } catch {}
        resolve(124); // 124 = timeout (like GNU timeout)
      }, PER_TEST_TIMEOUT_MS)
    ),
  ]);

  return { code, output };
}

async function main(): Promise<void> {
  const scope = parseScope(process.env.ALFRED_TEST_SCOPE);
  const cwd = process.cwd();
  const all = await discoverTests(cwd);
  const picked = all.filter((p) => kindOfFile(p) === scope);

  if (picked.length === 0) {
    writeOut("No tests found\n");
    process.exit(0);
  }

  const suffix = picked.length === 1 ? "" : "s";
  writeOut(`Running ${picked.length} test file${suffix}...\n\n`);

  const failedFile = process.env.ALFRED_FAILED_FILE;
  if (failedFile) {
    const idx = picked.indexOf(failedFile);
    if (idx !== -1) {
      writeOut(
        `Resuming from failed test: ${formatRelative(failedFile, cwd)}\n\n`
      );
      picked.splice(0, idx);
    }
  }

  const startAll = Date.now();
  let passed = 0;
  let failed = null as string | null;
  let failedOutput = "";

  for (let i = 0; i < picked.length; i++) {
    const file = picked[i];
    const rel = formatRelative(file, cwd);
    const current = i + 1;
    const total = picked.length;

    writeOut(`[${current}/${total}] ${rel}... `);

    const start = Date.now();
    const result = await runTest(file, true);
    const dur = Date.now() - start;

    if (result.code === 0) {
      passed += 1;
      writeOut(`✓ ${formatDuration(dur)}\n`);
    } else {
      failed = file;
      failedOutput = result.output;
      writeOut(`✗ (exit ${result.code})\n\n`);
      break;
    }
  }

  writeOut("\n");

  if (failed) {
    const rel = formatRelative(failed, cwd);

    writeOut(`FAILURE: ${rel}\n`);
    writeOut(`${"-".repeat(80)}\n`);
    writeOut("Full output:\n\n");
    writeOut(failedOutput || "(no output captured)");

    const totalDur = Date.now() - startAll;

    writeOut(`\n${"-".repeat(80)}\n`);
    writeOut("\nTest runner output:\n");
    writeOut(`Passed: ${passed}/${picked.length - 1}\n`);
    writeOut(`Failed: ${rel}\n`);
    writeOut(`Total: ${formatDuration(totalDur)}\n`);

    process.exit(1);
  }

  const totalDur = Date.now() - startAll;
  writeOut(`SUCCESS: All ${picked.length} test files passed\n`);
  writeOut(`Total time: ${formatDuration(totalDur)}\n`);

  process.exit(0);
}

await main();
