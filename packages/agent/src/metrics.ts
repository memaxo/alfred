type CounterLike = {
  labels: (auto: string, exitCode: string) => { inc: (value?: number) => void };
};

type HistogramLike = {
  startTimer: (labels?: { auto: string }) => () => void;
};

type EvalRunCounter = {
  labels: (agent: string, status: string) => { inc: (value?: number) => void };
};

type EvalRunHistogram = {
  startTimer: (labels: { agent: string }) => () => void;
};

type SingleLabelCounter = {
  labels: (label: string) => { inc: (value?: number) => void };
};

type FailureCounter = {
  labels: (scorer: string, reason: string) => { inc: (value?: number) => void };
};

type DualLabelCounter = {
  labels: (labelA: string, labelB: string) => { inc: (value?: number) => void };
};

type CompressionHistogram = {
  startTimer: () => (labels: { outcome: string }) => void;
};

type SessionValidationHistogram = {
  startTimer: () => (labels: { outcome: string }) => void;
};

let droidExecCounter: CounterLike | null = null;
let droidExecDurationHistogram: HistogramLike | null = null;
let codexExecCounter: CounterLike | null = null;
let codexExecDurationHistogram: HistogramLike | null = null;
let codexErrorCounter: SingleLabelCounter | null = null;
let codexWriterErrorCounter: SingleLabelCounter | null = null;
let codexSessionViolationCounter: SingleLabelCounter | null = null;
let evalRunsCounter: EvalRunCounter | null = null;
let evalRunDurationHistogram: EvalRunHistogram | null = null;
let evalScoreCounter: SingleLabelCounter | null = null;
let evalFailureCounter: FailureCounter | null = null;
let laminarDatapointCounter: SingleLabelCounter | null = null;
let laminarErrorCounter: SingleLabelCounter | null = null;
let assistantToolCounter: SingleLabelCounter | null = null;
let assistantEscalationCounter: SingleLabelCounter | null = null;
let policyCheckFailureCounter: SingleLabelCounter | null = null;
let memoryUpdatesCounter: DualLabelCounter | null = null;
let memoryForgetsCounter: SingleLabelCounter | null = null;
let compressionCycleHistogram: CompressionHistogram | null = null;
let compressionCycleCounter: SingleLabelCounter | null = null;
let compressionNodeCounter: SingleLabelCounter | null = null;
let codexSessionValidationHistogram: SessionValidationHistogram | null = null;

export function registerDroidExecCounter(counter: CounterLike) {
  droidExecCounter = counter;
}

export function registerDroidExecHistogram(histogram: HistogramLike) {
  droidExecDurationHistogram = histogram;
}

export function recordDroidExecRun(auto: string, exitCode: number) {
  droidExecCounter?.labels(auto, String(exitCode)).inc();
}

export function startDroidExecTimer(auto: string) {
  return droidExecDurationHistogram?.startTimer({ auto }) ?? (() => {});
}

export function registerCodexExecCounter(counter: CounterLike) {
  codexExecCounter = counter;
}

export function registerCodexExecHistogram(histogram: HistogramLike) {
  codexExecDurationHistogram = histogram;
}

export function recordCodexExecRun(auto: string, exitCode: number) {
  codexExecCounter?.labels(auto, String(exitCode)).inc();
}

export function startCodexExecTimer(auto: string) {
  return codexExecDurationHistogram?.startTimer({ auto }) ?? (() => {});
}

export function registerCodexErrorCounter(counter: SingleLabelCounter) {
  codexErrorCounter = counter;
}

export function recordCodexError(stage: string) {
  codexErrorCounter?.labels(stage).inc();
}

export function registerCodexWriterErrorCounter(counter: SingleLabelCounter) {
  codexWriterErrorCounter = counter;
}

export function recordCodexWriterError(errorType: string) {
  codexWriterErrorCounter?.labels(errorType).inc();
}

export function registerCodexSessionViolationCounter(
  counter: SingleLabelCounter
) {
  codexSessionViolationCounter = counter;
}

export function recordCodexSessionViolation(reason: string) {
  codexSessionViolationCounter?.labels(reason).inc();
}

export function registerCodexSessionValidationHistogram(
  histogram: SessionValidationHistogram
) {
  codexSessionValidationHistogram = histogram;
}

export function startCodexSessionValidationTimer() {
  return (
    codexSessionValidationHistogram?.startTimer() ??
    ((_: { outcome: string }) => {})
  );
}

export function registerEvalRunsCounter(counter: EvalRunCounter) {
  evalRunsCounter = counter;
}

export function registerEvalDurationHistogram(histogram: EvalRunHistogram) {
  evalRunDurationHistogram = histogram;
}

export function registerEvalScoreCounter(counter: SingleLabelCounter) {
  evalScoreCounter = counter;
}

export function registerEvalFailureCounter(counter: FailureCounter) {
  evalFailureCounter = counter;
}

export function registerLaminarDatapointCounter(counter: SingleLabelCounter) {
  laminarDatapointCounter = counter;
}

export function registerLaminarErrorCounter(counter: SingleLabelCounter) {
  laminarErrorCounter = counter;
}

