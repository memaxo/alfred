import { describe, expect, it } from "bun:test";
import { isModelMessage, isModelMessageArray, isUIMessage, isUIMessageArray } from "../src/guards";

describe("stream guards", () => {
  it("identifies valid UI messages", () => {
    const message = {
      id: "msg-1",
      role: "assistant",
      parts: [{ type: "text", text: "hello" }],
      metadata: { status: "sent" },
    };
    expect(isUIMessage(message)).toBe(true);
    expect(isUIMessageArray([message])).toBe(true);
  });

  it("rejects invalid UI messages", () => {
    expect(isUIMessage(null)).toBe(false);
    expect(isUIMessage({})).toBe(false);
    expect(
      isUIMessage({
        id: "msg",
        role: "assistant",
        parts: "not-an-array",
      }),
    ).toBe(false);
  });

  it("identifies valid model messages", () => {
    const systemMessage = { role: "system", content: "stay helpful" };
    const assistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "hello" }],
    };
    expect(isModelMessage(systemMessage)).toBe(true);
    expect(isModelMessage(assistantMessage)).toBe(true);
    expect(isModelMessageArray([systemMessage, assistantMessage])).toBe(true);
  });

  it("rejects invalid model messages", () => {
    expect(isModelMessage({ role: "unknown", content: "hi" })).toBe(false);
    expect(
      isModelMessage({
        role: "assistant",
        content: 42,
      }),
    ).toBe(false);
  });
});
