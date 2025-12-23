import { randomUUID } from "node:crypto";
import {
  alfredCodexEventSchema,
  ELEVATED_TIMEOUT_THRESHOLD_SEC,
  MAX_TIMEOUT_SEC,
  MIN_TIMEOUT_SEC,
} from "@alfred/agent/orchestrator/tool/codex/definition";
import type { AlfredCodexEvent } from "@alfred/agent/orchestrator/tool/codex/index";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";
import { sessionManager } from "@alfred/agent/orchestrator/codex-session";
import { codexRunRepo, codexSessionRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

const codexRunInputSchema = z.object({
  prompt: z.string().min(1),
  auto: z.enum(["read", "low", "medium", "high"]).default("read"),
  authz: z.string().optional(),
  sessionId: z.string().min(1).max(255).optional(),
  cw: z.string().optional(),
  model: z.string().optional(),
  profile: z.string().optional(),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  context: z
    .object({
      linearIssueId: z.string().optional(),
      linearSessionId: z.string().optional(),
      linearSpace: z.string().optional(),
      linearAuthz: z.string().optional(),
      relevantFiles: z.array(z.string()).optional(),
    })
    .optional(),
  env: z.record(z.string(), z.string()).optional(),
  timeoutSec: z
    .number()
    .int()
    .min(MIN_TIMEOUT_SEC)
    .max(MAX_TIMEOUT_SEC, { message: "codex_timeout_exceeds_limit" })
    .optional(),
});

type CodexRunInput = z.infer<typeof codexRunInputSchema>;

export type SanitizedCodexError = {
  code:
    | "execution_failed"
    | "timeout"
    | "elevation_required"
    | "limit_exceeded"
    | "forbidden"
    | "internal_error";
  message: string;
};

const CODEX_EXEC_FAILED_PREFIX = "codex_exec_failed";

export function sanitizeCodexError(error: Error): SanitizedCodexError {
  const message = error.message ?? "";
  if (
    message === CODEX_EXEC_FAILED_PREFIX ||
    message.startsWith(`${CODEX_EXEC_FAILED_PREFIX}:`)
  ) {
    return { code: "execution_failed", message: "Codex execution failed" };
  }
  if (message === "codex_exec_timeout") {
    return { code: "timeout", message: "Execution timed out" };
  }
  if (message === "biometric_required") {
    return {
      code: "elevation_required",
      message: "Additional authentication required",
    };
  }
  if (message === "codex_session_forbidden") {
    return {
      code: "forbidden",
      message: "codex_session_forbidden",
    };
  }
  if (message === "codex_timeout_requires_elevation") {
    return {
      code: "elevation_required",
      message: "Timeout above 10 minutes requires biometric elevation",
    };
  }
  if (message === "codex_timeout_exceeds_limit") {
    return {
      code: "limit_exceeded",
      message: "Timeout exceeds the 30 minute limit",
    };
  }
  return { code: "internal_error", message: "An unexpected error occurred" };
}

type CodexErrorHandlingResult = {
  sanitized: SanitizedCodexError;
  correlationId: string;
  trpcCode: TRPCError["code"];
  cause: Error;
};

export function buildCodexErrorResponse(
  error: unknown,
  scope: string
): CodexErrorHandlingResult {
  const normalized =
    error instanceof Error
      ? error
      : new Error(String(error ?? "unknown_error"));
  const sanitized = sanitizeCodexError(normalized);
  const correlationId = randomUUID();
  logger.error(scope, {
    correlationId,
    name: normalized.name,
    message: normalized.message,
    stack: normalized.stack,
  });
  const trpcCode: TRPCError["code"] =
    sanitized.code === "elevation_required"
      ? "PRECONDITION_FAILED"
      : sanitized.code === "limit_exceeded"
        ? "BAD_REQUEST"
        : sanitized.code === "forbidden"
          ? "FORBIDDEN"
          : "INTERNAL_SERVER_ERROR";
  return { sanitized, correlationId, trpcCode, cause: normalized };
}

export function formatCodexErrorMessage(
  sanitized: SanitizedCodexError,
  correlationId: string
): string {
  return `${sanitized.message} (code=${sanitized.code}, ref=${correlationId})`;
}

type CodexStreamEvent =
  | { type: "codex_event"; event: AlfredCodexEvent }
  | { type: "stdout"; text: string }
  | { type: "stderr"; text: string }
  | { type: "notice"; message: string; usage?: unknown }
  | {
      type: "complete";
      result: string;
      artifacts?: Array<{ path: string; kind: string }>;
    }
  | {
      type: "error";
      message: string;
      code: SanitizedCodexError["code"];
      correlationId: string;
    };

const stdoutChunkSchema = z
  .object({
    type: z.literal("stdout"),
    text: z.string(),
  })
  .passthrough();

const stderrChunkSchema = z
  .object({
    type: z.literal("stderr"),
    text: z.string(),
  })
  .passthrough();

const noticeChunkSchema = z
  .object({
    type: z.literal("notice"),
    message: z.string(),
    usage: z.unknown().optional(),
  })
  .passthrough();

const codexEventChunkSchema = z
  .object({
    type: z.literal("codex_event"),
    event: alfredCodexEventSchema,
  })
  .passthrough();

const writerChunkSchema = z.discriminatedUnion("type", [
  stdoutChunkSchema,
  stderrChunkSchema,
  noticeChunkSchema,
  codexEventChunkSchema,
]);

type WriterChunk = z.infer<typeof writerChunkSchema>;

function parseWriterChunk(chunk: unknown): WriterChunk | null {
  const parsed = writerChunkSchema.safeParse(chunk);
  if (parsed.success) {
    return parsed.data;
  }

  logger.warn("codex_invalid_writer_chunk", {
    issues: parsed.error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path,
    })),
  });

  return null;
}

