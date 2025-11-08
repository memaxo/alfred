import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import { z } from "zod";
import { recordAssistantToolCall } from "../../../src/metrics";

const homeInputSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["list", "status", "set"]),
  entity: z.string().optional(),
  state: z.unknown().optional(),
  authz: z.string().optional(),
});

const homeOutputSchema = z.union([
  z.object({
    action: z.literal("list"),
    entities: z
      .array(
        z.object({
          id: z.string(),
          type: z.string(),
          state: z.unknown().optional(),
        })
      )
      .default([]),
  }),
  z.object({
    action: z.literal("status"),
    entity: z.string(),
    state: z.unknown().optional(),
  }),
  z.object({
    action: z.literal("set"),
    ok: z.boolean().default(true),
    entity: z.string(),
    state: z.unknown().optional(),
  }),
]);

type HomeInput = z.infer<typeof homeInputSchema>;

function scopesForAction(action: HomeInput["action"]) {
  return action === "set" ? ["home.control"] : ["home.read"];
}

function policyAction(action: HomeInput["action"]) {
  return action === "set" ? "home.control" : "home.read";
}

export const toolHome = {
  name: "home",
  description: "Interact with home status/control providers (skeleton).",
  inputSchema: homeInputSchema,
  outputSchema: homeOutputSchema,
  execute: async ({
    input,
    runtimeContext,
  }: {
    input: HomeInput;
    runtimeContext?: RuntimeContext;
  }) => {
    recordAssistantToolCall("home");

    await requireToolScopesAndPolicy(input.authz, scopesForAction(input.action), {
      action: policyAction(input.action),
      resource: {
        kind: "home",
        id: input.entity ?? "all",
      },
      context: {
        runtimeContextId: runtimeContext?.get?.("requestId"),
      },
    });

    // TODO: Integrate with real provider once selected (HOME_PROVIDER, HOME_BASE_URL, HOME_TOKEN).
    throw new Error("home_tool_not_implemented");
  },
};

export type ToolHome = typeof toolHome;
