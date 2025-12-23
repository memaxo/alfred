import { beforeEach, describe, expect, it, mock, vi } from "bun:test";

const requireToolScopesAndPolicyMock = vi.fn();

mock.module("@alfred/auth/token", () => ({
  requireToolScopesAndPolicy: requireToolScopesAndPolicyMock,
}));

// Dynamic import after mock setup
const { enforcePolicy } = await import("../src/orchestrator/tool/codex/policy");

describe("enforcePolicy", () => {
  const defaultClaims = {
    sub: "user-123",
    elevated: false,
    mfa: undefined,
  };

  beforeEach(() => {
    requireToolScopesAndPolicyMock.mockClear();
    requireToolScopesAndPolicyMock.mockResolvedValue({ claims: defaultClaims });
  });

  describe("basic validation", () => {
    it("calls requireToolScopesAndPolicy with correct parameters", async () => {
      const input = {
        action: "exec" as const,
        prompt: "test",
        auto: "read" as const,
        out: "text" as const,
        authz: "token-abc",
        cw: "/tmp/project",
      };

      await enforcePolicy(input);

      expect(requireToolScopesAndPolicyMock).toHaveBeenCalledWith(
        "token-abc",
        ["droid.exec"],
        expect.objectContaining({
          action: "droid.exec",
          resource: {
            kind: "repo",
            id: "/tmp/project",
          },
          context: {
            auto: "read",
            memory_confidence: undefined,
          },
        })
      );
    });

    it("sets userId from claims.sub", async () => {
      const input = {
        action: "exec" as const,
        prompt: "test",
        auto: "read" as const,
        out: "text" as const,
      };

      await enforcePolicy(input);

      expect(input.userId).toBe("user-123");
    });

    it("throws when input.userId mismatches claims.sub", async () => {
      const input = {
        action: "exec" as const,
        prompt: "test",
        auto: "read" as const,
        out: "text" as const,
        userId: "different-user",
      };

      await expect(enforcePolicy(input)).rejects.toThrow(
        "codex_session_user_mismatch"
      );
    });
  });

  describe("timeout validation", () => {
    it("throws when timeout exceeds MAX_TIMEOUT_SEC", async () => {
      const input = {
        action: "exec" as const,
        prompt: "test",
        auto: "read" as const,
        out: "text" as const,
        timeoutSec: 3600, // 1 hour > 30 min max
      };

      await expect(enforcePolicy(input)).rejects.toThrow(
        "codex_timeout_exceeds_limit"
      );
    });

    it("allows timeout within limits", async () => {
      const input = {
        action: "exec" as const,
        prompt: "test",
        auto: "read" as const,
        out: "text" as const,
        timeoutSec: 300, // 5 minutes
      };

      await expect(enforcePolicy(input)).resolves.toBeUndefined();
    });
  });

  describe("elevation requirements", () => {
    it("throws biometric_required for medium auto without elevation", async () => {
      const input = {
        action: "exec" as const,
        prompt: "test",
        auto: "medium" as const,
        out: "text" as const,
      };

      await expect(enforcePolicy(input)).rejects.toThrow("biometric_required");
    });

    it("throws biometric_required for high auto without elevation", async () => {
      const input = {
        action: "exec" as const,
        prompt: "test",
        auto: "high" as const,
        out: "text" as const,
      };

      await expect(enforcePolicy(input)).rejects.toThrow("biometric_required");
    });

    it("allows medium auto with proper elevation", async () => {
      requireToolScopesAndPolicyMock.mockResolvedValue({
        claims: {
          sub: "user-123",
          elevated: true,
          mfa: "passkey",
        },
      });

      const input = {
        action: "exec" as const,
        prompt: "test",
        auto: "medium" as const,
        out: "text" as const,
      };

      await expect(enforcePolicy(input)).resolves.toBeUndefined();
    });

    it("allows high auto with proper elevation", async () => {
      requireToolScopesAndPolicyMock.mockResolvedValue({
        claims: {
          sub: "user-123",
          elevated: true,
          mfa: "passkey",
        },
      });

      const input = {
        action: "exec" as const,
        prompt: "test",
        auto: "high" as const,
        out: "text" as const,
      };

      await expect(enforcePolicy(input)).resolves.toBeUndefined();
    });

    it("allows read auto without elevation", async () => {
      const input = {
        action: "exec" as const,
        prompt: "test",
        auto: "read" as const,
        out: "text" as const,
      };

      await expect(enforcePolicy(input)).resolves.toBeUndefined();
    });

    it("allows low auto without elevation", async () => {
      const input = {
        action: "exec" as const,
        prompt: "test",
        auto: "low" as const,
        out: "text" as const,
      };

      await expect(enforcePolicy(input)).resolves.toBeUndefined();
    });
  });

  describe("elevated timeout threshold", () => {
    it("throws when timeout exceeds threshold without elevation", async () => {
      const input = {
        action: "exec" as const,
        prompt: "test",
        auto: "read" as const,
        out: "text" as const,
        timeoutSec: 700, // > 600 (10 min threshold)
      };

      await expect(enforcePolicy(input)).rejects.toThrow(
        "codex_timeout_requires_elevation"
      );
    });

    it("allows extended timeout with elevation", async () => {
      requireToolScopesAndPolicyMock.mockResolvedValue({
        claims: {
          sub: "user-123",
          elevated: true,
          mfa: "passkey",
        },
      });

      const input = {
        action: "exec" as const,
        prompt: "test",
        auto: "read" as const,
        out: "text" as const,
        timeoutSec: 1200, // 20 minutes
      };

      await expect(enforcePolicy(input)).resolves.toBeUndefined();
    });
  });

  describe("context propagation", () => {
    it("includes memory_confidence in policy context", async () => {
      const input = {
        action: "exec" as const,
        prompt: "test",
        auto: "read" as const,
        out: "text" as const,
        context: {
          confidence: 0.85,
        },
      };

      await enforcePolicy(input);

      expect(requireToolScopesAndPolicyMock).toHaveBeenCalledWith(
        undefined,
        ["droid.exec"],
        expect.objectContaining({
          context: {
            auto: "read",
            memory_confidence: 0.85,
          },
        })
      );
    });
  });
});
