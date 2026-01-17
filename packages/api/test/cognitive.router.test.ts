// SKIP: This test uses mock.module() at the top level which causes Bun's module
// mocking to pollute other test files in the same run. The mocks for @alfred/runtime
// and @alfred/policy don't properly intercept imports when run alongside other tests.
// NOTE: Refactor to use dependency injection instead of mock.module().
import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import type { Obligation } from "@alfred/type";
import { metricsStub } from "./utils/mock-metrics";
import { setupTestEnv } from "./utils/router-helpers";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";

setupTestEnv();

const runCognitiveLoopMock = vi.fn();
const runAssistantGenerationMock = vi.fn();
const createRuntimeMock = vi.fn();
const evaluateMock = vi.fn();
const createAuditLogMock = vi.fn().mockResolvedValue(undefined);

mock.module("@alfred/runtime", () => ({
  runCognitiveLoop: runCognitiveLoopMock,
  runAssistantGeneration: runAssistantGenerationMock,
  createRuntime: createRuntimeMock,
}));

mock.module("@alfred/embed", () => ({
  embedMany: async () => [
    [1, 0, 0],
    [1, 0, 0],
  ],
  cosineSimilarity: () => 1,
}));

mock.module("@alfred/policy", () => ({
  evaluate: evaluateMock,
  registerCacheObs: vi.fn(),
}));

mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: createAuditLogMock,
}));

beforeAll(() => {
  evaluateMock.mockResolvedValue({
    allow: true,
    obligations: [] as Obligation[],
  });
  runCognitiveLoopMock.mockResolvedValue({
    state: {
      _: "reflecting",
      outcome: { _: "success", result: null, duration: 0 },
      expected: "target",
      actual: "target",
      error: 0,
      physiology: { energy: 1, boredom: 0, frustration: 0 },
    },
    effects: [],
  });
});

afterEach(() => {
  vi.clearAllMocks();
  evaluateMock.mockResolvedValue({
    allow: true,
    obligations: [] as Obligation[],
  });
});

// biome-ignore lint/suspicious/noSkippedTests: Known test isolation issue with mock.module()
describe.skip("cognitive router", () => {
  it("submits feedback events and returns policy obligations", async () => {
    const mfaObligation: Obligation = {
      type: "mfa",
      reason: "mfa_required",
      metadata: { code: "mfa_required" },
    };
    evaluateMock.mockResolvedValueOnce({
      allow: true,
      obligations: [mfaObligation],
    });

    const state = {
      _: "reflecting" as const,
      outcome: { _: "success" as const, result: null, duration: 0 },
      expected: "target",
      actual: "target",
      error: 0,
      physiology: { energy: 1, boredom: 0, frustration: 0 },
    };
    runCognitiveLoopMock.mockResolvedValueOnce({ state, effects: [] });

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
    expect(response.obligations).toEqual([mfaObligation]);
    expect(
      metricsStub.cognitiveFeedbackSubmissionsTotal.labels
    ).toHaveBeenCalledWith("chat");
  });

  it("executes cognitive effects via assistant generation", async () => {
    const caller = await createTestCaller({
      scopes: ["cognitive.write"],
    });

    runCognitiveLoopMock.mockResolvedValueOnce({
      state: {
        _: "thinking",
        about: "Follow up",
        physiology: { energy: 1, boredom: 0, frustration: 0 },
      } as any,
      effects: [{ type: "generate_response", input: "Follow up" }],
    });

    runCognitiveLoopMock.mockResolvedValueOnce({
      state: {
        _: "reflecting",
        outcome: { _: "success", result: null, duration: 0 },
        physiology: { energy: 1, boredom: 0, frustration: 0 },
      } as any,
      effects: [],
    });

    runAssistantGenerationMock.mockResolvedValueOnce({
      _: "success",
      result: { text: "ok" },
      duration: 10,
    });

    await caller.cognitive.feedback({
      streamId: "effect-stream",
      expected: "Follow up",
      actual: "Follow up",
      surface: "chat",
    });

    expect(runAssistantGenerationMock).toHaveBeenCalledTimes(1);
    const effectCall = runAssistantGenerationMock.mock.calls[0];
    expect(effectCall?.[1]).toBe("effect-stream");
    expect(effectCall?.[2]).toBe("Follow up");
    expect(runCognitiveLoopMock).toHaveBeenCalledTimes(2);
    const completionEvent = runCognitiveLoopMock.mock.calls[1]?.[2];
    expect(completionEvent._).toBe("complete");
  });

  it("denies feedback when policy evaluation rejects", async () => {
    evaluateMock.mockResolvedValueOnce({
      allow: false,
      obligations: [] as Obligation[],
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
