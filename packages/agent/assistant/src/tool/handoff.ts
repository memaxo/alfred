import type { RuntimeContext } from "@alfred/type/runtime-context";

import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { z } from "zod";

import {
  recordAssistantEscalation,
  recordAssistantToolCall,
} from "../../../src/metrics";

const handoffInputSchema = z.object({
  userId: z.string().min(1),
  requirement: z.string().min(1),
  auto: z.enum(["read", "low"]).default("read"),
  authz: z.string().optional(),
  workspace: z.string().optional(),
  repoBase: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

type HandoffInput = z.infer<typeof handoffInputSchema>;

async function enforcePolicy(input: HandoffInput, requestId: string | null) {
  await requireToolScopesAndPolicy(input.authz, ["droid.exec", "repo.read"], {
    action: "assistant.escalate",
    resource: {
      kind: "requirement",
      id: input.workspace ?? undefined,
    },
    context: {
      auto: input.auto,
      requestId: requestId ?? undefined,
    },
  });
}

export const toolHandoff = {
  name: "handoff",
  description: "Escalate a requirement to the orchestrator planning workflow.",
  inputSchema: handoffInputSchema,
  outputSchema: z.object({
    ok: z.boolean(),
    runId: z.string().nullable(),
    summary: z.string().nullable(),
    ticketId: z.string().nullable(),
    ticketUrl: z.string().nullable(),
    plan: z.unknown().nullable(),
    results: z.array(z.unknown()).nullable(),
    next: z
      .object({
        kind: z.enum(["navigate", "start-workflow"]),
        href: z.string().optional(),
        reason: z.string().optional(),
      })
      .nullable(),
  }),
  execute: async ({
    input,
    runtimeContext,
  }: {
    input: HandoffInput;
    runtimeContext?: RuntimeContext;
  }) => {
    recordAssistantToolCall("handoff");

    const requestId =
      (runtimeContext?.get?.("requestId") as string | undefined) ?? null;

    await enforcePolicy(input, requestId);

    const summary = `Escalation requested: ${input.requirement}`;
    const next = {
      kind: "navigate" as const,
      href: "/orchestrator/run",
      reason:
        "Open the Orchestrator Run viewer to start and monitor the plan workflow.",
    };

    recordAssistantEscalation("workflow.plan");

    return {
      ok: true as const,
      runId: null,
      summary,
      results: null,
      plan: null,
      ticketId: null,
      ticketUrl: null,
      next,
    };
  },
};

export type ToolHandoff = typeof toolHandoff;
