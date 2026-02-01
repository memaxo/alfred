import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  batchDelete,
  batchExport,
  batchPin,
  batchUnpin,
} from "../src/services/agentfs-batch";

const TEST_DIR = path.join(
  process.cwd(),
  ".agent/test-workspaces/agentfs-batch-test"
);
const AGENTFS_DIR = path.join(TEST_DIR, ".agentfs");

describe("agentfs-batch service", () => {
  beforeAll(async () => {
    // Clean up any existing test directory
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(AGENTFS_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("batchDelete", () => {
    it("should delete run directories recursively (not using unlink)", async () => {
      // Create a test run with nested files
      const runId = "test-run-001";
      const runDir = path.join(AGENTFS_DIR, runId);
      const nestedDir = path.join(runDir, "subdir");
      const testFile = path.join(nestedDir, "test.txt");

      await mkdir(nestedDir, { recursive: true });
      await writeFile(testFile, "test content");

      expect(existsSync(runDir)).toBe(true);
      expect(existsSync(testFile)).toBe(true);

      const result = await batchDelete([runId], { rootAbs: TEST_DIR });

      expect(result.deleted).toHaveLength(1);
      expect(result.deleted[0].id).toBe(runId);
      expect(result.deleted[0].success).toBe(true);
      expect(existsSync(runDir)).toBe(false);
    });

    it("should skip pinned runs", async () => {
      const runId = "test-run-pinned";
      const runDir = path.join(AGENTFS_DIR, runId);
      const keepFile = path.join(runDir, ".keep");

      await mkdir(runDir, { recursive: true });
      await writeFile(keepFile, new Date().toISOString());

      const result = await batchDelete([runId], { rootAbs: TEST_DIR });

      expect(result.skippedPinned).toContain(runId);
      expect(result.deleted).toHaveLength(0);
      expect(existsSync(runDir)).toBe(true);

      // Cleanup
      await rm(runDir, { recursive: true, force: true });
    });

    it("should report missing runs as failed", async () => {
      const result = await batchDelete(["non-existent-run"], {
        rootAbs: TEST_DIR,
      });

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].id).toBe("non-existent-run");
      expect(result.failed[0].success).toBe(false);
    });

    it("should respect dryRun mode", async () => {
      const runId = "test-run-dry";
      const runDir = path.join(AGENTFS_DIR, runId);
      const testFile = path.join(runDir, "file.txt");

      await mkdir(runDir, { recursive: true });
      await writeFile(testFile, "content");

      const result = await batchDelete([runId], {
        dryRun: true,
        rootAbs: TEST_DIR,
      });

      expect(result.deleted).toHaveLength(1);
      expect(existsSync(runDir)).toBe(true); // Not actually deleted

      // Cleanup
      await rm(runDir, { recursive: true, force: true });
    });

    it("should never delete cas or quarantine directories", async () => {
      const casDir = path.join(AGENTFS_DIR, "cas");
      const quarantineDir = path.join(AGENTFS_DIR, "quarantine");

      await mkdir(casDir, { recursive: true });
      await mkdir(quarantineDir, { recursive: true });
      await writeFile(path.join(casDir, "test.txt"), "test");
      await writeFile(path.join(quarantineDir, "test.txt"), "test");

      const result = await batchDelete(["cas", "quarantine"], {
        rootAbs: TEST_DIR,
      });

      expect(result.failed).toHaveLength(2);
      expect(result.failed[0].error).toBe("agentfs_batch_protected_directory");
      expect(existsSync(casDir)).toBe(true);
      expect(existsSync(quarantineDir)).toBe(true);

      // Cleanup
      await rm(casDir, { recursive: true, force: true });
      await rm(quarantineDir, { recursive: true, force: true });
    });

    it("should calculate bytes freed correctly", async () => {
      const runId = "test-run-bytes";
      const runDir = path.join(AGENTFS_DIR, runId);
      const testFile = path.join(runDir, "file.txt");

      await mkdir(runDir, { recursive: true });
      const content = "x".repeat(1000);
      await writeFile(testFile, content);

      const result = await batchDelete([runId], { rootAbs: TEST_DIR });

      expect(result.bytesFreed).toBeGreaterThanOrEqual(1000);
    });
  });

  describe("batchPin", () => {
    it("should create .keep files", async () => {
      const runId = "test-run-pin";
      const runDir = path.join(AGENTFS_DIR, runId);

      await mkdir(runDir, { recursive: true });

      const result = await batchPin([runId], { rootAbs: TEST_DIR });

      expect(result.pinned).toContain(runId);
      expect(existsSync(path.join(runDir, ".keep"))).toBe(true);

      // Cleanup
      await rm(runDir, { recursive: true, force: true });
    });

    it("should report already pinned runs", async () => {
      const runId = "test-run-already-pinned";
      const runDir = path.join(AGENTFS_DIR, runId);

      await mkdir(runDir, { recursive: true });
      await writeFile(path.join(runDir, ".keep"), new Date().toISOString());

      const result = await batchPin([runId], { rootAbs: TEST_DIR });

      expect(result.alreadyPinned).toContain(runId);
      expect(result.pinned).toHaveLength(0);

      // Cleanup
      await rm(runDir, { recursive: true, force: true });
    });
  });

  describe("batchUnpin", () => {
    it("should remove .keep files", async () => {
      const runId = "test-run-unpin";
      const runDir = path.join(AGENTFS_DIR, runId);

      await mkdir(runDir, { recursive: true });
      await writeFile(path.join(runDir, ".keep"), new Date().toISOString());

      const result = await batchUnpin([runId], { rootAbs: TEST_DIR });

      expect(result.unpinned).toContain(runId);
      expect(existsSync(path.join(runDir, ".keep"))).toBe(false);

      // Cleanup
      await rm(runDir, { recursive: true, force: true });
    });

    it("should report not pinned runs", async () => {
      const runId = "test-run-not-pinned";
      const runDir = path.join(AGENTFS_DIR, runId);

      await mkdir(runDir, { recursive: true });

      const result = await batchUnpin([runId], { rootAbs: TEST_DIR });

      expect(result.notPinned).toContain(runId);
      expect(result.unpinned).toHaveLength(0);

      // Cleanup
      await rm(runDir, { recursive: true, force: true });
    });
  });

  describe("batchExport", () => {
    it("should export runs to CAS with real archives", async () => {
      const runId = "test-run-export";
      const runDir = path.join(AGENTFS_DIR, runId);

      await mkdir(runDir, { recursive: true });
      await writeFile(path.join(runDir, "file1.txt"), "content1");
      await writeFile(path.join(runDir, "file2.txt"), "content2");

      const result = await batchExport([runId], {
        store: true,
        rootAbs: TEST_DIR,
      });

      expect(result.archives).toHaveLength(1);
      expect(result.archives[0].runId).toBe(runId);
      expect(result.archives[0].sha).toMatch(/^[a-f0-9]{64}$/);

      // Verify CAS archive was created
      const casDir = path.join(AGENTFS_DIR, "cas");
      const { sha } = result.archives[0];
      const archivePath = path.join(casDir, `${sha}.tar.gz`);
      const metaPath = path.join(casDir, `${sha}.json`);

      expect(existsSync(archivePath)).toBe(true);
      expect(existsSync(metaPath)).toBe(true);

      // Verify archive is not empty
      const stats = await stat(archivePath);
      expect(stats.size).toBeGreaterThan(0);

      // Cleanup
      await rm(runDir, { recursive: true, force: true });
      await rm(casDir, { recursive: true, force: true });
    });

    it("should respect store=false (hash only)", async () => {
      const runId = "test-run-export-no-store";
      const runDir = path.join(AGENTFS_DIR, runId);

      await mkdir(runDir, { recursive: true });
      await writeFile(path.join(runDir, "file.txt"), "content");

      const result = await batchExport([runId], {
        store: false,
        rootAbs: TEST_DIR,
      });

      expect(result.archives).toHaveLength(1);

      // Verify no CAS archive was created
      const casDir = path.join(AGENTFS_DIR, "cas");
      expect(existsSync(casDir)).toBe(false);

      // Cleanup
      await rm(runDir, { recursive: true, force: true });
    });
  });
});
