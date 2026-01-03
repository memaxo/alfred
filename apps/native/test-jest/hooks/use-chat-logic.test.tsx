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
    expect(result.current.currentAgent).toBe("alfred");
  });

  it("should update agent when setAgent is called", () => {
    const { result } = renderHook(() => useChatLogic());

    act(() => {
      result.current.setAgent("jarvis");
    });

    expect(result.current.currentAgent).toBe("jarvis");
  });

  it("should call handleSubmit when sendMessage is called", () => {
    const handleSubmit = jest.fn();
    (useChatAi as jest.Mock).mockReturnValue({
      messages: [],
      input: "",
      setInput: jest.fn(),
      handleSubmit,
      isLoading: false,
    });

    const { result } = renderHook(() => useChatLogic());

    act(() => {
      result.current.sendMessage();
    });

    expect(handleSubmit).toHaveBeenCalled();
  });
});
