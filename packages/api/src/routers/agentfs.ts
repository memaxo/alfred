import { stat } from "node:fs/promises";
import path from "node:path";
import type {
  AgentFSKVEntry,
  AgentFSToolCall,
} from "@alfred/agent/agentfs/types";
import {
  type AgentFSStreamCursor,
  type AgentFSStreamEvent,
  READ_SCOPES,
} from "@alfred/type";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { requireScopes } from "../middleware/scopes";
import { authedProcedure, router } from "../trpc";

function sanitizeRunId(runId: string): string {
  return runId.replace(/[^a-zA-Z0-9-]/g, "-");
}

function isSafeAgentfsDbPath(args: { runId: string; dbPath: string }): boolean {
  const runId = sanitizeRunId(args.runId);
  const normalized = args.dbPath.replace(/\\/g, "/");
  if (!normalized.startsWith(`.agentfs/${runId}/`)) {
    return false;
  }
  if (normalized.includes("..")) {
    return false;
  }
  return normalized.endsWith(".db");
}

function nextCursor(
  prev: AgentFSStreamCursor,
  updates: { toolCallId?: number; toolCallSince?: number; kvUpdatedAt?: number }
): AgentFSStreamCursor {
  return {
    toolCallId:
      typeof updates.toolCallId === "number"
        ? Math.max(prev.toolCallId ?? 0, updates.toolCallId)
        : prev.toolCallId,
    toolCallSince:
      typeof updates.toolCallSince === "number"
        ? Math.max(prev.toolCallSince ?? 0, updates.toolCallSince)
        : prev.toolCallSince,
    kvUpdatedAt:
      typeof updates.kvUpdatedAt === "number"
        ? Math.max(prev.kvUpdatedAt ?? 0, updates.kvUpdatedAt)
        : prev.kvUpdatedAt,
  };
}

const agentfsSnapshotInputSchema = z.object({
  runId: z.string().min(1).max(200),
  dbPath: z.string().min(1).max(500),
  dir: z.string().min(1).max(500).default("/workspace"),
});

const agentfsStreamInputSchema = z.object({
  runId: z.string().min(1).max(200),
  dbPath: z.string().min(1).max(500),
  dir: z.string().min(1).max(500).default("/workspace"),
  cursor: z
    .object({
      toolCallId: z.number().int().min(0).optional(),
      toolCallSince: z.number().int().min(0).optional(),
      kvUpdatedAt: z.number().int().min(0).optional(),
    })
    .optional(),
  pollMs: z.number().int().min(200).max(5000).optional(),
});

async function loadAgentfs(args: { runId: string; dbPath: string }) {
  const { AlfredAgentFS } = await import("@alfred/agent/agentfs/index");
  const id = `tui-${sanitizeRunId(args.runId)}`.slice(0, 64);
  return await AlfredAgentFS.open({ id, path: args.dbPath }, args.runId);
}

type StatShape = {
  ino?: unknown;
  size?: unknown;
  mtime?: unknown;
  isDirectory?: unknown;
};

function toDirEntry(name: string, stat: unknown, inoFallback: number) {
  const s = stat as StatShape;
  const ino = typeof s.ino === "number" ? s.ino : inoFallback;
  const size = typeof s.size === "number" ? s.size : undefined;
  const mtime = typeof s.mtime === "number" ? s.mtime : undefined;
  const isDirectory =
    typeof s.isDirectory === "function"
      ? Boolean((s.isDirectory as () => boolean)())
      : false;

  return {
    name,
    ino,
    isDirectory,
    size,
    mtime,
  };
}

