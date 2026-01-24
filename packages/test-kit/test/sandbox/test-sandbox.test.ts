import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  assertInSandbox,
  cleanupAllSandboxes,
  createTestSandbox,
  createTrackedSandbox,
  createWorkspaceFixture,
  type TestSandbox,
} from "../../src/sandbox/test-sandbox";

describe("Test Sandbox Utilities", () => {
  describe("createTestSandbox", () => {
    let sandbox: TestSandbox;

    afterEach(() => {
      sandbox?.cleanup();
    });

    it("creates directory in os.tmpdir()", () => {
      sandbox = createTestSandbox("test-sandbox-");
      expect(sandbox.dir.startsWith(os.tmpdir())).toBe(true);
      expect(existsSync(sandbox.dir)).toBe(true);
    });

    it("mkdir creates subdirectories", () => {
      sandbox = createTestSandbox("test-mkdir-");
      const subdir = sandbox.mkdir("sub/nested");
      expect(existsSync(subdir)).toBe(true);
      expect(subdir).toBe(path.join(sandbox.dir, "sub/nested"));
    });

    it("path returns correct paths", () => {
      sandbox = createTestSandbox("test-path-");
      const filePath = sandbox.path("file.txt");
      expect(filePath).toBe(path.join(sandbox.dir, "file.txt"));
    });

    it("cleanup removes directory", () => {
      sandbox = createTestSandbox("test-cleanup-");
      const dir = sandbox.dir;
      expect(existsSync(dir)).toBe(true);
      sandbox.cleanup();
      expect(existsSync(dir)).toBe(false);
    });

    it("cleanup is idempotent", () => {
      sandbox = createTestSandbox("test-idempotent-");
      sandbox.cleanup();
      // Second cleanup should not throw
      expect(() => sandbox.cleanup()).not.toThrow();
    });
  });

  describe("createTrackedSandbox", () => {
    it("creates tracked sandbox", () => {
      const sandbox = createTrackedSandbox("test-tracked-");
      expect(sandbox.dir.startsWith(os.tmpdir())).toBe(true);
      expect(existsSync(sandbox.dir)).toBe(true);
      sandbox.cleanup();
      expect(existsSync(sandbox.dir)).toBe(false);
    });
  });

  describe("cleanupAllSandboxes", () => {
    it("cleans up all tracked sandboxes", () => {
      const sandbox1 = createTrackedSandbox("test-all-1-");
      const sandbox2 = createTrackedSandbox("test-all-2-");
      const dir1 = sandbox1.dir;
      const dir2 = sandbox2.dir;

      expect(existsSync(dir1)).toBe(true);
      expect(existsSync(dir2)).toBe(true);

      cleanupAllSandboxes();

      expect(existsSync(dir1)).toBe(false);
      expect(existsSync(dir2)).toBe(false);
    });
  });

  describe("assertInSandbox", () => {
    let sandbox: TestSandbox;

    beforeEach(() => {
      sandbox = createTestSandbox("test-assert-");
    });

    afterEach(() => {
      sandbox.cleanup();
    });

    it("accepts paths in temp directory", () => {
      const tempPath = sandbox.path("file.txt");
      expect(() => assertInSandbox(tempPath)).not.toThrow();
    });

    it("rejects paths outside temp directory", () => {
      const repoPath = path.join(process.cwd(), "packages/test-kit");
      expect(() => assertInSandbox(repoPath)).toThrow("SANDBOX VIOLATION");
    });

    it("rejects relative paths that resolve outside temp", () => {
      const relativePath = "./packages/test-kit";
      expect(() => assertInSandbox(relativePath)).toThrow("SANDBOX VIOLATION");
    });
  });

  describe("createWorkspaceFixture", () => {
    it("creates workspace and outside directories", () => {
      const fixture = createWorkspaceFixture("test-fixture-");
      try {
        expect(existsSync(fixture.workspace)).toBe(true);
        expect(existsSync(fixture.outside)).toBe(true);
        expect(fixture.workspace.startsWith(os.tmpdir())).toBe(true);
        expect(fixture.outside.startsWith(os.tmpdir())).toBe(true);
      } finally {
        fixture.cleanup();
      }
    });

    it("cleanup removes both directories", () => {
      const fixture = createWorkspaceFixture("test-fixture-cleanup-");
      const workspace = fixture.workspace;
      const outside = fixture.outside;

      fixture.cleanup();

      expect(existsSync(workspace)).toBe(false);
      expect(existsSync(outside)).toBe(false);
    });
  });

  describe("integration: file operations in sandbox", () => {
    let sandbox: TestSandbox;

    beforeEach(() => {
      sandbox = createTestSandbox("test-integration-");
    });

    afterEach(() => {
      sandbox.cleanup();
    });

    it("allows writing files in sandbox", () => {
      const filePath = sandbox.path("test.txt");
      writeFileSync(filePath, "test content");
      expect(existsSync(filePath)).toBe(true);
    });

    it("allows creating nested structure", () => {
      const venvDir = sandbox.mkdir(".venv/bin");
      const pythonPath = path.join(venvDir, "python");
      writeFileSync(pythonPath, "#!/usr/bin/env python3\n");
      expect(existsSync(pythonPath)).toBe(true);
    });
  });
});
