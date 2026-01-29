import {
  safeRegisterCounter,
  safeRegisterHistogram,
} from "@alfred/metrics/registry";

import type { PipelineEvent } from "../events";
import type { StageName } from "../pipeline";
import type { PipelineObserver } from "../runner";

const pipelineStageTotal = safeRegisterCounter({
  name: "pipeline_stage_total",
  help: "Total pipeline stage executions",
  labelNames: ["stage", "status"] as const,
});

const pipelineStageDuration = safeRegisterHistogram({
  name: "pipeline_stage_duration_seconds",
  help: "Pipeline stage duration in seconds",
  labelNames: ["stage"] as const,
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300],
});

const pipelineAgentTotal = safeRegisterCounter({
  name: "pipeline_agent_total",
  help: "Total agents spawned",
  labelNames: ["status"] as const,
});

const pipelineTotal = safeRegisterCounter({
  name: "pipeline_total",
  help: "Total pipeline executions",
  labelNames: ["status"] as const,
});

export class MetricsObserver implements PipelineObserver {
  private readonly stageTimers = new Map<StageName, () => void>();

  onEvent(event: PipelineEvent): void {
    switch (event.type) {
      case "stage:enter": {
        this.stageTimers.set(
          event.stage,
          pipelineStageDuration.startTimer({ stage: event.stage })
        );
        break;
      }

      case "stage:exit": {
        const stop = this.stageTimers.get(event.stage);
        stop?.();
        this.stageTimers.delete(event.stage);
        pipelineStageTotal.inc({ stage: event.stage, status: "success" });
        break;
      }

      case "stage:error": {
        pipelineStageTotal.inc({ stage: event.stage, status: "failure" });
        break;
      }

      case "agent:complete": {
        pipelineAgentTotal.inc({ status: event.outcome.status });
        break;
      }

      case "pipeline:complete": {
        pipelineTotal.inc({ status: "success" });
        break;
      }

      case "pipeline:failed": {
        pipelineTotal.inc({ status: "failure" });
        break;
      }
    }
  }
}
