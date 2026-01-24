import { describe, expect, it } from "bun:test";

import { parseThreadEvent, threadEventSchema } from "./events";

describe("parseThreadEvent", () => {
  it("parses thread.started events", () => {
    const event = { type: "thread.started", thread_id: "test-123" };
    const result = parseThreadEvent(event);
    expect(result).toEqual(event);
  });

  it("parses turn.started events", () => {
    const event = { type: "turn.started" };
    const result = parseThreadEvent(event);
    expect(result).toEqual(event);
  });

  it("parses turn.completed events with usage", () => {
    const event = {
      type: "turn.completed",
      usage: {
        input_tokens: 100,
        cached_input_tokens: 50,
        output_tokens: 200,
      },
    };
    const result = parseThreadEvent(event);
    expect(result).toEqual(event);
  });

  it("parses turn.failed events", () => {
    const event = {
      type: "turn.failed",
      error: { message: "Something went wrong" },
    };
    const result = parseThreadEvent(event);
    expect(result).toEqual(event);
  });

  it("parses item.completed events with reasoning item", () => {
    const event = {
      type: "item.completed",
      item: {
        id: "item-1",
        type: "reasoning",
        text: "Thinking about the problem...",
      },
    };
    const result = parseThreadEvent(event);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("item.completed");
  });

  it("parses item.completed events with agent_message item", () => {
    const event = {
      type: "item.completed",
      item: {
        id: "item-2",
        type: "agent_message",
        text: "Here is my response",
      },
    };
    const result = parseThreadEvent(event);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("item.completed");
  });

  it("parses error events", () => {
    const event = { type: "error", message: "boom" };
    const result = parseThreadEvent(event);
    expect(result).toEqual(event);
  });

  it("unwraps wrapped event payloads", () => {
    const wrapped = {
      event: { type: "turn.started" },
    };
    const result = parseThreadEvent(wrapped);
    expect(result).toEqual({ type: "turn.started" });
  });

  it("returns null for invalid events", () => {
    const invalid = { type: "unknown_event" };
    const result = parseThreadEvent(invalid);
    expect(result).toBeNull();
  });

  it("returns null for null input", () => {
    const result = parseThreadEvent(null);
    expect(result).toBeNull();
  });

  it("calls onWarning for invalid events", () => {
    const warnings: Array<{
      message: string;
      context: Record<string, unknown>;
    }> = [];
    const invalid = { type: "bad_event", foo: "bar" };

    parseThreadEvent(invalid, {
      onWarning: (message, context) => {
        warnings.push({ message, context });
      },
    });

    expect(warnings.length).toBe(1);
    expect(warnings[0].message).toBe("invalid_thread_event");
  });
});

describe("threadEventSchema", () => {
  it("accepts passthrough fields", () => {
    const event = {
      type: "turn.started",
      extra_field: "should be preserved",
    };
    const result = threadEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).extra_field).toBe(
        "should be preserved"
      );
    }
  });
});
