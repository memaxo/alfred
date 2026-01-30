type RagCacheMetricEvent = "hit" | "miss" | "eviction";

type PendingSnapshot = Record<RagCacheMetricEvent, number>;

const pending: PendingSnapshot = {
  hit: 0,
  miss: 0,
  eviction: 0,
};

const FLUSH_INTERVAL_MS = 5000;
const ENDPOINT = "/api/desktop/metrics";

let flushHandle: number | null = null;
let listenersRegistered = false;

function resetSnapshot() {
  pending.hit = 0;
  pending.miss = 0;
  pending.eviction = 0;
}

function scheduleFlush() {
  if (typeof window === "undefined") {
    return;
  }
  if (flushHandle !== null) {
    return;
  }
  flushHandle = window.setTimeout(() => {
    flushHandle = null;
    void flushMetrics();
  }, FLUSH_INTERVAL_MS);
}

async function flushMetrics() {
  if (typeof window === "undefined") {
    resetSnapshot();
    return;
  }
  const payload = {
    hits: pending.hit,
    misses: pending.miss,
    evictions: pending.eviction,
  };
  const total = payload.hits + payload.misses + payload.evictions;
  if (total === 0) {
    return;
  }
  resetSnapshot();
  const body = JSON.stringify(payload);
  const blob = new Blob([body], { type: "application/json" });
  const delivered =
    typeof navigator !== "undefined" && navigator.sendBeacon
      ? navigator.sendBeacon(ENDPOINT, blob)
      : false;
  if (delivered) {
    return;
  }
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      credentials: "include",
    });
  } catch {
    // Ignore network errors; metrics are best-effort.
  }
}

function ensureListeners() {
  if (typeof window === "undefined" || listenersRegistered) {
    return;
  }
  const flush = () => {
    if (flushHandle) {
      clearTimeout(flushHandle);
      flushHandle = null;
    }
    void flushMetrics();
  };
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flush();
    }
  });
  window.addEventListener("pagehide", flush);
  listenersRegistered = true;
}

export function queueRagCacheMetric(
  event: RagCacheMetricEvent,
  count = 1
): void {
  if (typeof window === "undefined") {
    return;
  }
  ensureListeners();
  pending[event] += count;
  scheduleFlush();
}
