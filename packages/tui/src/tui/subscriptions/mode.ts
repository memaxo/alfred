import type { SubscriptionManager } from "./manager";

export type DataMode = "live" | "mock";

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function resolveMode(): DataMode {
  return isTruthyEnv(process.env.ALFRED_TUI_MOCK) ? "mock" : "live";
}

function asError(err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }
  return new Error(typeof err === "string" ? err : "tui_unknown_error");
}

export type FallbackPollingOptions<T> = {
  manager: SubscriptionManager;
  id: string;
  interval: number;
  immediate?: boolean;
  mode?: DataMode;
  maxFailures?: number;
  shouldFallback?: (error: Error) => boolean;
  fetchLive: () => Promise<T>;
  fetchMock: () => Promise<T>;
  onData: (data: T) => void;
  onError?: (error: Error) => void;
};

export function addPollingWithFallback<T>(
  options: FallbackPollingOptions<T>
): void {
  const mode0 = options.mode ?? resolveMode();
  const maxFailures = options.maxFailures ?? 3;
  const shouldFallback =
    options.shouldFallback ??
    ((error: Error) => error.message === "tui_live_unavailable");

  if (mode0 === "mock") {
    options.manager.addPolling({
      id: options.id,
      fetch: options.fetchMock,
      onData: options.onData,
      onError: options.onError,
      interval: options.interval,
      immediate: options.immediate,
    });
    return;
  }

  let mode: DataMode = "live";
  let failures = 0;
  let hasLive = false;
  let lastLive: T | null = null;

  options.manager.addPolling({
    id: options.id,
    fetch: async () => {
      if (mode === "mock") {
        return await options.fetchMock();
      }

      try {
        const next = await options.fetchLive();
        failures = 0;
        hasLive = true;
        lastLive = next;
        return next;
      } catch (err) {
        const error = asError(err);

        if (!shouldFallback(error)) {
          throw error;
        }

        failures += 1;

        // On first load, prefer showing something rather than a blank panel.
        if (!hasLive) {
          return await options.fetchMock();
        }

        // Keep last good live data until we hit the fallback threshold.
        if (failures < maxFailures) {
          if (lastLive) {
            return lastLive;
          }
          throw error;
        }

        mode = "mock";
        return await options.fetchMock();
      }
    },
    onData: options.onData,
    onError: options.onError,
    interval: options.interval,
    immediate: options.immediate,
  });
}
