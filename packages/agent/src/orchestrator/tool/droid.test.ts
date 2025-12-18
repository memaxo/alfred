import { describe, expect, it } from "bun:test";

import { __internals } from "./droid";

const { appendReasoningTrace, extractDroidReasoning } = __internals;

describe("extractDroidReasoning", () => {
  it("extracts reasoning from assistant message with planning markers", () => {
    const chunk = {
      type: "message",
      role: "assistant",
      text: "I'll analyze the codebase structure first.",
    };
    expect(extractDroidReasoning(chunk)).toBe(
      "I'll analyze the codebase structure first."
    );
  });

  it("extracts reasoning from message with 'let me' marker", () => {
    const chunk = {
      type: "message",
      role: "assistant",
      text: "Let me check the file structure.",
    };
    expect(extractDroidReasoning(chunk)).toBe(
      "Let me check the file structure."
    );
  });

  it("extracts reasoning from message with 'analyzing' marker", () => {
    const chunk = {
      type: "message",
      role: "assistant",
      text: "Analyzing the dependencies.",
    };
    expect(extractDroidReasoning(chunk)).toBe("Analyzing the dependencies.");
  });

  it("extracts reasoning from completion event", () => {
    const chunk = {
      type: "completion",
      finalText: "Task completed successfully.",
    };
    expect(extractDroidReasoning(chunk)).toBe("Task completed successfully.");
  });

  it("returns null for user messages", () => {
    const chunk = {
      type: "message",
      role: "user",
      text: "I'll do something",
    };
    expect(extractDroidReasoning(chunk)).toBeNull();
  });

  it("returns null for assistant message without reasoning markers", () => {
    const chunk = {
      type: "message",
      role: "assistant",
      text: "The task is complete.",
    };
    expect(extractDroidReasoning(chunk)).toBeNull();
  });

  it("returns null for tool_call events", () => {
    const chunk = {
      type: "tool_call",
      toolName: "Execute",
      parameters: { command: "ls" },
    };
    expect(extractDroidReasoning(chunk)).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(extractDroidReasoning(null)).toBeNull();
    expect(extractDroidReasoning(undefined)).toBeNull();
    expect(extractDroidReasoning("string")).toBeNull();
  });
});

describe("appendReasoningTrace", () => {
  it("adds reasoning trace to accumulator", () => {
    const acc = {
      traces: [],
      storedBytes: 0,
      truncated: false,
    };
    const text = "I'll analyze the code.";
    const timestamp = 1_234_567_890;

    appendReasoningTrace(acc, text, timestamp);

    expect(acc.traces).toHaveLength(1);
    expect(acc.traces[0]).toEqual({ text, timestamp });
    expect(acc.storedBytes).toBeGreaterThan(0);
    expect(acc.truncated).toBe(false);
  });

  it("skips empty or whitespace-only text", () => {
    const acc = {
      traces: [],
      storedBytes: 0,
      truncated: false,
    };

    appendReasoningTrace(acc, "", 1_234_567_890);
    appendReasoningTrace(acc, "   ", 1_234_567_890);
    appendReasoningTrace(acc, "\n\t", 1_234_567_890);

    expect(acc.traces).toHaveLength(0);
    expect(acc.storedBytes).toBe(0);
  });

  it("truncates when exceeding OUTPUT_CAP_BYTES", () => {
    const acc = {
      traces: [],
      storedBytes: 0,
      truncated: false,
    };

    // Fill accumulator beyond 5MB limit
    const largeText = "x".repeat(6 * 1024 * 1024); // 6MB exceeds 5MB limit
    appendReasoningTrace(acc, largeText, 1_234_567_890);

    expect(acc.truncated).toBe(true);
    expect(acc.storedBytes).toBeLessThanOrEqual(6 * 1024 * 1024);
  });

  it("does not add traces after truncation", () => {
    const acc = {
      traces: [],
      storedBytes: 0,
      truncated: false,
    };

    // Fill to truncation
    const largeText = "x".repeat(6 * 1024 * 1024); // 6MB, exceeds limit
    appendReasoningTrace(acc, largeText, 1_234_567_890);

    const initialTraces = acc.traces.length;
    const initialBytes = acc.storedBytes;

    // Try to add more after truncation
    appendReasoningTrace(acc, "More reasoning", 1_234_567_891);

    expect(acc.traces).toHaveLength(initialTraces);
    expect(acc.storedBytes).toBeGreaterThan(initialBytes); // Still tracks bytes
  });

  it("handles multiple traces", () => {
    const acc = {
      traces: [],
      storedBytes: 0,
      truncated: false,
    };

    appendReasoningTrace(acc, "First reasoning", 1000);
    appendReasoningTrace(acc, "Second reasoning", 2000);
    appendReasoningTrace(acc, "Third reasoning", 3000);

    expect(acc.traces).toHaveLength(3);
    expect(acc.traces[0]?.timestamp).toBe(1000);
    expect(acc.traces[1]?.timestamp).toBe(2000);
    expect(acc.traces[2]?.timestamp).toBe(3000);
  });

  it("uses current timestamp when not provided", () => {
    const acc = {
      traces: [],
      storedBytes: 0,
      truncated: false,
    };
    const before = Date.now();

    appendReasoningTrace(acc, "Reasoning text");

    const after = Date.now();
    expect(acc.traces[0]?.timestamp).toBeGreaterThanOrEqual(before);
    expect(acc.traces[0]?.timestamp).toBeLessThanOrEqual(after);
  });
});