function createCodexStreamObservable({
  input,
  timeoutSec,
  userId,
}: {
  input: CodexRunInput;
  timeoutSec?: number;
  userId: string;
}) {
  return observable<CodexStreamEvent>((emit) => {
    const abortController = new AbortController();
    const effectiveTimeoutSec = timeoutSec ?? ELEVATED_TIMEOUT_THRESHOLD_SEC;

    void (async () => {
      try {
        const result = await toolCodex.execute({
          input: {
            action: "exec" as const,
            prompt: input.prompt,
            out: "text",
            auto: input.auto,
            cw: input.cw,
            model: input.model,
            profile: input.profile,
            authz: input.authz,
            timeoutSec: effectiveTimeoutSec,
            env: input.env,
            sessionId: input.sessionId,
            outputSchema: input.outputSchema,
            context: input.context,
            userId,
          },
          writer: {
            write: (chunk: unknown) => {
              if (abortController.signal.aborted) {
                return;
              }
              const parsed = parseWriterChunk(chunk);
              if (!parsed) {
                return;
              }

              switch (parsed.type) {
                case "stdout":
                  emit.next({ type: "stdout", text: parsed.text });
                  break;
                case "stderr":
                  emit.next({ type: "stderr", text: parsed.text });
                  break;
                case "notice":
                  emit.next({
                    type: "notice",
                    message: parsed.message,
                    usage: parsed.usage,
                  });
                  break;
                case "codex_event":
                  emit.next({ type: "codex_event", event: parsed.event });
                  break;
                default:
                  break;
              }
            },
          },
          signal: abortController.signal,
        });

        if (abortController.signal.aborted) {
          return;
        }

        emit.next({
          type: "complete",
          result: result.result,
          artifacts: result.artifacts,
        });
        emit.complete();
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        const { sanitized, correlationId, trpcCode, cause } =
          buildCodexErrorResponse(error, "codex_stream_failed");
        emit.next({
          type: "error",
          message: sanitized.message,
          code: sanitized.code,
          correlationId,
        });
        emit.error(
          new TRPCError({
            code: trpcCode,
            message: formatCodexErrorMessage(sanitized, correlationId),
            cause,
          })
        );
      }
    })();

    return () => {
      abortController.abort();
    };
  });
}

