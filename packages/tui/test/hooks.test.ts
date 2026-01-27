import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("CLI Hooks", () => {
  const repoRoot = path.join(import.meta.dir, "../../..");
  const bin = path.join(import.meta.dir, "../src/bin/alfred.ts");

  test("hooks create/validate/test", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "alfred-hooks-"));
    try {
      const createProc = Bun.spawn(
        ["bun", bin, "hooks", "create", "--dir", dir],
        {
          cwd: repoRoot,
          stdin: "ignore",
          stdout: "ignore",
          stderr: "ignore",
          env: {
            ...process.env,
            ALFRED_API_AUTO_INIT: "false",
            DATABASE_URL: process.env.DATABASE_URL ?? "sqlite::memory:",
          },
        }
      );

      expect(await createProc.exited).toBe(0);
      expect(await Bun.file(path.join(dir, "hooks.json")).exists()).toBe(true);
      expect(await Bun.file(path.join(dir, "hooks/echo.ts")).exists()).toBe(
        true
      );

      const validateProc = Bun.spawn(
        ["bun", bin, "hooks", "validate", "--dir", dir],
        {
          cwd: repoRoot,
          stdin: "ignore",
          stdout: "ignore",
          stderr: "ignore",
          env: {
            ...process.env,
            ALFRED_API_AUTO_INIT: "false",
            DATABASE_URL: process.env.DATABASE_URL ?? "sqlite::memory:",
          },
        }
      );
      expect(await validateProc.exited).toBe(0);

      const testProc = Bun.spawn(
        [
          "bun",
          bin,
          "hooks",
          "test",
          "--dir",
          dir,
          "--event",
          "voice:stt:after",
          "--payload",
          JSON.stringify({ transcript: "teh", confidence: 1 }),
        ],
        {
          cwd: repoRoot,
          stdin: "ignore",
          stdout: "ignore",
          stderr: "ignore",
          env: {
            ...process.env,
            ALFRED_API_AUTO_INIT: "false",
            DATABASE_URL: process.env.DATABASE_URL ?? "sqlite::memory:",
          },
        }
      );
      expect(await testProc.exited).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 20_000);
});
