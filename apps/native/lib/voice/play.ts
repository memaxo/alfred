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
    case "audio/mpeg": {
      return "mp3";
    }
    case "audio/ogg":
    case "audio/opus": {
      return "opus";
    }
    case "audio/wav":
    case "audio/x-wav": {
      return "wav";
    }
    default: {
      return "m4a";
    }
  }
};

export async function playBase64(
  audioBase64: string,
  mimeType: string,
  options?: { signal?: AbortSignal }
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
    let abort: (() => void) | null = null;
    try {
      if (options?.signal?.aborted) {
        return;
      }
      // Wait for playback to finish (or abort) deterministically.
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) {
            return;
          }
          settled = true;
          resolve();
        };

        abort = () => {
          sound.stopAsync().catch(() => {});
          finish();
        };
        options?.signal?.addEventListener("abort", abort, { once: true });

        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) {
            return;
          }
          if (status.didJustFinish) {
            finish();
          }
        });

        if (options?.signal?.aborted) {
          finish();
          return;
        }

        sound.playAsync().catch(() => {
          finish();
        });
      });
    } finally {
      if (abort) {
        options?.signal?.removeEventListener("abort", abort);
      }
      sound.setOnPlaybackStatusUpdate(null);
      await sound.unloadAsync();
    }
  } finally {
    await deleteAsync(uri, { idempotent: true }).catch(() => {
      // File deletion errors are non-fatal, silently ignore
    });
  }
}
