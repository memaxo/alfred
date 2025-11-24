import { beforeEach, describe, expect, it, mock } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  assertAllowedDirectory,
  enforcePolicy,
} from "../src/orchestrator/tool/codex/policy";

// Mock @alfred/auth/token
const mockRequireToolScopesAndPolicy = mock();
mock.module("@alfred/auth/token", () => ({
  requireToolScopesAndPolicy: mockRequireToolScopesAndPolicy,
}));

describe("Tool Policy & Security", () => {
  describe("assertAllowedDirectory", () => {
    const cwd = process.cwd();
    const tempDir = path.join(cwd, "tmp-policy-test");

    beforeEach(() => {
      try {
        fs.mkdirSync(tempDir, { recursive: true });
      } catch {}
    });

    it("allows CWD", () => {
      expect(assertAllowedDirectory(cwd)).toBe(cwd);
    });

    it("allows subdirectory of CWD", () => {
      const sub = path.join(cwd, "packages");
      expect(assertAllowedDirectory(sub)).toBe(sub);
    });

    it("throws for path outside allowed prefixes", () => {
      // /tmp is usually not in CWD (on Mac/Linux) unless CWD IS /tmp
      const outside = "/tmp";
      // Only run if /tmp is actually outside CWD
      if (!outside.startsWith(cwd)) {
        expect(() => assertAllowedDirectory(outside)).toThrow(
          "codex_invalid_cwd"
        );
      }
    });

    it("throws for non-existent path", () => {
      const nonExistent = path.join(cwd, "non-existent-folder-12345");
      expect(() => assertAllowedDirectory(nonExistent)).toThrow(
        "codex_invalid_cwd"
      );
    });

    it("throws for file path (must be directory)", () => {
      const file = path.join(cwd, "package.json");
      expect(() => assertAllowedDirectory(file)).toThrow(
        "codex_invalid_cwd_not_directory"
      );
    });
  });

  describe("enforcePolicy", () => {
    beforeEach(() => {
      mockRequireToolScopesAndPolicy.mockReset();
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
  });
});
