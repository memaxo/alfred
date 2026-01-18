import { clearRunCosts } from "@alfred/metrics";
import type { PipelineEvent } from "../events";
import type { PipelineObserver } from "../runner";

export class CostCleanupObserver implements PipelineObserver {
  private runId: string | null = null;

  onEvent(event: PipelineEvent): void {
    // Capture runId from any event that carries it.
    if (
      this.runId === null &&
      "runId" in event &&
      typeof (event as { runId?: unknown }).runId === "string"
    ) {
      this.runId = (event as { runId: string }).runId;
    }

    if (event.type === "pipeline:complete") {
      clearRunCosts(event.summary.runId);
      return;
    }

    if (event.type === "pipeline:failed") {
      if (
        "runId" in event &&
        typeof (event as { runId?: unknown }).runId === "string"
      ) {
        clearRunCosts((event as { runId: string }).runId);
      } else if (this.runId) {
        clearRunCosts(this.runId);
      }
    }
  }

  onComplete(): void {
    if (!this.runId) {
      return;
    }
    clearRunCosts(this.runId);
  }
}
