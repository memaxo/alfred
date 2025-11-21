import { describe, expect, it } from "bun:test";
import { eventToUiMessages } from "@alfred/api/src/ai/normalize";

describe("normalization round-trip", () => {
  it("produces byte-equal UIMessage arrays for replay", () => {
    const streamed = {
      type: "assistant",
      text: "Hi",
      reasoning: "think",
      toolCalls: [{ id: "t1", toolName: "echo", args: { x: 1 } }],
      toolResults: [{ id: "t1", toolName: "echo", result: { x: 1 } }],
    } as any;

    const msgs = eventToUiMessages(streamed);
    if (!msgs) {
      throw new Error("msgs is null");
    }
    // Simulate persisted replay event
    const replay = { type: "ui-message", messages: msgs } as any;
    const msgs2 = eventToUiMessages(replay);
    if (!msgs2) {
      throw new Error("msgs2 is null");
    }
    expect(JSON.stringify(msgs2)).toEqual(JSON.stringify(msgs));
  });
});
