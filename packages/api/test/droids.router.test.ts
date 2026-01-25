import type { Obligation } from "@alfred/type";

import {
  ELEVATED_TIMEOUT_THRESHOLD_SEC,
  MAX_TIMEOUT_SEC,
} from "@alfred/agent/orchestrator/tool/codex/definition";
// Use shared test utilities - import BEFORE any other imports
import {
  authTokenMocks,
  installAuthTokenMock,
  resetAuthTokenMocks,
} from "@alfred/test-kit/auth/token";
import { TRPCError } from "@trpc/server";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

import { metricsStub } from "./utils/mock-metrics";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { toObservable } from "./utils/stream";
import { createTestCaller } from "./utils/trpc";

// Install shared mocks
installAuthTokenMock();

setupTestEnv();
mockPolicyAudit();

// Use shared mock for assertions
const requireToolScopesAndPolicyMock =
  authTokenMocks.requireToolScopesAndPolicy;
const droidExecRunsTotalMock = {
  labels: vi.fn().mockReturnValue({
    inc: vi.fn(),
  }),
};
const runHandlers = new Map<
  string,
  {
    resume: (args: {
      resumeData: { event: string; authz: string };
    }) => Promise<void>;
    cancel: () => Promise<void>;
  }
>();

const registerMock = vi.fn((runId, handle) => {
  runHandlers.set(runId, handle);
});

const unregisterMock = vi.fn((runId) => {
  runHandlers.delete(runId);
});

const dispatchResumeMock = vi.fn(async (runId, payload) => {
  const handle = runHandlers.get(runId);
  if (!handle) {
    return false;
  }
  await handle.resume({ resumeData: payload });
  return true;
});

const BIOMETRIC_OBLIGATION: Obligation[] = [
  {
    type: "biometric",
    reason: "biometric_required",
    metadata: { code: "requireBio" },
  },
];

mock.module("@alfred/agent/orchestrator/tool/codex/index", () => ({
  toolCodex: {
    execute: vi.fn(),
  },
}));

// Use shared auth token mock (already installed above)

mock.module("@alfred/api/metrics", () => ({
  ...metricsStub,
  droidExecRunsTotal: droidExecRunsTotalMock,
}));

mock.module("@alfred/agent/workflow/registry", () => ({
  runRegistry: {
    register: registerMock,
    unregister: unregisterMock,
    dispatchResume: dispatchResumeMock,
  },
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["droid.exec"],
  });
});

beforeEach(() => {
  resetAuthTokenMocks();
  requireToolScopesAndPolicyMock.mockResolvedValue({
    claims: {
      elevated: true,
      mfa: "passkey",
    },
    decision: {
      obligations: [],
    },
  });
  registerMock.mockClear();
  unregisterMock.mockClear();
  dispatchResumeMock.mockClear();
  runHandlers.clear();
});

afterEach(() => {
  resetAllMocks();
});

