/**
 * Test Sandbox Utilities
 *
 * Provides isolated filesystem sandboxes for tests to prevent:
 * 1. Pollution of real repository directories
 * 2. Interference between tests
 * 3. Leftover files from failed tests
 *
 * Usage:
 *   const sandbox = createTestSandbox("my-test");
 *   // ... use sandbox.dir for all file operations
 *   sandbox.cleanup(); // Always cleanup in afterEach
 *
 * IMPORTANT: Never use process.cwd() or hardcoded paths like "packages/voice"
 * for creating temp directories. Always use os.tmpdir() via this module.
 */

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface TestSandbox {
  /** Root directory of the sandbox - all temp files should go here */
  dir: string;
  /** Create a subdirectory within the sandbox */
  mkdir: (name: string) => string;
  /** Get a path within the sandbox */
  path: (...segments: string[]) => string;
  /** Cleanup the sandbox (should be called in afterEach) */
  cleanup: () => void;
}

/**
 * Create an isolated test sandbox in the system temp directory.
 *
 * @param prefix - Prefix for the temp directory name (e.g., "my-test-")
 * @returns TestSandbox with helper methods
 *
 * @example
 * ```typescript
 * describe("My Test", () => {
 *   let sandbox: TestSandbox;
 *
 *   beforeEach(() => {
 *     sandbox = createTestSandbox("my-test-");
 *   });
 *
 *   afterEach(() => {
 *     sandbox.cleanup();
 *   });
 *
 *   it("creates files safely", () => {
 *     const venvDir = sandbox.mkdir(".venv/bin");
 *     writeFileSync(sandbox.path(".venv/bin/python"), "stub");
 *     // Files are isolated in /tmp/my-test-xxxxx/
 *   });
 * });
 * ```
 */
export function createTestSandbox(prefix: string): TestSandbox {
  // Always use os.tmpdir() - NEVER process.cwd()
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));

  return {
    dir,

    mkdir(name: string): string {
      const fullPath = path.join(dir, name);
      mkdirSync(fullPath, { recursive: true });
      return fullPath;
    },

    path(...segments: string[]): string {
      return path.join(dir, ...segments);
    },

    cleanup(): void {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors (e.g., already deleted)
      }
    },
  };
}

/**
 * Track all sandboxes created during a test run for emergency cleanup.
 * This is useful for CI environments where tests may crash.
 */
const activeSandboxes = new Set<string>();

/**
 * Create a tracked sandbox that will be cleaned up on process exit.
 * Useful for tests that might crash before afterEach runs.
 */
export function createTrackedSandbox(prefix: string): TestSandbox {
  const sandbox = createTestSandbox(prefix);
  activeSandboxes.add(sandbox.dir);

  const originalCleanup = sandbox.cleanup;
  sandbox.cleanup = () => {
    activeSandboxes.delete(sandbox.dir);
    originalCleanup();
  };

  return sandbox;
}

/**
 * Clean up all tracked sandboxes. Call this in global teardown.
 */
export function cleanupAllSandboxes(): void {
  for (const dir of activeSandboxes) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  }
  activeSandboxes.clear();
}

// Register cleanup on process exit
process.on("exit", cleanupAllSandboxes);
process.on("SIGINT", () => {
  cleanupAllSandboxes();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanupAllSandboxes();
  process.exit(143);
});

/**
 * Assert that a path is within a sandbox (not in the real repo).
 * Use this to prevent accidental writes to real directories.
 */
export function assertInSandbox(filePath: string): void {
  const tmpDir = os.tmpdir();
  const realPath = path.resolve(filePath);

  if (!realPath.startsWith(tmpDir)) {
    throw new Error(
      `SANDBOX VIOLATION: Path "${realPath}" is not in temp directory. ` +
        "Tests must not write to real repository directories. " +
        "Use createTestSandbox() instead."
    );
  }
}

/**
 * Create a workspace-like structure for testing agent operations.
 * Mirrors the structure that agents expect in production.
 */
export interface WorkspaceFixture {
  sandbox: TestSandbox;
  /** Workspace directory (like packages/voice in production) */
  workspace: string;
  /** External directory (simulates escape attempts) */
  outside: string;
  /** Cleanup both workspace and outside dirs */
  cleanup: () => void;
}

export function createWorkspaceFixture(prefix: string): WorkspaceFixture {
  const sandbox = createTrackedSandbox(`${prefix}workspace-`);
  const workspace = sandbox.mkdir("workspace");
  const outside = mkdtempSync(path.join(os.tmpdir(), `${prefix}outside-`));

  return {
    sandbox,
    workspace,
    outside,
    cleanup: () => {
      sandbox.cleanup();
      try {
        rmSync(outside, { recursive: true, force: true });
      } catch {
        // Ignore errors
      }
    },
  };
}
