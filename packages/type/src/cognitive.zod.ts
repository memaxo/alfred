import { z } from "zod";

/**
 * Zod schema for Cognitive Event
 */
export const cognitiveEventSchema = z.discriminatedUnion("_", [
  z.object({
    _: z.literal("input"),
    content: z.string(),
    source: z.enum(["user", "system", "tool"]),
    ts: z.number(),
  }),
  z.object({ _: z.literal("timeout"), deadline: z.number() }),
  z.object({
    _: z.literal("feedback"),
    expected: z.string(),
    actual: z.string(),
    similarity: z.number().optional(),
    ts: z.number(),
  }),
  z.object({
    _: z.literal("interrupt"),
    reason: z.string(),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    ts: z.number(),
  }),
  z.object({
    _: z.literal("complete"),
    outcome: z.unknown(),
    ts: z.number(),
  }),
]);

/**
 * Zod schema for CognitiveState
 */
export const cognitiveStateSchema = z.discriminatedUnion("_", [
  z.object({
    _: z.literal("idle"),
    since: z.number(),
    physiology: z.unknown(),
  }),
  z.object({
    _: z.literal("capturing"),
    input: z.string(),
    confidence: z.number(),
    started: z.number(),
    physiology: z.unknown(),
  }),
  z.object({
    _: z.literal("thinking"),
    about: z.string(),
    depth: z.number(),
    paths: z.array(z.unknown()),
    reasoningTraces: z.array(z.string()).optional(),
    started: z.number(),
    physiology: z.unknown(),
  }),
  z.object({
    _: z.literal("deciding"),
    options: z.array(z.unknown()),
    criteria: z.unknown(),
    weights: z.array(z.number()),
    deadline: z.number(),
    physiology: z.unknown(),
  }),
  z.object({
    _: z.literal("executing"),
    plan: z.unknown(),
    step: z.number(),
    auto: z.unknown(),
    started: z.number(),
    physiology: z.unknown(),
  }),
  z.object({
    _: z.literal("reflecting"),
    outcome: z.unknown(),
    expected: z.string(),
    actual: z.string(),
    error: z.number(),
    physiology: z.unknown(),
  }),
]);
