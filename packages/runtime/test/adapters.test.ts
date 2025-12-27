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

    const sdkEvent = { type: "text-delta", id: "text-1", delta: "hello" };

    const mapped = mapEvent(sdkEvent);

    expect(mapped).toMatchObject({
      _: "text-delta",
      id: "text-1",
      delta: "hello",
    });
  });

  it("maps tool-call events with input property", () => {
    const adapter = new AISDKAdapter();
    const mapEvent = (adapter as any).mapEvent.bind(adapter);

    const sdkEvent = {
      type: "tool-call",
      toolCallId: "call-1",
      toolName: "search",
      input: { query: "status" },
    };

    const mapped = mapEvent(sdkEvent);

    expect(mapped).toMatchObject({
      _: "tool-call",
      toolCallId: "call-1",
      toolName: "search",
      input: { query: "status" },
    });
  });

  it("maps tool-result events with input and output", () => {
    const adapter = new AISDKAdapter();
    const mapEvent = (adapter as any).mapEvent.bind(adapter);

    const sdkEvent = {
      type: "tool-result",
      toolCallId: "call-1",
      toolName: "search",
      input: { query: "status" },
      output: { ok: true },
    };

    const mapped = mapEvent(sdkEvent);

    expect(mapped).toMatchObject({
      _: "tool-result",
      toolCallId: "call-1",
      toolName: "search",
      input: { query: "status" },
      output: { ok: true },
    });
  });

  it("maps finish events", () => {
    const adapter = new AISDKAdapter();
    const mapEvent = (adapter as any).mapEvent.bind(adapter);

    const sdkEvent = {
      type: "finish",
      finishReason: "stop",
      usage: { promptTokens: 1, completionTokens: 2 },
    };

    const mapped = mapEvent(sdkEvent);

    expect(mapped).toMatchObject({
      _: "finish",
      finishReason: "stop",
      usage: { promptTokens: 1, completionTokens: 2 },
    });
  });

  it("maps error events safely", () => {
    const adapter = new AISDKAdapter();
    const mapEvent = (adapter as any).mapEvent.bind(adapter);

    const sdkEventWithError = { type: "error", error: new Error("boom") };

    const mapped = mapEvent(sdkEventWithError);

    expect(mapped).toMatchObject({ _: "error", message: "boom" });
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
    const event: WorkflowEvent = { _: "progress" };
    await expect(adapter.appendEvent("run-1", event)).resolves.toBeUndefined();
  });

  it("implements appendEventBatch", async () => {
    const events: WorkflowEvent[] = [
      { _: "progress" },
      { _: "notice", message: "ok" } as WorkflowEvent,
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
