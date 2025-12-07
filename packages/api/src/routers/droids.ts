import { randomUUID } from "node:crypto";
import {
  DEFAULT_TIMEOUT_SEC,
  ELEVATED_TIMEOUT_THRESHOLD_SEC,
  MAX_TIMEOUT_SEC,
  MIN_TIMEOUT_SEC,
} from "@alfred/agent/orchestrator/tool/codex/constants";
import { resolveExecutable } from "@alfred/agent/orchestrator/tool/shared";
import type { ResumePayload } from "@alfred/agent/workflow/registry";
import { runRegistry } from "@alfred/agent/workflow/registry";
import {
  registerRunHandle,
  StreamNotAttachedError,
  unregisterRunHandle,
} from "@alfred/agent/workflow/session-recovery";
import { droidExecRunsTotal } from "@alfred/api/metrics";
import { getRedis } from "@alfred/auth/redis";
import {
  requireToolScopesAndPolicy,
  type TokenClaims,
} from "@alfred/auth/token";
import { resolveObligationResumeEvents } from "@alfred/type";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import z from "zod";
import { PolicyObligationError } from "../errors";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";

const droidRunInputSchema = z.object({
  prompt: z.string().min(1),
  auto: z.enum(["read", "low", "medium", "high"]).default("read"),
  authz: z.string().min(1, "authz token required"),
  out: z.enum(["text", "json", "debug"]).default("text"),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  cw: z.string().optional(),
  timeoutSec: z
    .number()
    .int()
    .min(MIN_TIMEOUT_SEC)
    .max(MAX_TIMEOUT_SEC, { message: "codex_timeout_exceeds_limit" })
    .optional(),
});

type DroidRunInput = z.infer<typeof droidRunInputSchema>;
type StoredDroidInput = Omit<DroidRunInput, "authz">;

type DroidRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type StreamSession = {
  start: (input: DroidRunInput) => Promise<void>;
  cancel: () => void;
};

type PendingResumeEntry =
  | { type: "run"; input: StoredDroidInput }
  | { type: "stream"; input: StoredDroidInput; streamSession?: StreamSession };

type ResumeCompletion =
  | { kind: "run"; result: DroidRunResult }
  | { kind: "stream"; status: "ready" };

const pendingResumableRuns = new Map<string, PendingResumeEntry>();

const RESUME_RESULT_TTL_SEC = 15 * 60;
const PENDING_ENTRY_TTL_SEC = 30 * 60;
const KEY_RESUME_RESULT = (runId: string) => `droid:resume:${runId}:result`;
const KEY_PENDING_ENTRY = (runId: string) => `droid:pending:${runId}`;

type LocalResultEntry = {
  payload: ResumeCompletion;
  expiresAt: number;
};

type PendingRunRecord = {
  type: PendingResumeEntry["type"];
  input: StoredDroidInput;
  createdAt: number;
};

type LocalPendingEntry = {
  record: PendingRunRecord;
  expiresAt: number;
};

const localResumeResults = new Map<string, LocalResultEntry>();
const localPendingRecords = new Map<string, LocalPendingEntry>();

function normalizeTimeout(timeoutSec?: number): number {
  if (typeof timeoutSec !== "number" || Number.isNaN(timeoutSec)) {
    return DEFAULT_TIMEOUT_SEC;
  }
  return Math.min(Math.max(timeoutSec, MIN_TIMEOUT_SEC), MAX_TIMEOUT_SEC);
}

function ensureTimeoutAuthorization(timeoutSec: number, claims?: TokenClaims) {
  if (timeoutSec > MAX_TIMEOUT_SEC) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "codex_timeout_exceeds_limit",
    });
  }
  if (
    timeoutSec > ELEVATED_TIMEOUT_THRESHOLD_SEC &&
    (!claims?.elevated || claims?.mfa !== "passkey")
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "codex_timeout_requires_elevation",
    });
  }
}

function cloneStoredInput(input: DroidRunInput): StoredDroidInput {
  return {
    prompt: input.prompt,
    auto: input.auto,
    out: input.out,
    command: input.command,
    args: input.args ? [...input.args] : undefined,
    cw: input.cw,
    timeoutSec: normalizeTimeout(input.timeoutSec),
  };
}

function hydrateInput(stored: StoredDroidInput, authz: string): DroidRunInput {
  return {
    ...stored,
    authz,
    args: stored.args ? [...stored.args] : undefined,
    timeoutSec: stored.timeoutSec,
  };
}

