import { getEvents, listFacts } from "@alfred/db/repo/user";

export async function loadFactSummary(userId: string, limit = 10) {
  const result = await listFacts(userId, limit, 0);
  return Array.isArray(result) ? result : [];
}

export async function loadEventSummary(userId: string, limit = 25) {
  const events = await getEvents(userId, undefined, limit, 0);
  return Array.isArray(events) ? events : [];
}
