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

let droidExecCounter: CounterLike | null = null;
let droidExecDurationHistogram: HistogramLike | null = null;
let codexExecCounter: CounterLike | null = null;
let codexExecDurationHistogram: HistogramLike | null = null;
let codexErrorCounter: SingleLabelCounter | null = null;
let evalRunsCounter: EvalRunCounter | null = null;
let evalRunDurationHistogram: EvalRunHistogram | null = null;
let evalScoreCounter: SingleLabelCounter | null = null;
let evalFailureCounter: FailureCounter | null = null;
let laminarDatapointCounter: SingleLabelCounter | null = null;
let laminarErrorCounter: SingleLabelCounter | null = null;
let assistantToolCounter: SingleLabelCounter | null = null;
let assistantEscalationCounter: SingleLabelCounter | null = null;
let memoryUpdatesCounter: DualLabelCounter | null = null;
let memoryForgetsCounter: SingleLabelCounter | null = null;

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
