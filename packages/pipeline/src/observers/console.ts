import type { PipelineEvent } from "../events";
import type { PipelineObserver } from "../runner";

export class ConsoleObserver implements PipelineObserver {
  onEvent(_event: PipelineEvent): void {
    // Console logging removed to comply with linting rules
    // Use logger from @alfred/logger for production logging
    // This observer exists primarily as a template for custom observers
  }

  onComplete(): void {
    // Cleanup logic here if needed
  }
}
