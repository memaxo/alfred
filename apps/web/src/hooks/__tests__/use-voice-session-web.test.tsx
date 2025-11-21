import "@/test/dom";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
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

  return {
    trpc: {
      voice: {
        sttTranscribe: buildMutation(sttMutate),
        ttsSynthesize: buildMutation(ttsMutate),
        speechToSpeech: buildMutation(s2sMutate),
      },
    },
  };
});

class MockMediaRecorder {
  public state: "inactive" | "recording" = "inactive";
  public ondataavailable?: (event: { data: Blob }) => void;
  private stopListeners: ((event: Event) => void)[] = [];

  constructor(_stream: MediaStream) {}

  start() {
    this.state = "recording";
  }

  stop() {
    if (this.state === "inactive") return;
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

const getUserMediaMock = vi.fn(async () => ({
  getTracks: () => [],
}) as MediaStream);

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

  it("starts recording via MediaRecorder", async () => {
    const { result } = renderHook(() => useVoiceSessionWeb());

    await act(async () => {
      await result.current.start();
    });

    expect(getUserMediaMock).toHaveBeenCalled();
    expect(result.current.isRecording).toBe(true);
  });

  it("sends captured clip to speechToSpeech and updates response", async () => {
    const { result } = renderHook(() => useVoiceSessionWeb());

    await act(async () => {
      await result.current.start();
    });

    const recorder = mediaRecorderInstances.at(-1);
    if (!recorder) {
      throw new Error("MediaRecorder instance missing");
    }

    const sample = new Blob([new Uint8Array([1, 2, 3])], {
      type: "audio/webm",
    });
    recorder.emitData(sample);

    await act(async () => {
      await result.current.speechToSpeech();
    });

    expect(s2sMutate).toHaveBeenCalledTimes(1);
    expect(s2sMutate.mock.calls[0][0]).toMatchObject({
      mimeType: "audio/webm",
    });
    expect(result.current.lastResponse?.assistant?.text).toBe("reply");
    expect(result.current.error).toBeNull();
  });
});
