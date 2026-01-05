import { readdirSync, statSync } from "node:fs";
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
  // ─────────────────────────────────────────────────────────────────────────
  // Workspace Management Procedures
  // ─────────────────────────────────────────────────────────────────────────

  workspacesList: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .query(() => {
      try {
        const agentfsDir = path.join(process.cwd(), ".agentfs");

        // Check if .agentfs directory exists
        let dirExists = false;
        try {
          const stats = statSync(agentfsDir);
          dirExists = stats.isDirectory();
        } catch {
          dirExists = false;
        }

        if (!dirExists) {
          return { workspaces: [] };
        }

        // List subdirectories (each is a run)
        const entries = readdirSync(agentfsDir, { withFileTypes: true });
        const workspaces = entries
          .filter((e) => e.isDirectory())
          .map((e) => {
            const runPath = path.join(agentfsDir, e.name);
            const dbPath = `.agentfs/${e.name}/agentfs.db`;
            let dbExists = false;
            let mtime: Date | undefined;

            try {
              const dbStats = statSync(path.join(runPath, "agentfs.db"));
              dbExists = dbStats.isFile();
              mtime = dbStats.mtime;
            } catch {
              dbExists = false;
            }

            if (!dbExists) {
              return null;
            }

            // Infer status from directory name or mtime
            const isRecent =
              mtime && Date.now() - mtime.getTime() < 5 * 60 * 1000;

            return {
              id: e.name,
              runId: e.name,
              dbPath,
              agentType: inferAgentType(e.name),
              status: isRecent ? "active" : "completed",
              createdAt: mtime?.toISOString() ?? new Date().toISOString(),
              operationCount: 0, // Would need to query DB for actual count
              checkpointCount: 0,
            };
          })
          .filter(Boolean) as Array<{
          id: string;
          runId: string;
          dbPath: string;
          agentType: string;
          status: string;
          createdAt: string;
          operationCount: number;
          checkpointCount: number;
        }>;

        return { workspaces };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list workspaces: ${(error as Error).message}`,
        });
      }
    }),

  operationsList: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(500).default(100),
      })
    )
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
        const toolCallsRaw = await fsdb.tools.getRecent(0, input.limit);
        const operations = toolCallsRaw.map((c: AgentFSToolCall) => ({
          id: String(c.id),
          type: inferOperationType(c.name),
          name: c.name,
          path: extractPath(c.parameters),
          timestamp: new Date(c.started_at * 1000).toISOString(),
          duration: c.duration_ms ?? 0,
          bytesAffected: extractBytes(c.result),
          error: c.error ?? null,
        }));

        return { operations };
      } finally {
        await fsdb.close();
      }
    }),

  checkpointsList: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
      })
    )
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
        // Get checkpoints from KV store (if stored there)
        const kvRaw = await fsdb.kv.list();
        const checkpoints = kvRaw
          .filter((e: AgentFSKVEntry) => e.key.startsWith("checkpoint:"))
          .map((e: AgentFSKVEntry) => ({
            id: e.key.replace("checkpoint:", ""),
            name: e.key,
            createdAt: new Date((e.created_at ?? 0) * 1000).toISOString(),
            data: e.value,
          }));

        return { checkpoints };
      } finally {
        await fsdb.close();
      }
    }),

  kvList: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
      })
    )
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
        const kvRaw = await fsdb.kv.list();
        const entries = kvRaw.map((e: AgentFSKVEntry) => ({
          key: e.key,
          value: e.value,
          type: typeof e.value,
          createdAt: new Date((e.created_at ?? 0) * 1000).toISOString(),
          updatedAt: new Date((e.updated_at ?? 0) * 1000).toISOString(),
        }));

        return { entries };
      } finally {
        await fsdb.close();
      }
    }),

  fileAudit: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        filePath: z.string().min(1).max(500),
      })
    )
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
        // Get all tool calls and filter for those affecting the specified file
        const toolCallsRaw = await fsdb.tools.getRecent(0, 1000);
        const changes = toolCallsRaw
          .filter((c: AgentFSToolCall) => {
            const callPath = extractPath(c.parameters);
            return callPath.includes(input.filePath);
          })
          .map((c: AgentFSToolCall) => ({
            id: String(c.id),
            type: inferOperationType(c.name),
            timestamp: new Date(c.started_at * 1000).toISOString(),
            diff: extractDiff(c.parameters, c.result),
          }));

        return { changes };
      } finally {
        await fsdb.close();
      }
    }),

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

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

function inferAgentType(runId: string): string {
  if (runId.includes("codex")) {
    return "codex";
  }
  if (runId.includes("droid")) {
    return "droid";
  }
  if (runId.includes("claude")) {
    return "claude";
  }
  if (runId.includes("roo")) {
    return "roo";
  }
  return "agent";
}

function inferOperationType(
  toolName: string
): "read" | "write" | "delete" | "mkdir" {
  const lower = toolName.toLowerCase();
  if (
    lower.includes("read") ||
    lower.includes("get") ||
    lower.includes("list")
  ) {
    return "read";
  }
  if (
    lower.includes("write") ||
    lower.includes("create") ||
    lower.includes("save")
  ) {
    return "write";
  }
  if (lower.includes("delete") || lower.includes("remove")) {
    return "delete";
  }
  if (lower.includes("mkdir") || lower.includes("directory")) {
    return "mkdir";
  }
  return "read";
}

function extractPath(parameters: unknown): string {
  if (!parameters || typeof parameters !== "object") {
    return "";
  }
  const params = parameters as Record<string, unknown>;
  if (typeof params.path === "string") {
    return params.path;
  }
  if (typeof params.file === "string") {
    return params.file;
  }
  if (typeof params.filePath === "string") {
    return params.filePath;
  }
  return "";
}

function extractBytes(result: unknown): number | undefined {
  if (!result || typeof result !== "object") {
    return;
  }
  const res = result as Record<string, unknown>;
  if (typeof res.bytes === "number") {
    return res.bytes;
  }
  if (typeof res.size === "number") {
    return res.size;
  }
  if (typeof res.content === "string") {
    return res.content.length;
  }
  return;
}

function extractDiff(parameters: unknown, result: unknown): string | null {
  if (!parameters || typeof parameters !== "object") {
    return null;
  }
  const params = parameters as Record<string, unknown>;
  if (typeof params.content === "string") {
    return params.content.slice(0, 500);
  }
  if (result && typeof result === "object") {
    const res = result as Record<string, unknown>;
    if (typeof res.content === "string") {
      return res.content.slice(0, 500);
    }
  }
  return null;
}
