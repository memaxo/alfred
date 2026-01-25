export interface SerializedError {
  message: string;
  name?: string;
  stack?: string;
  code?: string;
  details?: Record<string, unknown>;
  cause?: SerializedError;
}

export interface StepResult {
  id: string;
  label: string;
  ok: boolean;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  attempts: number;
  error?: SerializedError;
  skipped?: boolean;
  skipReason?: string;
}

export interface RunEventBase {
  runId: string;
  ts: number;
}

export type RunEvent =
  | (RunEventBase & {
      type: "run_start";
      config: unknown;
    })
  | (RunEventBase & {
      type: "run_end";
      ok: boolean;
      results: StepResult[];
    })
  | (RunEventBase & {
      type: "step_start";
      id: string;
      label: string;
      attempt: number;
    })
  | (RunEventBase & {
      type: "step_ok";
      id: string;
      label: string;
      attempt: number;
      durationMs: number;
    })
  | (RunEventBase & {
      type: "step_fail";
      id: string;
      label: string;
      attempt: number;
      durationMs: number;
      error: SerializedError;
    })
  | (RunEventBase & {
      type: "step_skip";
      id: string;
      label: string;
      reason: string;
    })
  | (RunEventBase & {
      type: "step_stalled";
      id: string;
      label: string;
      msSinceActivity: number;
    })
  | (RunEventBase & {
      type: "log";
      stream: "stdout" | "stderr";
      text: string;
      stepId?: string;
    })
  | (RunEventBase & {
      type: "artifact";
      kind: string;
      path: string;
    });

export interface Reporter {
  emit: (event: RunEvent) => void | Promise<void>;
  close?: () => void | Promise<void>;
}
