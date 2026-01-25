import {
  clearInterval,
  clearTimeout,
  setInterval as setNodeInterval,
  setTimeout as setNodeTimeout,
} from "node:timers";

import type { Reporter, RunEvent, StepResult } from "./events.js";

import { serializeError } from "./error.js";

type DistOmit<T, K extends PropertyKey> = T extends any ? Omit<T, K> : never;
type LocalRunEvent = DistOmit<RunEvent, "runId" | "ts">;

export interface StepSpec {
  id: string;
  label: string;
  timeoutMs: number;
  retries?: number;
  retryBackoffMs?: number;
  fatal?: boolean;
  skip?: (ctx: RunCtx) => string | undefined;
  run: (ctx: StepCtx) => Promise<void>;
}

export interface RunCtx {
  runId: string;
  deadlineMs: number;
  defer: (fn: () => void | Promise<void>) => void;
  log: (stream: "stdout" | "stderr", text: string, stepId?: string) => void;
  emit: (event: LocalRunEvent) => void;
}

export interface StepCtx {
  runId: string;
  stepId: string;
  signal: AbortSignal;
  deadlineMs: number;
  defer: (fn: () => void | Promise<void>) => void;
  log: (stream: "stdout" | "stderr", text: string) => void;
  emit: (event: LocalRunEvent) => void;
}

export interface RunOptions {
  stallMs?: number;
  reporters?: Reporter[];
}

function now(): number {
  return Date.now();
}

async function emitAll(reporters: Reporter[] | undefined, event: RunEvent) {
  if (!reporters || reporters.length === 0) {
    return;
  }
  await Promise.all(reporters.map((r) => r.emit(event)));
}

async function closeAll(reporters: Reporter[] | undefined) {
  if (!reporters || reporters.length === 0) {
    return;
  }
  await Promise.all(reporters.map((r) => r.close?.()));
}

export async function runSteps(args: {
  runId: string;
  config: unknown;
  steps: StepSpec[];
  timeoutTotalMs: number;
  opts?: RunOptions;
  logRing?: { push: (line: string) => void };
}): Promise<{ ok: boolean; results: StepResult[] }> {
  const startedAt = now();
  const deadlineMs = startedAt + args.timeoutTotalMs;
  const reporters = args.opts?.reporters;
  const results: StepResult[] = [];
  const defers: (() => void | Promise<void>)[] = [];

  let activeStep: { id: string; label: string } | null = null;
  let lastActivityAt = now();
  let stalledEmittedAt: number | null = null;

  const emit = (event: LocalRunEvent) => {
    lastActivityAt = now();

    const full: RunEvent = {
      ...event,
      runId: args.runId,
      ts: lastActivityAt,
    } as RunEvent;

    void emitAll(reporters, full);
  };

  const log = (stream: "stdout" | "stderr", text: string, stepId?: string) => {
    lastActivityAt = now();
    args.logRing?.push(`[${stream}] ${text}`);
    void emitAll(reporters, {
      type: "log",
      runId: args.runId,
      ts: lastActivityAt,
      stream,
      text,
      stepId,
    });
  };

  const defer = (fn: () => void | Promise<void>) => {
    defers.push(fn);
  };

  const stallMs = args.opts?.stallMs ?? 30_000;
  const stallInterval = setNodeInterval(
    () => {
      if (!activeStep) {
        return;
      }
      const idle = now() - lastActivityAt;
      if (idle < stallMs) {
        return;
      }
      if (stalledEmittedAt && stalledEmittedAt >= lastActivityAt) {
        return;
      }
      stalledEmittedAt = now();
      emit({
        type: "step_stalled",
        id: activeStep.id,
        label: activeStep.label,
        msSinceActivity: idle,
      });
    },
    Math.min(stallMs, 5000)
  );
  stallInterval.unref();

  try {
    await emitAll(reporters, {
      type: "run_start",
      runId: args.runId,
      ts: startedAt,
      config: args.config,
    });

    const runCtx: RunCtx = {
      runId: args.runId,
      deadlineMs,
      defer,
      emit: (e) => emit(e),
      log,
    };

    for (const step of args.steps) {
      if (now() > deadlineMs) {
        const err = new Error("evals_run_deadline_exceeded");
        results.push({
          id: step.id,
          label: step.label,
          ok: false,
          startedAt: now(),
          finishedAt: now(),
          durationMs: 0,
          attempts: 0,
          error: serializeError(err),
        });
        break;
      }

      const skipReason = step.skip?.(runCtx);
      if (skipReason) {
        emit({
          type: "step_skip",
          id: step.id,
          label: step.label,
          reason: skipReason,
        });
        const ts = now();
        results.push({
          id: step.id,
          label: step.label,
          ok: true,
          startedAt: ts,
          finishedAt: ts,
          durationMs: 0,
          attempts: 0,
          skipped: true,
          skipReason,
        });
        continue;
      }

      const retries = Math.max(0, step.retries ?? 0);
      const backoff = Math.max(50, step.retryBackoffMs ?? 250);
      let attempt = 0;
      let success = false;
      let lastErr: unknown;
      const stepStartedAt = now();

      for (; attempt <= retries; attempt++) {
        activeStep = { id: step.id, label: step.label };
        stalledEmittedAt = null;
        const attemptStart = now();

        emit({
          type: "step_start",
          id: step.id,
          label: step.label,
          attempt: attempt + 1,
        });

        const stepCtrl = new AbortController();
        const timeoutId = setNodeTimeout(() => {
          stepCtrl.abort();
        }, step.timeoutMs);
        timeoutId.unref();

        try {
          const stepCtx: StepCtx = {
            runId: args.runId,
            stepId: step.id,
            deadlineMs,
            signal: stepCtrl.signal,
            defer,
            emit: (e) => emit(e),
            log: (stream, text) => log(stream, text, step.id),
          };

          await step.run(stepCtx);

          success = true;
          emit({
            type: "step_ok",
            id: step.id,
            label: step.label,
            attempt: attempt + 1,
            durationMs: now() - attemptStart,
          });
          break;
        } catch (error) {
          lastErr = error;
          emit({
            type: "step_fail",
            id: step.id,
            label: step.label,
            attempt: attempt + 1,
            durationMs: now() - attemptStart,
            error: serializeError(error),
          });

          if (attempt >= retries) {
            break;
          }

          const jitter = Math.floor(Math.random() * backoff);
          await new Promise((resolve) => {
            const t = setNodeTimeout(resolve, backoff + jitter);
            t.unref();
          });
        } finally {
          clearTimeout(timeoutId);
        }
      }

      activeStep = null;
      const stepFinishedAt = now();
      results.push({
        id: step.id,
        label: step.label,
        ok: success,
        startedAt: stepStartedAt,
        finishedAt: stepFinishedAt,
        durationMs: stepFinishedAt - stepStartedAt,
        attempts: attempt + 1,
        error: success ? undefined : serializeError(lastErr),
      });

      if (!success && (step.fatal ?? true)) {
        break;
      }
    }
  } finally {
    clearInterval(stallInterval);
    const ok = results.every((r) => r.ok);
    await emitAll(reporters, {
      type: "run_end",
      runId: args.runId,
      ts: now(),
      ok,
      results,
    });

    for (const fn of [...defers].toReversed()) {
      try {
        await fn();
      } catch {
        // ignore cleanup failures
      }
    }

    await closeAll(reporters);
  }

  return { ok: results.every((r) => r.ok), results };
}