async function requireOwnedRun(args: {
  runId: string;
  userId: string;
}): Promise<Awaited<ReturnType<typeof codexRunRepo.getRun>>> {
  const run = await codexRunRepo.getRun(args.runId);
  if (!run) {
    throw new TRPCError({ code: "NOT_FOUND", message: "codex_run_not_found" });
  }
  if (run.userId !== args.userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "codex_run_forbidden" });
  }
  return run;
}

const codexListRunsInputSchema = z.object({
  status: z.enum(["running", "completed", "failed", "cancelled"]).optional(),
  sessionId: z.string().min(1).max(255).optional(),
  threadId: z.string().min(1).max(255).optional(),
  environmentKind: z.enum(["host", "worktree", "container", "poof"]).optional(),
  startedAfter: z.string().datetime().optional(),
  startedBefore: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).max(10_000).optional(),
});

const codexGetRunInputSchema = z.object({
  runId: z.string().uuid(),
});

const codexEventsInputSchema = z.object({
  runId: z.string().uuid(),
  order: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().min(1).max(5000).optional(),
  afterSeq: z.number().int().min(0).optional(),
});

const codexSearchEventsInputSchema = z.object({
  query: z.string().min(1).max(2000),
  runId: z.string().uuid().optional(),
  eventTypes: z.array(z.string().min(1).max(100)).max(20).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).max(10_000).optional(),
});

const codexStreamEventsInputSchema = z.object({
  runId: z.string().uuid(),
  afterSeq: z.number().int().min(0).optional(),
  pollMs: z.number().int().min(200).max(5000).optional(),
});

const codexListSessionsInputSchema = z.object({
  status: z.enum(["active", "completed", "failed"]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).max(10_000).optional(),
});

const codexGetSessionInputSchema = z.object({
  sessionId: z.string().min(1).max(255),
});

const codexTerminateSessionInputSchema = z.object({
  sessionId: z.string().min(1).max(255),
});

