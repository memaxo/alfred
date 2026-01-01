import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { setupTestEnv } from "./utils/router-helpers";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";

setupTestEnv();

const openMock = vi.fn();
const closeMock = vi.fn().mockResolvedValue(undefined);
const readdirMock = vi.fn().mockResolvedValue(["a.txt", "dir"]);
const statMock = vi.fn((p: string) => {
  if (p.endsWith("/dir")) {
    return {
      ino: 2,
      size: 0,
      mtime: 1,
      isDirectory: () => true,
    };
  }
  return {
    ino: 1,
    size: 3,
    mtime: 1,
    isDirectory: () => false,
  };
});
const getRecentMock = vi.fn().mockResolvedValue([
  {
    id: 10,
    name: "tool.a",
    started_at: 1,
    completed_at: 2,
    duration_ms: 12,
    parameters: { a: 1 },
    result: { ok: true },
  },
]);
const kvListMock = vi.fn().mockResolvedValue([{ key: "k", value: "v" }]);

mock.module("@alfred/agent/agentfs", () => ({
  AlfredAgentFS: {
    open: openMock,
  },
}));

mock.module("@alfred/agent/agentfs/index", () => ({
  AlfredAgentFS: {
    open: openMock,
  },
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["read:agentfs"],
  });
});

afterEach(() => {
  vi.clearAllMocks();
  openMock.mockResolvedValue({
    fs: { readdir: readdirMock, stat: statMock },
    tools: { getRecent: getRecentMock },
    kv: { list: kvListMock },
    close: closeMock,
  });
});

describe("agentfs router", () => {
  it("requires auth", async () => {
    const unauthed = await createUnauthedCaller();
    await expect(
      unauthed.agentfs.snapshot({
        runId: "run-1",
        dbPath: ".agentfs/run-1/agent.db",
        dir: "/workspace",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires read:agentfs scope", async () => {
    const noScopes = await createTestCaller({ scopes: [] });
    await expect(
      noScopes.agentfs.snapshot({
        runId: "run-1",
        dbPath: ".agentfs/run-1/agent.db",
        dir: "/workspace",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects invalid dbPath", async () => {
    await expect(
      caller.agentfs.snapshot({
        runId: "run-1",
        dbPath: ".agentfs/other/agent.db",
        dir: "/workspace",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("returns a snapshot", async () => {
    openMock.mockResolvedValue({
      fs: { readdir: readdirMock, stat: statMock },
      tools: { getRecent: getRecentMock },
      kv: { list: kvListMock },
      close: closeMock,
    });

    const res = await caller.agentfs.snapshot({
      runId: "run-1",
      dbPath: ".agentfs/run-1/agent.db",
      dir: "/workspace",
    });

    expect(res.runId).toBe("run-1");
    expect(res.dbPath).toBe(".agentfs/run-1/agent.db");
    expect(res.entries.length).toBe(2);
    expect(res.toolCalls[0]?.id).toBe(10);
    expect(res.kvStore[0]?.key).toBe("k");
    expect(openMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("streams data and closes on unsubscribe", async () => {
    openMock.mockResolvedValue({
      fs: { readdir: readdirMock, stat: statMock },
      tools: { getRecent: getRecentMock },
      kv: { list: kvListMock },
      close: closeMock,
    });

    const sub = await caller.agentfs.stream({
      runId: "run-1",
      dbPath: ".agentfs/run-1/agent.db",
      dir: "/workspace",
      pollMs: 100,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        inner.unsubscribe();
        reject(new Error("stream_timeout"));
      }, 1000);

      const inner = sub.subscribe({
        next: (event) => {
          try {
            clearTimeout(timeout);
            expect(event).toMatchObject({ type: "data" });
            inner.unsubscribe();
            resolve();
          } catch (e) {
            clearTimeout(timeout);
            inner.unsubscribe();
            reject(e);
          }
        },
        error: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });
    });

    // Allow async close to run
    await new Promise((r) => setTimeout(r, 50));
    expect(closeMock).toHaveBeenCalled();
  });

  it("supports resume via cursor (no duplicate toolCalls)", async () => {
    openMock.mockResolvedValue({
      fs: { readdir: readdirMock, stat: statMock },
      tools: { getRecent: getRecentMock },
      kv: { list: kvListMock },
      close: closeMock,
    });

    const sub = await caller.agentfs.stream({
      runId: "run-1",
      dbPath: ".agentfs/run-1/agent.db",
      dir: "/workspace",
      pollMs: 200,
      cursor: { toolCallId: 10, toolCallSince: 2 },
    });

    let receivedEvent = false;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (receivedEvent) {
          resolve();
        } else {
          inner.unsubscribe();
          reject(new Error("stream_timeout - no events received"));
        }
      }, 500);

      const inner = sub.subscribe({
        next: (event) => {
          try {
            if (event.type !== "data") {
              return;
            }
            receivedEvent = true;
            clearTimeout(timeout);
            expect(event.toolCalls).toBeUndefined();
            inner.unsubscribe();
            resolve();
          } catch (e) {
            clearTimeout(timeout);
            inner.unsubscribe();
            reject(e);
          }
        },
        error: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });
    });
  });

  it("enforces a MAX_EVENTS safeguard", async () => {
    const prev = process.env.ALFRED_AGENTFS_MAX_EVENTS;
    process.env.ALFRED_AGENTFS_MAX_EVENTS = "1";

    try {
      openMock.mockResolvedValue({
        fs: { readdir: readdirMock, stat: statMock },
        tools: { getRecent: getRecentMock },
        kv: { list: kvListMock },
        close: closeMock,
      });

      const sub = await caller.agentfs.stream({
        runId: "run-1",
        dbPath: ".agentfs/run-1/agent.db",
        dir: "/workspace",
        pollMs: 200,
      });

      const events: unknown[] = [];
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          // If we got at least one event, consider it a pass (MAX_EVENTS worked)
          if (events.length > 0) {
            resolve();
          } else {
            reject(new Error("stream_timeout - no events received"));
          }
        }, 1000);

        sub.subscribe({
          next: (e) => {
            events.push(e);
            // Check if we got a done event (MAX_EVENTS triggered)
            if (
              typeof e === "object" &&
              e !== null &&
              "type" in e &&
              e.type === "done"
            ) {
              clearTimeout(timeout);
              resolve();
            }
          },
          error: (err) => {
            clearTimeout(timeout);
            reject(err);
          },
          complete: () => {
            clearTimeout(timeout);
            resolve();
          },
        });
      });

      const hasType = (x: unknown): x is { type: string } => {
        if (!x || typeof x !== "object") {
          return false;
        }
        return (
          "type" in x && typeof (x as { type?: unknown }).type === "string"
        );
      };

      // With MAX_EVENTS=1, we should get at least 1 data event and then a done event
      expect(events.length).toBeGreaterThanOrEqual(1);
      // The done event should be emitted after MAX_EVENTS is reached
      const doneEvents = events.filter((e) => hasType(e) && e.type === "done");
      expect(doneEvents.length).toBeGreaterThanOrEqual(1);
    } finally {
      if (prev === undefined) {
        process.env.ALFRED_AGENTFS_MAX_EVENTS = undefined;
      } else {
        process.env.ALFRED_AGENTFS_MAX_EVENTS = prev;
      }
    }
  });
});