export function recordEvalRunStatus(agent: string, status: string) {
  evalRunsCounter?.labels(agent, status).inc();
}

export function startEvalRunTimer(agent: string) {
  return evalRunDurationHistogram?.startTimer({ agent }) ?? (() => {});
}

export function recordEvalScore(scorer: string) {
  evalScoreCounter?.labels(scorer).inc();
}

export function recordEvalFailure(scorer: string, reason: string) {
  evalFailureCounter?.labels(scorer, reason).inc();
}

export function recordLaminarDatapoint(status: string) {
  laminarDatapointCounter?.labels(status).inc();
}

export function recordLaminarError(stage: string) {
  laminarErrorCounter?.labels(stage).inc();
}

export function registerAssistantToolCounter(counter: SingleLabelCounter) {
  assistantToolCounter = counter;
}

export function recordAssistantToolCall(tool: string) {
  assistantToolCounter?.labels(tool).inc();
}

export function registerAssistantEscalationCounter(
  counter: SingleLabelCounter
) {
  assistantEscalationCounter = counter;
}

export function recordAssistantEscalation(kind: string) {
  assistantEscalationCounter?.labels(kind).inc();
}

export function registerPolicyCheckFailureCounter(counter: SingleLabelCounter) {
  policyCheckFailureCounter = counter;
}

export function recordPolicyCheckFailure(tool: string) {
  policyCheckFailureCounter?.labels(tool).inc();
}

export function registerMemoryUpdatesCounter(counter: DualLabelCounter) {
  memoryUpdatesCounter = counter;
}

export function recordMemoryUpdate(kind: string, source: string) {
  memoryUpdatesCounter?.labels(kind, source).inc();
}

export function registerMemoryForgetsCounter(counter: SingleLabelCounter) {
  memoryForgetsCounter = counter;
}

export function recordMemoryForget(scope: string) {
  memoryForgetsCounter?.labels(scope).inc();
}

export function registerCompressionCycleHistogram(
  histogram: CompressionHistogram
) {
  compressionCycleHistogram = histogram;
}

export function startCompressionCycleTimer() {
  return compressionCycleHistogram?.startTimer() ?? (() => {});
}

export function registerCompressionCycleCounter(counter: SingleLabelCounter) {
  compressionCycleCounter = counter;
}

export function recordCompressionCycle(outcome: string) {
  compressionCycleCounter?.labels(outcome).inc();
}

export function registerCompressionNodeCounter(counter: SingleLabelCounter) {
  compressionNodeCounter = counter;
}

export function recordCompressionNodeUpdate(kind: string, count: number) {
  compressionNodeCounter?.labels(kind).inc(count);
}

// Memory Tool Metrics
type MemoryToolCounter = {
  labels: (tool: string, status: string) => { inc: (value?: number) => void };
};

type MemorySearchHistogram = {
  observe: (value: number) => void;
};

type MemoryResultsHistogram = {
  observe: (value: number) => void;
};

type MemoryTraverseHistogram = {
  observe: (value: number) => void;
};

type MemoryBoostCounter = {
  inc: (value?: number) => void;
};

type MemoryRemovalCounter = {
  labels: (type: string) => { inc: (value?: number) => void };
};

let memoryToolCounter: MemoryToolCounter | null = null;
let memorySearchLatencyHistogram: MemorySearchHistogram | null = null;
let memorySearchResultsHistogram: MemoryResultsHistogram | null = null;
let memoryTraverseDepthHistogram: MemoryTraverseHistogram | null = null;
let memoryBoostCounter: MemoryBoostCounter | null = null;
let memoryRemovalCounter: MemoryRemovalCounter | null = null;

export function registerMemoryToolCounter(counter: MemoryToolCounter) {
  memoryToolCounter = counter;
}

export function recordMemoryToolCall(
  tool: string,
  status: "success" | "error"
) {
  memoryToolCounter?.labels(tool, status).inc();
}

export function registerMemorySearchLatencyHistogram(
  histogram: MemorySearchHistogram
) {
  memorySearchLatencyHistogram = histogram;
}

export function recordMemorySearchLatency(durationSeconds: number) {
  memorySearchLatencyHistogram?.observe(durationSeconds);
}

export function registerMemorySearchResultsHistogram(
  histogram: MemoryResultsHistogram
) {
  memorySearchResultsHistogram = histogram;
}

export function recordMemorySearchResults(count: number) {
  memorySearchResultsHistogram?.observe(count);
}

export function registerMemoryTraverseDepthHistogram(
  histogram: MemoryTraverseHistogram
) {
  memoryTraverseDepthHistogram = histogram;
}

export function recordMemoryTraverseDepth(depth: number) {
  memoryTraverseDepthHistogram?.observe(depth);
}

export function registerMemoryBoostCounter(counter: MemoryBoostCounter) {
  memoryBoostCounter = counter;
}

export function recordMemoryBoost() {
  memoryBoostCounter?.inc();
}

export function registerMemoryRemovalCounter(counter: MemoryRemovalCounter) {
  memoryRemovalCounter = counter;
}

export function recordMemoryRemoval(type: "archived" | "deleted") {
  memoryRemovalCounter?.labels(type).inc();
}
