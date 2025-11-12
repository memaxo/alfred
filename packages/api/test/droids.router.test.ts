import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { metricsStub } from "./utils/mock-metrics";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const requireToolScopesAndPolicyMock = vi.fn();
const droidExecRunsTotalMock = {
  labels: vi.fn().mockReturnValue({
    inc: vi.fn(),
  }),
};

mock.module("@alfred/auth/token", () => ({
  requireToolScopesAndPolicy: requireToolScopesAndPolicyMock,
}));

mock.module("@alfred/api/metrics", () => ({
  ...metricsStub,
  droidExecRunsTotal: droidExecRunsTotalMock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["droid.exec"],
  });
});

afterEach(() => {
  resetAllMocks();
});

describe("droids router", () => {
  describe("run", () => {
    it("executes droid command", async () => {
      requireToolScopesAndPolicyMock.mockResolvedValue({
        claims: {
          elevated: true,
          mfa: "passkey",
        },
      });

      const result = await caller.droids.run({
        prompt: "test command",
        auto: "low",
        authz: "token-123",
        out: "text",
      });

      expect(requireToolScopesAndPolicyMock).toHaveBeenCalled();
      expect(result).toHaveProperty("exitCode");
      expect(result).toHaveProperty("stdout");
      expect(result).toHaveProperty("stderr");
    });

    it("requires biometric for medium/high autonomy", async () => {
      requireToolScopesAndPolicyMock.mockResolvedValue({
        claims: {
          elevated: false,
          mfa: "none",
        },
      });

      await expect(
        caller.droids.run({
          prompt: "test",
          auto: "medium",
          authz: "token",
        })
      ).rejects.toThrow("biometric_required");
    });
  });

  describe("stream", () => {
    it("streams droid execution", async () => {
      requireToolScopesAndPolicyMock.mockResolvedValue({
        claims: {
          elevated: true,
          mfa: "passkey",
        },
      });

      const subscription = caller.droids.stream({
        prompt: "test",
        auto: "low",
        authz: "token",
      });

      const events: unknown[] = [];
      await new Promise<void>((resolve) => {
        subscription.subscribe({
          next: (event) => {
            events.push(event);
            if (event.type === "exit") {
              resolve();
            }
          },
          error: () => resolve(),
          complete: resolve,
        });
      });

      expect(events.length).toBeGreaterThan(0);
    });
  });
});
