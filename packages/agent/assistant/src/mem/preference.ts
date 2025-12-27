import { getPreferences, getProfile } from "@alfred/db/repo/user";

export async function loadPreferenceMemory(userId: string, limit = 25) {
  const preferences = await getPreferences(userId);
  const list = Array.isArray(preferences) ? (preferences as unknown[]) : [];
  return list.slice(0, limit);
}

export function loadProfileMemory(userId: string) {
  return getProfile(userId);
}
