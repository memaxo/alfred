import type { StreamEvent } from "@alfred/type/stream";

type ResolveFn = (value: StreamEvent) => void;

export type MockStreamController = {
  emit(event: StreamEvent): void;
  error(error: Error): void;
  close(): void;
  next(kind?: StreamEvent["_"], timeoutMs?: number): Promise<StreamEvent>;
};

export function createMockStream(
  seed: StreamEvent[] = []
): MockStreamController {
  const queue: StreamEvent[] = [...seed];
  const listeners: ResolveFn[] = [];
  let isClosed = false;

  function flush() {
    if (listeners.length === 0 || queue.length === 0) {
      return;
    }
    const listener = listeners.shift();
    const event = queue.shift();
    if (listener && event) {
      listener(event);
    }
  }

  return {
    emit(event: StreamEvent) {
      if (isClosed) {
        return;
      }
      queue.push(event);
      flush();
    },
    error(error: Error) {
      if (isClosed) {
        return;
      }
      isClosed = true;
      while (listeners.length > 0) {
        const listener = listeners.shift();
        if (listener) {
          throw error;
        }
      }
    },
    close() {
      isClosed = true;
      queue.length = 0;
      listeners.length = 0;
    },
    next(kind?: StreamEvent["_"], timeoutMs = 1000): Promise<StreamEvent> {
      if (isClosed) {
        throw new Error("stream_closed");
      }
      const match = (event: StreamEvent) => (kind ? event._ === kind : true);
      const existingIndex = queue.findIndex(match);
      if (existingIndex >= 0) {
        const [event] = queue.splice(existingIndex, 1);
        if (!event) {
          throw new Error("stream_queue_error");
        }
        return Promise.resolve(event);
      }
      return new Promise<StreamEvent>((resolve, reject) => {
        const timer = setTimeout(() => {
          const index = listeners.indexOf(resolveListener);
          if (index >= 0) {
            listeners.splice(index, 1);
          }
          reject(new Error(`stream_timeout_${kind ?? "any"}`));
        }, timeoutMs);

        const resolveListener: ResolveFn = (event) => {
          if (!match(event)) {
            queue.push(event);
            return;
          }
          clearTimeout(timer);
          resolve(event);
        };
        listeners.push(resolveListener);
        flush();
      });
    },
  };
}

export function waitForStreamMessage(
  controller: MockStreamController,
  kind: StreamEvent["_"],
  timeoutMs = 1000
): Promise<StreamEvent> {
  return controller.next(kind, timeoutMs);
}
