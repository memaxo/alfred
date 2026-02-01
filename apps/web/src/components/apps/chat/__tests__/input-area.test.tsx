import "@/test/dom";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "bun:test";

// Import without mocks to use real components
const { InputArea } = await import("../input-area");

describe.skip("InputArea", () => {
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

    const input = getByPlaceholderText(
      "Type a message..."
    ) as HTMLTextAreaElement;

    // Type in the textarea
    await act(async () => {
      fireEvent.change(input, { target: { value: "Test message" } });
      await Promise.resolve();
    });

    // Wait for React to update the state
    await waitFor(() => expect(input.value).toBe("Test message"));

    const sendButton = [...container.querySelectorAll("button")].find((btn) =>
      btn.querySelector("svg.lucide-send")
    ) as HTMLButtonElement;

    expect(sendButton).toBeTruthy();
    expect(sendButton.disabled).toBe(false);

    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(sendButton);
      vi.runAllTimers();
      await Promise.resolve();
    });

    expect(handleSubmit).toHaveBeenCalledWith("Test message");
    vi.useRealTimers();
  });

  it("calls onSubmit when Enter is pressed", async () => {
    vi.useFakeTimers();
    const handleSubmit = vi.fn();
    const { getByPlaceholderText } = render(
      <InputArea
        isRecording={false}
        onSubmit={handleSubmit}
        onVoiceToggle={() => {}}
      />
    );

    const input = getByPlaceholderText(
      "Type a message..."
    ) as HTMLTextAreaElement;

    await act(async () => {
      fireEvent.change(input, { target: { value: "Test message" } });
      await Promise.resolve();
    });

    await waitFor(() => expect(input.value).toBe("Test message"));

    act(() => {
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    });

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

    await act(async () => {
      fireEvent.change(input, { target: { value: "Test message" } });
      await Promise.resolve();
    });

    await waitFor(() => expect(input.value).toBe("Test message"));

    const sendButton = [...container.querySelectorAll("button")].find((btn) =>
      btn.querySelector("svg.lucide-send")
    ) as HTMLButtonElement;

    expect(sendButton.disabled).toBe(false);

    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(sendButton);
      vi.runAllTimers();
      await Promise.resolve();
    });

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

    const input = getByPlaceholderText(
      "Type a message..."
    ) as HTMLTextAreaElement;
    const sendButton = [...container.querySelectorAll("button")].find((btn) =>
      btn.querySelector("svg.lucide-send")
    ) as HTMLButtonElement;

    // Initially disabled (empty input)
    expect(sendButton.disabled).toBe(true);

    await act(async () => {
      fireEvent.change(input, { target: { value: "Test" } });
      await Promise.resolve();
    });

    await waitFor(() => expect(input.value).toBe("Test"));

    // Now enabled
    expect(sendButton.disabled).toBe(false);
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
    const sendButton = [...container.querySelectorAll("button")].find((btn) =>
      btn.querySelector("svg.lucide-send")
    ) as HTMLButtonElement;
    const voiceButton = [...container.querySelectorAll("button")].find((btn) =>
      btn.querySelector("svg.lucide-mic")
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

      const input = getByPlaceholderText(
        "Type a message..."
      ) as HTMLTextAreaElement;

      await act(async () => {
        fireEvent.change(input, { target: { value: "Test" } });
        await Promise.resolve();
      });

      await waitFor(() => expect(input.value).toBe("Test"));

      const sendButton = [...container.querySelectorAll("button")].find((btn) =>
        btn.querySelector("svg.lucide-send")
      ) as HTMLButtonElement;

      expect(sendButton.disabled).toBe(false);

      vi.useFakeTimers();
      expect(() => {
        act(() => {
          fireEvent.click(sendButton);
        });
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

      const voiceButton = [...container.querySelectorAll("button")].find(
        (btn) => btn.querySelector("svg.lucide-mic")
      ) as HTMLButtonElement;

      expect(() => {
        act(() => {
          fireEvent.click(voiceButton);
        });
        vi.runAllTimers();
      }).not.toThrow();
      vi.useRealTimers();
    });
  });
});
