/**
 * Adapter Integration Tests
 *
 * Tests for AI SDK adapter and Storage adapter
 */

import { describe, expect, it } from "bun:test";
import type { WorkflowEvent } from "@alfred/type/plan";
import { AISDKAdapter } from "../src/adapters/ai";
import { NoOpStorageAdapter } from "../src/adapters/storage";

describe("AISDKAdapter", () => {
  it("maps text-delta events with correct property names", () => {
    const adapter = new AISDKAdapter();

    // Access private mapEvent method for testing
    const mapEvent = (adapter as any).mapEvent.bind(adapter);

    const sdkEvent = {
      type: "text-delta",
      id: "text-1",
      delta: "Hello",
    };

    const mapped = mapEvent(sdkEvent);

    expect(mapped).toMatchObject({
      type: "text-delta",
      id: "text-1",
      delta: "Hello",
    });
  });

  it("maps tool-call events with input property", () => {
    const adapter = new AISDKAdapter();
    const mapEvent = (adapter as any).mapEvent.bind(adapter);

    const sdkEvent = {
      type: "tool-call",
      toolCallId: "tc-1",
      toolName: "grep",
      input: { pattern: "test" },
    };

    const mapped = mapEvent(sdkEvent);

    expect(mapped).toMatchObject({
      type: "tool-call",
      toolCallId: "tc-1",
      toolName: "grep",
      input: { pattern: "test" },
    });
  });

  it("maps tool-result events with input and output", () => {
    const adapter = new AISDKAdapter();
    const mapEvent = (adapter as any).mapEvent.bind(adapter);

    const sdkEvent = {
      type: "tool-result",
      toolCallId: "tc-1",
      toolName: "grep",
      input: { pattern: "test" },
      output: { matches: ["test.ts"] },
    };

    const mapped = mapEvent(sdkEvent);

    expect(mapped).toMatchObject({
      type: "tool-result",
      toolCallId: "tc-1",
      toolName: "grep",
      input: { pattern: "test" },
      output: { matches: ["test.ts"] },
    });
  });

  it("maps finish events", () => {
    const adapter = new AISDKAdapter();
    const mapEvent = (adapter as any).mapEvent.bind(adapter);

    const sdkEvent = {
      type: "finish",
      finishReason: "stop",
      usage: { totalTokens: 100 },
    };

    const mapped = mapEvent(sdkEvent);

    expect(mapped).toMatchObject({
      type: "finish",
      finishReason: "stop",
      usage: { totalTokens: 100 },
    });
  });

  it("maps error events safely", () => {
    const adapter = new AISDKAdapter();
    const mapEvent = (adapter as any).mapEvent.bind(adapter);

    const sdkEventWithError = {
      type: "error",
      error: new Error("Test error"),
    };

    const mapped = mapEvent(sdkEventWithError);

    expect(mapped).toMatchObject({
      type: "error",
      message: "Test error",
    });
  });

  it("forwards additional event types", () => {
    const adapter = new AISDKAdapter();
    const mapEvent = (adapter as any).mapEvent.bind(adapter);

    const sdkEvent = {
      type: "text-start",
      id: "text-1",
    };

    const mapped = mapEvent(sdkEvent);

    expect(mapped).toMatchObject({
      type: "text-start",
      id: "text-1",
    });
  });

  it("returns null for unknown event types", () => {
    const adapter = new AISDKAdapter();
    const mapEvent = (adapter as any).mapEvent.bind(adapter);

    const sdkEvent = {
      type: "unknown-event-type",
      data: "test",
    };

    const mapped = mapEvent(sdkEvent);

    expect(mapped).toBeNull();
  });
});

describe("NoOpStorageAdapter", () => {
  const adapter = new NoOpStorageAdapter();

  it("implements appendEvent", async () => {
    const event: WorkflowEvent = { type: "progress", pct: 50, message: "test" };
    await expect(adapter.appendEvent("run-1", event)).resolves.toBeUndefined();
  });

  it("implements appendEventBatch", async () => {
    const events: WorkflowEvent[] = [
      { type: "progress", pct: 50, message: "test" },
      { type: "notice", message: "test" } as WorkflowEvent,
    ];
    await expect(
      adapter.appendEventBatch("run-1", events)
    ).resolves.toBeUndefined();
  });

  it("implements updateStatus", async () => {
    await expect(
      adapter.updateStatus("run-1", "completed")
    ).resolves.toBeUndefined();
  });
});
