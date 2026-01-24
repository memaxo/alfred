import * as workflowRepo from "@alfred/db/repo/workflow";
import { z } from "zod";

import { authedProcedure } from "../../trpc";
import { initWorkflowMetrics } from "../../workflow/metrics";

export const workflowReplayProcedure = authedProcedure
  .input(
    z.object({
      runId: z.string().min(1),
      eventType: z.string().optional().default("ui-message"),
      order: z.enum(["asc", "desc"]).optional(),
      page: z.number().int().min(0).optional(),
      pageSize: z.number().int().min(1).max(2000).optional(),
      includeTotal: z.boolean().optional(),
    })
  )
  .query(async ({ input }) => {
    await initWorkflowMetrics();
    const [
      { replayQueriesTotal, replayQueryDurationSeconds },
      { unwrapEventEnvelope },
    ] = await Promise.all([
      import("@alfred/agent/workflow/metrics"),
      import("@alfred/agent/utils/envelope"),
    ]);
    let stop: (() => void) | null = null;
    try {
      stop = replayQueryDurationSeconds.startTimer({
        event_type: input.eventType,
      });
    } catch {
      stop = null;
    }
    const items = await workflowRepo.listEventsByTypePaged({
      runId: input.runId,
      eventType:
        input.eventType as import("@alfred/db/schema/workflow").WorkflowEventType,
      page: input.page ?? 0,
      pageSize: input.pageSize ?? 500,
      order: input.order,
    });
    const transformed = items.map((e) => ({
      eventId: e.eventId,
      runId: e.runId,
      eventType: e.eventType,
      eventData: unwrapEventEnvelope(e.eventData).data,
      timestamp: e.timestamp,
    }));
    let total: number | undefined;
    if (input.includeTotal) {
      total = await workflowRepo.countEventsByType(
        input.runId,
        input.eventType as import("@alfred/db/schema/workflow").WorkflowEventType
      );
    }
    const page = input.page ?? 0;
    const pageSize = input.pageSize ?? 500;
    const hasMore =
      transformed.length === pageSize &&
      (total === undefined || (page + 1) * pageSize < total);
    try {
      replayQueriesTotal.inc({ event_type: input.eventType });
    } finally {
      stop?.();
    }
    return { items: transformed, page, pageSize, total, hasMore };
  });
