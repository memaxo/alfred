import { fireEvent } from "@testing-library/react-native";
import { ChatInput } from "@/components/chat/chat-input";
import { renderWithProviders } from "../../utils/test-helpers";

describe("ChatInput", () => {
  it("should render correctly", () => {
    const { getByPlaceholderText } = renderWithProviders(
      <ChatInput onSend={jest.fn()} />
    );
    expect(getByPlaceholderText("Ask Alfred...")).toBeTruthy();
  });

  it("should call onSend when send button is pressed", () => {
    const onSend = jest.fn();
    const { getByPlaceholderText, getByLabelText } = renderWithProviders(
      <ChatInput onSend={onSend} />
    );

    const input = getByPlaceholderText("Ask Alfred...");
    const sendButton = getByLabelText("Send message");

    fireEvent.changeText(input, "Hello world");
    fireEvent.press(sendButton);

    expect(onSend).toHaveBeenCalledWith("Hello world");
  });

  it("should disable send button when input is empty", () => {
    const { getByLabelText } = renderWithProviders(
      <ChatInput onSend={jest.fn()} />
    );
    const sendButton = getByLabelText("Send message");

    expect(sendButton.props.accessibilityState.disabled).toBe(true);
  });
});
