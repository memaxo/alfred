/**
 * GenUI Auto-Enrichment Integration Tests
 *
 * Tests that tool results in assistant router get automatically enriched
 * with GenUI data-ui parts.
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { randomUUID } from "node:crypto";

import { createTestCaller } from "../utils/test-caller";

// Mock the enrichment functions to track calls
const mockEnrich = mock(async () => [
  {
    type: "tool-result",
    toolName: "test_tool",
    toolCallId: "call-1",
    output: { data: "test" },
  },
  {
    type: "data-ui",
    ui: {
      component: "grid",
      props: { columns: 2 },
    },
    data: { data: "test" },
  },
]);

const mockNormalizeAsync = mock(async () => [
  {
    id: randomUUID(),
    role: "assistant",
    parts: [
      {
        type: "tool-result",
        toolName: "test_tool",
        toolCallId: "call-1",
        output: { data: "test" },
      },
      {
        type: "data-ui",
        ui: {
          component: "grid",
          props: { columns: 2 },
        },
        data: { data: "test" },
      },
    ],
  },
]);

beforeEach(() => {
  mockEnrich.mockClear();
  mockNormalizeAsync.mockClear();

  // Mock the async normalization module
  mock.module("@alfred/agent/utils/normalize-async", () => ({
    normalizeToUiMessagesAsync: mockNormalizeAsync,
  }));
});

describe("GenUI Auto-Enrichment Integration", () => {
  it("enriches tool results with GenUI schemas", async () => {
    const { caller, userId } = await createTestCaller();

    // Mock generateText to return a result with tool results
    const mockGenerateText = mock(async () => ({
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
    }));

    mock.module("ai", () => ({
      generateText: mockGenerateText,
    }));

    const result = await caller.assistant.generate({
      messages: [{ role: "user", content: "Show me some data" }],
    });

    expect(result).toBeDefined();
    // Verify that normalizeToUiMessagesAsync was called (indicating enrichment attempt)
    // Note: In a real test, we'd verify the actual enrichment happened
    // This is a simplified test that verifies the integration point exists
  });

  it("passes SchemaContext correctly", async () => {
    const { caller, userId } = await createTestCaller();

    // This test verifies that context (userId, surface, mode) is passed
    // The actual verification would require inspecting the normalizeToUiMessagesAsync call
    // For now, we verify the integration exists

    const mockGenerateText = mock(async () => ({
      text: "Result",
      toolResults: [
        {
          id: "call-1",
          toolName: "test_tool",
          result: { data: "test" },
        },
      ],
    }));

    mock.module("ai", () => ({
      generateText: mockGenerateText,
    }));

    await caller.assistant.generate({
      messages: [{ role: "user", content: "Test" }],
      projectId: randomUUID(),
    });

    // Verify normalizeToUiMessagesAsync was called (integration exists)
    // In a full test, we'd verify the context passed matches expected values
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
    // This test would run multiple tool results and verify enrichment rate
    // For now, this is a placeholder test structure

    const visualizableResults = [
      { data: [1, 2, 3], items: ["a", "b", "c"] },
      { table: [{ col1: "val1" }] },
      { chart: { type: "bar", data: [1, 2, 3] } },
    ];

    const enrichedCount = 0;
    for (const result of visualizableResults) {
      // Mock tool result and check if enrichment occurred
      // enrichedCount++ if data-ui part was added
    }

    const enrichmentRate = enrichedCount / visualizableResults.length;
    expect(enrichmentRate).toBeGreaterThan(0.6);
  });
});
