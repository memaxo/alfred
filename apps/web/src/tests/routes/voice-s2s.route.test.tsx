import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import type { SpeechToSpeechResponse } from "@alfred/voice/types";
import { Route as VoiceS2SRoute } from "@/routes/_protected/voice-s2s";
import { fireEvent, render, waitFor, within } from "../../test/testing-library";

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

mock.module("@/utils/trpc", () => ({
  trpc: {
    voice: {
      listVoices: {
        useQuery: () => ({ data: [], isLoading: false }),
      },
    },
  },
}));

// Build a default stream mock object
const buildStreamMock = (overrides: Record<string, unknown> = {}) => ({
  analyser: null,
  supported: false,
  isActive: false,
  status: "idle",
  vadConfidence: null,
  transcript: "",
  assistantText: "",
  sessionId: null,
  autoStopReason: null,
  error: null,
  start: vi.fn(),
  stop: vi.fn(),
  ...overrides,
});

describe("VoiceS2SRouteView", () => {
  const VoiceS2SRouteView = VoiceS2SRoute.options
    .component as unknown as () => JSX.Element;

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
      session: null,
      start,
      speechToSpeech: vi.fn(),
      isRecording: false,
      isProcessing: false,
      lastResponse: null,
      error: null,
      clear,
      stream: buildStreamMock(),
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
      session: null,
      start: vi.fn(),
      speechToSpeech,
      isRecording: true,
      isProcessing: false,
      lastResponse: null,
      error: null,
      clear: vi.fn(),
      stream: buildStreamMock(),
    });

    const view = render(<VoiceS2SRouteView />);

    const button = view.getByRole("button", { name: /recording/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(speechToSpeech).toHaveBeenCalledTimes(1);
      const replyHeading = view.getByRole("heading", {
        name: /assistant reply/i,
      });
      const replyPanel = replyHeading.parentElement;
      expect(replyPanel).toBeTruthy();
      expect(within(replyPanel!).getByText(/hello/i)).toBeTruthy();
      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });
  });
});