describe("droids router", () => {
  describe("run", () => {
    it("executes droid command", async () => {
      const result = await caller.droid.run({
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

    it("propagates obligations for medium/high autonomy", async () => {
      const policyModule = await import("@alfred/policy");
      const evaluateMock = policyModule.evaluate as ReturnType<typeof vi.fn>;
      evaluateMock.mockResolvedValueOnce({
        allow: true,
        obligations: BIOMETRIC_OBLIGATION,
      });

      await caller.droid
        .run({
          prompt: "test",
          auto: "medium",
          authz: "token",
        })
        .then(() => {
          throw new Error("expected obligations error");
        })
        .catch((error) => {
          expect(error).toBeInstanceOf(TRPCError);
          expect(error.message).toBe("obligation_required");
          expect(error.cause).toMatchObject({
            action: "droid.exec",
            obligations: BIOMETRIC_OBLIGATION,
          });
          expect(registerMock).toHaveBeenCalled();
        });
    });

    it("requires elevation for timeout above threshold", async () => {
      requireToolScopesAndPolicyMock.mockResolvedValueOnce({
        claims: { elevated: false, mfa: "none" },
        decision: { obligations: [] },
      });

      await expect(
        caller.droid.run({
          prompt: "long task",
          auto: "low",
          authz: "token",
          timeoutSec: ELEVATED_TIMEOUT_THRESHOLD_SEC + 60,
        })
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "codex_timeout_requires_elevation",
      });
    });

    it("rejects timeouts above maximum", async () => {
      await expect(
        caller.droid.run({
          prompt: "too long",
          auto: "low",
          authz: "token",
          timeoutSec: MAX_TIMEOUT_SEC + 60,
        })
      ).rejects.toThrow(/codex_timeout_exceeds_limit/);
    });
  });

  describe("stream", () => {
    it("streams droid execution", async () => {
      const subscription = toObservable(
        await caller.droid.stream({
          prompt: "test",
          auto: "low",
          authz: "token",
        })
      );

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

    it("emits obligation events before spawning and keeps stream open", async () => {
      const policyModule = await import("@alfred/policy");
      const evaluateMock = policyModule.evaluate as ReturnType<typeof vi.fn>;
      evaluateMock.mockResolvedValueOnce({
        allow: true,
        obligations: BIOMETRIC_OBLIGATION,
      });

      const subscription = toObservable(
        await caller.droid.stream({
          prompt: "test",
          auto: "high",
          authz: "token",
        })
      );

      await new Promise<void>((resolve, reject) => {
        subscription.subscribe({
          next: (event) => {
            try {
              if (event.type !== "obligation") {
                reject(new Error("expected obligation event"));
                return;
              }
              const payload = JSON.parse(event.data ?? "{}") as {
                obligations: Obligation[];
                runId: string;
              };
              expect(payload.obligations).toEqual(BIOMETRIC_OBLIGATION);
              expect(typeof payload.runId).toBe("string");
              expect(registerMock).toHaveBeenCalledWith(
                payload.runId,
                expect.objectContaining({ resume: expect.any(Function) })
              );
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          error: reject,
          complete: () => reject(new Error("should not complete")),
        });
      });
    });

    it("resumes stream in-place after elevation", async () => {
      const policyModule = await import("@alfred/policy");
      const evaluateMock = policyModule.evaluate as ReturnType<typeof vi.fn>;
      evaluateMock.mockResolvedValueOnce({
        allow: true,
        obligations: BIOMETRIC_OBLIGATION,
      });

      const subscription = toObservable(
        await caller.droid.stream({
          prompt: "resume-stream",
          auto: "high",
          authz: "token",
        })
      );

      const events: { type: string; data?: string; code?: number }[] = [];
      let runId: string | undefined;

      await new Promise<void>((resolve, reject) => {
        subscription.subscribe({
          next: (event) => {
            events.push(event);
            if (event.type === "obligation") {
              try {
                const payload = JSON.parse(event.data ?? "{}") as {
                  runId: string;
                };
                ({ runId } = payload);
              } catch (error) {
                reject(error);
                return;
              }
              requireToolScopesAndPolicyMock.mockResolvedValueOnce({
                claims: {
                  elevated: true,
                  mfa: "passkey",
                },
                decision: {
                  obligations: [],
                },
              });
              if (!runId) {
                reject(new Error("runId is undefined"));
                return;
              }
              void caller.droid
                .resume({
                  runId,
                  authz: "token-resumed",
                })
                .catch(reject);
            }
            if (event.type === "stdout") {
              expect(event.data).toContain("[droid] resume-stream");
            }
            if (event.type === "exit") {
              resolve();
            }
          },
          error: reject,
          complete: () => resolve(),
        });
      });

      expect(runId).toBeDefined();
      expect(events.some((ev) => ev.type === "stdout")).toBe(true);
      expect(events.some((ev) => ev.type === "exit")).toBe(true);
    });
  });

  describe("resume", () => {
    it("resumes run after elevation and returns result", async () => {
      const policyModule = await import("@alfred/policy");
      const evaluateMock = policyModule.evaluate as ReturnType<typeof vi.fn>;
      evaluateMock.mockResolvedValueOnce({
        allow: true,
        obligations: BIOMETRIC_OBLIGATION,
      });

      await caller.droid
        .run({
          prompt: "test",
          auto: "medium",
          authz: "token",
        })
        .catch(() => {});

      const capturedRunId = [...runHandlers.keys()][0];
      expect(capturedRunId).toBeDefined();
      if (!capturedRunId) {
        throw new Error("capturedRunId is undefined");
      }
      requireToolScopesAndPolicyMock.mockResolvedValueOnce({
        claims: {
          elevated: true,
          mfa: "passkey",
        },
        decision: {
          obligations: [],
        },
      });

      const resumeResult = await caller.droid.resume({
        runId: capturedRunId,
        authz: "token-resumed",
      });

      expect(dispatchResumeMock).toHaveBeenCalledWith(capturedRunId, {
        event: "bio-authz",
        authz: "token-resumed",
      });
      expect(resumeResult.success).toBe(true);
      expect(resumeResult.result?.stdout).toContain("[droid] test");
      expect(resumeResult.result?.exitCode).toBe(0);
    });
  });
});
