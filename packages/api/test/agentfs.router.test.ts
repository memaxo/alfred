import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { setupTestEnv } from "./utils/router-helpers";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";

setupTestEnv();

const openMock = vi.fn();
const closeMock = vi.fn().mockResolvedValue();
const readdirMock = vi.fn().mockResolvedValue(["a.txt", "dir"]);
const readFileMock = vi.fn().mockResolvedValue(Buffer.from("hello", "utf8"));
const statMock = vi.fn((p: string) => {
  if (p.endsWith("/dir")) {
    return Promise.resolve({
      ino: 2,
      isDirectory: () => true,
      mtime: 1,
      size: 0,
    });
  }
  return Promise.resolve({
    ino: 1,
    isDirectory: () => false,
    mtime: 1,
    size: 5,
  });
});
const diffMock = vi
  .fn()
  .mockResolvedValue([
    { mtime: 1, path: "/workspace/a.txt", size: 5, type: "modified" },
  ]);

const dbPrepareMock = vi.fn((sql: string) => {
  if (sql.includes("FROM fs_dentry")) {
    return {
      get: vi.fn(async (_parent: number, name: string) => {
        if (name === "a.txt") {
          return { ino: 2 };
        }
        return null;
      }),
    };
  }

  if (sql.includes("FROM tool_calls")) {
    return {
      get: vi.fn(async () => ({ count: 3 })),
    };
  }

  if (sql.includes("FROM kv_store")) {
    return {
      get: vi.fn(async () => ({ count: 1 })),
    };
  }

  if (sql.includes("COUNT(*)") && sql.includes("FROM fs_inode")) {
    return {
      get: vi.fn(async () => ({ count: 2 })),
    };
  }

  if (sql.includes("SUM(size)") && sql.includes("FROM fs_inode")) {
    return {
      get: vi.fn(async () => ({ sum: 10 })),
    };
  }

  if (sql.includes("SELECT size") && sql.includes("FROM fs_inode")) {
    return {
      get: vi.fn(async (_ino: number) => ({ size: 5 })),
    };
  }

  if (sql.includes("FROM fs_config")) {
    return {
      get: vi.fn(async () => ({ value: "4096" })),
    };
  }

  if (sql.includes("FROM fs_data")) {
    return {
      all: vi.fn(async (_ino: number) => [{ data: Buffer.from("hello") }]),
    };
  }

  return {
    all: vi.fn(async () => []),
    get: vi.fn(async () => null),
  };
});

const getDatabaseMock = vi.fn(() => ({ prepare: dbPrepareMock }));
const getRecentMock = vi.fn().mockResolvedValue([
  {
    completed_at: 2,
    duration_ms: 12,
    id: 10,
    name: "tool.a",
    parameters: { a: 1 },
    result: { ok: true },
    started_at: 1,
  },
]);
const kvListMock = vi.fn().mockResolvedValue([{ key: "k", value: "v" }]);
const kvGetMock = vi.fn().mockResolvedValue();
const kvSetMock = vi.fn().mockResolvedValue();

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
    scopes: ["read:agentfs", "agentfs.write"],
  });
});

afterEach(() => {
  vi.clearAllMocks();
  openMock.mockResolvedValue({
    close: closeMock,
    diff: diffMock,
    fs: { readdir: readdirMock, stat: statMock, readFile: readFileMock },
    getDatabase: getDatabaseMock,
    kv: { list: kvListMock, get: kvGetMock, set: kvSetMock, delete: vi.fn() },
    tools: { getRecent: getRecentMock },
  });
});

