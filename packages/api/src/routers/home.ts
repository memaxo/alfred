import { z } from "zod";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";

const listInput = z.object({}).optional();

const statusInput = z.object({
  entity: z.string().min(1),
});

const setInput = z.object({
  entity: z.string().min(1),
  state: z.unknown().optional(),
  authz: z.string().optional(),
});

function mapResource(raw: unknown) {
  const input = (raw ?? {}) as { entity?: string };
  return {
    kind: "home" as const,
    id: input.entity ?? "all",
  };
}

export const homeRouter = router({
  list: authedProcedure
    .use(requirePolicy("home.read", mapResource))
    .input(listInput)
    .query(async () => {
      // TODO: integrate selected provider (HOME_PROVIDER, HOME_BASE_URL).
      return [];
    }),
  status: authedProcedure
    .use(requirePolicy("home.read", mapResource))
    .input(statusInput)
    .query(async ({ input }) => {
      // TODO: fetch actual entity state from provider.
      return { entity: input.entity, state: null };
    }),
  set: authedProcedure
    .use(requirePolicy("home.control", mapResource))
    .input(setInput)
    .mutation(async ({ input }) => {
      // TODO: call provider and surface obligations (e.g., biometric) to caller.
      return {
        ok: true as const,
        entity: input.entity,
        state: input.state ?? null,
      };
    }),
});
