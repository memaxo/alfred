import { afterAll, afterEach, mock } from "bun:test";

const g = globalThis as unknown as {
  __alfredWatchdogInstalled?: boolean;
};

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
