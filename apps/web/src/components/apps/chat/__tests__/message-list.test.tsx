import "@/test/dom";
import type { AssistantUIMessage } from "@alfred/agent";

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "bun:test";

import { MessageList } from "../message-list";

describe("MessageList", () => {
  const createMessage = (
    overrides?: Partial<AssistantUIMessage>
  ): AssistantUIMessage => ({
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role: "user",
    parts: [{ type: "text", text: "Test message" }],
    metadata: { status: "sent" },
    ...overrides,
  });

  it("renders empty state when no messages", () => {
    const { getByText } = render(
      <MessageList
        messages={[]}
        onEdit={() => {}}
        onRegenerate={() => {}}
        status="idle"
      />
    );

    expect(getByText("Start a conversation")).toBeTruthy();
    expect(getByText("Type a message or use voice input")).toBeTruthy();
  });

  it("renders messages without crashing", () => {
    const messages = [
      createMessage({ id: "msg-1", parts: [{ type: "text", text: "Hello" }] }),
      createMessage({
        id: "msg-2",
        role: "assistant",
        parts: [{ type: "text", text: "Hi there" }],
      }),
    ];

    expect(() =>
      render(
        <MessageList
          messages={messages}
          onEdit={() => {}}
          onRegenerate={() => {}}
          status="idle"
        />
      )
    ).not.toThrow();
  });

  it("shows streaming indicator when status is streaming", () => {
    const messages = [createMessage()];

    const { getByText } = render(
      <MessageList
        messages={messages}
        onEdit={() => {}}
        onRegenerate={() => {}}
        status="streaming"
      />
    );

    expect(getByText("Thinking...")).toBeTruthy();
  });

  it("does not show streaming indicator when status is idle", () => {
    const messages = [createMessage()];

    const { queryByText } = render(
      <MessageList
        messages={messages}
        onEdit={() => {}}
        onRegenerate={() => {}}
        status="idle"
      />
    );

    expect(queryByText("Thinking...")).toBeNull();
  });

  it("renders user message with edit button without crashing", () => {
    const handleEdit = vi.fn();
    const messages = [createMessage({ id: "msg-1", role: "user" })];

    expect(() =>
      render(
        <MessageList
          messages={messages}
          onEdit={handleEdit}
          onRegenerate={() => {}}
          status="idle"
        />
      )
    ).not.toThrow();
  });

  it("renders assistant message with regenerate button without crashing", () => {
    const handleRegenerate = vi.fn();
    const messages = [
      createMessage({ id: "msg-1", role: "user" }),
      createMessage({
        id: "msg-2",
        role: "assistant",
        parts: [{ type: "text", text: "Response" }],
      }),
    ];

    expect(() =>
      render(
        <MessageList
          messages={messages}
          onEdit={() => {}}
          onRegenerate={handleRegenerate}
          status="idle"
        />
      )
    ).not.toThrow();
  });

  it("renders multiple messages in order without crashing", () => {
    const messages = [
      createMessage({
        id: "msg-1",
        parts: [{ type: "text", text: "First" }],
      }),
      createMessage({
        id: "msg-2",
        parts: [{ type: "text", text: "Second" }],
      }),
      createMessage({
        id: "msg-3",
        parts: [{ type: "text", text: "Third" }],
      }),
    ];

    expect(() =>
      render(
        <MessageList
          messages={messages}
          onEdit={() => {}}
          onRegenerate={() => {}}
          status="idle"
        />
      )
    ).not.toThrow();
  });

  describe("error cases", () => {
    it("handles messages with missing id gracefully", () => {
      const messages = [createMessage({ id: undefined as unknown as string })];

      expect(() =>
        render(
          <MessageList
            messages={messages}
            onEdit={() => {}}
            onRegenerate={() => {}}
            status="idle"
          />
        )
      ).not.toThrow();
    });

    it("handles messages with empty parts array", () => {
      const messages = [createMessage({ parts: [] })];

      const { queryByText } = render(
        <MessageList
          messages={messages}
          onEdit={() => {}}
          onRegenerate={() => {}}
          status="idle"
        />
      );

      // Should render without crashing
      expect(queryByText("Start a conversation")).toBeNull();
    });

    it("handles very long message list", () => {
      const messages = Array.from({ length: 1000 }, (_, i) =>
        createMessage({
          id: `msg-${i}`,
          parts: [{ type: "text", text: `Message ${i}` }],
        })
      );

      expect(() =>
        render(
          <MessageList
            messages={messages}
            onEdit={() => {}}
            onRegenerate={() => {}}
            status="idle"
          />
        )
      ).not.toThrow();
    });

    it("handles onEdit throwing error gracefully", () => {
      const handleEdit = vi.fn(() => {
        throw new Error("Edit failed");
      });
      const messages = [createMessage({ id: "msg-1", role: "user" })];

      // Should not crash during render
      expect(() =>
        render(
          <MessageList
            messages={messages}
            onEdit={handleEdit}
            onRegenerate={() => {}}
            status="idle"
          />
        )
      ).not.toThrow();
    });

    it("handles onRegenerate throwing error gracefully", () => {
      const handleRegenerate = vi.fn(() => {
        throw new Error("Regenerate failed");
      });
      const messages = [
        createMessage({
          id: "msg-1",
          role: "assistant",
          parts: [{ type: "text", text: "Response" }],
        }),
      ];

      // Should not crash during render
      expect(() =>
        render(
          <MessageList
            messages={messages}
            onEdit={() => {}}
            onRegenerate={handleRegenerate}
            status="idle"
          />
        )
      ).not.toThrow();
    });
  });
});
