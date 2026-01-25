import type { Reporter, StepResult } from "./events.js";

export type ExecutorEvalsTransport = "acp" | "http";
export type ExecutorEvalsProfiles = "default" | "server" | "both";
export type ExecutorEvalsRetain = "never" | "on-fail" | "always";
export type ExecutorEvalsPull = "missing" | "always" | "never";

export interface ExecutorEvalsTimeouts {
  totalMs: number;
  dockerMs: number;
  codexMs: number;
  opencodeMs: number;
}

export interface ExecutorEvalsSkip {
  codex?: boolean;
  opencode?: boolean;
  crashRecovery?: boolean;
}

export interface ExecutorEvalsConfig {
  runId?: string;

  confirmCost: boolean;
  preflightOnly?: boolean;

  artifactsDir?: string;
  reporters?: Reporter[];

  transport: ExecutorEvalsTransport;
  profiles: ExecutorEvalsProfiles;
  strict?: boolean;

  image?: string;
  skipBuild?: boolean;
  pull?: ExecutorEvalsPull;
  retain: ExecutorEvalsRetain;

  authz?: string;

  skip?: ExecutorEvalsSkip;
  timeouts?: Partial<ExecutorEvalsTimeouts>;
}

export type ExecutorEvalsStatus =
  | "completed"
  | "failed"
  | "preflight_only"
  | "skipped_cost";

export interface ExecutorEvalsResult {
  runId: string;
  ok: boolean;
  status: ExecutorEvalsStatus;
  artifactsDir?: string;
  results: StepResult[];
}
