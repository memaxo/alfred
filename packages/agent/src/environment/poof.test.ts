import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { POOF_PROFILES, resetPoofCache } from "../spawn/poof.js";
import { PoofWorkspace } from "./poof.js";

describe("PoofWorkspace", () => {
  let testDir: string;
  let repoBase: string;

  beforeEach(async () => {
    resetPoofCache();
    testDir = await mkdtemp(path.join(tmpdir(), "poof-workspace-test-"));
    repoBase = path.join(testDir, "repo");
    mkdirSync(repoBase, { recursive: true });
  });

  afterEach(async () => {
    resetPoofCache();
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("construction", () => {
    test("creates workspace with correct properties", () => {
      const ws = new PoofWorkspace("agent-1", "run-123", repoBase);

      expect(ws.id).toBe("agent-1");
      expect(ws.runId).toBe("run-123");
      expect(ws.repoBase).toBe(repoBase);
      expect(ws.kind).toBe("poof");
      expect(ws.root).toBe(repoBase);
      expect(ws.branch).toBeNull();
    });

    test("accepts custom config", () => {
      const ws = new PoofWorkspace("agent-1", "run-123", repoBase, {
        profile: POOF_PROFILES.intensive,
        mode: "exec",
        verbose: true,
      });

      expect(ws.profile).toEqual(POOF_PROFILES.intensive);
      expect(ws.mode).toBe("exec");
    });

    test("uses default profile and mode", () => {
      const ws = new PoofWorkspace("agent-1", "run-123", repoBase);

      expect(ws.profile).toEqual(POOF_PROFILES.standard);
      expect(ws.mode).toBe("run");
    });
  });

  describe("initialize", () => {
    test("throws when poof not available", async () => {
      if (process.platform !== "linux") {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await expect(ws.initialize()).rejects.toThrow("poof_not_available");
      }
    });

    test.skipIf(process.platform !== "linux")(
      "creates upper directory",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();

        const upperDir = ws.getUpperDir();
        expect(upperDir).not.toBeNull();
        expect(existsSync(upperDir!)).toBe(true);
        expect(upperDir).toContain("poof-run-123-agent-1");

        await ws.cleanup();
      }
    );

    test.skipIf(process.platform !== "linux")("is idempotent", async () => {
      const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
      await ws.initialize();
      const upperDir1 = ws.getUpperDir();

      await ws.initialize(); // Should not create new directory
      const upperDir2 = ws.getUpperDir();

      expect(upperDir1).toBe(upperDir2);

      await ws.cleanup();
    });
  });

  describe("cleanup", () => {
    test.skipIf(process.platform !== "linux")(
      "removes upper directory",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();
        const upperDir = ws.getUpperDir();
        expect(existsSync(upperDir!)).toBe(true);

        await ws.cleanup();

        expect(ws.getUpperDir()).toBeNull();
        expect(existsSync(upperDir!)).toBe(false);
      }
    );

    test.skipIf(process.platform !== "linux")(
      "removes checkpoint directories",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();
        await ws.checkpoint("cp1");
        await ws.checkpoint("cp2");

        await ws.cleanup();

        // Checkpoint directories should be cleaned up
        expect(ws.getUpperDir()).toBeNull();
      }
    );

    test("handles already cleaned workspace", async () => {
      const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
      // Should not throw when cleaning uninitialized workspace
      await ws.cleanup();
    });
  });

  describe("checkpoint and restore", () => {
    test("throws when not initialized", async () => {
      const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
      await expect(ws.checkpoint("cp1")).rejects.toThrow(
        "poof_workspace_not_initialized"
      );
    });

    test.skipIf(process.platform !== "linux")(
      "creates checkpoint snapshot",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();

        // Create some changes in upper dir
        const upperDir = ws.getUpperDir()!;
        const changesPath = path.join(upperDir, repoBase);
        mkdirSync(changesPath, { recursive: true });
        writeFileSync(path.join(changesPath, "file1.txt"), "original");

        await ws.checkpoint("before-modify");

        // Modify the file
        writeFileSync(path.join(changesPath, "file1.txt"), "modified");
        writeFileSync(path.join(changesPath, "file2.txt"), "new file");

        // Restore checkpoint
        await ws.restore("before-modify");

        // Should be back to original state
        const restoredPath = path.join(ws.getUpperDir()!, repoBase);
        expect(readFileSync(path.join(restoredPath, "file1.txt"), "utf8")).toBe(
          "original"
        );
        expect(existsSync(path.join(restoredPath, "file2.txt"))).toBe(false);

        await ws.cleanup();
      }
    );

    test.skipIf(process.platform !== "linux")(
      "throws for non-existent checkpoint",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();

        await expect(ws.restore("nonexistent")).rejects.toThrow(
          "poof_checkpoint_not_found:nonexistent"
        );

        await ws.cleanup();
      }
    );

    test.skipIf(process.platform !== "linux")(
      "supports multiple checkpoints",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();

        const upperDir = ws.getUpperDir()!;
        const changesPath = path.join(upperDir, repoBase);
        mkdirSync(changesPath, { recursive: true });

        writeFileSync(path.join(changesPath, "counter.txt"), "1");
        await ws.checkpoint("v1");

        writeFileSync(path.join(changesPath, "counter.txt"), "2");
        await ws.checkpoint("v2");

        writeFileSync(path.join(changesPath, "counter.txt"), "3");
        await ws.checkpoint("v3");

        // Restore to v1
        await ws.restore("v1");
        expect(
          readFileSync(
            path.join(ws.getUpperDir()!, repoBase, "counter.txt"),
            "utf8"
          )
        ).toBe("1");

        // Restore to v3
        await ws.restore("v3");
        expect(
          readFileSync(
            path.join(ws.getUpperDir()!, repoBase, "counter.txt"),
            "utf8"
          )
        ).toBe("3");

        await ws.cleanup();
      }
    );
  });

  describe("exec", () => {
    test("throws when not initialized", async () => {
      const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
      await expect(ws.exec("echo test")).rejects.toThrow(
        "poof_workspace_not_initialized"
      );
    });

    test.skipIf(process.platform !== "linux")(
      "executes command in isolation",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();

        const result = await ws.exec("echo 'hello from poof'");

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("hello from poof");
        expect(result.durationMs).toBeGreaterThan(0);

        await ws.cleanup();
      }
    );

    test.skipIf(process.platform !== "linux")(
      "captures exit code on failure",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();

        const result = await ws.exec("exit 42");

        expect(result.exitCode).toBe(42);

        await ws.cleanup();
      }
    );

    test.skipIf(process.platform !== "linux")(
      "respects working directory option",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();

        const subdir = "subdir";
        mkdirSync(path.join(repoBase, subdir), { recursive: true });

        const result = await ws.exec("pwd", { cwd: subdir });

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain(subdir);

        await ws.cleanup();
      }
    );

    test.skipIf(process.platform !== "linux")(
      "passes environment variables",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();

        const result = await ws.exec("echo $CUSTOM_VAR", {
          env: { CUSTOM_VAR: "custom_value" },
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("custom_value");

        await ws.cleanup();
      }
    );
  });

  describe("change tracking", () => {
    test("throws when not initialized", async () => {
      const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
      await expect(ws.getChanges()).rejects.toThrow(
        "poof_workspace_not_initialized"
      );
      await expect(ws.hasChanges()).rejects.toThrow(
        "poof_workspace_not_initialized"
      );
    });

    test.skipIf(process.platform !== "linux")(
      "getChanges returns empty array when no changes",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();

        const changes = await ws.getChanges();
        expect(changes).toEqual([]);

        await ws.cleanup();
      }
    );

    test.skipIf(process.platform !== "linux")(
      "hasChanges returns false when no changes",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();

        expect(await ws.hasChanges()).toBe(false);

        await ws.cleanup();
      }
    );

    test.skipIf(process.platform !== "linux")(
      "detects changes in upper layer",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();

        // Simulate changes in upper layer
        const upperDir = ws.getUpperDir()!;
        const changesPath = path.join(upperDir, repoBase);
        mkdirSync(changesPath, { recursive: true });
        writeFileSync(path.join(changesPath, "new-file.txt"), "content");

        const changes = await ws.getChanges();
        expect(changes.length).toBe(1);
        expect(changes[0].path).toBe("new-file.txt");
        expect(changes[0].type).toBe("added");

        expect(await ws.hasChanges()).toBe(true);

        await ws.cleanup();
      }
    );

    test.skipIf(process.platform !== "linux")(
      "getChangeSummary returns correct counts",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();

        // Create original file in repo
        writeFileSync(path.join(repoBase, "existing.txt"), "original");

        // Simulate changes
        const upperDir = ws.getUpperDir()!;
        const changesPath = path.join(upperDir, repoBase);
        mkdirSync(changesPath, { recursive: true });
        writeFileSync(path.join(changesPath, "new.txt"), "new");
        writeFileSync(path.join(changesPath, "existing.txt"), "modified");

        const summary = await ws.getChangeSummary();
        expect(summary.total).toBe(2);
        expect(summary.added).toBe(1);
        expect(summary.modified).toBe(1);

        await ws.cleanup();
      }
    );

    test.skipIf(process.platform !== "linux")(
      "formatChanges returns readable output",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();

        const upperDir = ws.getUpperDir()!;
        const changesPath = path.join(upperDir, repoBase);
        mkdirSync(changesPath, { recursive: true });
        writeFileSync(path.join(changesPath, "added.txt"), "new");

        const formatted = await ws.formatChanges();
        expect(formatted).toContain("+ added.txt");

        await ws.cleanup();
      }
    );
  });

  describe("applyChanges", () => {
    test("throws when not initialized", async () => {
      const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
      await expect(ws.applyChanges()).rejects.toThrow(
        "poof_workspace_not_initialized"
      );
    });

    test.skipIf(process.platform !== "linux")(
      "applies changes to repo",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();

        // Create change in upper layer
        const upperDir = ws.getUpperDir()!;
        const changesPath = path.join(upperDir, repoBase);
        mkdirSync(changesPath, { recursive: true });
        writeFileSync(path.join(changesPath, "applied.txt"), "applied content");

        // Verify not yet in repo
        expect(existsSync(path.join(repoBase, "applied.txt"))).toBe(false);

        // Apply changes
        await ws.applyChanges();

        // Verify now in repo
        expect(existsSync(path.join(repoBase, "applied.txt"))).toBe(true);
        expect(readFileSync(path.join(repoBase, "applied.txt"), "utf8")).toBe(
          "applied content"
        );

        await ws.cleanup();
      }
    );

    test.skipIf(process.platform !== "linux")(
      "applies changes to custom target",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();

        const customTarget = path.join(testDir, "custom-target");
        mkdirSync(customTarget, { recursive: true });

        // Create change in upper layer
        const upperDir = ws.getUpperDir()!;
        const changesPath = path.join(upperDir, repoBase);
        mkdirSync(changesPath, { recursive: true });
        writeFileSync(path.join(changesPath, "custom.txt"), "custom content");

        await ws.applyChanges(customTarget);

        expect(existsSync(path.join(customTarget, "custom.txt"))).toBe(true);

        await ws.cleanup();
      }
    );
  });

  describe("discardChanges", () => {
    test("throws when not initialized", async () => {
      const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
      await expect(ws.discardChanges()).rejects.toThrow(
        "poof_workspace_not_initialized"
      );
    });

    test.skipIf(process.platform !== "linux")(
      "clears upper layer",
      async () => {
        const ws = new PoofWorkspace("agent-1", "run-123", repoBase);
        await ws.initialize();

        // Create changes
        const upperDir = ws.getUpperDir()!;
        const changesPath = path.join(upperDir, repoBase);
        mkdirSync(changesPath, { recursive: true });
        writeFileSync(path.join(changesPath, "discard-me.txt"), "content");

        expect(await ws.hasChanges()).toBe(true);

        await ws.discardChanges();

        expect(await ws.hasChanges()).toBe(false);
        // Upper dir should still exist but be empty
        expect(existsSync(ws.getUpperDir()!)).toBe(true);

        await ws.cleanup();
      }
    );
  });
});
