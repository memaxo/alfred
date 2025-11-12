import { Audio } from "expo-av";
import {
  cacheDirectory,
  deleteAsync,
  documentDirectory,
  EncodingType,
  writeAsStringAsync,
} from "expo-file-system";
import { configureAudioSession } from "./config";

const TEMP_COUNTER_MAX = 100_000;

let tempCounter = 0;

const fallbackDir = () => cacheDirectory ?? documentDirectory ?? "";

const extensionForMime = (mimeType: string) => {
  switch (mimeType) {
    case "audio/mpeg":
      return "mp3";
    case "audio/ogg":
    case "audio/opus":
      return "opus";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    default:
      return "m4a";
  }
};

export async function playBase64(
  audioBase64: string,
  mimeType: string
): Promise<void> {
  await configureAudioSession(Audio, { background: true });
  const dir = fallbackDir();
  const suffix = extensionForMime(mimeType);
  tempCounter = (tempCounter + 1) % TEMP_COUNTER_MAX;
  const uri = `${dir}voice-${Date.now()}-${tempCounter}.${suffix}`;
  await writeAsStringAsync(uri, audioBase64, {
    encoding: EncodingType.Base64,
  });
  try {
    const { sound } = await Audio.Sound.createAsync({ uri });
    try {
      await sound.playAsync();
      // Wait for playback to finish
      await new Promise<void>((resolve) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            resolve();
          }
        });
      });
    } finally {
      await sound.unloadAsync();
    }
  } finally {
    await deleteAsync(uri, { idempotent: true }).catch(() => {
      // File deletion errors are non-fatal, silently ignore
    });
  }
}