const codexProcedures = {
  run: authedProcedure
    .input(codexRunInputSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const timeoutSec = input.timeoutSec ?? ELEVATED_TIMEOUT_THRESHOLD_SEC;
      const chunks: string[] = [];
      const events: AlfredCodexEvent[] = [];

      try {
        await toolCodex.execute({
          input: {
            action: "exec" as const,
            prompt: input.prompt,
            out: "text",
            auto: input.auto,
            cw: input.cw,
            model: input.model,
            profile: input.profile,
            authz: input.authz,
            timeoutSec,
            env: input.env,
            sessionId: input.sessionId,
            outputSchema: input.outputSchema,
            context: input.context,
            userId,
          },
          writer: {
            write: (chunk: unknown) => {
              const parsed = parseWriterChunk(chunk);
              if (!parsed) {
                return;
              }

              if (parsed.type === "stdout") {
                chunks.push(parsed.text);
                return;
              }

              if (parsed.type === "codex_event") {
                events.push(parsed.event);
              }
            },
          },
        });
      } catch (error) {
        const { sanitized, correlationId, trpcCode, cause } =
          buildCodexErrorResponse(error, "codex_run_failed");
        throw new TRPCError({
          code: trpcCode,
          message: formatCodexErrorMessage(sanitized, correlationId),
          cause,
        });
      }

      return {
        result: chunks.join("\n"),
        events,
      };
    }),

  stream: authedProcedure
    .input(codexRunInputSchema)
    .subscription(({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        return observable<CodexStreamEvent>((emit) => {
          emit.error(
            new TRPCError({ code: "UNAUTHORIZED", message: "session_required" })
          );
          return () => {};
        });
      }

      const timeoutSec = input.timeoutSec ?? ELEVATED_TIMEOUT_THRESHOLD_SEC;
      return createCodexStreamObservable({ input, timeoutSec, userId });
    }),

  listRuns: authedProcedure
    .input(codexListRunsInputSchema)
    .query(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "session_required" });
      }
      const startedAfter = input.startedAfter ? new Date(input.startedAfter) : undefined;
      const startedBefore = input.startedBefore ? new Date(input.startedBefore) : undefined;
      return codexRunRepo.listRuns({
        userId,
        status: input.status,
        sessionId: input.sessionId,
        threadId: input.threadId,
        environmentKind: input.environmentKind,
        startedAfter,
        startedBefore,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  getRun: authedProcedure.input(codexGetRunInputSchema).query(async ({ input, ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "session_required" });
    }
    return requireOwnedRun({ runId: input.runId, userId });
  }),

  events: authedProcedure
    .input(codexEventsInputSchema)
    .query(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "session_required" });
      }
      await requireOwnedRun({ runId: input.runId, userId });
      return codexRunRepo.listEvents({
        runId: input.runId,
        order: input.order,
        limit: input.limit,
        afterSeq: input.afterSeq,
      });
    }),

  searchEvents: authedProcedure
    .input(codexSearchEventsInputSchema)
    .query(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "session_required" });
      }
      if (input.runId) {
        await requireOwnedRun({ runId: input.runId, userId });
      }
      return codexRunRepo.searchEvents({
        userId,
        query: input.query,
        runId: input.runId,
        eventTypes: input.eventTypes,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  streamEvents: authedProcedure
    .input(codexStreamEventsInputSchema)
    .subscription(({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        return observable((emit) => {
          emit.error(new TRPCError({ code: "UNAUTHORIZED", message: "session_required" }));
          return () => {};
        });
      }

      return observable<{ type: "event"; event: unknown }>((emit) => {
        let cancelled = false;
        let lastSeq = input.afterSeq ?? 0;

        const poll = async () => {
          try {
            await requireOwnedRun({ runId: input.runId, userId });
            const rows = await codexRunRepo.listEvents({
              runId: input.runId,
              order: "asc",
              afterSeq: lastSeq,
              limit: 2000,
            });
            for (const row of rows) {
              lastSeq = Math.max(lastSeq, row.seq);
              emit.next({ type: "event", event: row });
            }
          } catch (error) {
            const { sanitized, correlationId, trpcCode, cause } = buildCodexErrorResponse(
              error,
              "codex_stream_events_failed"
            );
            emit.error(
              new TRPCError({
                code: trpcCode,
                message: formatCodexErrorMessage(sanitized, correlationId),
                cause,
              })
            );
          }
        };

        void poll();
        const interval = setInterval(() => {
          if (cancelled) {
            return;
          }
          void poll();
        }, input.pollMs ?? 500);

        return () => {
          cancelled = true;
          clearInterval(interval);
        };
      });
    }),

  // Session management procedures
  listSessions: authedProcedure
    .input(codexListSessionsInputSchema)
    .query(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "session_required" });
      }
      return codexSessionRepo.listSessions({
        userId,
        status: input.status,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  getSession: authedProcedure
    .input(codexGetSessionInputSchema)
    .query(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "session_required" });
      }
      const session = await sessionManager.getSession(input.sessionId, userId);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "codex_session_not_found" });
      }
      return session;
    }),

  terminateSession: authedProcedure
    .input(codexTerminateSessionInputSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "session_required" });
      }
      // Verify ownership before terminating
      const session = await codexSessionRepo.getSession(input.sessionId, userId);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "codex_session_not_found" });
      }
      await sessionManager.terminateSession(input.sessionId);
      return { success: true };
    }),
};

export const codexRouter = router(codexProcedures);

export const __internals = {
  createCodexStreamObservable,
};
