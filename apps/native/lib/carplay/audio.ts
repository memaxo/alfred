/**
 * ALFRED CarPlay Audio Session Management
 *
 * Handles AVAudioSession configuration for CarPlay voice interactions.
 * Manages barge-in detection, echo cancellation, and TTS coordination.
 */

import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

export type AudioState = "idle" | "listening" | "speaking" | "interrupted";

type AudioSessionConfig = {
  onInterruption?: (began: boolean) => void;
  onBargeIn?: () => void;
};

class CarPlayAudioSession {
  private currentState: AudioState = "idle";
  private config: AudioSessionConfig = {};
  private isInitialized = false;

  async initialize(config: AudioSessionConfig = {}): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.config = config;
    // Configure for voice chat (echo cancellation, proper routing)
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      playThroughEarpieceAndroid: false,
    });

    this.isInitialized = true;
  }

  async startListening(): Promise<void> {
    if (this.currentState === "speaking") {
      // Barge-in detected - stop TTS
      this.config.onBargeIn?.();
      await this.stopSpeaking();
    }

    this.currentState = "listening";

    // Ensure recording mode is active
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      playThroughEarpieceAndroid: false,
    });
  }

  async stopListening(): Promise<void> {
    if (this.currentState !== "listening") {
      return;
    }

    this.currentState = "idle";
  }

  async startSpeaking(): Promise<void> {
    this.currentState = "speaking";

    // Configure for playback (disable recording to prevent feedback)
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
    });
  }

  async stopSpeaking(): Promise<void> {
    if (this.currentState !== "speaking") {
      return;
    }

    this.currentState = "idle";

    // Re-enable recording capability
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      playThroughEarpieceAndroid: false,
    });
  }

  handleInterruption(began: boolean): void {
    if (began) {
      this.currentState = "interrupted";
      this.config.onInterruption?.(true);
    } else {
      this.currentState = "idle";
      this.config.onInterruption?.(false);
    }
  }

  getState(): AudioState {
    return this.currentState;
  }

  async cleanup(): Promise<void> {
    this.currentState = "idle";
    this.isInitialized = false;
  }
}

export const carPlayAudio = new CarPlayAudioSession();
