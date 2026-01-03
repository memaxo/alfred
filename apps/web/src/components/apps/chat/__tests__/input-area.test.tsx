import "@/test/dom";
import { describe, expect, it, vi } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { InputArea } from "../input-area";

describe("InputArea", () => {
  it("renders text input and buttons", () => {
    const { getByPlaceholderText, getAllByRole } = render(
      <InputArea
        isRecording={false}
        onSubmit={() => {}}
        onVoiceToggle={() => {}}
      />
    );

    expect(getByPlaceholderText("Type a message...")).toBeTruthy();
    // Buttons are icon-only, get by role and verify count
    const buttons = getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3); // attachment, voice, send
  });

  it("calls onSubmit when send button is clicked", () => {
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

    // Send button contains lucide-send SVG
    const buttons = container.querySelectorAll("button");
    const sendButton = Array.from(buttons).find((btn) =>
      btn.querySelector("svg.lucide-send")
    );
    if (sendButton) {
      fireEvent.click(sendButton);
    }

    expect(handleSubmit).toHaveBeenCalledWith("Test message");
  });

  it("calls onSubmit when Enter is pressed", () => {
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

    expect(handleSubmit).toHaveBeenCalledWith("Test message");
  });

  it("does not submit when Shift+Enter is pressed", () => {
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
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("clears input after submission", () => {
    const handleSubmit = vi.fn();
    const { getByPlaceholderText, getByRole } = render(
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
    fireEvent.click(getByRole("button", { name: /send/i }));

    expect(input.value).toBe("");
  });

  it("does not submit empty input", () => {
    const handleSubmit = vi.fn();
    const { container } = render(
      <InputArea
        isRecording={false}
        onSubmit={handleSubmit}
        onVoiceToggle={() => {}}
      />
    );

    const sendButton = container.querySelector("button:has(svg.lucide-send)");
    if (sendButton) {
      fireEvent.click(sendButton);
    }

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("does not submit whitespace-only input", () => {
    const handleSubmit = vi.fn();
    const { getByPlaceholderText, container } = render(
      <InputArea
        isRecording={false}
        onSubmit={handleSubmit}
        onVoiceToggle={() => {}}
      />
    );

    const input = getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "   " } });

    const sendButton = container.querySelector("button:has(svg.lucide-send)");
    if (sendButton) {
      fireEvent.click(sendButton);
    }

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("disables send button when input is empty", () => {
    const { container } = render(
      <InputArea
        isRecording={false}
        onSubmit={() => {}}
        onVoiceToggle={() => {}}
      />
    );

    const sendButton = container.querySelector(
      "button:has(svg.lucide-send)"
    ) as HTMLButtonElement;
    expect(sendButton?.disabled).toBe(true);
  });

  it("enables send button when input has content", () => {
    const { getByPlaceholderText, container } = render(
      <InputArea
        isRecording={false}
        onSubmit={() => {}}
        onVoiceToggle={() => {}}
      />
    );

    const input = getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "Test" } });

    const sendButton = container.querySelector(
      "button:has(svg.lucide-send)"
    ) as HTMLButtonElement;
    expect(sendButton?.disabled).toBe(false);
  });

  it("calls onVoiceToggle when voice button is clicked", () => {
    const handleVoiceToggle = vi.fn();
    const { container } = render(
      <InputArea
        isRecording={false}
        onSubmit={() => {}}
        onVoiceToggle={handleVoiceToggle}
      />
    );

    const buttons = container.querySelectorAll("button");
    const voiceButton = Array.from(buttons).find((btn) =>
      btn.querySelector("svg.lucide-mic")
    );
    if (voiceButton) {
      fireEvent.click(voiceButton);
    }

    expect(handleVoiceToggle).toHaveBeenCalled();
  });

  it("shows recording state in placeholder", () => {
    const { getByPlaceholderText } = render(
      <InputArea
        isRecording={true}
        onSubmit={() => {}}
        onVoiceToggle={() => {}}
      />
    );

    expect(getByPlaceholderText("Listening...")).toBeTruthy();
  });

  it("applies recording styling to voice button", () => {
    const { container } = render(
      <InputArea
        isRecording={true}
        onSubmit={() => {}}
        onVoiceToggle={() => {}}
      />
    );

    const buttons = container.querySelectorAll("button");
    const voiceButton = Array.from(buttons).find((btn) =>
      btn.querySelector("svg.lucide-mic")
    );
    expect(voiceButton?.className).toContain("bg-red-500/20");
  });

  it("displays error message when error prop is provided", () => {
    const error = new Error("Failed to send");
    const { getByText } = render(
      <InputArea
        error={error}
        isRecording={false}
        onSubmit={() => {}}
        onVoiceToggle={() => {}}
      />
    );

    expect(getByText("Failed to send")).toBeTruthy();
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

    const input = getByPlaceholderText("Type a message...");
    const sendButton = container.querySelector(
      "button:has(svg.lucide-send)"
    ) as HTMLButtonElement;
    const voiceButton = container.querySelector(
      "button:has(svg.lucide-mic)"
    ) as HTMLButtonElement;

    expect(input).toBeDisabled();
    expect(sendButton?.disabled).toBe(true);
    expect(voiceButton?.disabled).toBe(true);
  });

  describe("error cases", () => {
    it("handles very long input gracefully", () => {
      const handleSubmit = vi.fn();
      const { getByPlaceholderText, container } = render(
        <InputArea
          isRecording={false}
          onSubmit={handleSubmit}
          onVoiceToggle={() => {}}
        />
      );

      const longText = "a".repeat(10_000);
      const input = getByPlaceholderText("Type a message...");
      fireEvent.change(input, { target: { value: longText } });
      const sendButton = container.querySelector("button:has(svg.lucide-send)");
      if (sendButton) {
        fireEvent.click(sendButton);
      }

      expect(handleSubmit).toHaveBeenCalledWith(longText);
    });

    it("handles onSubmit throwing error gracefully", () => {
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

      // Should not crash
      const sendButton = container.querySelector("button:has(svg.lucide-send)");
      if (sendButton) {
        expect(() => fireEvent.click(sendButton)).not.toThrow();
      }
    });

    it("handles onVoiceToggle throwing error gracefully", () => {
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

      // Should not crash
      const buttons = container.querySelectorAll("button");
      const voiceButton = Array.from(buttons).find((btn) =>
        btn.querySelector("svg.lucide-mic")
      );
      if (voiceButton) {
        expect(() => fireEvent.click(voiceButton)).not.toThrow();
      }
    });
  });
});
