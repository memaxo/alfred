import type {
  SpeechToSpeechRequest,
  SpeechToSpeechResponse,
  TtsRequest,
} from "@alfred/voice/types";
import CarPlay from "@g4rb4g3/react-native-carplay";
import { Platform } from "react-native";

const POLL_INTERVAL_MS = 100;
const VOICE_TIMEOUT_MS = 10_000;
const STREAM_POLL_INTERVAL_MS = 250;
const STREAM_COMPLETION_TIMEOUT_MS = 30_000;

type StreamBridge = {
  supported: boolean;
  status: string;
  transcript: string;
  assistantText: string;
  vadConfidence: number | null;
  autoStopReason: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

type VoiceBridge = {
  start: () => Promise<void>;
  stopAndTranscribe: () => Promise<{ text: string } | null>;
  speak: (opts: TtsRequest) => Promise<void>;
  speechToSpeech?: (
    overrides?: Partial<Omit<SpeechToSpeechRequest, "audioBase64" | "mimeType">>
  ) => Promise<SpeechToSpeechResponse | null>;
  state: {
    capture: string;
  };
  stream?: StreamBridge;
};

const noop = () => {
  // No-op function for default callback
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

async function waitForStreamReply(voice: VoiceBridge): Promise<string | null> {
  if (!voice.stream?.supported) {
    return null;
  }
  const start = Date.now();
  let latestReply = voice.stream.assistantText ?? "";
  while (Date.now() - start < STREAM_COMPLETION_TIMEOUT_MS) {
    if (voice.stream.assistantText) {
      latestReply = voice.stream.assistantText;
    }
    if (
      (voice.stream.status === "idle" || voice.stream.status === "playing") &&
      (voice.stream.autoStopReason || latestReply)
    ) {
      break;
    }
    await delay(STREAM_POLL_INTERVAL_MS);
  }
  if (voice.stream.status === "recording") {
    try {
      await voice.stream.stop();
    } catch {
      // ignore stop failures; auto-stop or timeout will exit
    }
  }
  return latestReply || null;
}

async function handleVoiceButtonPress(
  voice: VoiceBridge,
  onReply: (text: string) => void
) {
  try {
    if (voice.stream?.supported) {
      try {
        await voice.stream.start();
        const reply = await waitForStreamReply(voice);
        if (reply) {
          onReply(reply);
        }
        return;
      } catch (_streamError) {
        // ignore
      }
    }
    await voice.start();
    // Wait for user to speak (monitor capture state or use a timeout)
    // Poll the capture state until it indicates speech is detected or timeout
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (
          voice.state.capture === "recording" ||
          voice.state.capture === "complete"
        ) {
          clearInterval(checkInterval);
          resolve();
        }
      }, POLL_INTERVAL_MS);
      // Timeout after configured duration
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, VOICE_TIMEOUT_MS);
    });
    if (voice.speechToSpeech) {
      const response = await voice.speechToSpeech({
        thread: "carplay-drive",
        resource: "carplay-drive",
        ttsVoice: "alloy",
        ttsFormat: "mp3",
      });
      if (response?.assistant?.text) {
        onReply(response.assistant.text);
      }
      return;
    }
    const result = await voice.stopAndTranscribe();
    if (result?.text) {
      onReply(result.text);
      await voice.speak({ text: result.text, format: "mp3" });
    }
  } catch (_error) {
    // ignore
  }
}

export function setupCarPlay(
  voice: VoiceBridge,
  onReply: (text: string) => void = noop
): void {
  if (Platform.OS !== "ios") {
    return;
  }
  const carplay = CarPlay as {
    registerOnConnect?: (handler: () => void) => void;
    VoiceControlTemplate?: unknown;
    VoiceControlButton?: unknown;
    CarPlayButton?: unknown;
    pushTemplate?: (template: unknown, animated: boolean) => void;
    connected?: boolean;
  };
  if (!carplay || typeof carplay.registerOnConnect !== "function") {
    return;
  }

  const buildTemplate = () => {
    if (typeof carplay.VoiceControlTemplate !== "function") {
      return null;
    }
    const VoiceControlTemplate = carplay.VoiceControlTemplate;
    const VoiceControlButton =
      carplay.VoiceControlButton ?? carplay.CarPlayButton;
    if (typeof VoiceControlButton !== "function") {
      return null;
    }

    const listenButton = new (VoiceControlButton as any)({
      id: "alfred-voice",
      onPress: async () => {
        await handleVoiceButtonPress(voice, onReply);
      },
    });

    return new (VoiceControlTemplate as any)({
      title: "Alfred Drive",
      subtitle: "Tap steering control or say “Hey Alfred”",
      buttons: [listenButton],
    });
  };

  const handleConnect = () => {
    const template = buildTemplate();
    if (template && typeof carplay.pushTemplate === "function") {
      carplay.pushTemplate(template, true);
    }
  };

  carplay.registerOnConnect(handleConnect);
  if (carplay.connected) {
    handleConnect();
  }
}
