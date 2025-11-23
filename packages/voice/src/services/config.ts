// We use any here to avoid strict type checking during build time for dynamic imports
// The runtime behavior is safe as we import the actual modules
// This is a workaround for the strict package boundaries in the monorepo

export const DEFAULT_STT_MODEL = "whisper-1";
export const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
export const DEFAULT_TTS_VOICE = "alloy";

export function getVoiceProvider(): "openai" | "local" {
  return (process.env.VOICE_PROVIDER ?? "openai") as "openai" | "local";
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
    // @ts-ignore
    const { userRepo } = await import("@alfred/db/repo/user");
    const prefs = await userRepo.getPreferences(userId);
    const voicePref = Array.isArray(prefs)
      ? prefs.find((p: any) => p.key === "voice.tts")
      : null;

    if (voicePref?.value && typeof voicePref.value === "string") {
      return voicePref.value;
    }
  } catch (error) {
    try {
      // @ts-ignore
      const { logger } = await import("@alfred/logger");
      logger.warn("failed_to_resolve_voice_preference", { userId, error });
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
    // @ts-ignore
    const { userRepo } = await import("@alfred/db/repo/user");
    const prefs = await userRepo.getPreferences(userId);
    const langPref = Array.isArray(prefs)
      ? prefs.find((p: any) => p.key === "voice.stt.language")
      : null;

    if (langPref?.value && typeof langPref.value === "string") {
      return langPref.value;
    }
  } catch (error) {
    try {
      // @ts-ignore
      const { logger } = await import("@alfred/logger");
      logger.warn("failed_to_resolve_stt_preference", { userId, error });
    } catch {
      // Ignore logger load failure
    }
  }

  return;
}

export function requireOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("openai_api_key_missing");
  }
  const baseUrl = (
    process.env.OPENAI_BASE_URL ?? "https://api.openai.com"
  ).replace(/\/+$/, "");
  return { apiKey, baseUrl };
}
