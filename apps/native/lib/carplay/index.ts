import type { TtsRequest } from "@alfred/voice/types";
import CarPlay from "@g4rb4g3/react-native-carplay";
import { Platform } from "react-native";

const POLL_INTERVAL_MS = 100;
const VOICE_TIMEOUT_MS = 10_000;

type VoiceBridge = {
  start: () => Promise<void>;
  stopAndTranscribe: () => Promise<{ text: string } | null>;
  speak: (opts: TtsRequest) => Promise<void>;
  state: {
    capture: string;
  };
};

const noop = () => {
  // No-op function for default callback
};

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

    const listenButton = new VoiceControlButton({
      id: "alfred-voice",
      onPress: async () => {
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
        const result = await voice.stopAndTranscribe();
        if (result?.text) {
          onReply(result.text);
          await voice.speak({ text: result.text, format: "mp3" });
        }
      },
    });

    return new VoiceControlTemplate({
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
