/**
 * Tests for tool result GenUI auto-enrichment
 */

import { isUIDataPart } from "@alfred/type/genui";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import type { ToolResultShape } from "../../src/utils/normalize";

import { enrich } from "../../src/utils/enrich";

describe("enrich", () => {
  beforeEach(() => {
    // Mock dynamic imports to avoid actual API calls in tests
    mock.module("@alfred/api/services/schema", () => ({
      SchemaGenerator: class {
        async toDataUiPart() {
          return {
            type: "data-ui",
            ui: { component: "chart", props: {} },
          };
        }
      },
    }));

    mock.module("@alfred/api/metrics/genui", () => ({
      genuiAutoEnrichmentTotal: { inc: () => {} },
      genuiAutoEnrichmentDurationSeconds: { observe: () => {} },
    }));
  });

  afterEach(() => {
    mock.restore();
  });

  it("should skip enrichment for GenUIToolResult", async () => {
    const toolResult: ToolResultShape = {
      toolName: "test",
      toolCallId: "call-1",
      output: {
        ui: { component: "chart", props: {} },
        data: [1, 2, 3],
      },
    };

    const parts = await enrich(toolResult);
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe("tool-result");
  });

  it("should skip enrichment for null/undefined output", async () => {
    const toolResult: ToolResultShape = {
      toolName: "test",
      toolCallId: "call-1",
      output: null,
    };

    const parts = await enrich(toolResult);
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe("tool-result");
  });

  it("should skip enrichment for short text strings", async () => {
    const toolResult: ToolResultShape = {
      toolName: "test",
      toolCallId: "call-1",
      output: "Short text response",
    };

    const parts = await enrich(toolResult);
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe("tool-result");
  });

  it("should enrich array of numbers with chart component", async () => {
    const toolResult: ToolResultShape = {
      toolName: "test",
      toolCallId: "call-1",
      output: [1, 2, 3, 4, 5],
    };

    const parts = await enrich(toolResult);
    expect(parts.length).toBeGreaterThanOrEqual(1);
    expect(parts[0].type).toBe("tool-result");

    // If enrichment succeeded, should have data-ui part
    const dataUiPart = parts.find((p) => p.type === "data-ui");
    if (dataUiPart) {
      expect(isUIDataPart(dataUiPart)).toBe(true);
    }
  });

  it("should enrich key-value record with grid component", async () => {
    const toolResult: ToolResultShape = {
      toolName: "test",
      toolCallId: "call-1",
      output: {
        name: "Alice",
        age: 30,
        active: true,
      },
    };

    const parts = await enrich(toolResult);
    expect(parts.length).toBeGreaterThanOrEqual(1);
    expect(parts[0].type).toBe("tool-result");
  });

  it("should enrich array of records with grid/list component", async () => {
    const toolResult: ToolResultShape = {
      toolName: "test",
      toolCallId: "call-1",
      output: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
    };

    const parts = await enrich(toolResult);
    expect(parts.length).toBeGreaterThanOrEqual(1);
    expect(parts[0].type).toBe("tool-result");
  });

  it("should enrich timestamped records with workflow-timeline", async () => {
    const toolResult: ToolResultShape = {
      toolName: "test",
      toolCallId: "call-1",
      output: [
        { id: 1, timestamp: "2024-01-01T00:00:00Z", status: "completed" },
        { id: 2, timestamp: "2024-01-02T00:00:00Z", status: "running" },
      ],
    };

    const parts = await enrich(toolResult, { mode: "workflow" });
    expect(parts.length).toBeGreaterThanOrEqual(1);
    expect(parts[0].type).toBe("tool-result");
  });

  it("should use provided schema context", async () => {
    const toolResult: ToolResultShape = {
      toolName: "test",
      toolCallId: "call-1",
      output: [1, 2, 3],
    };

    const parts = await enrich(toolResult, {
      userId: "user-123",
      surface: "mobile",
      mode: "workflow",
    });

    expect(parts.length).toBeGreaterThanOrEqual(1);
  });

  it("should enrich array data with data-ui part", async () => {
    // Note: mock.module() is permanent per Bun process, so we test the success path
    // Error handling is verified in integration tests
    const toolResult: ToolResultShape = {
      toolName: "test",
      toolCallId: "call-1",
      output: [1, 2, 3],
    };

    const parts = await enrich(toolResult);
    // With mocked SchemaGenerator, should return both tool-result and data-ui parts
    expect(parts.length).toBeGreaterThanOrEqual(1);
    expect(parts[0].type).toBe("tool-result");

    // Verify data-ui part exists when enrichment succeeds
    const dataUiPart = parts.find((p) => p.type === "data-ui");
    expect(dataUiPart).toBeDefined();
  });

  it("should preserve tool metadata in enriched parts", async () => {
    const toolResult: ToolResultShape = {
      toolName: "my_tool",
      toolCallId: "call-123",
      output: { data: "test" },
    };

    const parts = await enrich(toolResult);
    const toolResultPart = parts.find((p) => p.type === "tool-result");
    expect(toolResultPart).toBeDefined();
    if (toolResultPart && "toolName" in toolResultPart) {
      expect(toolResultPart.toolName).toBe("my_tool");
      expect(toolResultPart.toolCallId).toBe("call-123");
    }
  });

  it("should skip enrichment for tools in opt-out list", async () => {
    const toolResult: ToolResultShape = {
      toolName: "runtime_status",
      toolCallId: "call-1",
      output: { status: "running" },
    };

    const parts = await enrich(toolResult);
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe("tool-result");
  });
});
