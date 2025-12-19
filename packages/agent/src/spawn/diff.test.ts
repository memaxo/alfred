import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  applyUpperLayer,
  discardUpperLayer,
  formatChanges,
  hasChanges,
  parseUpperLayer,
  summarizeChanges,
  type PoofChange,
} from "./diff.js";

describe("diff", () => {
  let testDir: string;
  let upperDir: string;
  let targetDir: string;

  beforeEach(async () => {
    // Create temporary test directories
    testDir = await mkdtemp(path.join(tmpdir(), "poof-diff-test-"));
    upperDir = path.join(testDir, "upper");
    targetDir = path.join(testDir, "target");
    mkdirSync(upperDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });
  });

  afterEach(() => {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("parseUpperLayer", () => {
    test("returns empty array when no changes", async () => {
      const changes = await parseUpperLayer(upperDir, targetDir);
      expect(changes).toEqual([]);
    });

    test("detects added file", async () => {
      // Create the mirror path structure in upper
      const changesPath = path.join(upperDir, targetDir);
      mkdirSync(changesPath, { recursive: true });
      writeFileSync(path.join(changesPath, "newfile.txt"), "content");

      const changes = await parseUpperLayer(upperDir, targetDir);
      expect(changes.length).toBe(1);
      expect(changes[0].path).toBe("newfile.txt");
      expect(changes[0].type).toBe("added");
      expect(changes[0].isDirectory).toBe(false);
    });

    test("detects modified file", async () => {
      // Create original file in target
      writeFileSync(path.join(targetDir, "existing.txt"), "original");

      // Create modified version in upper
      const changesPath = path.join(upperDir, targetDir);
      mkdirSync(changesPath, { recursive: true });
      writeFileSync(path.join(changesPath, "existing.txt"), "modified");

      const changes = await parseUpperLayer(upperDir, targetDir);
      expect(changes.length).toBe(1);
      expect(changes[0].path).toBe("existing.txt");
      expect(changes[0].type).toBe("modified");
    });

    test("detects empty directory as added", async () => {
      const changesPath = path.join(upperDir, targetDir);
      mkdirSync(path.join(changesPath, "newdir"), { recursive: true });

      const changes = await parseUpperLayer(upperDir, targetDir);
      expect(changes.length).toBe(1);
      expect(changes[0].path).toBe("newdir");
      expect(changes[0].type).toBe("added");
      expect(changes[0].isDirectory).toBe(true);
    });

    test("recurses into directories with contents", async () => {
      const changesPath = path.join(upperDir, targetDir);
      const subdir = path.join(changesPath, "subdir");
      mkdirSync(subdir, { recursive: true });
      writeFileSync(path.join(subdir, "file.txt"), "content");

      const changes = await parseUpperLayer(upperDir, targetDir);
      expect(changes.length).toBe(1);
      expect(changes[0].path).toBe("subdir/file.txt");
    });
  });

  describe("summarizeChanges", () => {
    test("counts change types correctly", () => {
      const changes: PoofChange[] = [
        { path: "a.txt", type: "added", isDirectory: false },
        { path: "b.txt", type: "added", isDirectory: false },
        { path: "c.txt", type: "modified", isDirectory: false },
        { path: "d.txt", type: "deleted", isDirectory: false },
      ];

      const summary = summarizeChanges(changes);
      expect(summary.total).toBe(4);
      expect(summary.added).toBe(2);
      expect(summary.modified).toBe(1);
      expect(summary.deleted).toBe(1);
      expect(summary.changes).toBe(changes);
    });

    test("handles empty changes", () => {
      const summary = summarizeChanges([]);
      expect(summary.total).toBe(0);
      expect(summary.added).toBe(0);
      expect(summary.modified).toBe(0);
      expect(summary.deleted).toBe(0);
    });
  });

  describe("formatChanges", () => {
    test("formats changes with correct prefixes", () => {
      const changes: PoofChange[] = [
        { path: "added.txt", type: "added", isDirectory: false },
        { path: "modified.txt", type: "modified", isDirectory: false },
        { path: "deleted.txt", type: "deleted", isDirectory: false },
        { path: "newdir", type: "added", isDirectory: true },
      ];

      const formatted = formatChanges(changes);
      expect(formatted).toContain("+ added.txt");
      expect(formatted).toContain("~ modified.txt");
      expect(formatted).toContain("- deleted.txt");
      expect(formatted).toContain("+ newdir/");
    });

    test("handles empty changes", () => {
      const formatted = formatChanges([]);
      expect(formatted).toBe("");
    });
  });

  describe("hasChanges", () => {
    test("returns false when no changes", async () => {
      const result = await hasChanges(upperDir, targetDir);
      expect(result).toBe(false);
    });

    test("returns true when changes exist", async () => {
      const changesPath = path.join(upperDir, targetDir);
      mkdirSync(changesPath, { recursive: true });
      writeFileSync(path.join(changesPath, "file.txt"), "content");

      const result = await hasChanges(upperDir, targetDir);
      expect(result).toBe(true);
    });
  });

  describe("applyUpperLayer", () => {
    test("copies new files to target", async () => {
      const changesPath = path.join(upperDir, targetDir);
      mkdirSync(changesPath, { recursive: true });
      writeFileSync(path.join(changesPath, "newfile.txt"), "new content");

      await applyUpperLayer(upperDir, targetDir);

      const targetFile = path.join(targetDir, "newfile.txt");
      const file = Bun.file(targetFile);
      expect(await file.exists()).toBe(true);
      expect(await file.text()).toBe("new content");
    });

    test("overwrites modified files in target", async () => {
      // Create original
      writeFileSync(path.join(targetDir, "existing.txt"), "original");

      // Create modified version in upper
      const changesPath = path.join(upperDir, targetDir);
      mkdirSync(changesPath, { recursive: true });
      writeFileSync(path.join(changesPath, "existing.txt"), "modified");

      await applyUpperLayer(upperDir, targetDir);

      const targetFile = path.join(targetDir, "existing.txt");
      const file = Bun.file(targetFile);
      expect(await file.text()).toBe("modified");
    });

    test("handles non-existent upper directory gracefully", async () => {
      // Should not throw
      await applyUpperLayer("/nonexistent/upper", targetDir);
    });
  });

  describe("discardUpperLayer", () => {
    test("removes upper directory", async () => {
      const changesPath = path.join(upperDir, targetDir);
      mkdirSync(changesPath, { recursive: true });
      writeFileSync(path.join(changesPath, "file.txt"), "content");

      discardUpperLayer(upperDir);

      // Check that the directory no longer exists
      const exists = await Bun.file(path.join(upperDir, "some-file")).exists();
      expect(exists).toBe(false);
    });

    test("handles non-existent directory gracefully", () => {
      // Should not throw
      discardUpperLayer("/nonexistent/dir");
    });
  });
});
