// Use shared test utilities - import BEFORE any other imports
import {
  authTokenMocks,
  installAuthTokenMock,
  resetAuthTokenMocks,
} from "@alfred/test-kit/auth/token";
import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import os from "node:os";
import * as path from "node:path";

// Install shared mocks
installAuthTokenMock();

import {
  ELEVATED_TIMEOUT_THRESHOLD_SEC,
  MAX_TIMEOUT_SEC,
  MIN_TIMEOUT_SEC,
} from "../src/orchestrator/tool/codex/definition";
import {
  assertAllowedDirectory as assertCodexAllowedDirectory,
  enforcePolicy,
} from "../src/orchestrator/tool/codex/policy";
import { __internals as dockerInternals } from "../src/orchestrator/tool/docker";
import { __internals as droidInternals } from "../src/orchestrator/tool/droid";
import { __internals as gitInternals } from "../src/orchestrator/tool/git";

const { assertAllowedDirectory: assertGitAllowedDirectory } = gitInternals;
const { assertAllowedDirectory: assertDroidAllowedDirectory } = droidInternals;
const { assertAllowedDirectory: assertDockerAllowedDirectory } =
  dockerInternals;

/**
 * Security Policy Tests
 *
 * IMPORTANT: These tests MUST use directories inside process.cwd() because
 * the security functions (assertAllowedDirectory, openDirectorySecure) only
 * allow directories under the current working directory. This is by design
 * to prevent sandbox escapes.
 *
 * The tmp-policy-test directory is created inside the repo and cleaned up
 * after all tests complete.
 */
const TMP_ROOT = path.join(process.cwd(), "tmp-policy-test");

function ensureWorkspaceSandbox(name: string) {
  const target = path.join(TMP_ROOT, name);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  return target;
}

function makeExternalDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// Cleanup TMP_ROOT after all tests
afterAll(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

// Use shared mock for assertions
const mockRequireToolScopesAndPolicy =
  authTokenMocks.requireToolScopesAndPolicy;

describe("Tool Policy & Security", () => {
  describe("assertAllowedDirectory", () => {
    const cwd = process.cwd();

    it("allows CWD", () => {
      const handle = assertCodexAllowedDirectory(cwd);
      expect(handle.path).toBe(cwd);
      handle.close();
    });

    it("allows subdirectory of CWD", () => {
      const sub = path.join(cwd, "packages");
      const handle = assertCodexAllowedDirectory(sub);
      expect(handle.path).toBe(fs.realpathSync(sub));
      handle.close();
    });

    it("throws for path outside allowed prefixes", () => {
      // /tmp is usually not in CWD (on Mac/Linux) unless CWD IS /tmp
      const outside = "/tmp";
      // Only run if /tmp is actually outside CWD
      if (!outside.startsWith(cwd)) {
        expect(() => assertCodexAllowedDirectory(outside)).toThrow(
          "codex_invalid_cwd"
        );
      }
    });

    it("throws for non-existent path", () => {
      const nonExistent = path.join(cwd, "non-existent-folder-12345");
      expect(() => assertCodexAllowedDirectory(nonExistent)).toThrow(
        "codex_invalid_cwd"
      );
    });

    it("throws for file path (must be directory)", () => {
      const file = path.join(cwd, "package.json");
      expect(() => assertCodexAllowedDirectory(file)).toThrow(
        "codex_invalid_cwd_not_directory"
      );
    });
  });

  describe("git assertAllowedDirectory", () => {
    it("rejects direct symlink escapes", () => {
      const sandbox = ensureWorkspaceSandbox("git-direct");
      const outside = makeExternalDir("git-outside-");
      const link = path.join(sandbox, "link");
      fs.symlinkSync(outside, link);

      expect(() => assertGitAllowedDirectory(link)).toThrow("git_invalid_cwd");

      fs.rmSync(outside, { recursive: true, force: true });
    });

    it("rejects directories swapped for symlinks post-validation", () => {
      const sandbox = ensureWorkspaceSandbox("git-swap");
      const target = path.join(sandbox, "subdir");
      fs.mkdirSync(target, { recursive: true });
      expect(assertGitAllowedDirectory(target)).toBe(target);

      fs.rmSync(target, { recursive: true, force: true });
      const outside = makeExternalDir("git-swap-out-");
      fs.symlinkSync(outside, target);

      expect(() => assertGitAllowedDirectory(target)).toThrow(
        "git_invalid_cwd"
      );

      fs.rmSync(outside, { recursive: true, force: true });
    });
  });

  describe("droid assertAllowedDirectory", () => {
    it("accepts container workspace paths", () => {
      expect(assertDroidAllowedDirectory("/workspace")).toBe("/workspace");
      expect(assertDroidAllowedDirectory("workspace/subdir")).toBe(
        "/workspace/subdir"
      );
    });

    it("rejects paths outside the container workspace", () => {
      expect(() => assertDroidAllowedDirectory("/tmp")).toThrow(
        "droid_container_cwd_invalid"
      );
    });
  });

  describe("docker assertAllowedDirectory", () => {
    it("blocks direct symlink attempts", () => {
      const sandbox = ensureWorkspaceSandbox("docker-direct");
      const outside = makeExternalDir("docker-outside-");
      const link = path.join(sandbox, "link");
      fs.symlinkSync(outside, link);

      expect(() => assertDockerAllowedDirectory(link)).toThrow(
        "docker_invalid_cwd"
      );

      fs.rmSync(outside, { recursive: true, force: true });
    });

    it("detects symlink swaps", () => {
      const sandbox = ensureWorkspaceSandbox("docker-swap");
      const target = path.join(sandbox, "context");
      fs.mkdirSync(target, { recursive: true });
      expect(assertDockerAllowedDirectory(target)).toBe(target);

      fs.rmSync(target, { recursive: true, force: true });
      const outside = makeExternalDir("docker-swap-out-");
      fs.symlinkSync(outside, target);

      expect(() => assertDockerAllowedDirectory(target)).toThrow(
        "docker_invalid_cwd"
      );

      fs.rmSync(outside, { recursive: true, force: true });
    });
  });

  describe("enforcePolicy", () => {
    beforeEach(() => {
      resetAuthTokenMocks();
    });

    it("passes for low autonomy with valid token", async () => {
      mockRequireToolScopesAndPolicy.mockResolvedValue({
        decision: { allow: true },
        claims: {
          sub: "test",
          scopes: ["droid.exec"],
          elevated: false,
          mfa: "none",
        },
      });

      await expect(
        enforcePolicy({
          action: "exec",
          prompt: "ls",
          auto: "low",
          authz: "Bearer valid",
          timeoutSec: MIN_TIMEOUT_SEC,
        } as any)
      ).resolves.toBeUndefined();
    });

    it("throws if authz is missing", async () => {
      mockRequireToolScopesAndPolicy.mockImplementation(() => {
        throw new Error("unauthorized");
      });

      await expect(
        enforcePolicy({
          action: "exec",
          prompt: "ls",
          auto: "low",
          // no authz
        } as any)
      ).rejects.toThrow("unauthorized");
    });

    it("throws for high autonomy without elevation/MFA", async () => {
      mockRequireToolScopesAndPolicy.mockResolvedValue({
        decision: { allow: true },
        claims: {
          sub: "test",
          scopes: ["droid.exec"],
          elevated: false,
          mfa: "none",
        },
      });

      await expect(
        enforcePolicy({
          action: "exec",
          prompt: "rm -rf",
          auto: "high",
          authz: "Bearer valid",
        } as any)
      ).rejects.toThrow("biometric_required");
    });

    it("passes for high autonomy with elevation and MFA", async () => {
      mockRequireToolScopesAndPolicy.mockResolvedValue({
        decision: { allow: true },
        claims: {
          sub: "test",
          scopes: ["droid.exec"],
          elevated: true,
          mfa: "passkey",
        },
      });

      await expect(
        enforcePolicy({
          action: "exec",
          prompt: "rm -rf",
          auto: "high",
          authz: "Bearer valid",
        } as any)
      ).resolves.toBeUndefined();
    });

    it("allows timeout up to threshold without elevation", async () => {
      mockRequireToolScopesAndPolicy.mockResolvedValue({
        decision: { allow: true },
        claims: {
          sub: "test",
          scopes: ["droid.exec"],
          elevated: false,
          mfa: "none",
        },
      });

      await expect(
        enforcePolicy({
          action: "exec",
          prompt: "sleep",
          auto: "low",
          authz: "Bearer valid",
          timeoutSec: ELEVATED_TIMEOUT_THRESHOLD_SEC,
        } as any)
      ).resolves.toBeUndefined();
    });

    it("requires elevation for timeout above threshold", async () => {
      mockRequireToolScopesAndPolicy.mockResolvedValue({
        decision: { allow: true },
        claims: {
          sub: "test",
          scopes: ["droid.exec"],
          elevated: false,
          mfa: "none",
        },
      });

      await expect(
        enforcePolicy({
          action: "exec",
          prompt: "sleep",
          auto: "low",
          authz: "Bearer valid",
          timeoutSec: ELEVATED_TIMEOUT_THRESHOLD_SEC + 1,
        } as any)
      ).rejects.toThrow("codex_timeout_requires_elevation");
    });

    it("rejects timeouts above maximum limit regardless of elevation", async () => {
      mockRequireToolScopesAndPolicy.mockResolvedValue({
        decision: { allow: true },
        claims: {
          sub: "test",
          scopes: ["droid.exec"],
          elevated: true,
          mfa: "passkey",
        },
      });

      await expect(
        enforcePolicy({
          action: "exec",
          prompt: "sleep",
          auto: "low",
          authz: "Bearer valid",
          timeoutSec: MAX_TIMEOUT_SEC + 1,
        } as any)
      ).rejects.toThrow("codex_timeout_exceeds_limit");
    });
  });
});
