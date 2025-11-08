import "@/test/dom";
import { describe, expect, it } from "bun:test";
import type { UIMessage } from "@alfred/type/stream";
import { Chat } from "@alfred/ui";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { useEffect } from "react";

const StubVirtualList: React.ComponentType<{
  data: UIMessage[];
  itemContent: (index: number, message: UIMessage) => ReactNode;
  rangeChanged?: (range: { startIndex: number; endIndex: number }) => void;
}> = ({ data, itemContent, rangeChanged }) => {
  const startIndex = Math.max(data.length - 16, 0);
  const visible = data.slice(startIndex);
  useEffect(() => {
    rangeChanged?.({
      startIndex,
      endIndex: data.length > 0 ? data.length - 1 : 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startIndex, data.length]);
  return (
    <div data-testid="stub-virtual-list">
      {visible.map((message, idx) => (
        <div key={message.id ?? `message-${startIndex + idx}`}>
          {itemContent(startIndex + idx, message)}
        </div>
      ))}
    </div>
  );
};

describe("Chat", () => {
  const createMessages = (count: number): UIMessage[] =>
    Array.from({ length: count }, (_, index) => ({
      id: `msg-${index}`,
      role: index % 2 === 0 ? "user" : "assistant",
      parts: [
        {
          type: "text",
          text: `Message #${index}`,
        },
      ],
      metadata: { status: "sent" as const },
    }));

  it("renders empty state", () => {
    const { getByText } = render(
      <Chat messages={[]} onSend={() => {}} placeholder="Say hello" />
    );
    expect(getByText("No messages yet")).toBeTruthy();
  });

  it("renders non-virtualized message list", () => {
    const messages = createMessages(4);
    const { getByText } = render(
      <Chat messages={messages} onSend={() => {}} placeholder="Say hello" />
    );

    expect(getByText("Message #0")).toBeTruthy();
    expect(getByText("Message #3")).toBeTruthy();
  });

  it("supports virtualization with perf tracking", () => {
    if (typeof window !== "undefined") {
      window.__perf = {};
    }
    const messages = createMessages(200);

    const { getAllByText, getByText } = render(
      <Chat
        ListComponent={StubVirtualList}
        messages={messages}
        onSend={() => {}}
        perf
        placeholder="Say hello"
        virtualized
      />
    );

    // Ensure the last message is visible and an early message is not rendered
    expect(getByText("Message #199")).toBeTruthy();
    const early =
      document.querySelector('[data-testid="stub-virtual-list"]')
        ?.textContent ?? "";
    expect(early.includes("Message #10")).toBe(false);
    expect(window.__perf?.chat).toBeDefined();
  });

  it("renders message status metadata", () => {
    const messages: UIMessage[] = [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
        metadata: { status: "sending" },
      },
      {
        id: "msg-2",
        role: "assistant",
        parts: [{ type: "text", text: "Hi there" }],
        metadata: { status: "sent" },
      },
    ];

    const { getByText } = render(
      <Chat messages={messages} onSend={() => {}} placeholder="Say hello" />
    );
    expect(getByText(/sending/i)).toBeTruthy();
  });
});