export const agentfsRouter = router({
  snapshot: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .input(agentfsSnapshotInputSchema)
    .query(async ({ input }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const fsdb = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });
      try {
        const names = await fsdb.fs.readdir(input.dir);
        const entries = await Promise.all(
          names.map(async (name: string, i: number) => {
            const full = path.posix.join(input.dir, name);
            const st = await fsdb.fs.stat(full).catch(() => null);
            return toDirEntry(name, st, i + 1);
          })
        );

        const toolCallsRaw = await fsdb.tools.getRecent(0, 200);
        const toolCalls = toolCallsRaw.map((c: AgentFSToolCall) => ({
          id: c.id,
          name: c.name,
          startedAt: c.started_at,
          completedAt: c.completed_at,
          durationMs: c.duration_ms,
          error: c.error ?? null,
          parameters: c.parameters,
          result: c.result,
        }));

        const kvRaw = await fsdb.kv.list();
        const kvStore = kvRaw.map((e: AgentFSKVEntry) => ({
          key: e.key,
          value: e.value,
          createdAt: e.created_at,
          updatedAt: e.updated_at,
        }));

        const maxToolCallId =
          toolCalls.length > 0
            ? Math.max(...toolCalls.map((t: { id: number }) => t.id))
            : 0;
        const maxToolCallSince =
          toolCalls.length > 0
            ? Math.max(
                ...toolCalls.map((t: { completedAt: number }) => t.completedAt)
              )
            : 0;
        const maxKvUpdatedAt = kvStore
          .map((e: { updatedAt?: number }) => e.updatedAt ?? 0)
          .reduce((a: number, b: number) => Math.max(a, b), 0);

        return {
          runId: input.runId,
          dbPath: input.dbPath,
          ts: Math.floor(Date.now() / 1000),
          entries,
          toolCalls,
          kvStore,
          cursor: {
            toolCallId: maxToolCallId,
            toolCallSince: maxToolCallSince,
            kvUpdatedAt: maxKvUpdatedAt,
          },
        };
      } finally {
        await fsdb.close();
      }
    }),

  stream: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .input(agentfsStreamInputSchema)
    .subscription(({ input }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        return observable<AgentFSStreamEvent>((emit) => {
          emit.error(
            new TRPCError({
              code: "BAD_REQUEST",
              message: "agentfs_path_invalid",
            })
          );
          return () => {};
        });
      }

      return observable<AgentFSStreamEvent>((emit) => {
        let cancelled = false;
        let cursor: AgentFSStreamCursor = input.cursor ?? {};
        let interval: ReturnType<typeof setInterval> | null = null;
        let fsdb: Awaited<ReturnType<typeof loadAgentfs>> | null = null;
        let lastDbMtimeMs: number | null = null;
        let eventCount = 0;

        const maxEvents = (() => {
          const raw = process.env.ALFRED_AGENTFS_MAX_EVENTS;
          if (!raw) {
            return 10_000;
          }
          const n = Number.parseInt(raw, 10);
          return Number.isFinite(n) && n > 0 ? n : 10_000;
        })();

        const finish = (reason: "closed" | "complete") => {
          cancelled = true;
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
          void (async () => {
            if (fsdb) {
              try {
                await fsdb.close();
              } catch {
                // ignore
              } finally {
                fsdb = null;
              }
            }
          })();
          if (reason === "complete") {
            emit.next({
              type: "done",
              ts: Math.floor(Date.now() / 1000),
              reason,
            });
            emit.complete();
          }
        };

        const poll = async () => {
          if (cancelled) {
            return;
          }
          try {
            try {
              const absDbPath = path.resolve(process.cwd(), input.dbPath);
              const st = await stat(absDbPath);
              if (lastDbMtimeMs !== null && st.mtimeMs === lastDbMtimeMs) {
                return;
              }
              lastDbMtimeMs = st.mtimeMs;
            } catch {
              // If the db path isn't a real local file (or doesn't exist yet),
              // fall back to polling via the SDK without the mtime optimization.
            }

            if (!fsdb) {
              fsdb = await loadAgentfs({
                runId: input.runId,
                dbPath: input.dbPath,
              });
            }

            const currentFsdb = fsdb;
            if (!currentFsdb) {
              return;
            }

            const names = await currentFsdb.fs.readdir(input.dir);
            const entries = await Promise.all(
              names.map(async (name: string, i: number) => {
                const full = path.posix.join(input.dir, name);
                const st = await currentFsdb.fs.stat(full).catch(() => null);
                return toDirEntry(name, st, i + 1);
              })
            );

            const toolCallsRaw = await currentFsdb.tools.getRecent(
              cursor.toolCallSince ?? 0,
              200
            );
            const toolCalls = toolCallsRaw
              .filter((c: AgentFSToolCall) => c.id > (cursor.toolCallId ?? 0))
              .map((c: AgentFSToolCall) => ({
                id: c.id,
                name: c.name,
                startedAt: c.started_at,
                completedAt: c.completed_at,
                durationMs: c.duration_ms,
                error: c.error ?? null,
                parameters: c.parameters,
                result: c.result,
              }));

            const kvRaw = await currentFsdb.kv.list();
            const kvStore = kvRaw.map((e: AgentFSKVEntry) => ({
              key: e.key,
              value: e.value,
              createdAt: e.created_at,
              updatedAt: e.updated_at,
            }));

            const maxToolCallId =
              toolCallsRaw.length > 0
                ? Math.max(...toolCallsRaw.map((t: AgentFSToolCall) => t.id))
                : 0;
            const maxToolCallSince =
              toolCallsRaw.length > 0
                ? Math.max(
                    ...toolCallsRaw.map((t: AgentFSToolCall) => t.completed_at)
                  )
                : 0;
            const maxKvUpdatedAt = kvStore
              .map((e: { updatedAt?: number }) => e.updatedAt ?? 0)
              .reduce((a: number, b: number) => Math.max(a, b), 0);

            const prevKvUpdatedAt = cursor.kvUpdatedAt ?? 0;
            cursor = nextCursor(cursor, {
              toolCallId: maxToolCallId,
              toolCallSince: maxToolCallSince,
              kvUpdatedAt: maxKvUpdatedAt,
            });

            emit.next({
              type: "data",
              ts: Math.floor(Date.now() / 1000),
              runId: input.runId,
              dbPath: input.dbPath,
              cursor,
              entries,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              kvStore: maxKvUpdatedAt > prevKvUpdatedAt ? kvStore : undefined,
            });

            eventCount++;
            if (eventCount >= maxEvents) {
              finish("complete");
            }
          } catch (_error) {
            emit.next({
              type: "error",
              ts: Math.floor(Date.now() / 1000),
              code: "agentfs_stream_failed",
              message: "agentfs_stream_failed",
              retryable: true,
            });
          }
        };

        void poll();
        interval = setInterval(() => {
          void poll();
        }, input.pollMs ?? 500);
        interval.unref?.();

        return () => {
          if (!cancelled) {
            finish("closed");
          }
        };
      });
    }),
});