async function persistPendingRecord(runId: string, record: PendingRunRecord) {
  const redis = getRedis();
  const encoded = JSON.stringify(record);
  if (redis) {
    try {
      await (
        redis.set as unknown as (
          key: string,
          value: string,
          options: { EX: number }
        ) => Promise<string>
      )(KEY_PENDING_ENTRY(runId), encoded, { EX: PENDING_ENTRY_TTL_SEC });
      return;
    } catch {
      // fallback
    }
  }
  localPendingRecords.set(runId, {
    record,
    expiresAt: Date.now() + PENDING_ENTRY_TTL_SEC * 1000,
  });
}

async function removePendingRecord(runId: string) {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(KEY_PENDING_ENTRY(runId));
    } catch {
      // ignore
    }
  }
  localPendingRecords.delete(runId);
}

async function loadPendingRecord(
  runId: string
): Promise<PendingRunRecord | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(KEY_PENDING_ENTRY(runId));
      if (raw) {
        return JSON.parse(raw) as PendingRunRecord;
      }
    } catch {
      // ignore parse errors
    }
  }
  const entry = localPendingRecords.get(runId);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt < Date.now()) {
    localPendingRecords.delete(runId);
    return null;
  }
  return entry.record;
}

async function saveResumeResult(runId: string, payload: ResumeCompletion) {
  const redis = getRedis();
  const encoded = JSON.stringify(payload);
  if (redis) {
    try {
      await (
        redis.set as unknown as (
          key: string,
          value: string,
          options: { EX: number }
        ) => Promise<string>
      )(KEY_RESUME_RESULT(runId), encoded, { EX: RESUME_RESULT_TTL_SEC });
      return;
    } catch {
      // fallback
    }
  }
  localResumeResults.set(runId, {
    payload,
    expiresAt: Date.now() + RESUME_RESULT_TTL_SEC * 1000,
  });
}

async function consumeResumeResult(
  runId: string
): Promise<ResumeCompletion | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(KEY_RESUME_RESULT(runId));
      if (raw) {
        await redis.del(KEY_RESUME_RESULT(runId));
        return JSON.parse(raw) as ResumeCompletion;
      }
    } catch {
      // ignore and fallback
    }
  }
  const entry = localResumeResults.get(runId);
  if (!entry) {
    return null;
  }
  localResumeResults.delete(runId);
  if (entry.expiresAt < Date.now()) {
    return null;
  }
  return entry.payload;
}

function createScript(prompt: string, out: DroidRunInput["out"]) {
  if (out === "json") {
    const payload = { prompt };
    return `console.log(JSON.stringify(${JSON.stringify(payload)}));`;
  }
  return `console.log(${JSON.stringify(`[droid] ${prompt}`)});`;
}

function spawnDroidProcess(input: DroidRunInput) {
  let command: string;
  if (input.command) {
    // Resolve command from PATH if not absolute
    command = resolveExecutable(input.command, "droid");
  } else {
    // Default to Bun executable
    command = process.execPath;
  }

  const args = input.args ?? ["-e", createScript(input.prompt, input.out)];

  return Bun.spawn([command, ...args], {
    cwd: input.cw ?? process.cwd(),
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
}

async function executeDroidRun(input: DroidRunInput): Promise<DroidRunResult> {
  const proc = spawnDroidProcess(input);

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  if (proc.stdout && typeof proc.stdout !== "number") {
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          stdoutChunks.push(decoder.decode(value));
        }
      } catch {
        // Ignore stream read errors
      }
    })();
  }

  if (proc.stderr && typeof proc.stderr !== "number") {
    const reader = proc.stderr.getReader();
    const decoder = new TextDecoder();

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          stderrChunks.push(decoder.decode(value));
        }
      } catch {
        // Ignore stderr read errors
      }
    })();
  }

  const exitCode = await proc.exited;
  droidExecRunsTotal.labels(input.auto, String(exitCode)).inc();

  return {
    exitCode,
    stdout: stdoutChunks.join(""),
    stderr: stderrChunks.join(""),
  };
}

async function loadPendingOrFail(runId: string): Promise<PendingResumeEntry> {
  const existing = pendingResumableRuns.get(runId);
  if (existing) {
    return existing;
  }
  const record = await loadPendingRecord(runId);
  if (!record) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "run_not_found_or_expired",
    });
  }
  const pending: PendingResumeEntry = { type: record.type, input: record.input };
  pendingResumableRuns.set(runId, pending);
  return pending;
}

