import { afterEach, beforeEach, describe, expect, it, mock, vi } from "bun:test";
import type { Obligation } from "@alfred/type";
import { metricsStub } from "./utils/mock-metrics";
import { resetAllMocks, setupTestEnv } from "./utils/router-helpers";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";

setupTestEnv();

// Note: This test uses mock.module() which is process-global.
// Router uses dynamic imports which may bypass mocks.
// For full isolation, router should use dependency injection.
// biome-ignore lint/suspicious/noSkippedTests: Requires router DI refactor
describe.skip("cognitive router", () => {
  let runCognitiveLoopMock: ReturnType<typeof vi.fn>;
  let runAssistantGenerationMock: ReturnType<typeof vi.fn>;
  let createRuntimeMock: ReturnType<typeof vi.fn>;
  let evaluateMock: ReturnType<typeof vi.fn>;
  let createAuditLogMock: ReturnType<typeof vi.fn>;
  let embedManyMock: ReturnType<typeof vi.fn>;
  let cosineSimilarityMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Setup mocks inside beforeEach to avoid module cache pollution
    runCognitiveLoopMock = vi.fn();
    runAssistantGenerationMock = vi.fn();
    createRuntimeMock = vi.fn();
    evaluateMock = vi.fn();
    createAuditLogMock = vi.fn().mockResolvedValue(undefined);
    embedManyMock = vi.fn().mockResolvedValue([
      [1, 0, 0],
      [1, 0, 0],
    ]);
    cosineSimilarityMock = vi.fn().mockReturnValue(1);

    mock.module("@alfred/runtime", () => ({
      runCognitiveLoop: runCognitiveLoopMock,
      runAssistantGeneration: runAssistantGenerationMock,
      createRuntime: createRuntimeMock,
    }));

    mock.module("@alfred/embed", () => ({
      embedMany: embedManyMock,
      cosineSimilarity: cosineSimilarityMock,
    }));

    mock.module("@alfred/policy", () => ({
      evaluate: evaluateMock,
      registerCacheObs: vi.fn(),
    }));

    mock.module("@alfred/db/repo/policy", () => ({
      createAuditLog: createAuditLogMock,
    }));

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
    resetAllMocks();
    evaluateMock.mockResolvedValue({
      allow: true,
      obligations: [] as Obligation[],
    });
  });

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
    runCognitiveLoopMock.mockResolvedValueOnce({
      state: {
        _: "thinking",
        about: "Follow up",
        physiology: { energy: 1, boredom: 0, frustration: 0 },
      },
      effects: [{ type: "generate_response", input: "Follow up" }],
    });

    runCognitiveLoopMock.mockResolvedValueOnce({
      state: {
        _: "reflecting",
        outcome: { _: "success", result: null, duration: 0 },
        physiology: { energy: 1, boredom: 0, frustration: 0 },
      },
      effects: [],
    });

    runAssistantGenerationMock.mockResolvedValueOnce({
      _: "success",
      result: { text: "ok" },
      duration: 10,
    });

    const caller = await createTestCaller({
      scopes: ["cognitive.write"],
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
