import { z } from "zod";

import type {
  HomeAction,
  HomeActionResult,
  HomeEntity,
  HomeEvent,
  HomePillar,
  HomeSeverity,
} from "./home";

const dateSchema = z
  .union([z.date(), z.string().datetime()])
  .transform((value) => (value instanceof Date ? value : new Date(value)));

export const homePillarSchema = z.enum([
  "network",
  "media",
  "security",
  "presence",
  "utility",
]) satisfies z.ZodType<HomePillar>;

export const homeSeveritySchema = z.enum([
  "info",
  "low",
  "medium",
  "high",
  "critical",
]) satisfies z.ZodType<HomeSeverity>;

export const homeEntitySchema: z.ZodType<HomeEntity> = z.object({
  id: z
    .string()
    .describe(
      "Unified ID: pillar.provider.entity (e.g. security.frigate.front_door)"
    ),
  pillar: homePillarSchema,
  domain: z
    .string()
    .describe("Entity category (e.g. person, camera, router, series)"),
  name: z.string(),
  state: z.string().describe("Current human-readable state"),
  attributes: z.record(z.string(), z.unknown()).default({}),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("AI inference confidence for detected states"),
  provider: z
    .string()
    .describe("Integration provider (e.g. homeassistant, life360, sonarr)"),
  updatedAt: dateSchema,
});

export function parseHomeEntity(
  value: unknown
): { ok: true; value: HomeEntity } | { ok: false; error: string } {
  const res = homeEntitySchema.safeParse(value);
  if (res.success) {
    return { ok: true, value: res.data };
  }
  return { ok: false, error: res.error.message };
}

export const homeEventSchema: z.ZodType<HomeEvent> = z.object({
  id: z.string(),
  entityId: z.string(),
  pillar: homePillarSchema,
  type: z
    .string()
    .describe("Event discriminant (e.g. intruder_detected, download_started)"),
  severity: homeSeveritySchema,
  message: z.string(),
  data: z.record(z.string(), z.unknown()).default({}),
  timestamp: dateSchema,
});

export function parseHomeEvent(
  value: unknown
): { ok: true; value: HomeEvent } | { ok: false; error: string } {
  const res = homeEventSchema.safeParse(value);
  if (res.success) {
    return { ok: true, value: res.data };
  }
  return { ok: false, error: res.error.message };
}

export const homeActionSchema: z.ZodType<HomeAction> = z.object({
  entityId: z.string(),
  service: z
    .string()
    .describe("Action to perform (e.g. turn_on, lock, upgrade_quality)"),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const homeActionResultSchema: z.ZodType<HomeActionResult> = z.object({
  success: z.boolean(),
  entityId: z.string(),
  state: z.string().optional(),
  error: z.string().optional(),
});