describe("agentfs router", () => {
  it("requires auth", async () => {
    const unauthed = await createUnauthedCaller();
    await expect(
      unauthed.agentfs.snapshot({
        dbPath: ".agentfs/run-1/agent.db",
        dir: "/workspace",
        runId: "run-1",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires read:agentfs scope", async () => {
    const noScopes = await createTestCaller({ scopes: [] });
    await expect(
      noScopes.agentfs.snapshot({
        dbPath: ".agentfs/run-1/agent.db",
        dir: "/workspace",
        runId: "run-1",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects invalid dbPath", async () => {
    await expect(
      caller.agentfs.snapshot({
        dbPath: ".agentfs/other/agent.db",
        dir: "/workspace",
        runId: "run-1",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("returns a snapshot", async () => {
    openMock.mockResolvedValue({
      close: closeMock,
      diff: diffMock,
      fs: { readdir: readdirMock, stat: statMock, readFile: readFileMock },
      getDatabase: getDatabaseMock,
      kv: { list: kvListMock },
      tools: { getRecent: getRecentMock },
    });

    const res = await caller.agentfs.snapshot({
      dbPath: ".agentfs/run-1/agent.db",
      dir: "/workspace",
      runId: "run-1",
    });

    expect(res.runId).toBe("run-1");
    expect(res.dbPath).toBe(".agentfs/run-1/agent.db");
    expect(res.entries.length).toBe(2);
    expect(res.toolCalls[0]?.id).toBe(10);
    expect(res.kvStore[0]?.key).toBe("k");
    expect(openMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("returns file content preview", async () => {
    openMock.mockResolvedValue({
      close: closeMock,
      diff: diffMock,
      fs: { readdir: readdirMock, stat: statMock, readFile: readFileMock },
      getDatabase: getDatabaseMock,
      kv: { list: kvListMock },
      tools: { getRecent: getRecentMock },
    });

    const res = await caller.agentfs.fileContent({
      dbPath: ".agentfs/run-1/agent.db",
      filePath: "/a.txt",
      runId: "run-1",
    });

    expect(res).toMatchObject({
      content: "hello",
      encoding: "utf8",
      isBinary: false,
      sizeBytes: 5,
      truncated: false,
    });
    expect(closeMock).toHaveBeenCalled();
  });

  it("returns a file slice", async () => {
    openMock.mockResolvedValue({
      close: closeMock,
      diff: diffMock,
      fs: { readdir: readdirMock, stat: statMock, readFile: readFileMock },
      getDatabase: getDatabaseMock,
      kv: { list: kvListMock },
      tools: { getRecent: getRecentMock },
    });

    const res = await caller.agentfs.fileSlice({
      dbPath: ".agentfs/run-1/agent.db",
      filePath: "/a.txt",
      maxBytes: 2,
      offsetBytes: 1,
      runId: "run-1",
    });

    expect(res).toMatchObject({
      content: "el",
      encoding: "utf8",
      isBinary: false,
      offsetBytes: 1,
      returnedBytes: 2,
      sizeBytes: 5,
      truncated: true,
    });
  });

  it("returns file classification", async () => {
    const res = await caller.agentfs.fileClass({
      dbPath: ".agentfs/run-1/agent.db",
      filePath: "/a.txt",
      runId: "run-1",
    });

    expect(res).toMatchObject({
      filePath: "/a.txt",
      sensitivity: "normal",
    });
    expect(kvSetMock).toHaveBeenCalled();
  });

  it("blocks preview for sensitive files", async () => {
    await expect(
      caller.agentfs.fileSlice({
        dbPath: ".agentfs/run-1/agent.db",
        filePath: "/workspace/.env",
        maxBytes: 50,
        offsetBytes: 0,
        runId: "run-1",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "agentfs_sensitive_file",
    });
  });

  it("returns run stats", async () => {
    openMock.mockResolvedValue({
      close: closeMock,
      diff: diffMock,
      fs: { readdir: readdirMock, stat: statMock, readFile: readFileMock },
      getDatabase: getDatabaseMock,
      kv: { list: kvListMock },
      tools: { getRecent: getRecentMock },
    });

    const res = await caller.agentfs.runStats({
      dbPath: ".agentfs/run-1/agent.db",
      runId: "run-1",
    });

    expect(res).toEqual({
      bytes: 10,
      checkpoints: 1,
      files: 2,
      toolCalls: 3,
    });
  });

  it("returns file blame candidates", async () => {
    openMock.mockResolvedValue({
      close: closeMock,
      diff: diffMock,
      fs: { readdir: readdirMock, stat: statMock, readFile: readFileMock },
      getDatabase: getDatabaseMock,
      kv: { list: kvListMock },
      tools: { getRecent: getRecentMock },
    });

    const res = await caller.agentfs.fileBlame({
      dbPath: ".agentfs/run-1/agent.db",
      filePath: "/workspace/a.txt",
      runId: "run-1",
    });

    expect(res.mtimeSec).toBe(1);
    expect(res.candidates[0]).toMatchObject({
      completedAt: 2,
      id: 10,
      name: "tool.a",
      score: 1,
      startedAt: 1,
    });
  });

  it("compares two runs (files + kv)", async () => {
    const leftPrepare = vi.fn((sql: string) => {
      if (sql.includes("WITH RECURSIVE tree")) {
        return {
          all: vi.fn(async () => [
            {
              mode: 32_768,
              mtime: 1,
              path: "/workspace/a.txt",
              size: 5,
            },
          ]),
        };
      }
      if (sql.includes("SELECT key, value FROM kv_store")) {
        return {
          all: vi.fn(async () => [{ key: "k", value: '"v1"' }]),
        };
      }
      return { all: vi.fn(async () => []), get: vi.fn(async () => null) };
    });

    const rightPrepare = vi.fn((sql: string) => {
      if (sql.includes("WITH RECURSIVE tree")) {
        return {
          all: vi.fn(async () => [
            {
              mode: 32_768,
              mtime: 2,
              path: "/workspace/a.txt",
              size: 6,
            },
            {
              mode: 32_768,
              mtime: 2,
              path: "/workspace/b.txt",
              size: 1,
            },
          ]),
        };
      }
      if (sql.includes("SELECT key, value FROM kv_store")) {
        return {
          all: vi.fn(async () => [{ key: "k", value: '"v2"' }]),
        };
      }
      return { all: vi.fn(async () => []), get: vi.fn(async () => null) };
    });

    openMock
      .mockResolvedValueOnce({
        close: closeMock,
        getDatabase: () => ({ prepare: leftPrepare }),
      })
      .mockResolvedValueOnce({
        close: closeMock,
        getDatabase: () => ({ prepare: rightPrepare }),
      });

    const res = await caller.agentfs.compareRuns({
      left: { runId: "run-1", dbPath: ".agentfs/run-1/agent.db" },
      limit: 500,
      right: { runId: "run-2", dbPath: ".agentfs/run-2/agent.db" },
    });

    expect(res.file).toMatchObject({ added: 1, modified: 1, removed: 0 });
    expect(res.file.diffs[0]?.path).toBe("/workspace/a.txt");
    expect(res.kv).toMatchObject({ added: 0, modified: 1, removed: 0 });
    expect(res.kv.diffs[0]?.key).toBe("k");
  });

  it("clones a run database", async () => {
    const srcRunId = "clone-src";
    const dstRunId = "clone-dst";
    const srcDir = `.agentfs/${srcRunId}`;
    const srcDbPath = `${srcDir}/agent.db`;

    const srcAbsDir = path.resolve(process.cwd(), srcDir);
    const srcAbsDb = path.resolve(process.cwd(), srcDbPath);

    const dstAbsDir = path.resolve(process.cwd(), `.agentfs/${dstRunId}`);

    await mkdir(srcAbsDir, { recursive: true });
    await Bun.write(srcAbsDb, "hello");
    await Bun.write(`${srcAbsDb}-wal`, "wal");
    await Bun.write(`${srcAbsDb}-shm`, "shm");

    try {
      const res = await caller.agentfs.cloneRun({
        source: { dbPath: srcDbPath, runId: srcRunId },
        targetRunId: dstRunId,
      });

      expect(res).toEqual({
        dbPath: `.agentfs/${dstRunId}/agent.db`,
        runId: dstRunId,
      });

      const dstAbsDb = path.resolve(process.cwd(), res.dbPath);
      expect(await Bun.file(dstAbsDb).text()).toBe("hello");
      expect(await Bun.file(`${dstAbsDb}-wal`).text()).toBe("wal");
      expect(await Bun.file(`${dstAbsDb}-shm`).text()).toBe("shm");
    } finally {
      await rm(srcAbsDir, { force: true, recursive: true });
      await rm(dstAbsDir, { force: true, recursive: true });
    }
  });

  it("clones from a checkpoint snapshot", async () => {
    const srcRunId = "checkpoint-src";
    const dstRunId = "checkpoint-dst";
    const srcDir = `.agentfs/${srcRunId}`;
    const srcDbPath = `${srcDir}/agent.db`;

    const srcAbsDir = path.resolve(process.cwd(), srcDir);
    const srcAbsSnapshot = path.resolve(
      process.cwd(),
      `${srcDbPath}.checkpoint-v1`
    );

    const dstAbsDir = path.resolve(process.cwd(), `.agentfs/${dstRunId}`);

    await mkdir(srcAbsDir, { recursive: true });
    await Bun.write(srcAbsSnapshot, "snapshot");

    try {
      const res = await caller.agentfs.cloneCheckpoint({
        checkpointId: "v1",
        dbPath: srcDbPath,
        runId: srcRunId,
        targetRunId: dstRunId,
      });

      expect(res).toEqual({
        dbPath: `.agentfs/${dstRunId}/agent.db`,
        runId: dstRunId,
      });

      const dstAbsDb = path.resolve(process.cwd(), res.dbPath);
      expect(await Bun.file(dstAbsDb).text()).toBe("snapshot");
    } finally {
      await rm(srcAbsDir, { force: true, recursive: true });
      await rm(dstAbsDir, { force: true, recursive: true });
    }
  });

  it("pins and unpins a run", async () => {
    const runId = "pin-run";
    const dirAbs = path.resolve(process.cwd(), ".agentfs", runId);
    await mkdir(dirAbs, { recursive: true });
    await Bun.write(path.join(dirAbs, "agentfs.db"), "db");

    try {
      await caller.agentfs.pinRun({ runId });
      expect(await Bun.file(path.join(dirAbs, ".keep")).exists()).toBe(true);

      await caller.agentfs.unpinRun({ runId });
      expect(await Bun.file(path.join(dirAbs, ".keep")).exists()).toBe(false);
    } finally {
      await rm(dirAbs, { force: true, recursive: true });
    }
  });

  it("streams data and closes on unsubscribe", async () => {
    openMock.mockResolvedValue({
      close: closeMock,
      diff: diffMock,
      fs: { readdir: readdirMock, stat: statMock },
      kv: { list: kvListMock },
      tools: { getRecent: getRecentMock },
    });

    const sub = await caller.agentfs.stream({
      dbPath: ".agentfs/run-1/agent.db",
      dir: "/workspace",
      pollMs: 200,
      runId: "run-1",
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        inner.unsubscribe();
        reject(new Error("stream_timeout"));
      }, 1000);

      const inner = sub.subscribe({
        error: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
        next: (event) => {
          try {
            clearTimeout(timeout);
            expect(event).toMatchObject({ type: "data" });
            if (event.type === "data") {
              expect(event.changes).toBeDefined();
            }
            inner.unsubscribe();
            resolve();
          } catch (error) {
            clearTimeout(timeout);
            inner.unsubscribe();
            reject(error);
          }
        },
      });
    });

    // Allow async close to run
    await new Promise((r) => setTimeout(r, 50));
    expect(closeMock).toHaveBeenCalled();
  });

  it("supports resume via cursor (no duplicate toolCalls)", async () => {
    openMock.mockResolvedValue({
      close: closeMock,
      diff: diffMock,
      fs: { readdir: readdirMock, stat: statMock },
      kv: { list: kvListMock },
      tools: { getRecent: getRecentMock },
    });

    const sub = await caller.agentfs.stream({
      cursor: { toolCallId: 10, toolCallSince: 2 },
      dbPath: ".agentfs/run-1/agent.db",
      dir: "/workspace",
      pollMs: 200,
      runId: "run-1",
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
        error: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
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
          } catch (error) {
            clearTimeout(timeout);
            inner.unsubscribe();
            reject(error);
          }
        },
      });
    });
  });

  it("enforces a MAX_EVENTS safeguard", async () => {
    const prev = process.env.ALFRED_AGENTFS_MAX_EVENTS;
    process.env.ALFRED_AGENTFS_MAX_EVENTS = "1";

    try {
      openMock.mockResolvedValue({
        close: closeMock,
        diff: diffMock,
        fs: { readdir: readdirMock, stat: statMock },
        kv: { list: kvListMock },
        tools: { getRecent: getRecentMock },
      });

      const sub = await caller.agentfs.stream({
        dbPath: ".agentfs/run-1/agent.db",
        dir: "/workspace",
        pollMs: 200,
        runId: "run-1",
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
          complete: () => {
            clearTimeout(timeout);
            resolve();
          },
          error: (err) => {
            clearTimeout(timeout);
            reject(err);
          },
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
