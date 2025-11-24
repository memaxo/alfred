import type { FineTuneBackend, FineTuneRunPaths } from "./config";

export type FineTuneRunStatus = "success" | "failed" | "cancelled";

export type FineTuneRunSummary = {
  epochsCompleted?: number;
  stepsCompleted?: number;
  tokensProcessed?: number;
  samplesProcessed?: number;
  loss?: number;
  learningRate?: number;
};

export type FineTuneArtifacts = {
  outputDir: string;
  adaptersPath?: string;
  fusedModelDir?: string;
  metricsPath?: string;
};

export type FineTuneRunResult = {
  backend: FineTuneBackend;
  runId: string;
  status: FineTuneRunStatus;
  startedAt: Date;
  completedAt: Date;
  exitCode: number;
  paths: FineTuneRunPaths;
  artifacts: FineTuneArtifacts;
  summary?: FineTuneRunSummary;
};

export type FineTuneLogEvent = {
  source: "stdout" | "stderr" | "system";
  timestamp: number;
  raw: string;
  level?: "info" | "warn" | "error";
  data?: Record<string, unknown>;
};

export type FineTuneJobOptions = {
  runsRoot?: string;
  workspaceRoot?: string;
  pythonBin?: string;
  env?: Record<string, string>;
  abortSignal?: AbortSignal;
  onLog?: (event: FineTuneLogEvent) => void;
};
