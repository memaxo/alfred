import { userRepo } from "@alfred/db";

export async function loadPreferenceMemory(userId: string, limit = 25) {
  const preferences = await userRepo.getPreferences(userId);
  const list = Array.isArray(preferences) ? (preferences as unknown[]) : [];
  return list.slice(0, limit);
}

export function loadProfileMemory(userId: string) {
  return userRepo.getProfile(userId);
}
