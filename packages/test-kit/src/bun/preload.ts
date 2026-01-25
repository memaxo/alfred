import { afterAll, afterEach, mock } from "bun:test";

const g = globalThis as unknown as {
  __alfredWatchdogInstalled?: boolean;
  __alfredMockResetRegistry?: (() => void)[];
};

/**
 * Centralized mock reset registry.
 * Test-kit modules register their reset functions here to be called in afterEach.
 * This ensures all mock state is cleaned up between tests automatically.
 */
export function getMockResetRegistry(): (() => void)[] {
  if (!g.__alfredMockResetRegistry) {
    g.__alfredMockResetRegistry = [];
  }
  return g.__alfredMockResetRegistry;
}

/**
 * Register a mock reset function to be called after each test.
 * Call this in test-kit modules to auto-register cleanup.
 *
 * @example
 * ```ts
 * // In packages/test-kit/src/redis/index.ts
 * registerMockReset(resetRedisMocks);
 * ```
 */
export function registerMockReset(resetFn: () => void): void {
  const registry = getMockResetRegistry();
  if (!registry.includes(resetFn)) {
    registry.push(resetFn);
  }
}

/**
 * Unregister a mock reset function.
 * Useful for cleanup in edge cases.
 */
export function unregisterMockReset(resetFn: () => void): void {
  const registry = getMockResetRegistry();
  const idx = registry.indexOf(resetFn);
  if (idx !== -1) {
    registry.splice(idx, 1);
  }
}

function writeErr(s: string): void {
  try {
    process.stderr.write(s);
  } catch {
    // ignore
  }
}

function shouldManageEnvKey(k: string): boolean {
  // Keep env reset conservative: some ALFRED_* vars are deliberately set once
  // in package-specific preloads (e.g. ALFRED_PLANS_DIR) and must persist.
  if (k.startsWith("ALFRED_TEST_")) {
    return true;
  }
  if (k.startsWith("RUN_DB_")) {
    return true;
  }
  if (k.startsWith("VCR_")) {
    return true;
  }
  if (k === "VITE_TEST_MODE") {
    return true;
  }
  return false;
}

const baseEnv = new Map<string, string>();
for (const [k, v] of Object.entries(process.env)) {
  if (!shouldManageEnvKey(k)) {
    continue;
  }
  if (typeof v === "string") {
    baseEnv.set(k, v);
  }
}

function resetEnv(): void {
  for (const k of Object.keys(process.env)) {
    if (!shouldManageEnvKey(k)) {
      continue;
    }
    if (!baseEnv.has(k)) {
      Reflect.deleteProperty(process.env, k);
    }
  }
  for (const [k, v] of baseEnv) {
    process.env[k] = v;
  }
}

function parseMs(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

if (!g.__alfredWatchdogInstalled) {
  g.__alfredWatchdogInstalled = true;
  const ms = parseMs(process.env.ALFRED_TEST_WATCHDOG_MS, 300_000);
  const t = setTimeout(() => {
    writeErr(
      `\nalfred_test_watchdog_timeout ms=${ms} pid=${process.pid} cwd=${process.cwd()}\n`
    );
    process.exit(1);
  }, ms);
  (t as unknown as { unref?: () => void }).unref?.();
}

afterEach(async () => {
  // Function mocks (spyOn/jest.fn/vi.fn)
  try {
    mock.restore();
  } catch {
    // ignore
  }
  try {
    mock.clearAllMocks();
  } catch {
    // ignore
  }

  // Call all registered mock reset functions from test-kit modules
  const registry = getMockResetRegistry();
  for (const resetFn of registry) {
    try {
      resetFn();
    } catch {
      // ignore individual reset failures
    }
  }

  resetEnv();
});

afterAll(() => {
  // Defensive: some CLI libraries resume stdin (e.g. completion tooling).
  // Pausing stdin prevents “tests finished but process won’t exit” hangs.
  try {
    process.stdin.pause();
  } catch {
    // ignore
  }
});
