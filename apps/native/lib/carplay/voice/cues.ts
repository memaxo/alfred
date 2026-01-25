/**
 * CarPlay Audio Cues
 *
 * Simple audio feedback cues for CarPlay interactions.
 * Uses the existing playBase64() from lib/voice/play.ts.
 */

export type AudioCueType = "listening" | "confirmed" | "error" | "notification";

// Pre-generated simple audio cues (base64 encoded)
// These are minimal beep sounds for feedback
// In production, these would be replaced with proper sound design

// Simple sine wave beep generator (440Hz, 100ms)
function _generateBeep(_frequency: number, _durationMs: number): string {
  // For now, return empty - will use native sounds or TTS instead
  return "";
}

// Cue configurations
const _CUES: Record<AudioCueType, { frequency: number; duration: number }> = {
  listening: { frequency: 880, duration: 100 },
  confirmed: { frequency: 1760, duration: 50 },
  error: { frequency: 220, duration: 200 },
  notification: { frequency: 660, duration: 150 },
};

/**
 * Play an audio cue.
 * Falls back to no-op if audio is unavailable.
 */
export async function playCue(type: AudioCueType): Promise<void> {
  // For now, we'll use system haptics via expo-haptics instead of audio cues
  // This is more appropriate for CarPlay where audio shouldn't compete with TTS

  try {
    const Haptics = await import("expo-haptics");

    switch (type) {
      case "listening": {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      }
      case "confirmed": {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
        break;
      }
      case "error": {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      }
      case "notification": {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning
        );
        break;
      }
    }
  } catch {
    // Haptics unavailable (e.g., simulator), silently ignore
  }
}

/**
 * Play listening indicator sound.
 */
export async function playListeningCue(): Promise<void> {
  return playCue("listening");
}

/**
 * Play confirmation sound.
 */
export async function playConfirmationCue(): Promise<void> {
  return playCue("confirmed");
}

/**
 * Play error sound.
 */
export async function playErrorCue(): Promise<void> {
  return playCue("error");
}

/**
 * Play notification sound.
 */
export async function playNotificationCue(): Promise<void> {
  return playCue("notification");
}
