/**
 * EventSource/SSE mock helper for testing streaming subscriptions
 */

export class MockEventSource {
  url: string;
  readyState: number;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private messages: { data: string; event?: string }[] = [];
  private closed = false;
  private openTimer: ReturnType<typeof setTimeout> | null = null;

  static instances: MockEventSource[] = [];

  constructor(url: string) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    MockEventSource.instances.push(this);

    // Simulate connection after a tick
    this.openTimer = setTimeout(() => {
      if (!this.closed) {
        this.readyState = 1; // OPEN
        this.onopen?.(new Event("open"));
        // Process queued messages
        for (const msg of this.messages) {
          if (this.onmessage) {
            this.onmessage(new MessageEvent("message", { data: msg.data }));
          }
        }
        this.messages = [];
      }
    }, 0);
  }

  addMessage(data: string, event?: string): void {
    if (this.readyState === 1 && this.onmessage) {
      this.onmessage(new MessageEvent("message", { data }));
    } else if (this.readyState === 0) {
      this.messages.push({ data, event });
    }
  }

  close(): void {
    this.closed = true;
    this.readyState = 2; // CLOSED
    if (this.openTimer) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }
  }

  static reset(): void {
    for (const instance of MockEventSource.instances) {
      instance.close();
    }
    MockEventSource.instances = [];
  }
}

/**
 * Sets up EventSource mock globally for tests.
 * Call this in test setup files.
 */
export function setupEventSourceMock(): void {
  if (typeof globalThis !== "undefined") {
    (
      globalThis as typeof globalThis & { EventSource: typeof MockEventSource }
    ).EventSource = MockEventSource;
  }
}
