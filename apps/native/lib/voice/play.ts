import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { configureAudioSession } from "./config";

let tempCounter = 0;

const fallbackDir = () =>
  FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";

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
  tempCounter = (tempCounter + 1) % 100_000;
  const uri = `${dir}voice-${Date.now()}-${tempCounter}.${suffix}`;
  await FileSystem.writeAsStringAsync(uri, audioBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  try {
    const { sound } = await Audio.Sound.createAsync({ uri });
    try {
      await sound.playAsync();
    } finally {
      await sound.unloadAsync();
    }
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}
