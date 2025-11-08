import type { TtsRequest } from "@alfred/voice/types";
import CarPlay from "@g4rb4g3/react-native-carplay";
import { Platform } from "react-native";

type VoiceBridge = {
  start: () => Promise<void>;
  stopAndTranscribe: () => Promise<{ text: string } | null>;
  speak: (opts: TtsRequest) => Promise<void>;
  state: {
    capture: string;
  };
};

const noop = () => {};

export function setupCarPlay(
  voice: VoiceBridge,
  onReply: (text: string) => void = noop
): void {
  if (Platform.OS !== "ios") {
    return;
  }
  const carplay: any = CarPlay;
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
