import { userRepo } from "@alfred/db";

export async function loadFactSummary(userId: string, limit = 10) {
  const repo = userRepo as unknown as {
    listFacts?: (
      userId: string,
      limit?: number,
      offset?: number
    ) => Promise<unknown>;
  };
  const result = repo.listFacts ? await repo.listFacts(userId, limit, 0) : [];
  return Array.isArray(result) ? result : [];
}

export async function loadEventSummary(userId: string, limit = 25) {
  const events = await userRepo.getEvents(userId, undefined, limit, 0);
  return Array.isArray(events) ? events : [];
}
