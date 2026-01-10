import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { toolCodex } from "../tool/codex/index.js";
import { toolRalph } from "./ralph.js";

describe("toolRalph (container-aware Codex)", () => {
  const originalCodex = toolCodex.execute;

  beforeEach(() => {
    process.env.ORCH_EXEC_PROFILE_STRICT = undefined;
  });

  afterEach(() => {
    toolCodex.execute = originalCodex;
    process.env.ORCH_EXEC_PROFILE_STRICT = undefined;
  });

  it("passes containerName/containerCw through to Codex and completes on promise", async () => {
    const captured: any[] = [];
    toolCodex.execute = mock((args: any) => {
      captured.push(args);
      return { result: "ok\n<promise>DONE</promise>", artifacts: [] };
    }) as any;

    const writerChunks: unknown[] = [];
    const result = await toolRalph.execute({
      input: {
        executor: "codex",
        prompt: "do the thing",
        config: { maxIterations: 3, completionPromise: "DONE" },
        auto: "read",
        cw: "/tmp",
        execProfile: "server",
        containerName: "alfred-agentfs-test",
        containerCw: "/workspace",
        agentfsDbPath: "/workspace/.agentfs/test.db",
      },
      writer: {
        write: (chunk: unknown) => {
          writerChunks.push(chunk);
        },
      },
      signal: new AbortController().signal,
    });

    expect(result.completed).toBe(true);
    expect(captured.length).toBe(1);
    expect(captured[0]?.input?.containerName).toBe("alfred-agentfs-test");
    expect(captured[0]?.input?.containerCw).toBe("/workspace");
    expect(captured[0]?.input?.execProfile).toBe("server");
    expect(writerChunks.length).toBeGreaterThan(0);
  });

  it("reuses the same container inputs across iterations", async () => {
    const captured: any[] = [];
    let calls = 0;
    toolCodex.execute = mock((args: any) => {
      captured.push(args);
      calls += 1;
      return calls === 1
        ? { result: "iter1", artifacts: [] }
        : { result: "<promise>DONE</promise>", artifacts: [] };
    }) as any;

    const result = await toolRalph.execute({
      input: {
        executor: "codex",
        prompt: "do the thing",
        config: { maxIterations: 3, completionPromise: "DONE" },
        auto: "read",
        cw: "/tmp",
        containerName: "alfred-agentfs-test",
        containerCw: "/workspace",
      },
      writer: { write: () => {} },
      signal: new AbortController().signal,
    });

    expect(result.completed).toBe(true);
    expect(calls).toBe(2);
    expect(captured[0]?.input?.containerName).toBe("alfred-agentfs-test");
    expect(captured[1]?.input?.containerName).toBe("alfred-agentfs-test");
    expect(captured[0]?.input?.containerCw).toBe("/workspace");
    expect(captured[1]?.input?.containerCw).toBe("/workspace");
  });

  it("retries with execProfile=default when server start fails (non-strict)", async () => {
    let calls = 0;
    const captured: any[] = [];
    toolCodex.execute = mock((args: any) => {
      captured.push(args);
      calls += 1;
      if (calls === 1) {
        throw new Error("codex_server_start_failed");
      }
      return { result: "<promise>DONE</promise>", artifacts: [] };
    }) as any;

    const notices: string[] = [];
    const result = await toolRalph.execute({
      input: {
        executor: "codex",
        prompt: "fallback test",
        config: { maxIterations: 3, completionPromise: "DONE" },
        auto: "read",
        cw: "/tmp",
        containerName: "alfred-agentfs-test",
        containerCw: "/workspace",
      },
      writer: {
        write: (chunk: any) => {
          if (chunk?.type === "notice" && typeof chunk.message === "string") {
            notices.push(chunk.message);
          }
        },
      },
      signal: new AbortController().signal,
    });

    expect(result.completed).toBe(true);
    expect(calls).toBe(2);
    expect(captured[1]?.input?.execProfile).toBe("default");
    expect(notices).toContain("executor_server_fallback_default");
  });

  it("propagates AbortSignal into Codex execution", async () => {
    const controller = new AbortController();
    let seenSignal: AbortSignal | undefined;

    toolCodex.execute = mock(async (args: any) => {
      seenSignal = args?.signal;
      return await new Promise((_resolve, reject) => {
        args?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true }
        );
      });
    }) as any;

    const promise = toolRalph.execute({
      input: {
        executor: "codex",
        prompt: "abort test",
        config: { maxIterations: 2 },
        auto: "read",
        cw: "/tmp",
      },
      writer: { write: () => {} },
      signal: controller.signal,
    });

    queueMicrotask(() => controller.abort());

    const result = await promise;
    expect(seenSignal).toBe(controller.signal);
    expect(result.completed).toBe(false);
    expect(result.stuckReason).toBe("aborted");
  });
});