async function handleResume(runId: string, resumeData: ResumePayload) {
  if (resumeData.event !== "bio-authz" && resumeData.event !== "mfa-authz") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "unsupported_resume_event",
    });
  }

  const pending = await loadPendingOrFail(runId);
  const resumedInput = hydrateInput(pending.input, resumeData.authz);

  const { decision, claims } = await requireToolScopesAndPolicy(
    resumedInput.authz,
    ["droid.exec"],
    {
      action: "droid.exec",
      resource: buildPolicyResource(resumedInput),
      context: buildPolicyContext(resumedInput),
    }
  );

  ensureTimeoutAuthorization(
    resumedInput.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
    claims
  );

  const obligations = decision.obligations ?? [];
  if (obligations.length > 0) {
    throw new PolicyObligationError("droid.exec", obligations, {
      reason: "droid_execution",
      runId,
    });
  }

  if (pending.type === "run") {
    const result = await executeDroidRun(resumedInput);
    await saveResumeResult(runId, { kind: "run", result });
  } else {
    const session = pending.streamSession;
    if (session) {
      await session.start(resumedInput);
      await saveResumeResult(runId, { kind: "stream", status: "ready" });
    } else {
      await saveResumeResult(runId, { kind: "stream", status: "ready" });
    }
  }

  pendingResumableRuns.delete(runId);
  await removePendingRecord(runId);
  await unregisterRunHandle(runId);
}

function buildPolicyResource(input: StoredDroidInput | DroidRunInput) {
  return {
    kind: "repo",
    id: input.cw,
  } as const;
}

function buildPolicyContext(input: StoredDroidInput | DroidRunInput) {
  return { auto: input.auto } as const;
}

async function registerResumableRun(runId: string, entry: PendingResumeEntry) {
  pendingResumableRuns.set(runId, entry);
  await persistPendingRecord(runId, {
    type: entry.type,
    input: entry.input,
    createdAt: Date.now(),
  });
  const abortController = new AbortController();

  try {
    await registerRunHandle(runId, {
      resume: async ({ resumeData }) => {
        await handleResume(runId, resumeData);
      },
      cancel: async () => {
        pendingResumableRuns.delete(runId);
        await removePendingRecord(runId);
        abortController.abort();
        if (entry.type === "stream") {
          entry.streamSession?.cancel();
        }
      },
      abortController,
    });
  } catch (error) {
    pendingResumableRuns.delete(runId);
    await removePendingRecord(runId);
    throw error;
  }
}

async function cancelPendingRun(runId: string) {
  pendingResumableRuns.delete(runId);
  await removePendingRecord(runId);
  try {
    await unregisterRunHandle(runId);
  } catch {
    // ignore
  }
}

