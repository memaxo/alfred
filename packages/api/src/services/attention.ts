import type { AttentionStatus, AttentionUrgency } from "@alfred/type/focus";

import { attentionRepo, clarificationRepo } from "@alfred/db";
import { logger } from "@alfred/logger";

import { publishAttention } from "./notify";

interface UpsertAttentionArgs {
  userId: string;
  workflowRunId?: string | null;
  focusSetId?: string | null;
  commitmentId?: string | null;
  kind: string;
  urgency: AttentionUrgency;
  title?: string | null;
  body?: string | null;
  payload?: Record<string, unknown> | null;
}

type AttentionRow = Awaited<
  ReturnType<typeof attentionRepo.createAttentionItem>
>;
export interface UpsertAttentionResult {
  item: AttentionRow;
  created: boolean;
}

export async function upsertAttentionItem(
  args: UpsertAttentionArgs
): Promise<UpsertAttentionResult> {
  const status: AttentionStatus = "open";

  const existing = await attentionRepo.listAttentionItems({
    userId: args.userId,
    kind: args.kind,
    status,
    workflowRunId: args.workflowRunId ?? undefined,
    focusSetId: args.focusSetId ?? undefined,
    commitmentId: args.commitmentId ?? undefined,
    limit: 1,
  });

  if (existing[0]) {
    return { item: existing[0], created: false };
  }

  const item = await attentionRepo.createAttentionItem({
    userId: args.userId,
    workflowRunId: args.workflowRunId ?? null,
    focusSetId: args.focusSetId ?? null,
    commitmentId: args.commitmentId ?? null,
    kind: args.kind,
    status,
    urgency: args.urgency,
    title: args.title ?? null,
    body: args.body ?? null,
    payload: args.payload ?? null,
  });
  publishAttention(args.userId, item);
  return { item, created: true };
}

export async function upsertSuspendAttentionItem(args: {
  userId: string;
  workflowRunId: string;
  focusSetId?: string | null;
  commitmentId?: string | null;
  reason: string;
}): Promise<unknown> {
  const kind = `pipeline_suspend:${args.reason}`;

  let title = "Workflow needs input";
  let body: string | null = args.reason;
  let payload: Record<string, unknown> | null = {
    type: "pipeline:suspend",
    reason: args.reason,
  };

  try {
    const requests = await clarificationRepo.listRequestsByRunId(
      args.workflowRunId
    );
    const open = requests
      .filter((r) => !r.response)
      .sort((a, b) => {
        const at = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const bt = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return bt - at;
      });
    const latest = open[0];
    if (latest) {
      title = "Clarification needed";
      body = latest.question;
      payload = {
        ...payload,
        clarificationId: latest.id,
        phaseId: latest.phaseId,
        agentId: latest.agentId,
        options: latest.options,
      };
    }
  } catch (error) {
    logger.debug("attention_item_clarification_lookup_failed", {
      userId: args.userId,
      runId: args.workflowRunId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return upsertAttentionItem({
    userId: args.userId,
    workflowRunId: args.workflowRunId,
    focusSetId: args.focusSetId ?? null,
    commitmentId: args.commitmentId ?? null,
    kind,
    urgency: "high",
    title,
    body,
    payload,
  });
}

export async function resolveAttentionItem(args: {
  userId: string;
  id: string;
}): Promise<void> {
  try {
    const item = await attentionRepo.updateAttentionItem(args.id, {
      status: "resolved",
      resolvedAt: new Date(),
    });
    publishAttention(args.userId, item);
  } catch (error) {
    logger.warn("attention_item_resolve_failed", {
      userId: args.userId,
      id: args.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
