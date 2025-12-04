export const DEFAULT_STT_MODEL =
  process.env.VOICE_STT_MODEL ?? "faster-whisper-large-v3-turbo";
export const DEFAULT_TTS_MODEL = process.env.VOICE_TTS_MODEL ?? "maya1";
export const DEFAULT_TTS_VOICE =
  process.env.VOICE_TTS_VOICE ?? "en_US-lessac-medium";

export function getVoiceProvider(): "maya1" | "supertonic" {
  const raw = (process.env.VOICE_PROVIDER ?? "maya1").toLowerCase();
  return raw === "supertonic" ? "supertonic" : "maya1";
}

export async function resolveVoicePreference(
  userId: string,
  requestedVoice: string
): Promise<string> {
  // Only override if the requested voice is the default
  if (requestedVoice !== DEFAULT_TTS_VOICE) {
    return requestedVoice;
  }

  try {
    const userModule = await import("@alfred/db/repo/user");
    const prefs = await userModule.getPreferences(userId);
    const voicePref = Array.isArray(prefs)
      ? prefs.find((p: { key: string; value: unknown }) => p.key === "voice.tts")
      : null;

    if (voicePref?.value && typeof voicePref.value === "string") {
      return voicePref.value;
    }
  } catch (error) {
    try {
      const loggerModule = await import("@alfred/logger");
      loggerModule.logger.warn("failed_to_resolve_voice_preference", { userId, error });
    } catch {
      // Ignore logger load failure
    }
  }

  return requestedVoice;
}

export async function resolveSttLanguagePreference(
  userId: string,
  requestedLanguage?: string
): Promise<string | undefined> {
  if (requestedLanguage) {
    return requestedLanguage;
  }

  try {
    const userModule = await import("@alfred/db/repo/user");
    const prefs = await userModule.getPreferences(userId);
    const langPref = Array.isArray(prefs)
      ? prefs.find((p: { key: string; value: unknown }) => p.key === "voice.stt.language")
      : null;

    if (langPref?.value && typeof langPref.value === "string") {
      return langPref.value;
    }
  } catch (error) {
    try {
      const loggerModule = await import("@alfred/logger");
      loggerModule.logger.warn("failed_to_resolve_stt_preference", { userId, error });
    } catch {
      // Ignore logger load failure
    }
  }

  return;
}
