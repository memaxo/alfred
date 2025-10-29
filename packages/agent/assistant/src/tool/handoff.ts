import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import type { RuntimeContext } from "@mastra/core/runtime-context";
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

async function enforcePolicy(input: HandoffInput) {
  await requireToolScopesAndPolicy(input.authz, ["droid.exec", "repo.read"], {
    action: "assistant.escalate",
    resource: {
      kind: "requirement",
      id: input.workspace ?? undefined,
    },
    context: {
      auto: input.auto,
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
  }),
  execute: async ({
    input,
    runtimeContext,
  }: {
    input: HandoffInput;
    runtimeContext?: RuntimeContext;
  }) => {
    recordAssistantToolCall("handoff");

    await enforcePolicy(input);

    const { mastra } = await import("@alfred/agent");
    const workflow = mastra.getWorkflow?.("plan");
    if (!workflow) {
      throw new Error("workflow_not_found");
    }

    const payload = {
      requirement: input.requirement,
      auto: input.auto,
      userId: input.userId,
      workspace: input.workspace,
      repoBase: input.repoBase,
      ...(input.context ?? {}),
    };

    const run = await workflow.createRunAsync();
    const outcome = await run.start({
      inputData: payload,
      runtimeContext,
    });

    const output = (outcome as { result?: unknown }).result ?? undefined;
    const summary = (output as { summary?: string })?.summary ?? null;
    const results = (output as { results?: unknown[] })?.results ?? null;
    const plan = (output as { plan?: unknown })?.plan ?? null;
    const ticketId = (output as { ticketId?: string })?.ticketId ?? null;
    const ticketUrl = (output as { ticketUrl?: string })?.ticketUrl ?? null;

    const runId = (run as { id?: string }).id ?? null;

    recordAssistantEscalation("workflow.plan");

    return {
      ok: true as const,
      runId,
      summary,
      results,
      plan,
      ticketId,
      ticketUrl,
    };
  },
};

export type ToolHandoff = typeof toolHandoff;
