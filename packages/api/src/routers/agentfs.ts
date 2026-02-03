import type {
  AgentFSKVEntry,
  AgentFSToolCall,
} from "@alfred/agent/agentfs/types";

import {
  type AgentFSChange,
  type AgentFSStreamCursor,
  type AgentFSStreamEvent,
  READ_SCOPES,
  WRITE_SCOPES,
  executorConfigPublicSchema,
  executorConfigWriteSchema,
  executorHealthSchema,
  executorKindSchema,
  executorStatusSchema,
} from "@alfred/type";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  readdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { requirePolicy } from "../gate";
import { requireScopes } from "../middleware/scopes";
import {
  compareAgentfsRuns,
  listAgentfsFiles,
  listAgentfsKv,
  rankAgentfsBlameCandidates,
  readAgentfsRunStats,
} from "../services/agentfs";
import { authedProcedure, router } from "../trpc";
import { agentfsExtraProcedures } from "./agentfs/extra";
import {
  agentfsSnapshotInputSchema,
  agentfsStreamInputSchema,
  assertSafeExecutorHttpBaseUrl,
  classifyAgentfsFilePath,
  coerceCheckpointCreatedAtSec,
  enforceAgentfsProjectAccess,
  extractBytes,
  extractDiff,
  extractPath,
  getPreviewMaxBytes,
  inferOperationType,
  isSafeAgentfsDbPath,
  loadAgentfs,
  looksBinary,
  nextCursor,
  readAgentfsFileClass,
  readAgentfsPrefix,
  readAgentfsRange,
  redactExecutorKvEntry,
  recordAgentfsOp,
  sanitizeCheckpointId,
  sanitizeRunId,
  toDirEntry,
  validateAgentfsFilePath,
} from "./agentfs/shared";

