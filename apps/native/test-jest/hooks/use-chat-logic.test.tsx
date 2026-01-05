import { act, renderHook } from "@testing-library/react-native";
import { useChatLogic } from "@/hooks/use-chat-logic";

// Mock analytics
jest.mock("@/lib/analytics", () => ({
  trackEvent: jest.fn(),
}));

// Mock useChat from ai-sdk
jest.mock("@ai-sdk/react", () => ({
  useChat: jest.fn(() => ({
    messages: [],
    input: "",
    setInput: jest.fn(),
    handleSubmit: jest.fn(),
    isLoading: false,
    error: undefined,
  })),
}));

import { useChat as useChatAi } from "@ai-sdk/react";

describe("useChatLogic", () => {
  it("should initialize with default values", () => {
    const { result } = renderHook(() => useChatLogic());

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.currentAgent).toBe("assistant");
  });

  it("should update agent when setAgent is called", () => {
    const { result } = renderHook(() => useChatLogic());

    act(() => {
      result.current.setAgent("orchestrator");
    });

    expect(result.current.currentAgent).toBe("orchestrator");
  });

  it("should call handleSend when sendMessage is called", () => {
    const sendMessage = jest.fn();
    (useChatAi as jest.Mock).mockReturnValue({
      messages: [],
      sendMessage,
      status: "idle",
      error: null,
      stop: jest.fn(),
      regenerate: jest.fn(),
      setMessages: jest.fn(),
    });

    const { result } = renderHook(() => useChatLogic());

    act(() => {
      result.current.handleSend("test message");
    });

    expect(sendMessage).toHaveBeenCalledWith({ text: "test message" });
  });
});
