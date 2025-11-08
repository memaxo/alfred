import "@/test/dom";
import type { ReactNode } from "react";
import type { UIMessage } from "@alfred/type/stream";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "bun:test";
import { Chat } from "@alfred/ui";

const StubVirtualList: React.ComponentType<{
  data: UIMessage[];
  itemContent: (index: number, message: UIMessage) => ReactNode;
  rangeChanged?: (range: { startIndex: number; endIndex: number }) => void;
}> = ({ data, itemContent, rangeChanged }) => {
  const startIndex = Math.max(data.length - 16, 0);
  const visible = data.slice(startIndex);
  rangeChanged?.({
    startIndex,
    endIndex: data.length > 0 ? data.length - 1 : 0,
  });
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
    render(<Chat messages={[]} onSend={() => {}} placeholder="Say hello" />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  it("renders non-virtualized message list", () => {
    const messages = createMessages(4);
    render(<Chat messages={messages} onSend={() => {}} placeholder="Say hello" />);

    expect(screen.getByText("Message #0")).toBeInTheDocument();
    expect(screen.getByText("Message #3")).toBeInTheDocument();
  });

  it("supports virtualization with perf tracking", () => {
    if (typeof window !== "undefined") {
      window.__perf = {};
    }
    const messages = createMessages(200);

    render(
      <Chat
        messages={messages}
        onSend={() => {}}
        placeholder="Say hello"
        virtualized
        perf
        ListComponent={StubVirtualList}
      />,
    );

    const visibleMessages = screen.getAllByText(/Message #\d+/);
    expect(visibleMessages.length).toBeLessThanOrEqual(16);
    expect(screen.getByText("Message #199")).toBeInTheDocument();
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

    render(<Chat messages={messages} onSend={() => {}} placeholder="Say hello" />);
    expect(screen.getByText(/sending/i)).toBeInTheDocument();
  });
});
