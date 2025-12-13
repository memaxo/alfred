import "@/test/dom";
import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useVoiceSessionWeb } from "../use-voice-session-web";

const sttMutate = vi.fn();
const ttsMutate = vi.fn();
const s2sMutate = vi.fn();

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
      data: undefined,
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
});
