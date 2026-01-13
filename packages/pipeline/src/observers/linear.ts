import { logger } from "@alfred/logger";
import type { PipelineEvent } from "../events";
import type { PipelineObserver } from "../runner";

type LinearUpdate = {
  type: "status" | "comment" | "progress";
  value: string;
};

export type LinearObserverConfig = {
  syncIntervalMs: number;
  issueId: string;
  authz: string;
};

export class LinearSyncObserver implements PipelineObserver {
  private pendingUpdates: LinearUpdate[] = [];
  private rateLimiter: ReturnType<
    typeof import("@alfred/agent/orchestrator/linear-rate-limiter").LinearRateLimiter
  > | null = null;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private readonly config: LinearObserverConfig;

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
      const { LinearRateLimiter } = await import(
        "@alfred/agent/orchestrator/linear-rate-limiter"
      );
      this.rateLimiter = new LinearRateLimiter();
    } catch (error) {
      logger.warn("linear_rate_limiter_init_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  onEvent(event: PipelineEvent): void {
    switch (event.type) {
      case "stage:enter":
        if (event.stage === "execute") {
          this.pendingUpdates.push({ type: "status", value: "In Progress" });
        }
        break;

      case "stage:progress":
        this.pendingUpdates.push({
          type: "progress",
          value: `${event.stage}: ${event.message}`,
        });
        break;

      case "agent:complete":
        this.pendingUpdates.push({
          type: "comment",
          value: `Agent completed with status: ${event.outcome.status}`,
        });
        break;

      case "pipeline:complete":
        this.pendingUpdates.push({ type: "status", value: "Done" });
        void this.flush(); // Immediate flush on completion
        break;

      case "pipeline:failed":
        this.pendingUpdates.push({
          type: "comment",
          value: `Pipeline failed at ${event.lastStage}: ${event.error}`,
        });
        this.pendingUpdates.push({ type: "status", value: "Cancelled" });
        void this.flush(); // Immediate flush on failure
        break;
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
    if (this.pendingUpdates.length === 0 || !this.rateLimiter) {
      return;
    }

    const updates = [...this.pendingUpdates];
    this.pendingUpdates = [];

    for (const update of updates) {
      try {
        await this.rateLimiter.throttle();
        await this.applyUpdate(update);
      } catch (error) {
        logger.warn("linear_update_failed", {
          type: update.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async applyUpdate(update: LinearUpdate): Promise<void> {
    // Use toolTicket.execute() pattern for Linear operations
    const { toolTicket } = await import(
      "@alfred/agent/orchestrator/tool/ticket"
    );

    switch (update.type) {
      case "status":
        await toolTicket.execute({
          input: {
            space: this.config.issueId.split("-")[0] ?? "", // Extract space from issueId if needed
            action: "update",
            issueId: this.config.issueId,
            description: update.value,
            authz: this.config.authz,
          },
        });
        break;

      case "comment":
      case "progress":
        await toolTicket.execute({
          input: {
            space: this.config.issueId.split("-")[0] ?? "",
            action: "comment",
            issueId: this.config.issueId,
            description: update.value,
            authz: this.config.authz,
          },
        });
        break;
    }
  }
}
