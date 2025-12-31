import { beforeEach, describe, expect, it, vi } from "bun:test";
import { createVoiceSession, VoiceSessionError } from "../src/session";
import type { PlatformAdapter, VoiceClient } from "../src/types";

function createAdapter(): PlatformAdapter & {
  play: ReturnType<typeof vi.fn>;
} {
  return {
    configureSession: vi.fn(async () => {}),
    startCapture: vi.fn(async () => {}),
    stopCapture: vi.fn(async () => ({
      audioBase64: "AAA",
      mimeType: "audio/webm",
    })),
    play: vi.fn(async () => {}),
  };
}

const baseClient: VoiceClient = {
  sttTranscribe: vi.fn(async () => ({ text: "hello" })),
  ttsSynthesize: vi.fn(async () => ({
    audioBase64: "BBB",
    mimeType: "audio/mpeg",
  })),
  speechToSpeech: vi.fn(async () => ({
    transcript: { text: "hello" },
    audio: { audioBase64: "CCC", mimeType: "audio/mpeg" },
  })),
};

describe("createVoiceSession", () => {
  beforeEach(() => {
    baseClient.sttTranscribe.mockClear();
    baseClient.ttsSynthesize.mockClear();
    baseClient.speechToSpeech?.mockClear();
  });

  it("records and transcribes audio", async () => {
    const adapter = createAdapter();
    const session = createVoiceSession(adapter, baseClient);

    await session.start();
    expect(adapter.startCapture).toHaveBeenCalledTimes(1);

    const result = await session.stopAndTranscribe({ language: "en" });
    expect(result?.text).toBe("hello");
    expect(baseClient.sttTranscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "en",
        audioBase64: "AAA",
        mimeType: "audio/webm",
      })
    );
    expect(session.state.capture).toBe("complete");
    expect(session.state.transcript).toBe("hello");
  });

  it("synthesizes speech and plays audio", async () => {
    const adapter = createAdapter();
    const session = createVoiceSession(adapter, baseClient, {
      defaultVoice: "alloy",
    });

    await session.speak({ text: "Reply" });
    expect(baseClient.ttsSynthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Reply",
        voice: "alloy",
      })
    );
    expect(adapter.play).toHaveBeenCalledWith("BBB", "audio/mpeg");
  });

  it("runs speech-to-speech when client supports it", async () => {
    const adapter = createAdapter();
    const session = createVoiceSession(adapter, baseClient);

    await session.start();
    const result = await session.speechToSpeech?.({
      thread: "thread-1",
    });

    expect(result?.transcript.text).toBe("hello");
    expect(baseClient.speechToSpeech).toHaveBeenCalledWith(
      expect.objectContaining({
        audioBase64: "AAA",
        mimeType: "audio/webm",
        thread: "thread-1",
      })
    );
    expect(adapter.play).toHaveBeenCalledWith("CCC", "audio/mpeg");
  });

  it("wraps speech-to-speech failures with captured clip", async () => {
    const adapter = createAdapter();
    const failingClient: VoiceClient = {
      ...baseClient,
      speechToSpeech: vi.fn(() => Promise.reject(new Error("upstream_failed"))),
    };
    const session = createVoiceSession(adapter, failingClient);

    await session.start();
    let caught: unknown;
    try {
      await session.speechToSpeech?.();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(VoiceSessionError);
    expect(caught).toBeInstanceOf(VoiceSessionError);
    const voiceError = caught as VoiceSessionError;
    expect(voiceError.clip?.audioBase64).toBe("AAA");
    expect(voiceError.clip?.mimeType).toBe("audio/webm");
  });
});
