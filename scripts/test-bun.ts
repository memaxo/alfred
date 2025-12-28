#!/usr/bin/env bun
/**
 * Wrapper script for running Bun tests.
 *
 * Playwright E2E tests are in apps/web/.tests/ (hidden directory),
 * which Bun automatically excludes from discovery.
 *
 * Run Playwright tests separately with:
 *   bunx playwright test --config apps/web/playwright.config.ts
 */

import { Glob } from "bun";
import path from "node:path";

type Scope = "unit" | "integration" | "e2e" | "perf" | "slow" | "all";
type Kind = Exclude<Scope, "all">;

const args = process.argv.slice(2);

function writeErr(s: string): void {
  try {
    process.stderr.write(s);
  } catch {
    // ignore
  }
}

function parseMs(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Hard-stop the wrapper itself (covers “all tests passed but process won’t exit”).
const runnerMs = parseMs(process.env.ALFRED_TEST_RUNNER_TIMEOUT_MS, 0);
if (runnerMs > 0) {
  const startedAt = Date.now();
  let last: string | null = null;

  const g = globalThis as unknown as { __alfredTestLastFile?: string };
  Object.defineProperty(g, "__alfredTestLastFile", {
    configurable: true,
    enumerable: false,
    get() {
      return last ?? "";
    },
    set(v: string) {
      last = v;
    },
  });

  setTimeout(() => {
    const ms = Date.now() - startedAt;
    const lf = last ?? "";
    writeErr(
      `alfred_test_runner_timeout ms=${ms} limitMs=${runnerMs} lastFile=${lf}\n`
    );
    process.exit(1);
  }, runnerMs);
}

function hasTimeoutFlag(argv: string[]): boolean {
  return argv.some((a) => a === "--timeout" || a.startsWith("--timeout="));
}

function hasBailFlag(argv: string[]): boolean {
  return argv.some((a) => a === "--bail" || a.startsWith("--bail="));
}

function parsePositiveInt(v: string | undefined, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  if (!Number.isInteger(n)) {
    return fallback;
  }
  return n > 0 ? n : fallback;
}

async function runBunTestWithTimeout(
  argv: string[],
  timeoutMs: number,
  label: string
): Promise<number> {
  const proc = Bun.spawn(argv, {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  });

  let timedOut = false;
  const t = setTimeout(() => {
    timedOut = true;
    writeErr(`alfred_test_timeout label=${label} ms=${timeoutMs}\n`);
    try {
      proc.kill();
    } catch {
      // ignore
    }
    // Escalate: some hangs ignore SIGTERM (or keep the process alive via open handles).
    setTimeout(() => {
      try {
        proc.kill(9);
      } catch {
        // ignore
      }
    }, 2000);
  }, timeoutMs);
  (t as unknown as { unref?: () => void }).unref?.();

  const code = await proc.exited;
  clearTimeout(t);

  if (timedOut && code === 0) {
    return 1;
  }
  return code;
}

function splitArgs(argv: string[]): { flags: string[]; patterns: string[] } {
  const flags: string[] = [];
  const patterns: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a) {
      continue;
    }

    if (a.startsWith("-")) {
      flags.push(a);
      const next = argv[i + 1];
      if (
        next &&
        !next.startsWith("-") &&
        (a === "--timeout" ||
          a === "--preload" ||
          a === "--rerun-each" ||
          a === "--seed" ||
          a === "--bail" ||
          a === "--max-concurrency" ||
          a === "-t" ||
          a === "--test-name-pattern" ||
          a === "--coverage-reporter" ||
          a === "--coverage-dir" ||
          a === "--reporter" ||
          a === "--reporter-outfile")
      ) {
        flags.push(next);
        i += 1;
      }
      continue;
    }

    patterns.push(a);
  }

  return { flags, patterns };
}

function parseScope(v: string | undefined): Scope {
  const s = (v ?? "unit").trim().toLowerCase();
  if (s === "all") {
    return "all";
  }
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

  // Some repos place tests under __tests__ with looser naming.
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

const { flags, patterns } = splitArgs(args);

// Back-compat: if the caller provides patterns/files, delegate to Bun discovery for that.
// Repo scripts should avoid passing patterns for package tests so scope filtering can apply.
if (patterns.length > 0) {
  const ms = parseMs(process.env.ALFRED_TEST_RUN_TIMEOUT_MS, 120_000);
  const code = await runBunTestWithTimeout(
    ["bun", "test", ...flags, ...patterns],
    ms,
    "patterns"
  );
  process.exit(code);
}

const scope = parseScope(process.env.ALFRED_TEST_SCOPE);
const cwd = process.cwd();
const all = await discoverTests(cwd);
const picked =
  scope === "all" ? all : all.filter((p) => kindOfFile(p) === scope);

if (picked.length === 0) {
  // Match Bun behavior (unless user asked for strictness).
  const ms = parseMs(process.env.ALFRED_TEST_RUN_TIMEOUT_MS, 120_000);
  const code = await runBunTestWithTimeout(
    ["bun", "test", ...flags, "--pass-with-no-tests"],
    ms,
    "no_tests"
  );
  process.exit(code);
}

const finalFlags = hasTimeoutFlag(flags)
  ? flags
  : (() => {
      const timeout = process.env.ALFRED_TEST_TIMEOUT_MS?.trim();
      if (!timeout) {
        return flags;
      }
      return [...flags, `--timeout=${timeout}`];
    })();

const isolateFiles = process.env.ALFRED_TEST_ISOLATE_FILES?.trim() === "1";
if (!isolateFiles) {
  const ms = parseMs(process.env.ALFRED_TEST_RUN_TIMEOUT_MS, 120_000);
  const code = await runBunTestWithTimeout(
    ["bun", "test", ...finalFlags, ...picked],
    ms,
    "suite"
  );
  process.exit(code);
}

const isolateConc = parsePositiveInt(process.env.ALFRED_TEST_ISOLATE_CONCURRENCY, 1);
const bail = hasBailFlag(finalFlags);
const q = [...picked];
let failCode = 0;

async function runFile(file: string): Promise<number> {
  const start = Date.now();
  (globalThis as unknown as { __alfredTestLastFile?: string }).__alfredTestLastFile =
    file;
  writeErr(`alfred_test_file_start file=${file}\n`);
  const ms = parseMs(process.env.ALFRED_TEST_FILE_TIMEOUT_MS, 60_000);
  const code = await runBunTestWithTimeout(
    ["bun", "test", ...finalFlags, file],
    ms,
    file
  );
  const dur = Date.now() - start;
  writeErr(`alfred_test_file_done file=${file} code=${code} ms=${dur}\n`);
  return code;
}

const workerCount = Math.min(isolateConc, q.length);
const workers = Array.from({ length: workerCount }, async () => {
  while (q.length > 0) {
    if (bail && failCode !== 0) {
      return;
    }
    const file = q.shift();
    if (!file) {
      return;
    }
    const code = await runFile(file);
    if (code !== 0) {
      failCode = code;
      if (bail) {
        return;
      }
    }
  }
});

await Promise.all(workers);
process.exit(failCode);

