import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { toolDroid } from "../tool/droid";

const workflowInputSchema = z.object({
  requirement: z.string().min(1),
  auto: z.enum(["read", "low", "medium", "high"]).default("low"),
  authz: z.string().optional(),
  cw: z.string().optional(),
});

const workflowOutputSchema = z.object({
  summary: z.string(),
  results: z.array(
    z.object({
      task: z.string(),
      outcome: z.string(),
    }),
  ),
});

function splitRequirement(requirement: string) {
  const candidates = requirement
    .split(/[\n.;]+/u)
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);

  if (candidates.length === 0) {
    return [requirement.trim()];
  }

  return candidates.slice(0, 5);
}

const executePlanStep = createStep({
  id: "execute-plan",
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData, writer }) => {
    const tasks = splitRequirement(inputData.requirement);
    const results: { task: string; outcome: string }[] = [];

    for (const [index, task] of tasks.entries()) {
      if (writer) {
        await writer.write({
          type: "progress",
          pct: Math.min(10 + index * (60 / Math.max(tasks.length, 1)), 70),
          message: `starting: ${task}`,
        });
      }

      const response = await toolDroid.execute({
        input: {
          prompt: task,
          auto: inputData.auto,
          out: "debug",
          authz: inputData.authz,
          cw: inputData.cw,
        },
        writer,
      });

      results.push({ task, outcome: response.result });

      if (writer) {
        await writer.write({
          type: "progress",
          pct: Math.min(30 + index * (60 / Math.max(tasks.length, 1)), 85),
          message: `completed: ${task}`,
        });
      }
    }

    if (writer) {
      await writer.write({ type: "progress", pct: 90, message: "plan_completed" });
    }

    return {
      summary: `Executed ${results.length} task(s).`,
      results,
    };
  },
});

export const planWorkflow = createWorkflow({
  id: "plan",
  description: "Minimal secure SWE planner that executes droid tasks sequentially.",
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  .then(executePlanStep)
  .commit();
