import { createHomeAssistantClient } from "@alfred/home";
import { z } from "zod";

import { enforcePolicy, requirePolicy } from "../gate";
import { authedProcedure, router, t } from "../trpc";

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

export interface HomeProvider {
  provider: string;
  baseUrl: string | null;
}

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

function hasHomeAssistantConfig(): boolean {
  const provider =
    typeof process.env.HOME_PROVIDER === "string" &&
    process.env.HOME_PROVIDER.trim().length > 0
      ? process.env.HOME_PROVIDER.trim()
      : "none";
  if (provider !== "homeassistant") {
    return false;
  }
  return Boolean(process.env.HOME_BASE_URL && process.env.HOME_TOKEN);
}

function parseUpdatedAt(state: {
  last_updated?: string;
  last_changed?: string;
}): number | null {
  const v = state.last_updated ?? state.last_changed;
  if (!v) {
    return null;
  }
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

function entityDomain(entityId: string): string | null {
  const i = entityId.indexOf(".");
  if (i <= 0) {
    return null;
  }
  return entityId.slice(0, i) || null;
}

function parseService(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const val = (raw as { service?: unknown }).service;
  return typeof val === "string" && val.trim().length > 0 ? val.trim() : null;
}

function isHighRiskService(service: string | null): boolean {
  return service === "lock" || service === "unlock" || service === "delete";
}

const setPolicyContext = (raw: unknown) => {
  const input = (raw ?? {}) as { entity?: unknown; state?: unknown };
  const entity =
    typeof input.entity === "string" ? entityDomain(input.entity) : null;
  const service = parseService(input.state);
  return { entity, service };
};

const enforceSetPolicy = t.middleware(async ({ ctx, input, next, path }) => {
  const raw = (input ?? {}) as { state?: unknown };
  const service = parseService(raw.state);
  const action = isHighRiskService(service) ? "home.act" : "home.control";
  const { obligations } = await enforcePolicy(
    ctx,
    input,
    path,
    action,
    mapResource,
    setPolicyContext
  );

  return next({
    ctx: {
      ...ctx,
      policy: {
        obligations,
      },
    },
  });
});

const stateByEntity = new Map<string, unknown>();
const updatedAtByEntity = new Map<string, number>();

export const homeRouter = router({
  list: authedProcedure
    .use(requirePolicy("home.read", mapResource))
    .input(listInput)
    .query(async () => {
      const provider = readProvider();

      if (hasHomeAssistantConfig()) {
        try {
          const client = createHomeAssistantClient();
          const states = await client.getStates();
          return states
            .map((s) => ({
              entity: s.entity_id,
              state: s,
              updatedAt: parseUpdatedAt(s),
              provider,
            }))
            .sort((a, b) => a.entity.localeCompare(b.entity));
        } catch {
          return [];
        }
      }

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
    .query(async ({ input }) => {
      const provider = readProvider();
      if (hasHomeAssistantConfig()) {
        try {
          const client = createHomeAssistantClient();
          const state = await client.getState(input.entity);
          return {
            entity: input.entity,
            state,
            updatedAt: parseUpdatedAt(state),
            provider,
          };
        } catch {
          // fall through
        }
      }

      return {
        entity: input.entity,
        state: stateByEntity.get(input.entity) ?? null,
        updatedAt: updatedAtByEntity.get(input.entity) ?? null,
        provider,
      };
    }),
  set: authedProcedure
    .input(setInput)
    .use(enforceSetPolicy)
    .mutation(async ({ input }) => {
      const provider = readProvider();

      if (hasHomeAssistantConfig()) {
        const payload = input.state as
          | {
              service?: unknown;
              data?: unknown;
            }
          | undefined;
        const service = payload?.service;
        const data = payload?.data;

        if (typeof service === "string") {
          try {
            const client = createHomeAssistantClient();
            await client.controlEntity(
              input.entity,
              service,
              typeof data === "object" && data !== null
                ? (data as Record<string, unknown>)
                : undefined
            );
            const state = await client.getState(input.entity);
            return {
              ok: true as const,
              entity: input.entity,
              state,
              updatedAt: parseUpdatedAt(state),
              provider,
            };
          } catch {
            // fall through
          }
        }
      }

      stateByEntity.set(input.entity, input.state ?? null);
      updatedAtByEntity.set(input.entity, Date.now());
      return {
        ok: true as const,
        entity: input.entity,
        state: input.state ?? null,
        updatedAt: updatedAtByEntity.get(input.entity) ?? null,
        provider,
      };
    }),
});
