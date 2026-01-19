import "@/test/dom";
import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import { renderHook } from "@testing-library/react";
import { useVoiceSessionWeb } from "../use-voice-session-web";

const sttMutate = vi.fn();
const ttsMutate = vi.fn();
const s2sMutate = vi.fn();
const connectMock = vi.fn(async () => ({ sendTelemetry: vi.fn() }));
const startCaptureMock = vi.fn(async () => {});
let prefsData: unknown;

mock.module("@/utils/trpc", () => {
  const buildMutation = (fn: typeof sttMutate) => {
    const mutation = {
      mutateAsync: fn,
      isPending: false,
    };
    return {
      useMutation: () => mutation,
    };
  };

  const buildQuery = () => ({
    useQuery: () => ({
      data: prefsData,
      isPending: false,
      refetch: vi.fn(),
    }),
  });

  return {
    trpc: {
      voice: {
        sttTranscribe: buildMutation(sttMutate),
        ttsSynthesize: buildMutation(ttsMutate),
        speechToSpeech: buildMutation(s2sMutate),
        sessions: buildQuery(),
      },
      user: {
        getPreferences: buildQuery(),
      },
    },
  };
});

mock.module("../use-voice-protocol", () => ({
  useVoiceProtocol: () => ({
    supported: true,
    connect: connectMock,
    disconnect: vi.fn(async () => {}),
    getClient: vi.fn(),
    state: {
      status: "idle",
      transcript: "",
      assistantText: "",
      vadConfidence: null,
      autoStopReason: null,
      error: null,
      sessionId: null,
    },
  }),
}));

mock.module("../use-voice-audio", () => ({
  useVoiceAudio: () => ({
    analyser: null,
    startCapture: startCaptureMock,
    stopCapture: vi.fn(),
    playAudio: vi.fn(),
    clearAudio: vi.fn(),
  }),
}));

class MockMediaRecorder {
  public state: "inactive" | "recording" = "inactive";
  public ondataavailable?: (event: { data: Blob }) => void;
  private readonly stopListeners: ((event: Event) => void)[] = [];

  start() {
    this.state = "recording";
  }

  stop() {
    if (this.state === "inactive") {
      return;
    }
    this.state = "inactive";
    this.stopListeners.forEach((listener) => listener(new Event("stop")));
  }

  addEventListener(_type: string, listener: (event: Event) => void) {
    this.stopListeners.push(listener);
  }

  emitData(blob: Blob) {
    this.ondataavailable?.({ data: blob });
  }
}

const mediaRecorderInstances: MockMediaRecorder[] = [];

const MediaRecorderCtor = function MediaRecorderMock(stream: MediaStream) {
  const instance = new MockMediaRecorder(stream);
  mediaRecorderInstances.push(instance);
  return instance as unknown as MediaRecorder;
};

Object.defineProperty(globalThis, "MediaRecorder", {
  value: MediaRecorderCtor,
});

const getUserMediaMock = vi.fn(
  async () =>
    ({
      getTracks: () => [],
    }) as MediaStream
);

Object.assign(globalThis.navigator, {
  mediaDevices: {
    getUserMedia: getUserMediaMock,
  },
});

class MockAudio {
  public preload = "auto";
  constructor(public src: string) {}
  play = vi.fn(async () => {});
  pause = vi.fn(() => {});
}

Object.defineProperty(globalThis, "Audio", {
  value: MockAudio,
});

describe("useVoiceSessionWeb", () => {
  beforeEach(() => {
    mediaRecorderInstances.length = 0;
    getUserMediaMock.mockClear();
    sttMutate.mockReset();
    ttsMutate.mockReset();
    s2sMutate.mockReset().mockResolvedValue({
      assistant: { text: "reply" },
      transcript: { text: "hi" },
      audio: { audioBase64: "PCM", mimeType: "audio/mpeg" },
    });
    connectMock.mockClear();
    startCaptureMock.mockClear();
    prefsData = undefined;
  });

  it("exposes legacy API stubs", () => {
    const { result } = renderHook(() => useVoiceSessionWeb());

    // Legacy methods are now stubs (no-ops) - verify they exist and don't throw
    expect(typeof result.current.start).toBe("function");
    expect(typeof result.current.speechToSpeech).toBe("function");
    expect(typeof result.current.stream.start).toBe("function");
    expect(result.current.stream.supported).toBeDefined();
  });

  it("disables voice queries in test mode", () => {
    // Set test mode
    const originalEnv = import.meta.env.VITE_TEST_MODE;
    (import.meta.env as any).VITE_TEST_MODE = "true";

    const { result } = renderHook(() => useVoiceSessionWeb());

    // In test mode, queries should be disabled (no errors thrown)
    expect(result.current.session).toBeNull();
    expect(result.current.stream.supported).toBeDefined();

    // Restore
    (import.meta.env as any).VITE_TEST_MODE = originalEnv;
  });

  it("passes sttChunkSize from preferences into streaming start", async () => {
    prefsData = [{ key: "voice.stt.chunk_size", value: "fast" }];

    const { result } = renderHook(() => useVoiceSessionWeb());
    await result.current.stream.start();

    expect(connectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        codec: "pcm",
        sttChunkSize: "fast",
        inputMimeType: "audio/raw;codec=pcm_s16le;rate=16000",
      })
    );
  });
});
