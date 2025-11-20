import { Audio } from "expo-av";
import { deleteAsync, EncodingType, readAsStringAsync } from "expo-file-system";
import { configureAudioSession } from "./config";

const MIME_TYPE = "audio/m4a";

export class ExpoCapture {
  private recording: Audio.Recording | null = null;

  async start(): Promise<void> {
    if (this.recording) {
      return;
    }
    await configureAudioSession(Audio, { background: true });
    const instance = new Audio.Recording();
    const options = Audio.RecordingOptionsPresets?.HIGH_QUALITY;
    if (!options) {
      throw new Error("expo-av recording presets unavailable");
    }
    await instance.prepareToRecordAsync(options);
    await instance.startAsync();
    this.recording = instance;
  }

  async stop(): Promise<{ mimeType: string; audioBase64: string } | null> {
    if (!this.recording) {
      return null;
    }
    const active = this.recording;
    this.recording = null;
    await active.stopAndUnloadAsync();
    const uri = active.getURI();
    if (!uri) {
      return null;
    }
    try {
      const audioBase64 = await readAsStringAsync(uri, {
        encoding: EncodingType.Base64,
      });
      return { mimeType: MIME_TYPE, audioBase64 };
    } finally {
      try {
        await deleteAsync(uri, { idempotent: true });
      } catch {
        // Best-effort cleanup; ignore failures
      }
    }
  }
}
