import { describe, expect, it } from "bun:test";
import {
  getToolInvocationName,
  getToolInvocationState,
  isToolInvocationPart,
} from "../src/chat/parts";

describe("chat parts: tool invocation", () => {
  it("detects tool-<name> invocation parts", () => {
    const part = {
      type: "tool-search",
      toolCallId: "call-1",
      state: "approval-requested",
      input: { query: "hi" },
      approval: { id: "approval-1" },
    };
    expect(isToolInvocationPart(part)).toBe(true);
    if (isToolInvocationPart(part)) {
      expect(getToolInvocationName(part)).toBe("search");
      expect(getToolInvocationState(part)).toBe("approval-requested");
    }
  });

  it("detects dynamic-tool invocation parts", () => {
    const part = {
      type: "dynamic-tool",
      toolName: "whatever",
      toolCallId: "call-1",
      input: { ok: true },
    };
    expect(isToolInvocationPart(part)).toBe(true);
    if (isToolInvocationPart(part)) {
      expect(getToolInvocationName(part)).toBe("whatever");
      expect(getToolInvocationState(part)).toBe("input-available");
    }
  });

  it("normalizes state using approval object when missing", () => {
    const part = {
      type: "tool-write",
      toolCallId: "call-1",
      input: { x: 1 },
      approval: { id: "approval-1" },
    };
    expect(isToolInvocationPart(part)).toBe(true);
    if (isToolInvocationPart(part)) {
      expect(getToolInvocationState(part)).toBe("approval-requested");
    }
  });

  it("prefers explicit state", () => {
    const part = {
      type: "tool-write",
      toolCallId: "call-1",
      state: "output-available",
      input: { x: 1 },
      output: { ok: true },
    };
    expect(isToolInvocationPart(part)).toBe(true);
    if (isToolInvocationPart(part)) {
      expect(getToolInvocationState(part)).toBe("output-available");
    }
  });

  it("maps errorText to output-error when state missing", () => {
    const part = {
      type: "tool-write",
      toolCallId: "call-1",
      input: { x: 1 },
      errorText: "boom",
    };
    expect(isToolInvocationPart(part)).toBe(true);
    if (isToolInvocationPart(part)) {
      expect(getToolInvocationState(part)).toBe("output-error");
    }
  });

  it("maps approval.denied to output-denied", () => {
    const part = {
      type: "tool-write",
      toolCallId: "call-1",
      input: { x: 1 },
      approval: { id: "approval-1", approved: false },
    };
    expect(isToolInvocationPart(part)).toBe(true);
    if (isToolInvocationPart(part)) {
      expect(getToolInvocationState(part)).toBe("output-denied");
    }
  });
});
