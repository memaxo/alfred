import { Platform } from "react-native";

type AudioModule = typeof import("expo-av").Audio;

/**
 * iOS Interruption Mode (from expo-av)
 * 0 = MixWithOthers
 * 1 = DoNotMix
 * 2 = DuckOthers
 */
const IOS_INTERRUPTION_MODE = {
  MIX_WITH_OTHERS: 0,
  DO_NOT_MIX: 1,
  DUCK_OTHERS: 2,
} as const;

export type AudioSessionMode = "voice" | "playback" | "carplay";

interface AudioSessionConfig {
  mode: AudioSessionMode;
  background: boolean;
}

let lastAppliedConfig: AudioSessionConfig | null = null;

/**
 * Configure the audio session for voice interactions.
 *
 * iOS-specific:
 * - Uses PlayAndRecord category for simultaneous input/output
 * - Enables background audio via staysActiveInBackground
 * - Sets interruption mode to DoNotMix for clear voice capture
 * - playsInSilentModeIOS ensures audio even when muted switch is on
 *
 * Android-specific:
 * - shouldDuckAndroid reduces other app volume during recording
 * - Android handles background via foreground service (see AndroidManifest)
 *
 * @param Audio - The expo-av Audio module
 * @param opts - Configuration options
 * @param opts.background - Enable background audio (default: false)
 * @param opts.mode - Audio session mode: "voice" | "playback" | "carplay" (default: "voice")
 */
export async function configureAudioSession(
  Audio: AudioModule,
  opts?: { background?: boolean; mode?: AudioSessionMode }
): Promise<void> {
  const background = Boolean(opts?.background);
  const mode = opts?.mode ?? "voice";

  if (typeof Audio.setAudioModeAsync !== "function") {
    return;
  }

  // Skip if already configured with same settings
  if (
    lastAppliedConfig !== null &&
    lastAppliedConfig.background === background &&
    lastAppliedConfig.mode === mode
  ) {
    return;
  }

  // CarPlay and Drive modes need special handling
  const isCarPlay = mode === "carplay";
  const needsRecording = mode === "voice" || mode === "carplay";

  await Audio.setAudioModeAsync({
    // Allow recording for voice modes
    allowsRecordingIOS: needsRecording,

    // Play audio even when silent switch is on
    playsInSilentModeIOS: true,

    // Enable background audio for CarPlay and explicit background requests
    staysActiveInBackground: background || isCarPlay,

    // DoNotMix (1) for voice to ensure clear capture
    // DuckOthers (2) for CarPlay to allow navigation audio
    interruptionModeIOS: isCarPlay
      ? IOS_INTERRUPTION_MODE.DUCK_OTHERS
      : IOS_INTERRUPTION_MODE.DO_NOT_MIX,

    // Android: Duck other apps during recording
    shouldDuckAndroid: true,

    // Android: Play through earpiece for voice calls
    playThroughEarpieceAndroid: false,
  });

  lastAppliedConfig = { mode, background };
}

/**
 * Reset the audio session to default state.
 * Call this when voice session ends to restore normal audio behavior.
 */
export async function resetAudioSession(Audio: AudioModule): Promise<void> {
  if (typeof Audio.setAudioModeAsync !== "function") {
    return;
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: false,
    staysActiveInBackground: false,
    interruptionModeIOS: IOS_INTERRUPTION_MODE.MIX_WITH_OTHERS,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });

  lastAppliedConfig = null;
}

/**
 * Check if the current platform supports background audio.
 */
export function supportsBackgroundAudio(): boolean {
  // iOS supports background audio via UIBackgroundModes
  // Android requires foreground service which we configure separately
  return Platform.OS === "ios" || Platform.OS === "android";
}

/**
 * Get platform-specific audio configuration hints.
 */
export function getAudioConfigHints(): {
  platform: string;
  supportsCarPlay: boolean;
  requiresForegroundService: boolean;
} {
  return {
    platform: Platform.OS,
    supportsCarPlay: Platform.OS === "ios",
    requiresForegroundService: Platform.OS === "android",
  };
}
