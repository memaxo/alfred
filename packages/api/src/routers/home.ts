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

type HomeProvider = {
  provider: string;
  baseUrl: string | null;
};

function readProvider(): HomeProvider {
  const provider =
    typeof process.env.HOME_PROVIDER === "string" &&
    process.env.HOME_PROVIDER.trim().length > 0
      ? process.env.HOME_PROVIDER.trim()
      : "none";
  const baseUrl =
    typeof process.env.HOME_BASE_URL === "string" &&
    process.env.HOME_BASE_URL.trim().length > 0
      ? process.env.HOME_BASE_URL.trim()
      : null;
  return { provider, baseUrl };
}

const stateByEntity = new Map<string, unknown>();
const updatedAtByEntity = new Map<string, number>();

export const homeRouter = router({
  list: authedProcedure
    .use(requirePolicy("home.read", mapResource))
    .input(listInput)
    .query(() => {
      const provider = readProvider();
      const entities = [...stateByEntity.keys()].sort();
      return entities.map((entity) => ({
        entity,
        state: stateByEntity.get(entity) ?? null,
        updatedAt: updatedAtByEntity.get(entity) ?? null,
        provider,
      }));
    }),
  status: authedProcedure
    .use(requirePolicy("home.read", mapResource))
    .input(statusInput)
    .query(({ input }) => ({
      entity: input.entity,
      state: stateByEntity.get(input.entity) ?? null,
      updatedAt: updatedAtByEntity.get(input.entity) ?? null,
      provider: readProvider(),
    })),
  set: authedProcedure
    .use(requirePolicy("home.control", mapResource))
    .input(setInput)
    .mutation(({ input }) => {
      stateByEntity.set(input.entity, input.state ?? null);
      updatedAtByEntity.set(input.entity, Date.now());
      return {
        ok: true as const,
        entity: input.entity,
        state: input.state ?? null,
        updatedAt: updatedAtByEntity.get(input.entity) ?? null,
        provider: readProvider(),
      };
    }),
});
