/**
 * ALFRED TUI Metrics Subscription
 *
 * Polls performance metrics for system health visualization.
 */

import type { SubscriptionManager } from "./manager";

// ─── Types ───────────────────────────────────────────────────────────────────

export type LatencyMetrics = {
  p50: number;
  p99: number;
  avg: number;
};

export type RouterMetrics = {
  name: string;
  requests: number;
  errors: number;
  latency: LatencyMetrics;
};

export type SystemMetrics = {
  requestsPerMinute: number;
  errorsPerMinute: number;
  activeConnections: number;
  memoryUsageMb: number;
  cpuPercent: number;
};

export type MetricsState = {
  system: SystemMetrics;
  routers: RouterMetrics[];
  latencyHistory: number[]; // Recent latency samples for sparkline
  requestHistory: number[]; // Recent request counts for sparkline
  timestamp: number;
};

// ─── Mock Data ───────────────────────────────────────────────────────────────

const mockRouters = [
  "assistant",
  "cognitive",
  "workflow",
  "voice",
  "knowledge",
];

function mockMetricsState(previous?: MetricsState): MetricsState {
  const baseRequests = 100 + Math.random() * 150;
  const baseLatency = 50 + Math.random() * 100;

  // Generate smooth-ish history by slightly modifying previous values
  const prevLatency = previous?.latencyHistory ?? [];
  const prevRequests = previous?.requestHistory ?? [];

  const lastLatency = prevLatency.at(-1);
  const newLatency =
    lastLatency !== undefined
      ? lastLatency * (0.8 + Math.random() * 0.4)
      : baseLatency;

  const lastRequests = prevRequests.at(-1);
  const newRequests =
    lastRequests !== undefined
      ? lastRequests * (0.8 + Math.random() * 0.4)
      : baseRequests;

  return {
    system: {
      requestsPerMinute: Math.round(baseRequests),
      errorsPerMinute: Math.floor(Math.random() * 5),
      activeConnections: Math.floor(1 + Math.random() * 10),
      memoryUsageMb: Math.round(150 + Math.random() * 100),
      cpuPercent: Math.round(5 + Math.random() * 30),
    },
    routers: mockRouters.map((name) => ({
      name,
      requests: Math.floor(10 + Math.random() * 50),
      errors: Math.floor(Math.random() * 3),
      latency: {
        p50: Math.round(30 + Math.random() * 50),
        p99: Math.round(100 + Math.random() * 200),
        avg: Math.round(50 + Math.random() * 70),
      },
    })),
    latencyHistory: [...prevLatency.slice(-19), newLatency],
    requestHistory: [...prevRequests.slice(-19), newRequests],
    timestamp: Date.now(),
  };
}

// ─── Metrics Store ───────────────────────────────────────────────────────────

export class MetricsStore {
  private state: MetricsState | null = null;
  private readonly listeners: Set<(state: MetricsState) => void> = new Set();

  getState(): MetricsState | null {
    return this.state;
  }

  getSystemMetrics(): SystemMetrics | null {
    return this.state?.system ?? null;
  }

  getRouterMetrics(name: string): RouterMetrics | undefined {
    return this.state?.routers.find((r) => r.name === name);
  }

  getLatencyHistory(): number[] {
    return this.state?.latencyHistory ?? [];
  }

  getRequestHistory(): number[] {
    return this.state?.requestHistory ?? [];
  }

  update(newState: MetricsState): void {
    this.state = newState;
    this.notify();
  }

  subscribe(listener: (state: MetricsState) => void): () => void {
    this.listeners.add(listener);
    if (this.state) {
      listener(this.state);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    if (!this.state) {
      return;
    }
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

// ─── Metrics Subscription Setup ──────────────────────────────────────────────

export type MetricsSubscriptionOptions = {
  manager: SubscriptionManager;
  store: MetricsStore;
  pollingInterval?: number;
  useMockData?: boolean;
};

export function setupMetricsSubscription(
  options: MetricsSubscriptionOptions
): void {
  const {
    manager,
    store,
    pollingInterval = 2000,
    useMockData = true, // TODO: Switch to false when API ready
  } = options;

  let previousState: MetricsState | undefined;

  if (useMockData) {
    manager.addPolling({
      id: "metrics",
      fetch: () => {
        const state = mockMetricsState(previousState);
        previousState = state;
        return Promise.resolve(state);
      },
      onData: (state) => store.update(state),
      onError: (_error) => {},
      interval: pollingInterval,
      immediate: true,
    });
  } else {
    // Use real API polling
    manager.addPolling({
      id: "metrics",
      fetch: () => {
        // const client = getTrpcClient();
        // const stats = await client.admin.getPerformanceStats.query();
        // return transformToMetricsState(stats);
        const state = mockMetricsState(previousState);
        previousState = state;
        return Promise.resolve(state);
      },
      onData: (state) => store.update(state),
      onError: (_error) => {},
      interval: pollingInterval,
      immediate: true,
    });
  }
}

// ─── Sparkline Helpers ───────────────────────────────────────────────────────

export function normalizeForSparkline(
  values: number[],
  targetLength = 20
): number[] {
  if (values.length === 0) {
    return [];
  }
  if (values.length <= targetLength) {
    return values;
  }
  return values.slice(-targetLength);
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createMetricsStore(): MetricsStore {
  return new MetricsStore();
}
