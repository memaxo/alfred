import {
  ELEVATED_TIMEOUT_THRESHOLD_SEC,
  MAX_TIMEOUT_SEC,
} from "@alfred/agent/orchestrator/tool/codex/definition";
import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";

import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const toolCodexExecuteMock = vi.fn();

mock.module("@alfred/agent/orchestrator/tool/codex/index", () => ({
  toolCodex: {
    execute: toolCodexExecuteMock,
  },
}));

mock.module("@alfred/agent/src/metrics", () => ({
  recordCodexExecRun: vi.fn(),
  recordCodexError: vi.fn(),
  recordCodexWriterError: vi.fn(),
  recordCodexSessionViolation: vi.fn(),
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller();
});

afterEach(() => {
  resetAllMocks();
  toolCodexExecuteMock.mockReset();
});

describe("codex router stream", () => {
  it("aborts codex execution when the subscription unsubscribes", async () => {
    let capturedSignal: AbortSignal | undefined;
    let resolveExecution: (() => void) | undefined;

    const executionStopped = new Promise<void>((resolve) => {
      resolveExecution = resolve;
    });

    toolCodexExecuteMock.mockImplementationOnce(
      async ({ signal }: { signal?: AbortSignal }) => {
        capturedSignal = signal;
        if (!signal) {
          throw new Error("missing_signal");
        }
        await new Promise<void>((resolveAbort) => {
          signal.addEventListener(
            "abort",
            () => {
              resolveAbort();
              resolveExecution?.();
            },
            { once: true }
          );
        });
        return { result: "", artifacts: [] };
      }
    );

    const { __internals } = await import("../src/routers/codex");
    const stream = __internals.createCodexStreamObservable({
      input: {
        prompt: "echo 'hi'",
        auto: "low",
      },
      timeoutSec: undefined,
      userId: "test-user",
    });

    const subscription = stream.subscribe({
      next: () => {},
      error: () => {},
      complete: () => {},
    });

    // createCodexStreamObservable kicks off Codex execution in an async task
    // so we need to wait a tick for the dynamic import + execute call to start.
    const startedAt = Date.now();
    while (toolCodexExecuteMock.mock.calls.length === 0) {
      if (Date.now() - startedAt > 250) {
        throw new Error("codex_execute_not_started");
      }
      await new Promise((r) => setTimeout(r, 1));
    }
    expect(toolCodexExecuteMock).toHaveBeenCalledTimes(1);

    subscription.unsubscribe();
    await executionStopped;

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(true);
  });
});

describe("codex router run", () => {
  it("defaults timeout to the elevated threshold", async () => {
    toolCodexExecuteMock.mockResolvedValueOnce({ result: "", artifacts: [] });

    await caller.codex.run({ prompt: "short task" });

    expect(toolCodexExecuteMock).toHaveBeenCalledTimes(1);
    expect(toolCodexExecuteMock.mock.calls[0]?.[0]?.input?.timeoutSec).toBe(
      ELEVATED_TIMEOUT_THRESHOLD_SEC
    );
  });

  it("accepts explicit timeout at the threshold", async () => {
    toolCodexExecuteMock.mockResolvedValueOnce({ result: "", artifacts: [] });

    await caller.codex.run({
      prompt: "explicit timeout",
      timeoutSec: ELEVATED_TIMEOUT_THRESHOLD_SEC,
    });

    expect(toolCodexExecuteMock.mock.calls[0]?.[0]?.input?.timeoutSec).toBe(
      ELEVATED_TIMEOUT_THRESHOLD_SEC
    );
  });

  it("returns PRECONDITION_FAILED when Codex requires elevation for timeout", async () => {
    toolCodexExecuteMock.mockRejectedValueOnce(
      new Error("codex_timeout_requires_elevation")
    );

    await expect(
      caller.codex.run({
        prompt: "long task",
        timeoutSec: ELEVATED_TIMEOUT_THRESHOLD_SEC + 1,
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("code=elevation_required"),
    });

    expect(toolCodexExecuteMock).toHaveBeenCalledTimes(1);
  });

  it("returns BAD_REQUEST when Codex rejects timeouts above the absolute cap", async () => {
    toolCodexExecuteMock.mockRejectedValueOnce(
      new Error("codex_timeout_exceeds_limit")
    );

    await expect(
      caller.codex.run({
        prompt: "too long",
        timeoutSec: MAX_TIMEOUT_SEC,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("code=limit_exceeded"),
    });

    expect(toolCodexExecuteMock).toHaveBeenCalledTimes(1);
  });
});
