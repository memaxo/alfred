import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  cleanupUpperDir,
  createUpperDir,
  spawnEphemeral,
  spawnIsolated,
  spawnReviewable,
} from "./isolated.js";
import { resetPoofCache, POOF_PROFILES } from "./poof.js";

describe("isolated", () => {
  let testDir: string;

  beforeEach(async () => {
    resetPoofCache();
    testDir = await mkdtemp(path.join(tmpdir(), "isolated-test-"));
  });

  afterEach(() => {
    resetPoofCache();
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("spawnIsolated", () => {
    test("throws when poof not available", async () => {
      // On non-Linux platforms, poof is not available
      if (process.platform !== "linux") {
        await expect(
          spawnIsolated({
            mode: "exec",
            cwd: testDir,
            command: ["echo", "test"],
          })
        ).rejects.toThrow("poof_not_available");
      }
    });

    test.skipIf(process.platform !== "linux")(
      "runs command in exec mode (ephemeral)",
      async () => {
        const result = await spawnIsolated({
          mode: "exec",
          cwd: testDir,
          command: ["touch", "ephemeral-file.txt"],
          captureStdout: true,
          captureStderr: true,
        });

        expect(result.exitCode).toBe(0);
        expect(result.timedOut).toBe(false);
        expect(result.commandNotFound).toBe(false);
        // File should not exist after ephemeral execution
        expect(existsSync(path.join(testDir, "ephemeral-file.txt"))).toBe(false);
      }
    );

    test.skipIf(process.platform !== "linux")(
      "runs command in run mode (reviewable)",
      async () => {
        const upperDir = await createUpperDir();

        try {
          const result = await spawnIsolated({
            mode: "run",
            upperDir,
            cwd: testDir,
            command: ["touch", "reviewable-file.txt"],
            captureStdout: true,
            captureStderr: true,
          });

          expect(result.exitCode).toBe(0);
          expect(result.upperDir).toBe(upperDir);
          expect(result.timedOut).toBe(false);
          // Changes should be captured, not applied to host
          expect(existsSync(path.join(testDir, "reviewable-file.txt"))).toBe(
            false
          );
          // Changes should be in upper layer
          expect(result.changes).toBeDefined();
        } finally {
          cleanupUpperDir(upperDir);
        }
      }
    );

    test.skipIf(process.platform !== "linux")(
      "creates temp upper dir when not provided in run mode",
      async () => {
        const result = await spawnIsolated({
          mode: "run",
          cwd: testDir,
          command: ["echo", "test"],
          captureStdout: true,
        });

        expect(result.exitCode).toBe(0);
        expect(result.upperDir).toBeDefined();
        expect(result.upperDir).toContain("poof-upper-");

        // Clean up
        if (result.upperDir) {
          cleanupUpperDir(result.upperDir);
        }
      }
    );

    test.skipIf(process.platform !== "linux")(
      "captures stdout when requested",
      async () => {
        const result = await spawnIsolated({
          mode: "exec",
          cwd: testDir,
          command: ["echo", "hello world"],
          captureStdout: true,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("hello world");
      }
    );

    test.skipIf(process.platform !== "linux")(
      "captures stderr when requested",
      async () => {
        const result = await spawnIsolated({
          mode: "exec",
          cwd: testDir,
          command: ["sh", "-c", "echo error >&2"],
          captureStderr: true,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toContain("error");
      }
    );

    test.skipIf(process.platform !== "linux")(
      "detects timeout exit code",
      async () => {
        const result = await spawnIsolated({
          mode: "exec",
          cwd: testDir,
          command: ["sleep", "60"],
          profile: { name: "quick-timeout", timeout: 1 },
          captureStdout: true,
          captureStderr: true,
        });

        expect(result.exitCode).toBe(124);
        expect(result.timedOut).toBe(true);
      }
    );

    test.skipIf(process.platform !== "linux")(
      "detects command not found exit code",
      async () => {
        const result = await spawnIsolated({
          mode: "exec",
          cwd: testDir,
          command: ["nonexistent-command-xyz"],
          captureStdout: true,
          captureStderr: true,
        });

        expect(result.exitCode).toBe(127);
        expect(result.commandNotFound).toBe(true);
      }
    );

    test.skipIf(process.platform !== "linux")(
      "passes environment variables",
      async () => {
        const result = await spawnIsolated({
          mode: "exec",
          cwd: testDir,
          command: ["sh", "-c", "echo $TEST_VAR"],
          env: { TEST_VAR: "custom_value" },
          captureStdout: true,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("custom_value");
      }
    );

    test.skipIf(process.platform !== "linux")(
      "applies resource profile limits",
      async () => {
        const result = await spawnIsolated({
          mode: "exec",
          cwd: testDir,
          command: ["echo", "limited"],
          profile: POOF_PROFILES.minimal,
          captureStdout: true,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("limited");
      }
    );
  });

  describe("spawnEphemeral", () => {
    test("throws when poof not available", async () => {
      if (process.platform !== "linux") {
        await expect(
          spawnEphemeral(["echo", "test"], testDir)
        ).rejects.toThrow("poof_not_available");
      }
    });

    test.skipIf(process.platform !== "linux")(
      "runs command in ephemeral mode",
      async () => {
        const result = await spawnEphemeral(["echo", "ephemeral"], testDir, {
          captureStdout: true,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("ephemeral");
        expect(result.upperDir).toBeUndefined();
      }
    );
  });

  describe("spawnReviewable", () => {
    test("throws when poof not available", async () => {
      if (process.platform !== "linux") {
        await expect(
          spawnReviewable(["echo", "test"], testDir)
        ).rejects.toThrow("poof_not_available");
      }
    });

    test.skipIf(process.platform !== "linux")(
      "runs command in reviewable mode",
      async () => {
        const result = await spawnReviewable(["echo", "reviewable"], testDir, {
          captureStdout: true,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("reviewable");
        expect(result.upperDir).toBeDefined();

        // Clean up
        if (result.upperDir) {
          cleanupUpperDir(result.upperDir);
        }
      }
    );

    test.skipIf(process.platform !== "linux")(
      "uses provided upper directory",
      async () => {
        const customUpper = await createUpperDir();

        try {
          const result = await spawnReviewable(["echo", "test"], testDir, {
            upperDir: customUpper,
            captureStdout: true,
          });

          expect(result.exitCode).toBe(0);
          expect(result.upperDir).toBe(customUpper);
        } finally {
          cleanupUpperDir(customUpper);
        }
      }
    );
  });

  describe("createUpperDir", () => {
    test("creates temporary directory", async () => {
      const upperDir = await createUpperDir();

      expect(existsSync(upperDir)).toBe(true);
      expect(upperDir).toContain("poof-upper-");

      // Clean up
      cleanupUpperDir(upperDir);
    });

    test("uses custom prefix", async () => {
      const prefix = path.join(testDir, "custom-prefix-");
      const upperDir = await createUpperDir(prefix);

      expect(existsSync(upperDir)).toBe(true);
      expect(upperDir).toContain("custom-prefix-");

      // Clean up
      cleanupUpperDir(upperDir);
    });
  });

  describe("cleanupUpperDir", () => {
    test("removes directory and contents", async () => {
      const upperDir = await createUpperDir();
      mkdirSync(path.join(upperDir, "subdir"), { recursive: true });
      writeFileSync(path.join(upperDir, "file.txt"), "content");
      writeFileSync(path.join(upperDir, "subdir", "nested.txt"), "nested");

      cleanupUpperDir(upperDir);

      expect(existsSync(upperDir)).toBe(false);
    });

    test("handles non-existent directory gracefully", () => {
      // Should not throw
      cleanupUpperDir("/nonexistent/directory/path");
    });

    test("handles already-deleted directory gracefully", async () => {
      const upperDir = await createUpperDir();
      rmSync(upperDir, { recursive: true });

      // Should not throw
      cleanupUpperDir(upperDir);
    });
  });
});
