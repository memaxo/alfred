import "@/test/dom";
import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it, mock, vi } from "bun:test";

const originalTestMode = import.meta.env.VITE_TEST_MODE;

mock.module("react-virtuoso", () => ({
  Virtuoso: ({
    data,
    itemContent,
  }: {
    data: unknown[];
    itemContent: Function;
  }) => (
    <div data-testid="virtuoso">
      {data.map((item, index) => {
        const key = (item as { id?: string }).id ?? String(index);
        return (
          <div key={key} data-testid={`item-${index}`}>
            {itemContent(index, item)}
          </div>
        );
      })}
    </div>
  ),
}));

mock.module("@/components/windows/shared", () => ({
  useLOD: () => "full",
  TinyDot: () => <div data-testid="tiny-dot" />,
  SmallCard: () => <div data-testid="small-card" />,
  WindowFrame: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="window-frame">{children}</div>
  ),
}));

mock.module("@/hooks/use-chat-logic", () => ({
  useChatLogic: () => ({
    messages: [
      { id: "m1", role: "user", parts: [{ type: "text", text: "Hello" }] },
      { id: "m2", role: "assistant", parts: [{ type: "text", text: "Hi" }] },
    ],
    actions: [],
    status: "ready",
    sendToChat: vi.fn(),
    toggleVoice: vi.fn(),
    isRecording: false,
    error: null,
    conversationId: "conv-1",
    handleEdit: vi.fn(),
    handleRegenerate: vi.fn(),
  }),
}));

mock.module("@/hooks/use-message-edit", () => ({
  useMessageEdit: () => ({
    editText: "",
    isEditing: () => false,
    setEditText: vi.fn(),
    startEditing: vi.fn(),
    cancelEditing: vi.fn(),
    saveEdit: vi.fn(),
  }),
}));

mock.module("@/hooks/use-offline-queue", () => ({
  useOfflineQueue: () => ({
    queueMessage: vi.fn(),
    pendingMessages: [],
    retryAll: () => [],
  }),
}));

mock.module("@/store/desktop", () => ({
  useDesktopStore: (selector: (s: { updateWindowData: unknown }) => unknown) =>
    selector({ updateWindowData: vi.fn() }),
}));

let ChatWindow: typeof import("../chat-window").ChatWindow;

describe("ChatWindow virtualization", () => {
  beforeAll(async () => {
    ({ ChatWindow } = await import("../chat-window"));
  });

  it("renders messages via Virtuoso", () => {
    (import.meta.env as any).VITE_TEST_MODE = "false";

    const { getByTestId, getByText } = render(
      <ChatWindow data={{ type: "chat" }} id="chat-1" selected={false} />
    );

    expect(getByTestId("virtuoso")).toBeTruthy();
    expect(getByText("Hello")).toBeTruthy();
    expect(getByText("Hi")).toBeTruthy();

    (import.meta.env as any).VITE_TEST_MODE = originalTestMode;
  });
});
