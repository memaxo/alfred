import { AsyncQueue } from "@alfred/runtime/utils/concurrency";

import type { PipelineEvent } from "../events";
import type { PipelineObserver } from "../runner";

export class PipelineEventQueueObserver implements PipelineObserver {
  private readonly queue = new AsyncQueue<PipelineEvent>();

  onEvent(event: PipelineEvent): void {
    this.queue.enqueue(event);
  }

  onComplete(): void {
    this.queue.close();
  }

  close(): void {
    this.queue.close();
  }

  stream(): AsyncIterable<PipelineEvent> {
    return this.queue;
  }
}
