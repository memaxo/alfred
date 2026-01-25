import type { PipelineEvent } from "@alfred/pipeline";

import { deltaRepo } from "@alfred/db";

import { publishDelta } from "./notify";

interface EnsureRunDeltaArgs {
  userId: string;
  runId: string;
  focusSetId?: string | null;
  commitmentId?: string | null;
  event: Extract<
    PipelineEvent,
    { type: "pipeline:complete" | "pipeline:failed" }
  >;
}

export async function ensureRunDeltaBrief(
  args: EnsureRunDeltaArgs
): Promise<void> {
  const existing = await deltaRepo.listDeltaBriefs({
    userId: args.userId,
    scope: "workflow_run",
    workflowRunId: args.runId,
    limit: 1,
  });
  if (existing.length > 0) {
    return;
  }

  const summaryText =
    args.event.type === "pipeline:complete"
      ? (args.event.summaryText ?? "Workflow completed.")
      : `Workflow failed: ${args.event.error}`;

  const brief = await deltaRepo.createDeltaBrief({
    userId: args.userId,
    scope: "workflow_run",
    workflowRunId: args.runId,
    focusSetId: args.focusSetId ?? null,
    commitmentId: args.commitmentId ?? null,
    untilAt: new Date(args.event.timestamp),
    summaryText,
    data:
      args.event.type === "pipeline:complete"
        ? {
            summary: args.event.summary,
          }
        : {
            lastStage: args.event.lastStage,
            error: args.event.error,
          },
  });
  publishDelta(args.userId, brief);
}
