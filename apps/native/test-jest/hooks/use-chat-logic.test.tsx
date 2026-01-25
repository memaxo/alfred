import { act, renderHook } from "@testing-library/react-native";

jest.mock<typeof import("@ai-sdk/react")>(
  "@ai-sdk/react",
  () =>
    ({
      Chat: () => null,
      experimental_useObject: jest.fn(),
      useChat: jest.fn(),
      useCompletion: jest.fn(),
    }) as unknown as typeof import("@ai-sdk/react")
);
jest.mock<typeof import("@/lib/voice/session")>("@/lib/voice/session", () => ({
  useVoiceSessionNative: jest.fn(),
}));

jest.mock<typeof import("@/lib/auth-client")>(
  "@/lib/auth-client",
  () =>
    ({
      useAuthClient: () => ({
        useSession: () => ({ data: null }),
        getCookie: () => "",
        deleteUser: { callback: jest.fn() },
      }),
    }) as unknown as typeof import("@/lib/auth-client")
);

jest.mock<typeof import("@/lib/api")>(
  "@/lib/api",
  () =>
    ({
      ApiProvider: () => null,
      useApiContext: () => {
        throw new Error("useApiContext_unexpected_in_test");
      },
      useAuthClient: () => ({
        useSession: () => ({ data: null }),
        getCookie: () => "",
        deleteUser: { callback: jest.fn() },
      }),
      useServerUrl: () => ({ serverUrl: "https://example.com" }),
      useTrpcClient: () => ({}),
    }) as unknown as typeof import("@/lib/api")
);

const { useChat: useChatAi } = require("@ai-sdk/react") as {
  useChat: jest.Mock;
};
const { useVoiceSessionNative } = require("@/lib/voice/session") as {
  useVoiceSessionNative: jest.Mock;
};

import type { useChatLogic as UseChatLogic } from "@/hooks/use-chat-logic";

const { useChatLogic } = require("@/hooks/use-chat-logic") as {
  useChatLogic: typeof UseChatLogic;
};

interface VoiceStreamMock {
  status:
    | "idle"
    | "connecting"
    | "recording"
    | "processing"
    | "playing"
    | "error";
  transcript: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

describe("useChatLogic", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const stream: VoiceStreamMock = {
      status: "idle",
      transcript: "",
      start: async () => {},
      stop: async () => {},
    };

    useVoiceSessionNative.mockReturnValue({ stream });
    useChatAi.mockReturnValue({
      messages: [],
      sendMessage: jest.fn(),
      status: "idle",
      error: null,
      stop: jest.fn(),
      regenerate: jest.fn(),
      setMessages: jest.fn(),
    });
  });

  it("should initialize with default values", () => {
    const { result } = renderHook(() => useChatLogic());

    expect(result.current.messages).toStrictEqual([]);
    expect(result.current.isLoading).toBeFalsy();
    expect(result.current.currentAgent).toBe("assistant");
  });

  it("should update agent when setAgent is called", () => {
    const stop = jest.fn();
    useChatAi.mockReturnValue({
      messages: [],
      sendMessage: jest.fn(),
      status: "idle",
      error: null,
      stop,
      regenerate: jest.fn(),
      setMessages: jest.fn(),
    });

    const { result } = renderHook(() => useChatLogic());

    act(() => {
      result.current.setAgent("orchestrator");
    });

    expect(stop).toHaveBeenCalledOnce();
    expect(result.current.currentAgent).toBe("orchestrator");
    expect(useChatAi).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "chat-orchestrator" })
    );
  });

  it("should call handleSend when sendMessage is called", () => {
    const sendMessage = jest.fn();
    useChatAi.mockReturnValue({
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

  it("should send a voice transcript exactly once per idle cycle", () => {
    const sendMessage = jest.fn();
    useChatAi.mockReturnValue({
      messages: [],
      sendMessage,
      status: "idle",
      error: null,
      stop: jest.fn(),
      regenerate: jest.fn(),
      setMessages: jest.fn(),
    });

    const stream: VoiceStreamMock = {
      status: "recording",
      transcript: "",
      start: async () => {},
      stop: async () => {},
    };
    useVoiceSessionNative.mockReturnValue({ stream });

    const { rerender } = renderHook(
      (_props: { tick: number }) => useChatLogic(),
      {
        initialProps: { tick: 0 },
      }
    );

    act(() => {
      stream.status = "idle";
      stream.transcript = "hello from voice";
    });
    rerender({ tick: 1 });

    expect(sendMessage).toHaveBeenCalledWith({ text: "hello from voice" });
    expect(sendMessage).toHaveBeenCalledOnce();

    // Re-rendering while still idle should not send again.
    rerender({ tick: 2 });
    expect(sendMessage).toHaveBeenCalledOnce();

    // Leaving idle should reset the guard so the next idle cycle sends again.
    act(() => {
      stream.status = "recording";
      stream.transcript = "";
    });
    rerender({ tick: 3 });

    act(() => {
      stream.status = "idle";
      stream.transcript = "hello from voice";
    });
    rerender({ tick: 4 });

    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});
