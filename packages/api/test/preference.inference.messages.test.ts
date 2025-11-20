import { describe, expect, it, vi } from "bun:test";
import type { UIMessage } from "@alfred/type/stream";
import { validateConversationMessages } from "../src/scheduler/preference-inference";

describe("validateConversationMessages", () => {
  it("returns validated messages for well-formed history", async () => {
    const messages: UIMessage[] = [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      },
      {
        id: "msg-2",
        role: "assistant",
        parts: [{ type: "text", text: "Hi" }],
      },
    ];

    const logger = { warn: vi.fn() };
    const validated = await validateConversationMessages({
      messages,
      conversationId: "conv-valid",
      userId: "user-1",
      logger,
      tools: {},
    });

    expect(validated).not.toBeNull();
    expect(validated).toHaveLength(2);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("logs and returns null when validation fails", async () => {
    const messages = [
      {
        id: "msg-1",
        role: "malicious" as unknown as UIMessage["role"],
        parts: [],
      },
    ];
    const logger = { warn: vi.fn() };

    const validated = await validateConversationMessages({
      messages: messages as UIMessage[],
      conversationId: "conv-invalid",
      userId: "user-1",
      logger,
      tools: {},
    });

    expect(validated).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      "preference_inference_invalid_history",
      expect.objectContaining({
        conversationId: "conv-invalid",
        userId: "user-1",
      })
    );
  });
});
