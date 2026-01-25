import type { PipelineEvent, PipelineObserver } from "@alfred/pipeline";

import { logger } from "@alfred/logger";

import { upsertAttentionItem, upsertSuspendAttentionItem } from "./attention";
import { ensureRunDeltaBrief } from "./delta";

interface ConciergeObserverOptions {
  userId: string;
  runId: string;
  focusSetId?: string | null;
  commitmentId?: string | null;
  fire?: (p: Promise<unknown>, meta: Record<string, unknown>) => void;
}

function defaultFireAndForget(
  p: Promise<unknown>,
  meta: Record<string, unknown>
): void {
  void p.catch((error) => {
    logger.warn("concierge_observer_persist_failed", {
      ...meta,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export class ConciergeObserver implements PipelineObserver {
  private readonly opts: ConciergeObserverOptions;
  private readonly fire: (
    p: Promise<unknown>,
    meta: Record<string, unknown>
  ) => void;

  constructor(options: ConciergeObserverOptions) {
    this.opts = options;
    this.fire = options.fire ?? defaultFireAndForget;
  }

  onEvent(event: PipelineEvent): void {
    if (event.type === "pipeline:suspend") {
      this.fire(
        upsertSuspendAttentionItem({
          userId: this.opts.userId,
          workflowRunId: this.opts.runId,
          focusSetId: this.opts.focusSetId ?? null,
          commitmentId: this.opts.commitmentId ?? null,
          reason: event.reason,
        }),
        { runId: this.opts.runId, kind: `pipeline_suspend:${event.reason}` }
      );
      return;
    }

    if (event.type === "pipeline:failed") {
      const kind = "pipeline_failed";
      this.fire(
        upsertAttentionItem({
          userId: this.opts.userId,
          workflowRunId: this.opts.runId,
          focusSetId: this.opts.focusSetId ?? null,
          commitmentId: this.opts.commitmentId ?? null,
          kind,
          urgency: "critical",
          title: "Workflow failed",
          body: event.error,
          payload: {
            type: event.type,
            timestamp: event.timestamp,
            lastStage: event.lastStage,
            error: event.error,
          },
        }),
        { runId: this.opts.runId, kind }
      );

      this.fire(
        ensureRunDeltaBrief({
          userId: this.opts.userId,
          runId: this.opts.runId,
          focusSetId: this.opts.focusSetId ?? null,
          commitmentId: this.opts.commitmentId ?? null,
          event,
        }),
        { runId: this.opts.runId, kind: "delta_brief_failed" }
      );
      return;
    }

    if (event.type === "pipeline:complete") {
      this.fire(
        ensureRunDeltaBrief({
          userId: this.opts.userId,
          runId: this.opts.runId,
          focusSetId: this.opts.focusSetId ?? null,
          commitmentId: this.opts.commitmentId ?? null,
          event,
        }),
        { runId: this.opts.runId, kind: "delta_brief_complete" }
      );
      return;
    }

    if (event.type === "agent:escalate-request") {
      const kind = `agent_escalate_request:${event.agentId}`;
      this.fire(
        upsertAttentionItem({
          userId: this.opts.userId,
          workflowRunId: this.opts.runId,
          focusSetId: this.opts.focusSetId ?? null,
          commitmentId: this.opts.commitmentId ?? null,
          kind,
          urgency: event.severity === "blocking" ? "critical" : "high",
          title: "Agent escalation",
          body: event.details,
          payload: {
            type: event.type,
            timestamp: event.timestamp,
            agentId: event.agentId,
            reason: event.reason,
            details: event.details,
            suggestions: event.suggestions,
            severity: event.severity,
          },
        }),
        { runId: this.opts.runId, kind }
      );
      return;
    }

    if (event.type === "budget:exceeded") {
      const kind = "budget_exceeded";
      this.fire(
        upsertAttentionItem({
          userId: this.opts.userId,
          workflowRunId: this.opts.runId,
          focusSetId: this.opts.focusSetId ?? null,
          commitmentId: this.opts.commitmentId ?? null,
          kind,
          urgency: "high",
          title: "Budget exceeded",
          body: `costUsd=${event.costUsd} budgetUsd=${event.budgetUsd}`,
          payload: {
            type: event.type,
            timestamp: event.timestamp,
            costUsd: event.costUsd,
            budgetUsd: event.budgetUsd,
          },
        }),
        { runId: this.opts.runId, kind }
      );
    }
  }
}