const droidProcedures = {
  run: authedProcedure
    .use(
      requirePolicy(
        "droid.exec",
        (raw) => {
          const input = (raw ?? {}) as DroidRunInput;
          return {
            kind: "repo",
            id: input.cw,
          };
        },
        (raw) => {
          const input = (raw ?? {}) as DroidRunInput;
          return { auto: input.auto };
        },
        { handleObligations: "passThrough" }
      )
    )
    .input(droidRunInputSchema)
    .mutation(async ({ input, ctx }) => {
      const normalizedInput: DroidRunInput = {
        ...input,
        timeoutSec: normalizeTimeout(input.timeoutSec),
      };
      const { decision, claims } = await requireToolScopesAndPolicy(
        normalizedInput.authz,
        ["droid.exec"],
        {
          action: "droid.exec",
          resource: buildPolicyResource(normalizedInput),
          context: buildPolicyContext(normalizedInput),
        }
      );

      ensureTimeoutAuthorization(
        normalizedInput.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
        claims
      );

      const obligations = ctx.policy?.obligations ?? decision.obligations ?? [];
      if (obligations.length > 0) {
        const runId = randomUUID();
        await registerResumableRun(runId, {
          type: "run",
          input: cloneStoredInput(normalizedInput),
        });
        throw new PolicyObligationError("droid.exec", obligations, {
          reason: "droid_execution",
          runId,
        });
      }

      return executeDroidRun(normalizedInput);
    }),

  stream: authedProcedure
    .use(
      requirePolicy(
        "droid.exec",
        (raw) => {
          const input = (raw ?? {}) as DroidRunInput;
          return {
            kind: "repo",
            id: input.cw,
          };
        },
        (raw) => {
          const input = (raw ?? {}) as DroidRunInput;
          return { auto: input.auto };
        },
        { handleObligations: "passThrough" }
      )
    )
    .input(droidRunInputSchema)
    .subscription(({ input, ctx }) =>
      observable<{ type: string; data?: string; code?: number }>((emit) => {
        const normalizedInput: DroidRunInput = {
          ...input,
          timeoutSec: normalizeTimeout(input.timeoutSec),
        };
        let proc: ReturnType<typeof spawnDroidProcess> | null = null;
        let closed = false;
        let runId: string | null = null;

        const stopProcess = () => {
          if (proc && !proc.killed) {
            proc.kill("SIGTERM");
          }
          proc = null;
        };

        const startStreaming = async (execInput: DroidRunInput) => {
          if (closed) {
            return;
          }
          proc = spawnDroidProcess(execInput);

          if (proc.stdout && typeof proc.stdout !== "number") {
            const reader = proc.stdout.getReader();
            const decoder = new TextDecoder();

            (async () => {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done || closed) {
                    break;
                  }
                  emit.next({ type: "stdout", data: decoder.decode(value) });
                }
              } catch (error) {
                if (!closed) {
                  emit.error(error);
                }
              }
            })();
          }

          if (proc.stderr && typeof proc.stderr !== "number") {
            const reader = proc.stderr.getReader();
            const decoder = new TextDecoder();

            (async () => {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done || closed) {
                    break;
                  }
                  emit.next({ type: "stderr", data: decoder.decode(value) });
                }
              } catch (error) {
                if (!closed) {
                  emit.error(error);
                }
              }
            })();
          }

          proc.exited
            .then((code) => {
              if (closed) {
                return;
              }
              droidExecRunsTotal
                .labels(execInput.auto, String(code ?? 0))
                .inc();
              emit.next({ type: "exit", code: code ?? 0 });
              emit.complete();
            })
            .catch((error) => {
              if (!closed) {
                emit.error(error);
              }
            });
        };

        void (async () => {
          const { decision, claims } = await requireToolScopesAndPolicy(
            normalizedInput.authz,
            ["droid.exec"],
            {
              action: "droid.exec",
              resource: buildPolicyResource(normalizedInput),
              context: buildPolicyContext(normalizedInput),
            }
          );

          ensureTimeoutAuthorization(
            normalizedInput.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
            claims
          );

          const obligations =
            ctx.policy?.obligations ?? decision.obligations ?? [];
          if (obligations.length > 0) {
            runId = randomUUID();
            const streamSession: StreamSession = {
              start: async (resumedInput) => {
                if (closed) {
                  return;
                }
                emit.next({ type: "resume", data: JSON.stringify({ runId }) });
                await startStreaming(resumedInput);
              },
              cancel: () => {
                stopProcess();
              },
            };
            await registerResumableRun(runId, {
              type: "stream",
              input: cloneStoredInput(normalizedInput),
              streamSession,
            });
            emit.next({
              type: "obligation",
              data: JSON.stringify({
                reason: "droid_execution",
                obligations,
                runId,
                resumeEvents: resolveObligationResumeEvents(obligations),
              }),
            });
            return;
          }

          await startStreaming(normalizedInput);
        })().catch((error) => {
          if (!closed) {
            emit.error(error);
          }
        });

        return () => {
          closed = true;
          stopProcess();
          if (runId) {
            void cancelPendingRun(runId);
          }
        };
      })
    ),

  resume: authedProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        authz: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const pending =
        pendingResumableRuns.get(input.runId) ??
        (await loadPendingRecord(input.runId));
      if (!pending) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "run_not_found_or_expired",
        });
      }

      try {
        const delivered = await runRegistry.dispatchResume(input.runId, {
          event: "bio-authz",
          authz: input.authz,
        });

        if (!delivered) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "run_not_found_or_expired",
          });
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        if (error instanceof StreamNotAttachedError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "stream_not_attached",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "resume_failed",
          cause: error,
        });
      }

      const completion = await consumeResumeResult(input.runId);
      if (!completion) {
        return { success: true };
      }
      if (completion.kind === "run") {
        return { success: true, result: completion.result };
      }
      return { success: true, event: completion.status };
    }),
};

export const droidsRouter: ReturnType<typeof router> = router(droidProcedures);
