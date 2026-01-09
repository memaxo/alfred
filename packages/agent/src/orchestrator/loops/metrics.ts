/**
 * Ralph Loop Metrics
 *
 * Prometheus-compatible metrics for Ralph Wiggum loop execution.
 * Uses lazy registration pattern consistent with packages/agent/src/metrics.ts
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type RalphIterationCounter = {
  labels: (
    executor: string,
    iteration: string
  ) => { inc: (value?: number) => void };
};

type RalphCompletionCounter = {
  labels: (executor: string) => { inc: (value?: number) => void };
};

type RalphStuckCounter = {
  labels: (
    executor: string,
    reason: string
  ) => { inc: (value?: number) => void };
};

type RalphTimeoutCounter = {
  labels: (executor: string) => { inc: (value?: number) => void };
};

type RalphDurationHistogram = {
  startTimer: (labels: { executor: string }) => () => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// Counter References
// ─────────────────────────────────────────────────────────────────────────────

let ralphIterationCounter: RalphIterationCounter | null = null;
let ralphCompletionCounter: RalphCompletionCounter | null = null;
let ralphStuckCounter: RalphStuckCounter | null = null;
let ralphTimeoutCounter: RalphTimeoutCounter | null = null;
let ralphDurationHistogram: RalphDurationHistogram | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Registration Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register counter for ralph_iterations_total
 * Labels: executor (codex|droid), iteration (iteration number)
 */
export function registerRalphIterationCounter(counter: RalphIterationCounter) {
  ralphIterationCounter = counter;
}

/**
 * Register counter for ralph_completions_total
 * Labels: executor (codex|droid)
 */
export function registerRalphCompletionCounter(
  counter: RalphCompletionCounter
) {
  ralphCompletionCounter = counter;
}

/**
 * Register counter for ralph_stuck_total
 * Labels: executor (codex|droid), reason (max_iterations|stall|exact_match|semantic_similarity)
 */
export function registerRalphStuckCounter(counter: RalphStuckCounter) {
  ralphStuckCounter = counter;
}

/**
 * Register counter for ralph_timeout_total
 * Labels: executor (codex|droid)
 */
export function registerRalphTimeoutCounter(counter: RalphTimeoutCounter) {
  ralphTimeoutCounter = counter;
}

/**
 * Register histogram for ralph_duration_seconds
 * Labels: executor (codex|droid)
 */
export function registerRalphDurationHistogram(
  histogram: RalphDurationHistogram
) {
  ralphDurationHistogram = histogram;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recording Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record a Ralph loop iteration
 */
export function recordRalphIteration(
  executor: "codex" | "droid",
  iteration: number
) {
  ralphIterationCounter?.labels(executor, String(iteration)).inc();
}

/**
 * Record a Ralph loop completion (promise detected)
 */
export function recordRalphCompletion(
  executor: "codex" | "droid",
  iterations: number
) {
  ralphCompletionCounter?.labels(executor).inc();
  // Also record final iteration count for histogram-like analysis
  ralphIterationCounter?.labels(executor, `final:${iterations}`).inc();
}

/**
 * Record a Ralph loop stuck termination
 */
export function recordRalphStuck(executor: "codex" | "droid", reason: string) {
  // Normalize reason to avoid high cardinality
  const normalizedReason = normalizeStuckReason(reason);
  ralphStuckCounter?.labels(executor, normalizedReason).inc();
}

/**
 * Record a Ralph loop timeout
 */
export function recordRalphTimeout(executor: "codex" | "droid") {
  ralphTimeoutCounter?.labels(executor).inc();
}

/**
 * Start a Ralph loop duration timer
 */
export function startRalphDurationTimer(executor: "codex" | "droid") {
  return ralphDurationHistogram?.startTimer({ executor }) ?? (() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize stuck reason to avoid high cardinality metrics
 */
function normalizeStuckReason(reason: string): string {
  if (reason.startsWith("semantic_similarity")) {
    return "semantic_similarity";
  }
  if (reason.startsWith("stuck:")) {
    return reason.replace("stuck:", "");
  }
  if (reason.startsWith("error:")) {
    return "error";
  }
  if (reason.startsWith("timeout:")) {
    return "timeout";
  }
  return reason;
}
