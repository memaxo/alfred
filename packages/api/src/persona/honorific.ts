import * as userRepo from "@alfred/db/repo/user";
import { parseHonorificPreference, type HonorificPreference } from "@alfred/persona";

const HONORIFIC_PREF_KEY = "persona.honorific";

function isPrefEntry(value: unknown): value is { key: string; value: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "key" in value &&
    "value" in value &&
    typeof (value as { key: unknown }).key === "string"
  );
}

export async function getHonorificPreference(
  userId: string
): Promise<HonorificPreference> {
  try {
    const prefs = (await userRepo.getPreferences(userId)) as unknown[];
    const entry = prefs.find(
      (p) => isPrefEntry(p) && p.key === HONORIFIC_PREF_KEY
    ) as { key: string; value: unknown } | undefined;
    return parseHonorificPreference(entry?.value, "sir");
  } catch {
    return "sir";
  }
}

