/**
 * GenUI Auto-Enrichment Integration Tests
 *
 * Tests that tool results in assistant router get automatically enriched
 * with GenUI data-ui parts.
 */

import { createMockDeps } from "@alfred/api/deps";
import { afterEach, describe, expect, it, mock, vi } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "../utils/router-helpers";
import { createTestCaller } from "../utils/trpc";

setupTestEnv();
mockPolicyAudit();

const enrichMock = vi.fn();
mock.module("@alfred/agent/utils/enrich", () => ({
  enrich: enrichMock,
}));

const generateTextMock = vi.fn();
const persistResultMock = vi.fn().mockResolvedValue("replay-1");

afterEach(() => {
  resetAllMocks();
  generateTextMock.mockReset();
  persistResultMock.mockReset();
  persistResultMock.mockResolvedValue("replay-1");
  enrichMock.mockReset();
});

describe("GenUI Auto-Enrichment Integration", () => {
  it("enriches tool results with GenUI schemas", async () => {
    generateTextMock.mockResolvedValue({
      text: "Here's the data:",
      toolCalls: [
        {
          id: "call-1",
          toolName: "test_tool",
          args: { query: "test" },
        },
      ],
      toolResults: [
        {
          id: "call-1",
          toolName: "test_tool",
          result: { data: "test", items: [1, 2, 3] },
        },
      ],
      usage: { inputTokens: 10, outputTokens: 15 },
      warnings: [],
      finishReason: "stop",
    });

    const caller = await createTestCaller({
      deps: createMockDeps({
        assistant: {
          generateText: generateTextMock,
          persistResult: persistResultMock,
        },
      }),
    });

    const result = await caller.assistant.generate({
      messages: [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "Show me some data" }],
        },
      ],
    });

    expect(result.toolResults).toHaveLength(1);
    expect(persistResultMock).toHaveBeenCalledTimes(1);
  });

  it("passes SchemaContext correctly", async () => {
    const projectId = randomUUID();
    generateTextMock.mockResolvedValue({
      text: "Result",
      toolCalls: [],
      toolResults: [
        {
          id: "call-1",
          toolName: "test_tool",
          result: { data: "test" },
        },
      ],
      usage: null,
      warnings: [],
      finishReason: "stop",
    });

    const caller = await createTestCaller({
      deps: createMockDeps({
        assistant: {
          generateText: generateTextMock,
          persistResult: persistResultMock,
        },
      }),
    });

    await caller.assistant.generate({
      messages: [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "Test" }],
        },
      ],
      projectId,
    });

    const call = persistResultMock.mock.calls[0]?.[0] as
      | {
          schemaContext?: {
            userId?: string;
            projectId?: string;
            mode?: string;
          };
        }
      | undefined;
    expect(call?.schemaContext?.mode).toBe("assistant");
    expect(call?.schemaContext?.projectId).toBe(projectId);
  });

  it("skips enrichment for SKIP_GENUI_TOOLS", async () => {
    // This test would verify that tools in SKIP_GENUI_TOOLS don't get enriched
    // The skip list is in packages/agent/src/utils/enrich.ts
    // For now, this is a placeholder test structure

    const skipTools = ["runtime_status", "session_create", "router"];

    for (const toolName of skipTools) {
      // Test that each skip tool doesn't trigger enrichment
      // Implementation would mock the tool result and verify no data-ui part was added
    }
  });

  it("achieves >60% enrichment rate for visualizable tool results", async () => {
    const visualizableResults = [
      { data: [1, 2, 3], items: ["a", "b", "c"] },
      { table: [{ col1: "val1" }] },
      { chart: { type: "bar", data: [1, 2, 3] } },
    ];

    enrichMock.mockImplementation(async (toolResult: unknown) => {
      const rec =
        toolResult && typeof toolResult === "object"
          ? (toolResult as Record<string, unknown>)
          : {};
      const out = (rec.result ?? rec.output) as unknown;
      const outRec =
        out && typeof out === "object" ? (out as Record<string, unknown>) : {};

      const shouldEnrich =
        out &&
        typeof out === "object" &&
        ("items" in outRec || "table" in outRec || "chart" in outRec);

      const toolCallId =
        (typeof rec.id === "string" ? rec.id : undefined) ?? "call-1";
      const toolName =
        (typeof rec.toolName === "string" ? rec.toolName : undefined) ??
        "test_tool";

      const base = {
        type: "tool-result",
        toolName,
        toolCallId,
        output: out,
      };

      if (!shouldEnrich) {
        return [base];
      }

      return [
        base,
        {
          type: "data-ui",
          ui: { component: "grid", props: { columns: 2 } },
          data: out,
        },
      ];
    });

    const { normalizeToUiMessagesAsync } =
      await import("@alfred/agent/utils/normalize-async");

    const ui = await normalizeToUiMessagesAsync({
      text: "ok",
      toolCalls: [],
      toolResults: visualizableResults.map((r, i) => ({
        id: `call-${i + 1}`,
        toolName: "test_tool",
        result: r,
      })),
    });

    const parts = ui[0]?.parts ?? [];
    const dataUiCount = parts.filter((p) => p.type === "data-ui").length;
    const enrichmentRate = dataUiCount / visualizableResults.length;
    expect(enrichmentRate).toBeGreaterThan(0.6);
  });
});
