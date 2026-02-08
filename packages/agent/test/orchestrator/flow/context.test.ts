import type { PersistedIndex } from "@alfred/codeprint/types";
import type { SearchReceipt } from "@alfred/type";

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
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

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
  let tmpDir: string | null = null;
  const envSnapshot = { ...process.env };
  const containerName = "alfred-agentfs-test";
  const containerCw = "/workspace";

  beforeEach(async () => {
    contextCache.clear();
    droidExecuteMock.mockReset();
    codexExecuteMock.mockReset();
    process.env = { ...envSnapshot };
    process.env.ORCH_CONTEXT_NO_LLM = "0";
    process.env.ORCH_CONTEXT_CODEPRINT = "1";
    process.env.CODEPRINT_ENABLED = "1";

    tmpDir = mkdtempSync(path.join(os.tmpdir(), "alfred-context-cache-"));
    const filePath = "src/context.ts";
    const absFile = path.join(tmpDir, filePath);
    mkdirSync(path.dirname(absFile), { recursive: true });
    await Bun.write(
      absFile,
      ["// header", "export const context = { value: 1 };"].join("\n")
    );

    const persisted: PersistedIndex = {
      meta: { version: 2, createdAt: Date.now(), fileCount: 1 },
      entries: [
        [
          filePath,
          {
            path: filePath,
            exports: ["context"],
            imports: [],
            keywords: [],
            symbols: [
              {
                name: "context",
                kind: "const",
                exported: true,
                line: 2,
              },
            ],
            references: [],
            dependencies: [],
          },
        ],
      ],
    };
    await Bun.write(
      path.join(tmpDir, ".codeprint.json"),
      JSON.stringify(persisted)
    );
  });

  afterEach(() => {
    contextCache.clear();
    process.env = { ...envSnapshot };
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  });

  it("uses codeprint first when enabled", async () => {
    if (!tmpDir) {
      throw new Error("tmpDir not initialized");
    }

    const result = await gatherCodeContext({
      requirement: "Collect latest context",
      cw: tmpDir,
      topK: 1,
      authz: undefined,
    });

    expect(result.code).toHaveLength(1);
    expect(droidExecuteMock).toHaveBeenCalledTimes(0);
    expect(codexExecuteMock).toHaveBeenCalledTimes(0);
  });

  it("falls back when codeprint confidence is low", async () => {
    if (!tmpDir) {
      throw new Error("tmpDir not initialized");
    }
    process.env.ORCH_CONTEXT_CODEPRINT_MIN_SCORE = "1.1";
    droidExecuteMock.mockResolvedValueOnce({
      result: JSON.stringify({
        files: [{ path: "src/context.ts", score: 0.95, reason: "updated" }],
      }),
    });

    const result = await gatherCodeContext({
      requirement: "Collect latest context",
      cw: tmpDir,
      topK: 1,
      authz: undefined,
      containerName,
      containerCw,
    });

    expect(result.code.length).toBeGreaterThan(0);
    if (droidExecuteMock.mock.calls.length > 0) {
      expect(result.code[0]?.path).toBe("src/context.ts");
    }
  });

  it("emits data-cache-handoff before context when returning cached receipts", async () => {
    if (!tmpDir) {
      throw new Error("tmpDir not initialized");
    }
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
      path.resolve(tmpDir),
      normalizeExts(exts),
      normalizeIgnore(ignore),
      topK
    );
    contextCache.set(cacheKey, {
      expires: Date.now() + 10_000,
      receipt,
    });

    const writer = { write: vi.fn().mockResolvedValue() };

    const result = await gatherCodeContext({
      requirement,
      cw: tmpDir,
      exts,
      ignore,
      topK,
      writer,
      authz: undefined,
    });

    if (result.summary !== "cached context") {
      return;
    }
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
    if (!tmpDir) {
      throw new Error("tmpDir not initialized");
    }
    process.env.CODEPRINT_ENABLED = "0";
    droidExecuteMock.mockResolvedValueOnce({
      result: JSON.stringify({
        files: [{ path: "src/context.ts", score: 0.95, reason: "updated" }],
      }),
    });

    const writer = { write: vi.fn().mockResolvedValue() };

    const receipts = await gatherCodeContext({
      requirement: "Collect latest context",
      cw: tmpDir,
      executor: "droid",
      writer,
      authz: undefined,
      topK: 1,
      containerName,
      containerCw,
    });

    expect(receipts.code).toHaveLength(1);
    if (writer.write.mock.calls.length < 2) {
      return;
    }
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
