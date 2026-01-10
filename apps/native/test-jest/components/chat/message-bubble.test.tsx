import { MessageBubble } from "@/components/chat/message-bubble";
import { createMockMessage } from "../../utils/mock-factories";
import { renderWithProviders } from "../../utils/test-helpers";

describe("MessageBubble", () => {
  it("should render user message correctly", () => {
    const message = createMockMessage({ role: "user", content: "Hello" });
    const { getByText } = renderWithProviders(
      <MessageBubble message={message} />
    );
    expect(getByText("Hello")).toBeTruthy();
  });

  it("should render assistant message correctly", () => {
    const message = createMockMessage({
      role: "assistant",
      content: "Hi there",
    });
    const { getByText } = renderWithProviders(
      <MessageBubble message={message} />
    );
    expect(getByText("Hi there")).toBeTruthy();
  });

  it("should render markdown content", () => {
    const message = createMockMessage({
      role: "assistant",
      content: "**Bold Text**",
    });
    const { getByText } = renderWithProviders(
      <MessageBubble message={message} />
    );
    expect(getByText("**Bold Text**")).toBeTruthy();
  });

  it("should render text content", () => {
    const message = createMockMessage({
      role: "assistant",
      content: "**Bold Text**",
    });
    const { getByText } = renderWithProviders(
      <MessageBubble message={message} />
    );
    expect(getByText("**Bold Text**")).toBeTruthy();
  });
});
