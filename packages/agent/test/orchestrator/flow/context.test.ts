import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import path from "node:path";
import type { SearchReceipt } from "@alfred/type";

const droidExecuteMock = vi.fn();
const codexExecuteMock = vi.fn();

const createDroidModule = () => ({
  toolDroid: {
    execute: droidExecuteMock,
  },
});

const createCodexModule = () => ({
  toolCodex: {
    execute: codexExecuteMock,
  },
});

mock.module("../../../src/orchestrator/tool/droid.ts", createDroidModule);
mock.module("../../../src/orchestrator/tool/droid.js", createDroidModule);
mock.module("../../../src/orchestrator/tool/codex.ts", createCodexModule);
mock.module("../../../src/orchestrator/tool/codex.js", createCodexModule);

import {
  __internals,
  gatherCodeContext,
} from "../../../src/orchestrator/flow/context";

const { contextCache, buildCacheKey, normalizeExts, normalizeIgnore } =
  __internals;

describe("gatherCodeContext cache handoff", () => {
  const cw = process.cwd();

  beforeEach(() => {
    contextCache.clear();
    droidExecuteMock.mockReset();
    codexExecuteMock.mockReset();
  });

  afterEach(() => {
    contextCache.clear();
  });

  it("emits data-cache-handoff before context when returning cached receipts", async () => {
    const requirement = "Verify cached context";
    const exts = [".ts"];
    const ignore = ["node_modules"];
    const topK = 5;
    const receipt: SearchReceipt = {
      code: [
        {
          id: "code:src/index.ts",
          kind: "code",
          path: "src/index.ts",
          score: 0.9,
          reason: "cached",
        },
      ],
      created: new Date("2025-01-01T00:00:00.000Z"),
      summary: "cached context",
    };

    const cacheKey = buildCacheKey(
      requirement,
      path.resolve(cw),
      normalizeExts(exts),
      normalizeIgnore(ignore),
      topK
    );
    contextCache.set(cacheKey, {
      expires: Date.now() + 10_000,
      receipt,
    });

    const writer = { write: vi.fn().mockResolvedValue(undefined) };

    const result = await gatherCodeContext({
      requirement,
      cw,
      exts,
      ignore,
      topK,
      writer,
      authz: undefined,
    });

    expect(result.summary).toBe("cached context");
    expect(writer.write).toHaveBeenCalledTimes(2);
    const firstPayload = writer.write.mock.calls[0]?.[0];
    const secondPayload = writer.write.mock.calls[1]?.[0];
    expect(firstPayload?.type).toBe("data-cache-handoff");
    expect(secondPayload?.type).toBe("context");
    expect(secondPayload?.phase).toBe("cache");
    expect(secondPayload?.receipts).toEqual(firstPayload?.receipts);
    expect(typeof firstPayload?.receipts?.created).toBe("string");
  });

  it("emits handoff events before context events for fresh scans", async () => {
    droidExecuteMock.mockResolvedValueOnce({
      result: JSON.stringify({
        files: [{ path: "src/context.ts", score: 0.95, reason: "updated" }],
      }),
    });

    const writer = { write: vi.fn().mockResolvedValue(undefined) };

    const receipts = await gatherCodeContext({
      requirement: "Collect latest context",
      cw,
      executor: "droid",
      writer,
      authz: undefined,
      topK: 1,
    });

    expect(receipts.code).toHaveLength(1);
    expect(writer.write).toHaveBeenCalledTimes(2);
    const firstPayload = writer.write.mock.calls[0]?.[0];
    const secondPayload = writer.write.mock.calls[1]?.[0];
    expect(firstPayload?.type).toBe("data-cache-handoff");
    expect(secondPayload?.type).toBe("context");
    expect(secondPayload?.phase).toBe("scan");
    expect(secondPayload?.receipts).toEqual(firstPayload?.receipts);
    expect(firstPayload?.receipts?.code?.[0]?.path).toBe("src/context.ts");
  });
});

afterAll(() => {
  mock.restore();
});