export const agentfsRouter = router({
  // ─────────────────────────────────────────────────────────────────────────
  // Workspace Management Procedures
  // ─────────────────────────────────────────────────────────────────────────

  applyChanges: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    ) // Explicit scope for applying to host
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        paths: z.array(z.string()).optional(), // Optional: apply only specific files
        projectId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        if (!baseDir) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "agentfs_base_dir_missing",
          });
        }

        const changes = await fsdb.diff();
        const filtered = input.paths
          ? changes.filter((c: AgentFSChange) => input.paths?.includes(c.path))
          : changes;

        const { writeFile, unlink, mkdir } = await import("node:fs/promises");
        const results: {
          path: string;
          status: "success" | "error";
          message?: string;
        }[] = [];

        for (const change of filtered) {
          const hostPath = path.resolve(
            baseDir,
            change.path.replace(/^\//, "")
          );

          // Safety check: ensure hostPath is within baseDir
          if (!hostPath.startsWith(path.resolve(baseDir))) {
            results.push({
              path: change.path,
              status: "error",
              message: "outside_base",
            });
            continue;
          }

          try {
            if (change.type === "deleted") {
              await unlink(hostPath);
            } else {
              const content = await fsdb.fs.readFile(change.path);
              await mkdir(path.dirname(hostPath), { recursive: true });
              await writeFile(hostPath, content);
            }
            results.push({ path: change.path, status: "success" });
          } catch (error) {
            results.push({
              path: change.path,
              status: "error",
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return { results };
      } finally {
        await fsdb.close();
      }
    }),

  checkpointsList: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const normalizedDbPath = input.dbPath.replaceAll("\\", "/");
        const absDbPath = path.resolve(process.cwd(), normalizedDbPath);
        const absRunDir = path.dirname(absDbPath);
        const base = path.posix.basename(normalizedDbPath);
        const prefix = `${base}.checkpoint-`;

        const merged = new Map<
          string,
          { id: string; name: string; createdAt: string; data?: unknown }
        >();

        try {
          const files = await readdir(absRunDir);
          for (const f of files) {
            if (!f.startsWith(prefix)) {
              continue;
            }
            const id = sanitizeCheckpointId(f.slice(prefix.length));
            if (!id) {
              continue;
            }
            let createdAt = new Date(0).toISOString();
            try {
              const st = await stat(path.join(absRunDir, f));
              createdAt = st.mtime.toISOString();
            } catch {
              // ignore
            }
            merged.set(id, { id, name: id, createdAt });
          }
        } catch {
          // ignore
        }

        const kvRaw = await fsdb.kv.list();
        for (const e of kvRaw) {
          if (!e.key.startsWith("checkpoint:")) {
            continue;
          }
          const id = sanitizeCheckpointId(e.key.replace("checkpoint:", ""));
          if (!id) {
            continue;
          }
          const createdAtSec = coerceCheckpointCreatedAtSec(e);
          const createdAt = createdAtSec
            ? new Date(createdAtSec * 1000).toISOString()
            : (merged.get(id)?.createdAt ?? new Date(0).toISOString());
          const label =
            e.value &&
            typeof e.value === "object" &&
            typeof (e.value as Record<string, unknown>).label === "string"
              ? ((e.value as Record<string, unknown>).label as string)
              : id;
          merged.set(id, {
            id,
            name: label,
            createdAt,
            data: e.value,
          });
        }

        return {
          checkpoints: [...merged.values()].sort((a, b) =>
            a.createdAt < b.createdAt ? 1 : (a.createdAt > b.createdAt ? -1 : 0)
          ),
        };
      } finally {
        await fsdb.close();
      }
    }),

  clearRetention: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(z.object({ runId: z.string().min(1).max(200) }))
    .mutation(async ({ input }) => {
      const runId = sanitizeRunId(input.runId);
      if (!runId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_run_id_invalid",
        });
      }

      const runDir = path.resolve(process.cwd(), ".agentfs", runId);
      const p = path.join(runDir, ".retention");
      try {
        await unlink(p);
      } catch {
        // ignore
      }
      return { ok: true };
    }),

  cloneCheckpoint: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        checkpointId: z.string().min(1).max(200),
        targetRunId: z.string().min(1).max(200).optional(),
        projectId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        if (
          !isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "agentfs_path_invalid",
          });
        }

        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir: null,
          projectId: input.projectId,
        });

        const checkpointId = sanitizeCheckpointId(input.checkpointId);
        if (!checkpointId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "agentfs_checkpoint_id_invalid",
          });
        }

        const srcDbPath = input.dbPath.replaceAll("\\", "/");
        const srcAbsDbPath = path.resolve(process.cwd(), srcDbPath);
        const srcSnapshotAbs = `${srcAbsDbPath}.checkpoint-${checkpointId}`;

        const srcSt = await stat(srcSnapshotAbs).catch(() => null);
        if (!srcSt?.isFile()) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "agentfs_checkpoint_not_found",
          });
        }

        const base = path.posix.basename(srcDbPath);
        const targetRunId = sanitizeRunId(
          input.targetRunId ? input.targetRunId : randomUUID().slice(0, 12)
        );
        if (!targetRunId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "agentfs_run_id_invalid",
          });
        }

        await mkdir(path.resolve(process.cwd(), ".agentfs"), {
          recursive: true,
        });

        const dstDir = `.agentfs/${targetRunId}`;
        const dstAbsDir = path.resolve(process.cwd(), dstDir);
        try {
          await mkdir(dstAbsDir, { recursive: false });
        } catch (error) {
          const code = (error as { code?: string } | null)?.code;
          if (code === "EEXIST") {
            throw new TRPCError({
              code: "CONFLICT",
              message: "agentfs_run_exists",
            });
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "agentfs_clone_failed",
          });
        }

        const dstDbPath = `${dstDir}/${base}`;
        const dstAbsDbPath = path.resolve(process.cwd(), dstDbPath);

        await copyFile(srcSnapshotAbs, dstAbsDbPath);

        for (const suffix of ["-wal", "-shm"]) {
          const src = `${srcSnapshotAbs}${suffix}`;
          const dst = `${dstAbsDbPath}${suffix}`;
          try {
            await stat(src);
            await copyFile(src, dst);
          } catch {
            // ignore
          }
        }

        const result = { runId: targetRunId, dbPath: dstDbPath };
        await recordAgentfsOp({
          ctx,
          action: "checkpoint_restore",
          success: true,
          projectId: input.projectId ?? null,
          runId: input.runId,
          extra: { targetRunId },
        });
        return result;
      } catch (error) {
        await recordAgentfsOp({
          ctx,
          action: "checkpoint_restore",
          success: false,
          projectId: input.projectId ?? null,
          runId: input.runId,
          extra: {
            error: error instanceof Error ? error.message : String(error ?? ""),
            targetRunId: input.targetRunId ?? null,
          },
        });
        throw error;
      }
    }),

  cloneRun: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const source = (rec.source ?? {}) as Record<string, unknown>;
        const runId =
          typeof source.runId === "string" ? source.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        source: z.object({
          runId: z.string().min(1).max(200),
          dbPath: z.string().min(1).max(500),
        }),
        targetRunId: z.string().min(1).max(200).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        if (!isSafeAgentfsDbPath(input.source)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "agentfs_path_invalid",
          });
        }

        const srcDbPath = input.source.dbPath.replaceAll("\\", "/");
        const srcAbsDbPath = path.resolve(process.cwd(), srcDbPath);
        const base = path.posix.basename(srcDbPath);

        const targetRunId = sanitizeRunId(
          input.targetRunId ? input.targetRunId : randomUUID().slice(0, 12)
        );
        if (!targetRunId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "agentfs_run_id_invalid",
          });
        }

        const dstDir = `.agentfs/${targetRunId}`;
        const dstAbsDir = path.resolve(process.cwd(), dstDir);

        await mkdir(path.resolve(process.cwd(), ".agentfs"), {
          recursive: true,
        });

        try {
          await mkdir(dstAbsDir, { recursive: false });
        } catch (error) {
          const code = (error as { code?: string } | null)?.code;
          if (code === "EEXIST") {
            throw new TRPCError({
              code: "CONFLICT",
              message: "agentfs_run_exists",
            });
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "agentfs_clone_failed",
          });
        }

        const dstDbPath = `${dstDir}/${base}`;
        const dstAbsDbPath = path.resolve(process.cwd(), dstDbPath);

        await copyFile(srcAbsDbPath, dstAbsDbPath);

        for (const suffix of ["-wal", "-shm"]) {
          const src = `${srcAbsDbPath}${suffix}`;
          const dst = `${dstAbsDbPath}${suffix}`;
          try {
            await stat(src);
            await copyFile(src, dst);
          } catch {
            // ignore
          }
        }

        const result = { runId: targetRunId, dbPath: dstDbPath };
        await recordAgentfsOp({
          ctx,
          action: "run_clone",
          success: true,
          runId: input.source.runId,
          extra: { targetRunId },
        });
        return result;
      } catch (error) {
        await recordAgentfsOp({
          ctx,
          action: "run_clone",
          success: false,
          runId: input.source.runId,
          extra: {
            error: error instanceof Error ? error.message : String(error ?? ""),
            targetRunId: input.targetRunId ?? null,
          },
        });
        throw error;
      }
    }),

  compareRuns: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const left = (rec.left ?? {}) as Record<string, unknown>;
        const runId =
          typeof left.runId === "string" && left.runId.length > 0
            ? left.runId
            : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const right = (rec.right ?? {}) as Record<string, unknown>;
        const runId =
          typeof right.runId === "string" && right.runId.length > 0
            ? right.runId
            : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        left: z.object({
          runId: z.string().min(1).max(200),
          dbPath: z.string().min(1).max(500),
        }),
        right: z.object({
          runId: z.string().min(1).max(200),
          dbPath: z.string().min(1).max(500),
        }),
        limit: z.number().int().min(1).max(5000).default(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath(input.left)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }
      if (!isSafeAgentfsDbPath(input.right)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const leftLoaded = await loadAgentfs(input.left);
      const rightLoaded = await loadAgentfs(input.right);
      const leftFsdb = leftLoaded.fsdb;
      const rightFsdb = rightLoaded.fsdb;

      try {
        const leftAccess = await enforceAgentfsProjectAccess({
          ctx,
          runId: input.left.runId,
          dbPath: input.left.dbPath,
          baseDir: leftLoaded.baseDir,
          projectId: input.projectId,
        });
        const rightAccess = await enforceAgentfsProjectAccess({
          ctx,
          runId: input.right.runId,
          dbPath: input.right.dbPath,
          baseDir: rightLoaded.baseDir,
          projectId: input.projectId,
        });

        if (
          leftAccess.projectId &&
          rightAccess.projectId &&
          leftAccess.projectId !== rightAccess.projectId
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "agentfs_project_mismatch",
          });
        }

        const leftDb = leftFsdb.getDatabase() as unknown;
        const rightDb = rightFsdb.getDatabase() as unknown;
        const hasPrepare = (db: unknown) =>
          typeof (db as { prepare?: unknown } | null)?.prepare === "function";

        if (!hasPrepare(leftDb) || !hasPrepare(rightDb)) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "agentfs_db_unavailable",
          });
        }

        const leftFiles = await listAgentfsFiles(
          leftDb as { prepare: (sql: string) => { all?: () => unknown } }
        );
        const rightFiles = await listAgentfsFiles(
          rightDb as { prepare: (sql: string) => { all?: () => unknown } }
        );
        const leftKv = await listAgentfsKv(
          leftDb as { prepare: (sql: string) => { all?: () => unknown } }
        );
        const rightKv = await listAgentfsKv(
          rightDb as { prepare: (sql: string) => { all?: () => unknown } }
        );

        return compareAgentfsRuns({
          leftFiles,
          rightFiles,
          leftKv,
          rightKv,
          limit: input.limit,
        });
      } finally {
        await Promise.all([leftFsdb.close(), rightFsdb.close()]);
      }
    }),

  diff: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const changes = await fsdb.diff();
        return { changes };
      } finally {
        await fsdb.close();
      }
    }),

  fileAudit: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        const filePath =
          typeof rec.filePath === "string" ? rec.filePath : "unknown";
        return {
          kind: "agentfs_file",
          id: `${runId}:${filePath}`,
        };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        filePath: z.string().min(1).max(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const filePath = validateAgentfsFilePath(input.filePath);

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        // Get all tool calls and filter for those affecting the specified file
        const toolCallsRaw = await fsdb.tools.getRecent(0, 1000);
        const changes = toolCallsRaw
          .filter((c: AgentFSToolCall) => {
            const callPath = extractPath(c.parameters);
            return callPath.includes(filePath);
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

  fileBlame: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        const filePath =
          typeof rec.filePath === "string" ? rec.filePath : "unknown";
        return {
          kind: "agentfs_file",
          id: `${runId}:${filePath}`,
        };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        filePath: z.string().min(1).max(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const filePath = validateAgentfsFilePath(input.filePath);

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const st = await fsdb.fs.stat(filePath).catch(() => null);
        if (!st || typeof st.mtime !== "number") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "agentfs_file_not_found",
          });
        }

        const toolCallsRaw = await fsdb.tools.getRecent(0, 1000);
        const candidates = rankAgentfsBlameCandidates({
          toolCalls: toolCallsRaw,
          fileMtimeSec: st.mtime,
          limit: 5,
        });

        return {
          mtimeSec: st.mtime,
          candidates,
        };
      } finally {
        await fsdb.close();
      }
    }),

  fileClass: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy(
        "agentfs.read",
        (raw) => {
          const rec = (raw ?? {}) as Record<string, unknown>;
          const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
          const filePath =
            typeof rec.filePath === "string" ? rec.filePath : "unknown";
          return {
            kind: "agentfs_file",
            id: `${runId}:${filePath}`,
          };
        },
        (raw) => {
          const rec = (raw ?? {}) as Record<string, unknown>;
          const filePath = typeof rec.filePath === "string" ? rec.filePath : "";
          return { sensitivity: classifyAgentfsFilePath(filePath) };
        }
      )
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        filePath: z.string().min(1).max(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const filePath = validateAgentfsFilePath(input.filePath);

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const st = await fsdb.fs.stat(filePath).catch(() => null);
        if (!st || typeof st.isDirectory !== "function" || st.isDirectory()) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "agentfs_file_not_found",
          });
        }

        const cls = await readAgentfsFileClass(fsdb, filePath);
        return {
          filePath,
          ...cls,
        };
      } finally {
        await fsdb.close();
      }
    }),

  fileContent: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy(
        "agentfs.read",
        (raw) => {
          const rec = (raw ?? {}) as Record<string, unknown>;
          const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
          const filePath =
            typeof rec.filePath === "string" ? rec.filePath : "unknown";
          return {
            kind: "agentfs_file",
            id: `${runId}:${filePath}`,
          };
        },
        (raw) => {
          const rec = (raw ?? {}) as Record<string, unknown>;
          const filePath = typeof rec.filePath === "string" ? rec.filePath : "";
          return { sensitivity: classifyAgentfsFilePath(filePath) };
        }
      )
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        filePath: z.string().min(1).max(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const filePath = validateAgentfsFilePath(input.filePath);

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const cls = await readAgentfsFileClass(fsdb, filePath);
        if (cls.sensitivity === "sensitive") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "agentfs_sensitive_file",
          });
        }

        const maxBytes = getPreviewMaxBytes();
        const { buf, sizeBytes } = await readAgentfsPrefix(
          fsdb,
          filePath,
          maxBytes
        );

        const truncated = sizeBytes > maxBytes;

        const isBinary = looksBinary(buf);
        const encoding = isBinary ? ("base64" as const) : ("utf8" as const);
        const content = isBinary
          ? buf.toString("base64")
          : buf.toString("utf8");

        return {
          encoding,
          content,
          isBinary,
          sizeBytes,
          truncated,
        };
      } finally {
        await fsdb.close();
      }
    }),

  fileSlice: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy(
        "agentfs.read",
        (raw) => {
          const rec = (raw ?? {}) as Record<string, unknown>;
          const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
          const filePath =
            typeof rec.filePath === "string" ? rec.filePath : "unknown";
          return {
            kind: "agentfs_file",
            id: `${runId}:${filePath}`,
          };
        },
        (raw) => {
          const rec = (raw ?? {}) as Record<string, unknown>;
          const filePath = typeof rec.filePath === "string" ? rec.filePath : "";
          return { sensitivity: classifyAgentfsFilePath(filePath) };
        }
      )
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        filePath: z.string().min(1).max(500),
        offsetBytes: z.number().int().min(0).default(0),
        maxBytes: z
          .number()
          .int()
          .min(1)
          .max(1024 * 1024)
          .default(200_000),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const filePath = validateAgentfsFilePath(input.filePath);

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const cls = await readAgentfsFileClass(fsdb, filePath);
        if (cls.sensitivity === "sensitive") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "agentfs_sensitive_file",
          });
        }

        const { buf, sizeBytes } = await readAgentfsRange(
          fsdb,
          filePath,
          input.offsetBytes,
          input.maxBytes
        );

        const isBinary = looksBinary(buf);
        const encoding = isBinary ? ("base64" as const) : ("utf8" as const);
        const content = isBinary
          ? buf.toString("base64")
          : buf.toString("utf8");
        const truncated = input.offsetBytes + buf.length < sizeBytes;

        return {
          encoding,
          content,
          isBinary,
          sizeBytes,
          offsetBytes: input.offsetBytes,
          returnedBytes: buf.length,
          truncated,
        };
      } finally {
        await fsdb.close();
      }
    }),

  kvList: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const kvRaw = await fsdb.kv.list();
        const entries = kvRaw.map((e: AgentFSKVEntry) => {
          const redacted = redactExecutorKvEntry({
            key: e.key,
            value: e.value,
          });
          return {
            key: e.key,
            value: redacted.value,
            type: redacted.redacted ? "redacted" : typeof e.value,
            createdAt: new Date((e.created_at ?? 0) * 1000).toISOString(),
            updatedAt: new Date((e.updated_at ?? 0) * 1000).toISOString(),
          };
        });

        return { entries };
      } finally {
        await fsdb.close();
      }
    }),

  executorConfigGet: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        kind: executorKindSchema,
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const key = `executor:${input.kind}:config`;
        const raw = await fsdb.kv.get<unknown>(key);
        const parsed = raw ? executorConfigPublicSchema.safeParse(raw) : null;
        return {
          exists: Boolean(raw),
          config: parsed?.success ? parsed.data : null,
          valid: parsed ? parsed.success : false,
        };
      } finally {
        await fsdb.close();
      }
    }),

  executorConfigSet: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        config: executorConfigWriteSchema,
        projectId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const {kind} = input.config;
        const keyConfig = `executor:${kind}:config`;
        const keySecrets = `executor:${kind}:secrets`;

        let nextSecrets: unknown | undefined;
        let passwordSet = false;

        if (kind === "opencode") {
          const cfg = input.config as Extract<
            z.infer<typeof executorConfigWriteSchema>,
            { kind: "opencode" }
          >;

          if (cfg.transport === "http") {
            const baseUrl = cfg.http?.baseUrl;
            if (baseUrl) {
              assertSafeExecutorHttpBaseUrl(baseUrl);
            }
          }

          const prevSecrets = await fsdb.kv.get<unknown>(keySecrets);
          const prevHttp =
            prevSecrets && typeof prevSecrets === "object"
              ? (prevSecrets as Record<string, unknown>).http
              : undefined;
          const prevPassword =
            prevHttp && typeof prevHttp === "object"
              ? (prevHttp as Record<string, unknown>).password
              : undefined;

          const nextPassword = cfg.http?.password;
          const password =
            typeof nextPassword === "string"
              ? nextPassword
              : (typeof prevPassword === "string"
                ? prevPassword
                : undefined);
          passwordSet = typeof password === "string" && password.length > 0;

          if (password) {
            nextSecrets = {
              http: { password },
              kind,
              v: cfg.v,
            };
            await fsdb.kv.set(keySecrets, nextSecrets);
          }

          const publicCfg = {
            acp: cfg.acp,
            defaultExecProfile: cfg.defaultExecProfile,
            http: cfg.http
              ? {
                  baseUrl: cfg.http.baseUrl,
                  passwordSet,
                  username: cfg.http.username,
                }
              : undefined,
            kind,
            transport: cfg.transport,
            v: cfg.v,
          };

          const parsedPublic = executorConfigPublicSchema.safeParse(publicCfg);
          if (!parsedPublic.success) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "executor_config_invalid",
            });
          }

          await fsdb.kv.set(keyConfig, parsedPublic.data);
          return {
            config: parsedPublic.data,
            exists: true,
          };
        }

        if (kind === "codex") {
          await fsdb.kv.set(keyConfig, input.config);
          return { config: input.config, exists: true };
        }

        await fsdb.kv.set(keyConfig, input.config);
        return { config: input.config, exists: true };
      } finally {
        await fsdb.close();
      }
    }),

  executorStatus: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        kind: executorKindSchema,
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const expectedName = `alfred-agentfs-${sanitizeRunId(input.runId)}`;
        const expectedCw = "/workspace";

        const keyConfig = `executor:${input.kind}:config`;
        const raw = await fsdb.kv.get<unknown>(keyConfig);
        const parsed = raw ? executorConfigPublicSchema.safeParse(raw) : null;
        const issues = parsed?.success
          ? undefined
          : (parsed
            ? parsed.error.issues.map((i) => i.message)
            : undefined);

        const supports = (() => {
          if (input.kind === "droid") {
            return {
              execProfiles: ["default"] as const,
              transports: undefined,
            };
          }
          if (input.kind === "codex") {
            return {
              execProfiles: ["default", "server"] as const,
              transports: undefined,
            };
          }
          return {
            execProfiles: ["default", "server"] as const,
            transports: ["acp", "http"] as const,
          };
        })();

        const res = {
          config: {
            exists: Boolean(raw),
            issues,
            valid: parsed ? parsed.success : false,
          },
          containerContext: {
            expectedCw,
            expectedName,
            present: input.kind !== "droid",
          },
          kind: input.kind,
          supports,
        };

        return executorStatusSchema.parse(res);
      } finally {
        await fsdb.close();
      }
    }),

  executorHealth: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        kind: executorKindSchema,
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const checkedAt = new Date().toISOString();
        const keyConfig = `executor:${input.kind}:config`;
        const rawCfg = await fsdb.kv.get<unknown>(keyConfig);
        const parsedCfg = rawCfg
          ? executorConfigPublicSchema.safeParse(rawCfg)
          : null;
        if (!parsedCfg?.success) {
          return executorHealthSchema.parse({
            checkedAt,
            details: rawCfg
              ? "executor_config_invalid"
              : "executor_config_missing",
            kind: input.kind,
            ok: false,
          });
        }

        if (input.kind !== "opencode") {
          return executorHealthSchema.parse({
            checkedAt,
            details: "executor_health_unsupported",
            kind: input.kind,
            ok: false,
          });
        }

        const cfg = parsedCfg.data as Extract<
          z.infer<typeof executorConfigPublicSchema>,
          { kind: "opencode" }
        >;

        if (cfg.transport !== "http") {
          return executorHealthSchema.parse({
            checkedAt,
            details: "opencode_health_acp_unsupported",
            kind: input.kind,
            ok: false,
          });
        }

        const baseUrl = cfg.http?.baseUrl;
        if (!baseUrl) {
          return executorHealthSchema.parse({
            checkedAt,
            details: "opencode_http_baseurl_required",
            kind: input.kind,
            ok: false,
          });
        }

        const safeBaseUrl = assertSafeExecutorHttpBaseUrl(baseUrl);

        const keySecrets = `executor:${input.kind}:secrets`;
        const rawSecrets = await fsdb.kv.get<unknown>(keySecrets);
        const secretsHttp =
          rawSecrets && typeof rawSecrets === "object"
            ? (rawSecrets as Record<string, unknown>).http
            : undefined;
        const password =
          secretsHttp && typeof secretsHttp === "object"
            ? (secretsHttp as Record<string, unknown>).password
            : undefined;

        const username = cfg.http?.username;
        const passwordSet = cfg.http?.passwordSet === true;
        if (
          passwordSet &&
          !(typeof username === "string" && username.length > 0)
        ) {
          return executorHealthSchema.parse({
            checkedAt,
            details: "opencode_http_username_required",
            kind: input.kind,
            ok: false,
          });
        }
        if (
          passwordSet &&
          !(typeof password === "string" && password.length > 0)
        ) {
          return executorHealthSchema.parse({
            checkedAt,
            details: "opencode_http_password_missing",
            kind: input.kind,
            ok: false,
          });
        }

        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 2000);
        try {
          const headers = new Headers();
          if (passwordSet && username && typeof password === "string") {
            const token = Buffer.from(
              `${username}:${password}`,
              "utf8"
            ).toString("base64");
            headers.set("authorization", `Basic ${token}`);
          }

          const res = await fetch(`${safeBaseUrl}/path`, {
            headers,
            method: "GET",
            signal: ac.signal,
          });

          if (!res.ok) {
            return executorHealthSchema.parse({
              checkedAt,
              details: `opencode_http_unhealthy:${res.status}`,
              kind: input.kind,
              ok: false,
            });
          }

          return executorHealthSchema.parse({
            checkedAt,
            kind: input.kind,
            ok: true,
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return executorHealthSchema.parse({
            checkedAt,
            details: `opencode_http_unhealthy:${msg}`,
            kind: input.kind,
            ok: false,
          });
        } finally {
          clearTimeout(t);
        }
      } finally {
        await fsdb.close();
      }
    }),

  operationsList: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(500).default(100),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

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

  pinRun: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(z.object({ runId: z.string().min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      try {
        const runId = sanitizeRunId(input.runId);
        if (!runId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "agentfs_run_id_invalid",
          });
        }

        const runDir = path.resolve(process.cwd(), ".agentfs", runId);
        const keep = path.join(runDir, ".keep");
        await mkdir(runDir, { recursive: true });
        await writeFile(keep, new Date().toISOString(), "utf8");

        await recordAgentfsOp({
          ctx,
          action: "pin_set",
          success: true,
          runId: input.runId,
        });
        return { ok: true };
      } catch (error) {
        await recordAgentfsOp({
          ctx,
          action: "pin_set",
          success: false,
          runId: input.runId,
          extra: {
            error: error instanceof Error ? error.message : String(error ?? ""),
          },
        });
        throw error;
      }
    }),

  runStats: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return {
          kind: "agentfs_file",
          id: `${runId}:/`,
        };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const db = fsdb.getDatabase() as unknown;
        const hasPrepare =
          typeof (db as { prepare?: unknown } | null)?.prepare === "function";
        if (!hasPrepare) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "agentfs_db_unavailable",
          });
        }

        const stats = await readAgentfsRunStats(
          db as { prepare: (sql: string) => { get?: () => unknown } }
        );

        return {
          toolCalls: stats.toolCalls,
          checkpoints: stats.checkpoints,
          files: stats.files,
          bytes: stats.bytes,
        };
      } finally {
        await fsdb.close();
      }
    }),

  setRetention: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        days: z.number().int().min(1).max(3650),
      })
    )
    .mutation(async ({ input }) => {
      const runId = sanitizeRunId(input.runId);
      if (!runId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_run_id_invalid",
        });
      }

      const runDir = path.resolve(process.cwd(), ".agentfs", runId);
      await mkdir(runDir, { recursive: true });
      const p = path.join(runDir, ".retention");
      await writeFile(p, String(input.days), "utf8");
      return { ok: true, retentionDays: input.days };
    }),

  snapshot: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        const dir = typeof rec.dir === "string" ? rec.dir : "/";
        return { kind: "agentfs_file", id: `${runId}:${dir}` };
      })
    )
    .input(agentfsSnapshotInputSchema)
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const dir = validateAgentfsFilePath(input.dir);

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const names = await fsdb.fs.readdir(dir);
        const entries = await Promise.all(
          names.map(async (name: string, i: number) => {
            const full = path.posix.join(dir, name);
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
        const kvStore = kvRaw.map((e: AgentFSKVEntry) => {
          const redacted = redactExecutorKvEntry({
            key: e.key,
            value: e.value,
          });
          return {
            key: e.key,
            value: redacted.value,
            createdAt: e.created_at,
            updatedAt: e.updated_at,
          };
        });

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

        const cursor: AgentFSStreamCursor = {
          toolCallId: maxToolCallId,
          toolCallSince: maxToolCallSince,
          kvUpdatedAt: maxKvUpdatedAt,
        };

        return {
          runId: input.runId,
          dbPath: input.dbPath,
          entries,
          toolCalls,
          kvStore,
          cursor,
        };
      } finally {
        await fsdb.close();
      }
    }),

  stream: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        const dir = typeof rec.dir === "string" ? rec.dir : "/";
        return { kind: "agentfs_file", id: `${runId}:${dir}` };
      })
    )
    .input(agentfsStreamInputSchema)
    .subscription(({ input, ctx }) => {
      let { dir } = input;
      try {
        dir = validateAgentfsFilePath(input.dir);
      } catch (error) {
        return observable<AgentFSStreamEvent>((emit) => {
          emit.error(error as TRPCError);
          return () => {};
        });
      }

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
        let loaded: Awaited<ReturnType<typeof loadAgentfs>> | null = null;
        let lastDbMtimeMs: number | null = null;
        let lastDiffSig: string | null = null;
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
            if (loaded) {
              try {
                await loaded.fsdb.close();
              } catch {
                // ignore
              } finally {
                loaded = null;
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

            if (!loaded) {
              loaded = await loadAgentfs({
                runId: input.runId,
                dbPath: input.dbPath,
              });

              await enforceAgentfsProjectAccess({
                ctx,
                runId: input.runId,
                dbPath: input.dbPath,
                baseDir: loaded.baseDir,
                projectId: input.projectId,
              });
            }

            const currentLoaded = loaded;
            if (!currentLoaded) {
              return;
            }

            const currentFsdb = currentLoaded.fsdb;

            const names = await currentFsdb.fs.readdir(dir);
            const entries = await Promise.all(
              names.map(async (name: string, i: number) => {
                const full = path.posix.join(dir, name);
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
            const kvStore = kvRaw.map((e: AgentFSKVEntry) => {
              const redacted = redactExecutorKvEntry({
                key: e.key,
                value: e.value,
              });
              return {
                key: e.key,
                value: redacted.value,
                createdAt: e.created_at,
                updatedAt: e.updated_at,
              };
            });

            const diffRaw = await currentFsdb.diff().catch(() => []);
            const changes = [...diffRaw].sort(
              (a: AgentFSChange, b: AgentFSChange) =>
                a.path.localeCompare(b.path)
            );
            const diffSig = JSON.stringify(
              changes.map((c) => ({
                path: c.path,
                type: c.type,
                size: c.size ?? 0,
                mtime: c.mtime ?? 0,
              }))
            );
            const diffChanged = lastDiffSig !== diffSig;
            if (diffChanged) {
              lastDiffSig = diffSig;
            }

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
              changes: diffChanged ? changes : undefined,
            });

            eventCount++;
            if (eventCount >= maxEvents) {
              finish("complete");
            }
          } catch {
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

  timeline: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(1000).default(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const toolCallsRaw = await fsdb.tools.getRecent(0, input.limit);
        const events = toolCallsRaw.map((c: AgentFSToolCall) => ({
          id: String(c.id),
          type: "tool" as const,
          name: c.name,
          timestamp: new Date(c.started_at * 1000).toISOString(),
          duration: c.duration_ms,
          data: {
            parameters: c.parameters,
            result: c.result,
            error: c.error,
          },
        }));

        return { events };
      } finally {
        await fsdb.close();
      }
    }),

  unpinRun: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(z.object({ runId: z.string().min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      try {
        const runId = sanitizeRunId(input.runId);
        if (!runId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "agentfs_run_id_invalid",
          });
        }

        const runDir = path.resolve(process.cwd(), ".agentfs", runId);
        const keep = path.join(runDir, ".keep");
        try {
          await unlink(keep);
        } catch {
          // ignore
        }

        await recordAgentfsOp({
          ctx,
          action: "pin_clear",
          success: true,
          runId: input.runId,
        });
        return { ok: true };
      } catch (error) {
        await recordAgentfsOp({
          ctx,
          action: "pin_clear",
          success: false,
          runId: input.runId,
          extra: {
            error: error instanceof Error ? error.message : String(error ?? ""),
          },
        });
        throw error;
      }
    }),

  ...agentfsExtraProcedures,
});
