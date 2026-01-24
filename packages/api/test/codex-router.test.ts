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

import { router } from "../src/trpc";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { toObservable } from "./utils/stream";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const toolCodexExecuteMock = vi.fn();

mock.module("@alfred/agent/orchestrator/tool/codex/index", () => ({
  toolCodex: {
    execute: toolCodexExecuteMock,
  },
}));

mock.module("../src/routers/droids", () => ({
  droidsRouter: router({}),
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller();
});

beforeEach(() => {
  toolCodexExecuteMock.mockReset();
  toolCodexExecuteMock.mockResolvedValue({
    result: "codex-output",
    artifacts: [],
  });
});

afterEach(() => {
  resetAllMocks();
});

describe("codex router", () => {
  it("aggregates stdout output for run mutations", async () => {
    toolCodexExecuteMock.mockImplementation(async ({ writer }) => {
      await writer?.write({ type: "stdout", text: "line-one" });
      await writer?.write({ type: "stdout", text: "line-two" });
      return { result: "ok", events: [] } as any;
    });

    const response = await caller.codex.run({ prompt: "list files" });

    expect(response.result).toContain("line-one");
    expect(response.result).toContain("line-two");
  });

  it("surfaces timeout errors during run", async () => {
    toolCodexExecuteMock.mockRejectedValueOnce(new Error("codex_exec_timeout"));

    await expect(
      caller.codex.run({ prompt: "long task", timeoutSec: 120 })
    ).rejects.toThrow(/timeout/i);
    expect(toolCodexExecuteMock).toHaveBeenCalledTimes(1);
  });

  it("emits timeout notices over the stream API", async () => {
    toolCodexExecuteMock.mockImplementation(async ({ writer }) => {
      await writer?.write({
        type: "notice",
        message: "codex_exec_timeout",
      });
      throw new Error("codex_exec_timeout");
    });

    const streamResult = await caller.codex.stream({ prompt: "stream task" });
    const observable = toObservable(streamResult);
    const events: Array<{ type: string; message?: string }> = [];

    await new Promise<void>((resolve) => {
      const subscription = observable.subscribe({
        next: (event) => {
          events.push(event as any);
          if (event.type === "error") {
            subscription.unsubscribe();
            resolve();
          }
        },
        error: () => {
          resolve();
        },
        complete: () => {
          resolve();
        },
      });
    });

    expect(events[0]).toMatchObject({
      type: "notice",
      message: "codex_exec_timeout",
    });
    const errorEvent = events.find((event) => event.type === "error");
    const errorMessage = String(errorEvent?.message ?? "").toLowerCase();
    expect(errorMessage).toContain("timed out");
  });

  it("emits codex_session_forbidden when a second user reuses a session via stream", async () => {
    const owner = await createTestCaller({ userId: "stream-owner" });
    const intruder = await createTestCaller({ userId: "stream-intruder" });
    const sessionId = "session-stream-guard";

    toolCodexExecuteMock.mockResolvedValueOnce({ result: "", artifacts: [] });
    await owner.codex.run({ prompt: "prime", sessionId });

    toolCodexExecuteMock.mockRejectedValueOnce(
      new Error("codex_session_forbidden")
    );

    const streamResult = await intruder.codex.stream({
      prompt: "reuse",
      sessionId,
    });
    const observable = toObservable(streamResult);
    const events: Array<{ type: string; message?: string }> = [];

    await new Promise<void>((resolve) => {
      const subscription = observable.subscribe({
        next: (event) => {
          events.push(event as any);
          if (event.type === "error") {
            subscription.unsubscribe();
            resolve();
          }
        },
        error: () => resolve(),
        complete: () => resolve(),
      });
    });

    const errorEvent = events.find((event) => event.type === "error");
    expect(errorEvent?.message).toContain("codex_session_forbidden");
    expect(toolCodexExecuteMock).toHaveBeenCalledTimes(2);
    expect(toolCodexExecuteMock.mock.calls[1]?.[0]?.input?.userId).toBe(
      "stream-intruder"
    );
  });

  it("completes streams and supports cleanup", async () => {
    toolCodexExecuteMock.mockImplementation(async ({ writer }) => {
      await writer?.write({ type: "stdout", text: "done" });
      return { result: "done", artifacts: [] };
    });

    let completed = false;
    const streamResult = await caller.codex.stream({ prompt: "stream" });
    const observable = toObservable(streamResult);

    await new Promise<void>((resolve, reject) => {
      const subscription = observable.subscribe({
        next: (event) => {
          if (event.type === "complete") {
            completed = true;
            subscription.unsubscribe();
            resolve();
          }
        },
        error: reject,
        complete: () => {
          if (!completed) {
            completed = true;
          }
          resolve();
        },
      });
    });

    expect(completed).toBe(true);
    expect(toolCodexExecuteMock).toHaveBeenCalledTimes(1);
  });

  it("rejects empty prompts", async () => {
    await expect(caller.codex.run({ prompt: "" } as any)).rejects.toThrow();
    expect(toolCodexExecuteMock).not.toHaveBeenCalled();
  });

  it("rejects invalid output schemas", async () => {
    await expect(
      caller.codex.run({
        prompt: "test",
        outputSchema: "invalid" as any,
      })
    ).rejects.toThrow();
    expect(toolCodexExecuteMock).not.toHaveBeenCalled();
  });

  it("rejects environment injections with non-string values", async () => {
    await expect(
      caller.codex.run({
        prompt: "test",
        env: {
          LD_PRELOAD: "/tmp/libhack.so",
          EVIL: 123 as any,
        },
      })
    ).rejects.toThrow();
    expect(toolCodexExecuteMock).not.toHaveBeenCalled();
  });

  it("surface codex_session_forbidden when a different user reuses a run session", async () => {
    const owner = await createTestCaller({ userId: "run-owner" });
    const intruder = await createTestCaller({ userId: "run-intruder" });
    const sessionId = "session-run-guard";

    toolCodexExecuteMock.mockResolvedValueOnce({ result: "", artifacts: [] });
    await owner.codex.run({ prompt: "prime", sessionId });

    toolCodexExecuteMock.mockRejectedValueOnce(
      new Error("codex_session_forbidden")
    );

    await expect(
      intruder.codex.run({ prompt: "reuse", sessionId })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("codex_session_forbidden"),
    });

    expect(toolCodexExecuteMock).toHaveBeenCalledTimes(2);
    expect(toolCodexExecuteMock.mock.calls[1]?.[0]?.input?.userId).toBe(
      "run-intruder"
    );
  });
});
