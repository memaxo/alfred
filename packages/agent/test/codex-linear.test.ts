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

import type { AlfredCodexEvent } from "../src/orchestrator/tool/codex";
import {
  injectLinearContext,
  mapCodexEventToLinearActivity,
} from "../src/orchestrator/tool/codex-linear";

describe("codex-linear", () => {
  const originalEnv = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://test";
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      process.env.DATABASE_URL = undefined;
    } else {
      process.env.DATABASE_URL = originalEnv;
    }
  });

  describe("injectLinearContext", () => {
    it("returns original prompt when no linearIssueId", () => {
      const prompt = "Fix the bug";
      const result = injectLinearContext(prompt, undefined);
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
    });

    it("handles thought events", async () => {
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

      await expect(
        mapCodexEventToLinearActivity(event, context)
      ).resolves.toBeUndefined();
    });
  });
});
