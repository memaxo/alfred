import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { setupTestEnv } from "./utils/router-helpers";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";
import { metricsStub } from "./utils/mock-metrics";

setupTestEnv();

const runCognitiveLoopMock = vi.fn();
const createRuntimeMock = vi.fn();
const evaluateMock = vi.fn();
const createAuditLogMock = vi.fn().mockResolvedValue(undefined);

mock.module("@alfred/runtime", () => ({
  runCognitiveLoop: runCognitiveLoopMock,
  createRuntime: createRuntimeMock,
}));

mock.module("@alfred/policy", () => ({
  evaluate: evaluateMock,
  registerCacheObs: vi.fn(),
}));

mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: createAuditLogMock,
}));

beforeAll(() => {
  evaluateMock.mockResolvedValue({ allow: true, obligations: [] });
  runCognitiveLoopMock.mockResolvedValue({
    _: "reflecting",
    outcome: { _: "success", result: null, duration: 0 },
    expected: "target",
    actual: "target",
    error: 0,
    physiology: { energy: 1, boredom: 0, frustration: 0 },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  evaluateMock.mockResolvedValue({ allow: true, obligations: [] });
});

describe("cognitive router", () => {
  it("submits feedback events and returns policy obligations", async () => {
    evaluateMock.mockResolvedValueOnce({
      allow: true,
      obligations: ["mfa_required"],
    });

    const state = {
      _: "reflecting" as const,
      outcome: { _: "success" as const, result: null, duration: 0 },
      expected: "target",
      actual: "target",
      error: 0,
      physiology: { energy: 1, boredom: 0, frustration: 0 },
    };
    runCognitiveLoopMock.mockResolvedValueOnce(state);

    const caller = await createTestCaller({
      scopes: ["cognitive.write"],
    });

    const response = await caller.cognitive.feedback({
      streamId: "verify-stream",
      expected: "target",
      actual: "target",
      surface: "chat",
    });

    expect(runCognitiveLoopMock).toHaveBeenCalledTimes(1);
    const call = runCognitiveLoopMock.mock.calls[0];
    expect(call?.[1]).toBe("verify-stream");
    expect(call?.[2]).toMatchObject({
      _: "feedback",
      expected: "target",
      actual: "target",
    });
    expect(response.state).toBe(state);
    expect(response.obligations).toEqual(["mfa_required"]);
    expect(
      metricsStub.cognitiveFeedbackSubmissionsTotal.labels
    ).toHaveBeenCalledWith("chat");
  });

  it("denies feedback when policy evaluation rejects", async () => {
    evaluateMock.mockResolvedValueOnce({
      allow: false,
      obligations: [],
      reason: "forbidden",
    });

    const caller = await createTestCaller();

    await expect(
      caller.cognitive.feedback({
        streamId: "deny-stream",
        expected: "foo",
        actual: "bar",
      })
    ).rejects.toThrow(/forbidden/i);
    expect(runCognitiveLoopMock).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    const unauthed = await createUnauthedCaller();

    await expect(
      unauthed.cognitive.feedback({
        streamId: "anon-stream",
        expected: "foo",
        actual: "foo",
      })
    ).rejects.toThrow(/Authentication required/i);
    expect(runCognitiveLoopMock).not.toHaveBeenCalled();
  });
});
