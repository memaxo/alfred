import { Audio } from "expo-av";
import { deleteAsync, EncodingType, readAsStringAsync } from "expo-file-system";

import {
  type AudioSessionMode,
  configureAudioSession,
  resetAudioSession,
} from "./config";

const MIME_TYPE = "audio/m4a";

type ExpoCaptureOptions = {
  /** Enable background audio recording (default: true) */
  background?: boolean;
  /** Audio session mode (default: "voice") */
  mode?: AudioSessionMode;
};

/**
 * Audio capture adapter for Expo/React Native.
 *
 * Handles:
 * - iOS background audio via AVAudioSession configuration
 * - Android background via shouldDuckAndroid (foreground service handled separately)
 * - CarPlay mode for in-car voice interaction
 */
export class ExpoCapture {
  private recording: Audio.Recording | null = null;
  private readonly options: Required<ExpoCaptureOptions>;

  constructor(options?: ExpoCaptureOptions) {
    this.options = {
      background: options?.background ?? true,
      mode: options?.mode ?? "voice",
    };
  }

  /**
   * Start audio capture.
   *
   * Configures the audio session for recording and starts capture.
   * On iOS, this enables background audio if configured.
   */
  async start(): Promise<void> {
    if (this.recording) {
      return;
    }

    // Configure audio session for voice recording
    await configureAudioSession(Audio, {
      background: this.options.background,
      mode: this.options.mode,
    });

    const instance = new Audio.Recording();
    const options = Audio.RecordingOptionsPresets?.HIGH_QUALITY;
    if (!options) {
      throw new Error("expo-av recording presets unavailable");
    }

    await instance.prepareToRecordAsync(options);
    await instance.startAsync();
    this.recording = instance;
  }

  /**
   * Stop audio capture and return the recorded audio.
   *
   * @returns The recorded audio as base64, or null if no recording was active
   */
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

  /**
   * Check if currently recording.
   */
  get isRecording(): boolean {
    return this.recording !== null;
  }

  /**
   * Reset the audio session to default state.
   * Call this when the voice session is completely done.
   */
  async resetSession(): Promise<void> {
    await resetAudioSession(Audio);
  }
}

// Re-export type for use in other modules
export type { AudioSessionMode };
