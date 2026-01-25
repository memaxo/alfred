import type { HooksJsonConfig } from "@alfred/type";

import { z } from "zod";

const matcherSchema = z
  .object({
    toolName: z.string().optional(),
    agentType: z.string().optional(),
    commandPattern: z.string().optional(),
    stateFrom: z
      .enum([
        "idle",
        "capturing",
        "thinking",
        "deciding",
        "executing",
        "reflecting",
      ])
      .optional(),
    stateTo: z
      .enum([
        "idle",
        "capturing",
        "thinking",
        "deciding",
        "executing",
        "reflecting",
      ])
      .optional(),
    risk: z.enum(["low", "medium", "high"]).optional(),
    memoryKind: z.enum(["fact", "relation", "insight", "heuristic"]).optional(),
  })
  .passthrough();

const commandHookSchema = z
  .object({
    type: z.literal("command").optional(),
    command: z.string().min(1),
    timeout: z.number().positive().optional(),
    failMode: z.enum(["open", "closed"]).optional(),
    matcher: matcherSchema.optional(),
    async: z.boolean().optional(),
    transform: z.boolean().optional(),
  })
  .passthrough();

const promptHookSchema = z
  .object({
    type: z.literal("prompt"),
    prompt: z.string().min(1),
    model: z.string().optional(),
    timeout: z.number().positive().optional(),
    matcher: matcherSchema.optional(),
  })
  .passthrough();

const hooksJsonSchema = z.object({
  version: z.literal(1),
  hooks: z.record(
    z.string(),
    z.array(z.union([commandHookSchema, promptHookSchema]))
  ),
});

export async function loadHooksJsonFile(
  filePath: string
): Promise<HooksJsonConfig> {
  const raw = await Bun.file(filePath).text();
  const parsed = hooksJsonSchema.parse(JSON.parse(raw));
  return parsed as HooksJsonConfig;
}
