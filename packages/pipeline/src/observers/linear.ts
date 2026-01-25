import { logger } from "@alfred/logger";
import { LiteBatcher } from "@alfred/pacer";

import type { PipelineEvent } from "../events";
import type { PipelineObserver } from "../runner";

type LinearUpdate =
  | {
      action: "set-started" | "set-completed" | "set-cancelled";
      issueId: string;
    }
  | { action: "comment"; issueId: string; body: string };

export interface LinearObserverConfig {
  syncIntervalMs: number;
  space: string;
  issueId: string;
  authz: string;
}

export class LinearSyncObserver implements PipelineObserver {
  private readonly pendingUpdates = new LiteBatcher<LinearUpdate>(() => {}, {
    // We use the batcher as a shared, typed buffer and trigger flushing explicitly
    // via the observer interval / completion hooks to preserve process-liveness behavior.
    maxSize: Number.POSITIVE_INFINITY,
    started: false,
    wait: Number.POSITIVE_INFINITY,
  });
  private rateLimiter: InstanceType<
    typeof import("@alfred/agent/orchestrator/linear-rate-limiter").LinearRateLimiter
  > | null = null;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private readonly config: LinearObserverConfig;
  private readonly agentToTaskId = new Map<string, string>();
  private taskIssueMap = new Map<string, string>();

  constructor(config: LinearObserverConfig) {
    this.config = config;
    this.initRateLimiter();

    // Start periodic flush
    this.flushInterval = setInterval(() => {
      void this.flush();
    }, config.syncIntervalMs);
    this.flushInterval.unref(); // Don't keep process alive
  }

  private async initRateLimiter(): Promise<void> {
    try {
      const { LinearRateLimiter } =
        await import("@alfred/agent/orchestrator/linear-rate-limiter");
      this.rateLimiter = new LinearRateLimiter();
      void this.flush();
    } catch (error) {
      logger.warn("linear_rate_limiter_init_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private applyTaskIssueMap(value: unknown): void {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return;
    }
    const raw = value as Record<string, unknown>;
    const next = new Map<string, string>();
    for (const [k, v] of Object.entries(raw)) {
      if (typeof k !== "string" || k.length === 0) {
        continue;
      }
      if (typeof v === "string" && v.trim().length > 0) {
        next.set(k, v.trim());
      }
    }
    if (next.size > 0) {
      this.taskIssueMap = next;
    }
  }

  onEvent(event: PipelineEvent): void {
    switch (event.type) {
      case "context:set": {
        if (event.key === "linearTaskIssueMap") {
          this.applyTaskIssueMap(event.value);
        }
        break;
      }

      case "stage:enter": {
        if (event.stage === "execute") {
          this.pendingUpdates.addItem({
            action: "set-started",
            issueId: this.config.issueId,
          });
        }
        break;
      }

      case "agent:spawn": {
        this.agentToTaskId.set(event.agentId, event.taskId);
        const issueId = this.taskIssueMap.get(event.taskId);
        if (issueId) {
          this.pendingUpdates.addItem({ action: "set-started", issueId });
        }
        break;
      }

      case "agent:complete": {
        {
          const taskId = this.agentToTaskId.get(event.agentId);
          if (!taskId) {
            break;
          }
          const issueId = this.taskIssueMap.get(taskId);
          if (!issueId) {
            break;
          }

          if (event.outcome.status === "success") {
            this.pendingUpdates.addItem({ action: "set-completed", issueId });
            break;
          }

          const details: string[] = [];
          if (event.outcome.handoff) {
            details.push(`Handoff: ${event.outcome.handoff}`);
          }
          if (event.outcome.error) {
            details.push(`Error: ${event.outcome.error}`);
          }

          const body =
            details.length > 0
              ? `Task ${taskId} completed with status: ${event.outcome.status}\n\n${details.join("\n")}`
              : `Task ${taskId} completed with status: ${event.outcome.status}`;

          this.pendingUpdates.addItem({ action: "comment", issueId, body });
          this.pendingUpdates.addItem({ action: "set-cancelled", issueId });
        }
        break;
      }

      case "pipeline:complete": {
        this.pendingUpdates.addItem({
          action: "set-completed",
          issueId: this.config.issueId,
        });
        if (event.summaryText) {
          this.pendingUpdates.addItem({
            action: "comment",
            issueId: this.config.issueId,
            body: `Summary:\n${event.summaryText}`,
          });
        }
        void this.flush(); // Immediate flush on completion
        break;
      }

      case "pipeline:failed": {
        this.pendingUpdates.addItem({
          action: "comment",
          issueId: this.config.issueId,
          body: `Pipeline failed at ${event.lastStage}: ${event.error}`,
        });
        this.pendingUpdates.addItem({
          action: "set-cancelled",
          issueId: this.config.issueId,
        });
        void this.flush(); // Immediate flush on failure
        break;
      }
    }
  }

  onComplete(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    void this.flush();
  }

  private async flush(): Promise<void> {
    if (this.pendingUpdates.isEmpty || !this.rateLimiter) {
      return;
    }

    const updates = this.pendingUpdates.peekAllItems();
    this.pendingUpdates.clear();

    for (const update of updates) {
      try {
        await this.rateLimiter.throttle("session");
        await this.applyUpdate(update);
      } catch (error) {
        logger.warn("linear_update_failed", {
          action: update.action,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async applyUpdate(update: LinearUpdate): Promise<void> {
    // Use toolTicket.execute() pattern for Linear operations
    const { toolTicket } =
      await import("@alfred/agent/orchestrator/tool/ticket");

    switch (update.action) {
      case "set-started":
      case "set-completed":
      case "set-cancelled": {
        await toolTicket.execute({
          input: {
            space: this.config.space,
            action: update.action,
            issueId: update.issueId,
            authz: this.config.authz,
          },
        });
        break;
      }
      case "comment": {
        await toolTicket.execute({
          input: {
            space: this.config.space,
            action: "comment",
            issueId: update.issueId,
            description: update.body,
            authz: this.config.authz,
          },
        });
        break;
      }
    }
  }
}
