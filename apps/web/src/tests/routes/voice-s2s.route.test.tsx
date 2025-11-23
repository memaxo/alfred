import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import type { SpeechToSpeechResponse } from "@alfred/voice/types";
import { fireEvent, render, waitFor } from "../../test/testing-library";
import { VoiceS2SRouteView } from "../voice-s2s";

const toastSuccess = vi.fn();
const toastError = vi.fn();

mock.module("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

const useVoiceSessionWebMock = vi.fn();

mock.module("@/hooks/use-voice-session-web", () => ({
  useVoiceSessionWeb: useVoiceSessionWebMock,
}));

describe("VoiceS2SRouteView", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    useVoiceSessionWebMock.mockReset();
  });

  it("starts recording when idle", async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    const clear = vi.fn();

    useVoiceSessionWebMock.mockReturnValue({
      state: { capture: "idle", transcript: "", error: null, lastUpdated: 0 },
      start,
      speechToSpeech: vi.fn(),
      isRecording: false,
      isProcessing: false,
      lastResponse: null,
      error: null,
      clear,
    });

    const view = render(<VoiceS2SRouteView />);

    const button = view.getByRole("button", { name: /hold to talk/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(clear).toHaveBeenCalledTimes(1);
      expect(start).toHaveBeenCalledTimes(1);
    });
  });

  it("runs speechToSpeech when already recording", async () => {
    const speechToSpeech = vi.fn().mockResolvedValue({
      assistant: { text: "hello" },
    } satisfies Partial<SpeechToSpeechResponse>);

    useVoiceSessionWebMock.mockReturnValue({
      state: {
        capture: "recording",
        transcript: "hey",
        error: null,
        lastUpdated: 0,
      },
      start: vi.fn(),
      speechToSpeech,
      isRecording: true,
      isProcessing: false,
      lastResponse: null,
      error: null,
      clear: vi.fn(),
    });

    const view = render(<VoiceS2SRouteView />);

    const button = view.getByRole("button", { name: /recording/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(speechToSpeech).toHaveBeenCalledTimes(1);
      expect(view.getByText(/hello/i)).toBeTruthy();
      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });
  });
});
