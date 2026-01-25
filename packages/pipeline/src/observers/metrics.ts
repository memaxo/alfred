import * as client from "prom-client";

import type { PipelineEvent } from "../events";
import type { StageName } from "../pipeline";
import type { PipelineObserver } from "../runner";

const pipelineStageTotal = new client.Counter({
  name: "pipeline_stage_total",
  help: "Total pipeline stage executions",
  labelNames: ["stage", "status"],
});

const pipelineStageDuration = new client.Histogram({
  name: "pipeline_stage_duration_seconds",
  help: "Pipeline stage duration in seconds",
  labelNames: ["stage"],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300],
});

const pipelineAgentTotal = new client.Counter({
  name: "pipeline_agent_total",
  help: "Total agents spawned",
  labelNames: ["status"],
});

const pipelineTotal = new client.Counter({
  name: "pipeline_total",
  help: "Total pipeline executions",
  labelNames: ["status"],
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
