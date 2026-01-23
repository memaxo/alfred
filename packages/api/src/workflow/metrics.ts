import {
  codexLinearActivitiesDroppedTotal,
  codexLinearActivitiesEmittedTotal,
  codexLinearActivityBatchesTotal,
  codexLinearIntegrationLatencySeconds,
  codexSessionContinuityTotal,
} from "@alfred/api/metrics";
import { logger } from "@alfred/logger";

let workflowMetricsInit = false;

export async function initWorkflowMetrics(): Promise<void> {
  if (workflowMetricsInit) {
    return;
  }
  workflowMetricsInit = true;

  try {
    const [{ configureLinearMetrics }, metrics] = await Promise.all([
      import("@alfred/agent/orchestrator/linearmetrics"),
      import("@alfred/agent/workflow/metrics"),
    ]);
    configureLinearMetrics({
      linearActivityEmissionsTotal: metrics.linearActivityEmissionsTotal,
      linearActivityDurationSeconds: metrics.linearActivityDurationSeconds,
      linearSessionOperationsTotal: metrics.linearSessionOperationsTotal,
    });
  } catch (error) {
    logger.warn("workflow_linear_metrics_init_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const [{ configureCodexLinearMetrics }, { sessionManager }] =
      await Promise.all([
        import("@alfred/agent/orchestrator/tool/codex-linear"),
        import("@alfred/agent/orchestrator/codex-session"),
      ]);
    configureCodexLinearMetrics({
      histogram: codexLinearIntegrationLatencySeconds,
      activitiesEmitted: codexLinearActivitiesEmittedTotal,
      activitiesDropped: codexLinearActivitiesDroppedTotal,
      activityBatches: codexLinearActivityBatchesTotal,
    });
    sessionManager.configureContinuityMetrics(
      (status: "success" | "failure") => {
        codexSessionContinuityTotal.inc({ status });
      }
    );
  } catch (error) {
    logger.warn("codex_linear_metrics_init_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

