import "@/test/dom";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, mock, vi } from "bun:test";

// Mocking UI components often fixes complex JSDOM/React-DOM interaction issues in Bun
mock.module("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, className }: any) => (
    <button className={className} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

mock.module("@/components/ui/textarea", () => ({
  Textarea: ({
    value,
    onChange,
    onKeyDown,
    placeholder,
    disabled,
    className,
  }: any) => (
    <textarea
      className={className}
      disabled={disabled}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      value={value}
    />
  ),
}));

// Import after mocks
const { InputArea } = await import("../input-area");

describe("InputArea", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    try {
      vi.useRealTimers();
    } catch {
      // ignore
    }
  });

  it("renders text input and buttons", () => {
    const { getByPlaceholderText, getAllByRole } = render(
      <InputArea
        isRecording={false}
        onSubmit={() => {}}
        onVoiceToggle={() => {}}
      />
    );

    expect(getByPlaceholderText("Type a message...")).toBeTruthy();
    expect(getAllByRole("button").length).toBeGreaterThanOrEqual(3);
  });

  it("calls onSubmit when send button is clicked", async () => {
    const handleSubmit = vi.fn();
    const { getByPlaceholderText, container } = render(
      <InputArea
        isRecording={false}
        onSubmit={handleSubmit}
        onVoiceToggle={() => {}}
      />
    );

    const input = getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "Test message" } });

    const sendButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.querySelector("svg.lucide-send")
    ) as HTMLButtonElement;

    expect(sendButton).toBeTruthy();

    // In our simplified mock, state update might be sync or handled by RTL
    await waitFor(() => expect(sendButton.disabled).toBe(false));

    vi.useFakeTimers();
    fireEvent.click(sendButton);

    // Deferral in component means we need to run timers
    vi.runAllTimers();

    expect(handleSubmit).toHaveBeenCalledWith("Test message");
    vi.useRealTimers();
  });

  it("calls onSubmit when Enter is pressed", () => {
    vi.useFakeTimers();
    const handleSubmit = vi.fn();
    const { getByPlaceholderText } = render(
      <InputArea
        isRecording={false}
        onSubmit={handleSubmit}
        onVoiceToggle={() => {}}
      />
    );

    const input = getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "Test message" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    vi.runAllTimers();

    expect(handleSubmit).toHaveBeenCalledWith("Test message");
    vi.useRealTimers();
  });

  it("clears input after submission", async () => {
    const handleSubmit = vi.fn();
    const { getByPlaceholderText, container } = render(
      <InputArea
        isRecording={false}
        onSubmit={handleSubmit}
        onVoiceToggle={() => {}}
      />
    );

    const input = getByPlaceholderText(
      "Type a message..."
    ) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "Test message" } });

    const sendButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.querySelector("svg.lucide-send")
    ) as HTMLButtonElement;

    await waitFor(() => expect(sendButton.disabled).toBe(false));
    vi.useFakeTimers();
    fireEvent.click(sendButton);

    vi.runAllTimers();

    expect(input.value).toBe("");
    vi.useRealTimers();
  });

  it("enables send button when input has content", async () => {
    const { getByPlaceholderText, container } = render(
      <InputArea
        isRecording={false}
        onSubmit={() => {}}
        onVoiceToggle={() => {}}
      />
    );

    const input = getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "Test" } });

    const sendButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.querySelector("svg.lucide-send")
    ) as HTMLButtonElement;

    await waitFor(() => expect(sendButton.disabled).toBe(false));
  });

  it("disables all inputs when disabled prop is true", () => {
    const { getByPlaceholderText, container } = render(
      <InputArea
        disabled
        isRecording={false}
        onSubmit={() => {}}
        onVoiceToggle={() => {}}
      />
    );

    const input = getByPlaceholderText(
      "Type a message..."
    ) as HTMLTextAreaElement;
    const sendButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.querySelector("svg.lucide-send")
    ) as HTMLButtonElement;
    const voiceButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.querySelector("svg.lucide-mic")
    ) as HTMLButtonElement;

    expect(input.disabled).toBe(true);
    expect(sendButton.disabled).toBe(true);
    expect(voiceButton.disabled).toBe(true);
  });

  describe("error cases", () => {
    it("handles onSubmit throwing error gracefully", async () => {
      const handleSubmit = vi.fn(() => {
        throw new Error("Submit failed");
      });
      const { getByPlaceholderText, container } = render(
        <InputArea
          isRecording={false}
          onSubmit={handleSubmit}
          onVoiceToggle={() => {}}
        />
      );

      const input = getByPlaceholderText("Type a message...");
      fireEvent.change(input, { target: { value: "Test" } });

      const sendButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.querySelector("svg.lucide-send")
      ) as HTMLButtonElement;

      await waitFor(() => expect(sendButton.disabled).toBe(false));

      vi.useFakeTimers();
      expect(() => {
        fireEvent.click(sendButton);
        vi.runAllTimers();
      }).not.toThrow();
      vi.useRealTimers();
    });

    it("handles onVoiceToggle throwing error gracefully", () => {
      vi.useFakeTimers();
      const handleVoiceToggle = vi.fn(() => {
        throw new Error("Voice toggle failed");
      });
      const { container } = render(
        <InputArea
          isRecording={false}
          onSubmit={() => {}}
          onVoiceToggle={handleVoiceToggle}
        />
      );

      const voiceButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.querySelector("svg.lucide-mic")
      ) as HTMLButtonElement;

      expect(() => {
        fireEvent.click(voiceButton);
        vi.runAllTimers();
      }).not.toThrow();
      vi.useRealTimers();
    });
  });
});
