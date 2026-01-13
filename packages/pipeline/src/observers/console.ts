import type { PipelineEvent } from "../events";
import type { PipelineObserver } from "../runner";

export class ConsoleObserver implements PipelineObserver {
  constructor(prefix = "[pipeline]") {
    this.prefix = prefix;
  }

  onEvent(event: PipelineEvent): void {
    const _time = new Date(event.timestamp).toISOString();
    switch (event.type) {
      case "stage:enter":
        break;
      case "stage:exit":
        break;
      case "stage:error":
        break;
      case "stage:progress":
        break;
      case "agent:spawn":
        break;
      case "agent:complete":
        break;
      case "pipeline:complete":
        break;
      case "pipeline:failed":
        break;
    }
  }

  onComplete(): void {}
}
