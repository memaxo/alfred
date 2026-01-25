import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

// Mock the graph repo to avoid DB dependency
mock.module("@alfred/db/repo/graph", () => ({
  upsertNodes: vi.fn().mockResolvedValue(new Map()),
  upsertEdges: vi.fn().mockResolvedValue([]),
}));

const emitLinearActivityMock = vi.fn().mockResolvedValue({ ok: true });

mock.module("../src/orchestrator/linear", () => ({
  emitLinearActivity: emitLinearActivityMock,
}));

const histogramStub = {
  startTimer: () => vi.fn(),
};

const activitiesEmittedStub = { inc: vi.fn() };
const activitiesDroppedStub = { inc: vi.fn() };
const activityBatchesStub = { inc: vi.fn() };

import { logger } from "@alfred/metrics";

import type { AlfredCodexEvent } from "../src/orchestrator/tool/codex/index";

import {
  configureCodexLinearMetrics,
  flushCodexLinearBatches,
  injectLinearContext,
  mapCodexEventToLinearActivity,
  resetCodexLinearLimiter,
  setCodexLinearTimingConfig,
} from "../src/orchestrator/tool/codex-linear";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("codex-linear", () => {
  const originalEnv = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://test";
    resetCodexLinearLimiter();
    emitLinearActivityMock.mockClear();
    activitiesEmittedStub.inc.mockClear();
    activitiesDroppedStub.inc.mockClear();
    activityBatchesStub.inc.mockClear();
    configureCodexLinearMetrics({
      histogram: histogramStub,
      activitiesEmitted: activitiesEmittedStub,
      activitiesDropped: activitiesDroppedStub,
      activityBatches: activityBatchesStub,
    });
    setCodexLinearTimingConfig({ batchWindowMs: 5, windowMs: 1000 });
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      process.env.DATABASE_URL = undefined;
    } else {
      process.env.DATABASE_URL = originalEnv;
    }
    resetCodexLinearLimiter();
    setCodexLinearTimingConfig();
  });

  describe("injectLinearContext", () => {
    it("returns original prompt when no linearIssueId", () => {
      const prompt = "Fix the bug";
      const result = injectLinearContext(prompt);
      expect(result).toBe(prompt);
    });

    it("returns original prompt when context has no linearIssueId", () => {
      const prompt = "Fix the bug";
      const result = injectLinearContext(prompt, { relevantFiles: [] });
      expect(result).toBe(prompt);
    });

    it("prepends Linear context when linearIssueId is provided", () => {
      const prompt = "Fix the bug";
      const context = {
        linearIssueId: "ENG-123",
      };
      const result = injectLinearContext(prompt, context);
      expect(result).toContain("ENG-123");
      expect(result).toContain("Fix the bug");
      expect(result).toContain("Linear issue");
    });
  });

  describe("mapCodexEventToLinearActivity", () => {
    it("skips activity when Linear context is incomplete", async () => {
      const event: AlfredCodexEvent = {
        type: "thought",
        content: "Testing",
        timestamp: Date.now(),
      };
      const context = {
        linearIssueId: "ENG-123",
        // Missing linearSessionId, linearSpace, linearAuthz
      };

      // Should not throw
      await expect(
        mapCodexEventToLinearActivity(event, context)
      ).resolves.toBeUndefined();
      expect(emitLinearActivityMock).not.toHaveBeenCalled();
    });

    it("batches rapid thought events", async () => {
      const event: AlfredCodexEvent = {
        type: "thought",
        content: "Analyzing code",
        timestamp: Date.now(),
      };
      const context = {
        linearSessionId: "session-1",
        linearSpace: "workspace-1",
        linearAuthz: "token-123",
      };

      await mapCodexEventToLinearActivity(event, context);
      await mapCodexEventToLinearActivity(
        { ...event, content: "Second thought" },
        context
      );

      await sleep(20);
      await flushCodexLinearBatches();

      expect(emitLinearActivityMock).toHaveBeenCalledTimes(1);
      const payload = emitLinearActivityMock.mock.calls[0]?.[1];
      expect(payload?.title).toContain("thought");
      expect(payload?.body).toContain("2 thoughts");
      expect(activityBatchesStub.inc).toHaveBeenCalledWith({
        status: "batched",
      });
      expect(activitiesEmittedStub.inc).toHaveBeenCalledWith({
        type: "thought",
        mode: "batch",
      });
    });

    it("enforces per-minute rate limit and emits summary", async () => {
      setCodexLinearTimingConfig({ batchWindowMs: 5, windowMs: 200 });
      const warnSpy = vi.spyOn(logger, "warn");
      const context = {
        linearSessionId: "session-1",
        linearSpace: "workspace-1",
        linearAuthz: "token-123",
      };

      for (let i = 0; i < 12; i += 1) {
        await mapCodexEventToLinearActivity(
          { type: "thought", content: `Thought ${i}`, timestamp: Date.now() },
          context
        );
        await sleep(15);
        await flushCodexLinearBatches();
      }

      expect(emitLinearActivityMock).toHaveBeenCalledTimes(10);
      expect(warnSpy).toHaveBeenCalledWith(
        "linear_activity_rate_limited",
        expect.objectContaining({ reason: "window" })
      );

      await sleep(250);
      await flushCodexLinearBatches();

      expect(emitLinearActivityMock).toHaveBeenCalledTimes(11);
      const summaryCall = emitLinearActivityMock.mock.calls.at(-1);
      expect(summaryCall?.[1].title).toContain("rate limited");
      warnSpy.mockRestore();
    });

    it("stops emitting after total execution cap", async () => {
      setCodexLinearTimingConfig({ batchWindowMs: 5, windowMs: 30 });
      const warnSpy = vi.spyOn(logger, "warn");
      const context = {
        linearSessionId: "session-2",
        linearSpace: "workspace-2",
        linearAuthz: "token-456",
      };

      for (let i = 0; i < 51; i += 1) {
        await mapCodexEventToLinearActivity(
          { type: "artifact", path: `file-${i}.ts`, kind: "file" },
          context
        );
        await sleep(40);
        await flushCodexLinearBatches();
      }

      expect(emitLinearActivityMock).toHaveBeenCalledTimes(50);
      expect(warnSpy).toHaveBeenCalledWith(
        "linear_activity_rate_limited",
        expect.objectContaining({ reason: "total" })
      );
      warnSpy.mockRestore();
    });
  });
});
