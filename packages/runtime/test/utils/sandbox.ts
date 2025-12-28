import { afterAll, beforeAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const g = globalThis as unknown as {
  __alfredSandboxWatchdogInstalled?: boolean;
};

if (!g.__alfredSandboxWatchdogInstalled) {
  g.__alfredSandboxWatchdogInstalled = true;
  const ms = Number(process.env.ALFRED_TEST_WATCHDOG_MS ?? "300000");
  const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 300_000;
  const t = setTimeout(() => {
    try {
      process.stderr.write(
        `\nalfred_test_sandbox_watchdog_timeout ms=${safeMs} pid=${process.pid} cwd=${process.cwd()}\n`
      );
    } catch {
      // ignore
    }
    process.exit(1);
  }, safeMs);
  (t as unknown as { unref?: () => void }).unref?.();
}

let dir: string | null = null;

beforeAll(() => {
  if (process.env.ALFRED_PLANS_DIR?.trim()) {
    return;
  }
  dir = mkdtempSync(path.join(os.tmpdir(), "alfred-plans-"));
  process.env.ALFRED_PLANS_DIR = dir;
});

afterAll(() => {
  if (!dir) {
    return;
  }
  rmSync(dir, { recursive: true, force: true });
});
