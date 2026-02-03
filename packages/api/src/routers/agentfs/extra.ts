import { READ_SCOPES, WRITE_SCOPES } from "@alfred/type";
import { TRPCError } from "@trpc/server";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

import type { WorkspaceListItem } from "./shared";

import { requirePolicy } from "../../gate";
import { requireScopes } from "../../middleware/scopes";
import { checkAgentfsAccess } from "../../services/agentfsaccess";
import { authedProcedure } from "../../trpc";
import {
  getUserIdForAgentfsAccess,
  inferAgentType,
  loadAgentfs,
  recordAgentfsOp,
  resolveSearchRunIds,
} from "./shared";

export const agentfsExtraProcedures = {
  // ─────────────────────────────────────────────────────────────────────────
  // Workspace Management Procedures (overflow)
  // ─────────────────────────────────────────────────────────────────────────

  workspacesList: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .query(async ({ ctx }) => {
      try {
        const agentfsDir = path.join(process.cwd(), ".agentfs");
        const userId = getUserIdForAgentfsAccess({ session: ctx.session });

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
        const workspaces: WorkspaceListItem[] = [];

        for (const e of entries) {
          if (!e.isDirectory()) {
            continue;
          }
          if (e.name === "quarantine" || e.name === "cas") {
            continue;
          }

          const runPath = path.join(agentfsDir, e.name);
          const dbPath = `.agentfs/${e.name}/agentfs.db`;
          const keepPath = path.join(runPath, ".keep");
          const pinned = existsSync(keepPath);

          const retentionPath = path.join(runPath, ".retention");
          let retentionDays: number | null = null;
          try {
            if (existsSync(retentionPath)) {
              const raw = readFileSync(retentionPath, "utf8").trim();
              const n = Number.parseInt(raw, 10);
              if (Number.isFinite(n) && n > 0) {
                retentionDays = n;
              }
            }
          } catch {
            retentionDays = null;
          }

          let dbExists = false;
          let mtime: Date | undefined;
          try {
            const dbStats = statSync(path.join(runPath, "agentfs.db"));
            dbExists = dbStats.isFile();
            ({ mtime } = dbStats);
          } catch {
            dbExists = false;
          }
          if (!dbExists) {
            continue;
          }

          let projectId: string | null = null;
          try {
            const projectHint = path.join(runPath, ".project");
            if (existsSync(projectHint)) {
              const access = await checkAgentfsAccess({
                userId,
                runId: e.name,
                baseDir: null,
                requestedProjectId: null,
              });
              if (!access.allow && access.reason === "run_not_owned") {
                continue;
              }
              ({ projectId } = access);
            } else {
              const loaded = await loadAgentfs({ runId: e.name, dbPath });
              try {
                const access = await checkAgentfsAccess({
                  userId,
                  runId: e.name,
                  baseDir: loaded.baseDir,
                  requestedProjectId: null,
                });
                if (!access.allow && access.reason === "run_not_owned") {
                  continue;
                }
                ({ projectId } = access);
              } finally {
                await loaded.fsdb.close();
              }
            }
          } catch {
            projectId = null;
          }

          const isRecent =
            mtime && Date.now() - mtime.getTime() < 5 * 60 * 1000;

          workspaces.push({
            id: e.name,
            runId: e.name,
            dbPath,
            agentType: inferAgentType(e.name),
            status: isRecent ? "active" : "completed",
            createdAt: mtime?.toISOString() ?? new Date().toISOString(),
            operationCount: 0,
            checkpointCount: 0,
            pinned,
            retentionDays,
            projectId,
          });
        }

        return { workspaces };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list workspaces: ${(error as Error).message}`,
        });
      }
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Quarantine Management Procedures
  // ─────────────────────────────────────────────────────────────────────────

  quarantineList: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "quarantine:/",
      }))
    )
    .input(
      z.object({
        cursor: z.string().min(1).max(500).optional(),
        limit: z.number().int().min(1).max(1000).default(100),
        type: z.enum(["run", "cas"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const { listQuarantine } =
        await import("../../services/agentfs-quarantine");
      const result = await listQuarantine({
        cursor: input.cursor,
        limit: input.limit,
        type: input.type,
      });
      return { items: result.entries, nextCursor: result.nextCursor };
    }),

  quarantineInspect: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const id = typeof rec.id === "string" ? rec.id : "unknown";
        return { kind: "agentfs_file", id: `quarantine:${id}` };
      })
    )
    .input(z.object({ id: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const { inspectQuarantineItem } =
        await import("../../services/agentfs-quarantine");
      const item = await inspectQuarantineItem(input.id);
      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quarantine item not found",
        });
      }
      return item;
    }),

  quarantineRestore: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const id = typeof rec.id === "string" ? rec.id : "unknown";
        return { kind: "agentfs_file", id: `quarantine:${id}` };
      })
    )
    .input(z.object({ id: z.string().min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const { inspectQuarantineItem, restoreQuarantineItem } =
        await import("../../services/agentfs-quarantine");

      const item = await inspectQuarantineItem(input.id).catch(() => null);

      const resource =
        item?.type === "run"
          ? { kind: "agentfs_quarantine", id: `run:${item.id}` }
          : (item?.type === "cas"
            ? { kind: "agentfs_quarantine", id: `cas:${item.id}` }
            : { kind: "agentfs_quarantine", id: input.id });
      const runId = item?.type === "run" ? item.id : undefined;
      const sha = item?.type === "cas" ? item.id : undefined;

      const result = await restoreQuarantineItem(input.id);
      if (!result.success) {
        await recordAgentfsOp({
          ctx,
          action: "quarantine_restore",
          success: false,
          runId,
          sha,
          resource,
          extra: { error: result.error ?? "agentfs_quarantine_restore_failed" },
        });

        if (result.error === "agentfs_quarantine_not_found") {
          throw new TRPCError({ code: "NOT_FOUND", message: "not_found" });
        }
        if (result.error === "agentfs_quarantine_pinned") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "pinned",
          });
        }
        if (result.error === "agentfs_quarantine_target_exists") {
          throw new TRPCError({ code: "CONFLICT", message: "target_exists" });
        }
        if (
          result.error === "agentfs_quarantine_invalid_target" ||
          result.error === "agentfs_quarantine_no_target" ||
          result.error === "agentfs_quarantine_corrupt_metadata"
        ) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to restore quarantine item",
        });
      }

      await recordAgentfsOp({
        ctx,
        action: "quarantine_restore",
        success: true,
        runId,
        sha,
        resource,
        extra: { newPath: result.newPath },
      });
      return result;
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Storage Metrics Procedures
  // ─────────────────────────────────────────────────────────────────────────

  metricsStorage: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "metrics:/",
      }))
    )
    .input(z.object({ projectId: z.string().uuid().optional() }))
    .query(async ({ input }) => {
      const { calculateStorageMetrics } =
        await import("../../services/agentfs-metrics");
      return calculateStorageMetrics({ projectId: input.projectId });
    }),

  metricsCas: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "metrics:cas",
      }))
    )
    .query(async () => {
      const { getCasMetrics } = await import("../../services/agentfs-metrics");
      return getCasMetrics();
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Batch Operations Procedures
  // ─────────────────────────────────────────────────────────────────────────

  batchDelete: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "batch:/",
      }))
    )
    .input(
      z.object({
        runIds: z.array(z.string().min(1)).min(1).max(1000),
        dryRun: z.boolean().default(false),
        projectId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = getUserIdForAgentfsAccess(ctx);

      // Validate access to each run
      const accessibleRunIds: string[] = [];
      const failed: { id: string; success: boolean; error: string }[] = [];

      for (const runId of input.runIds) {
        const access = await checkAgentfsAccess({
          userId,
          runId,
          requestedProjectId: input.projectId ?? null,
        });

        if (!access.allow) {
          failed.push({
            id: runId,
            success: false,
            error:
              access.reason === "run_not_owned"
                ? "agentfs_run_forbidden"
                : "agentfs_project_mismatch",
          });
        } else {
          accessibleRunIds.push(runId);
        }
      }

      const { batchDelete } = await import("../../services/agentfs-batch");
      const result = await batchDelete(accessibleRunIds, {
        dryRun: input.dryRun,
      });

      // Merge access failures with operation failures
      const merged = {
        ...result,
        failed: [...failed, ...result.failed],
      };
      await recordAgentfsOp({
        ctx,
        action: "batch_delete",
        success: merged.failed.length === 0,
        projectId: input.projectId ?? null,
        resource: { kind: "agentfs_batch", id: "delete" },
        extra: {
          dryRun: input.dryRun,
          requested: input.runIds.length,
          accessible: accessibleRunIds.length,
          deleted: merged.deleted.length,
          skippedPinned: merged.skippedPinned.length,
          failed: merged.failed.length,
          bytesFreed: merged.bytesFreed,
        },
      });
      return merged;
    }),

  batchPin: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "batch:/",
      }))
    )
    .input(
      z.object({
        runIds: z.array(z.string().min(1)).min(1).max(1000),
        projectId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = getUserIdForAgentfsAccess(ctx);

      // Validate access to each run
      const accessibleRunIds: string[] = [];
      const failed: { id: string; success: boolean; error: string }[] = [];

      for (const runId of input.runIds) {
        const access = await checkAgentfsAccess({
          userId,
          runId,
          requestedProjectId: input.projectId ?? null,
        });

        if (!access.allow) {
          failed.push({
            id: runId,
            success: false,
            error:
              access.reason === "run_not_owned"
                ? "agentfs_run_forbidden"
                : "agentfs_project_mismatch",
          });
        } else {
          accessibleRunIds.push(runId);
        }
      }

      const { batchPin } = await import("../../services/agentfs-batch");
      const result = await batchPin(accessibleRunIds);

      const merged = {
        ...result,
        failed: [...failed, ...result.failed],
      };
      await recordAgentfsOp({
        ctx,
        action: "batch_pin",
        success: merged.failed.length === 0,
        projectId: input.projectId ?? null,
        resource: { kind: "agentfs_batch", id: "pin" },
        extra: {
          requested: input.runIds.length,
          accessible: accessibleRunIds.length,
          pinned: merged.pinned.length,
          alreadyPinned: merged.alreadyPinned.length,
          failed: merged.failed.length,
        },
      });
      return merged;
    }),

  batchUnpin: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "batch:/",
      }))
    )
    .input(
      z.object({
        runIds: z.array(z.string().min(1)).min(1).max(1000),
        projectId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = getUserIdForAgentfsAccess(ctx);

      // Validate access to each run
      const accessibleRunIds: string[] = [];
      const failed: { id: string; success: boolean; error: string }[] = [];

      for (const runId of input.runIds) {
        const access = await checkAgentfsAccess({
          userId,
          runId,
          requestedProjectId: input.projectId ?? null,
        });

        if (!access.allow) {
          failed.push({
            id: runId,
            success: false,
            error:
              access.reason === "run_not_owned"
                ? "agentfs_run_forbidden"
                : "agentfs_project_mismatch",
          });
        } else {
          accessibleRunIds.push(runId);
        }
      }

      const { batchUnpin } = await import("../../services/agentfs-batch");
      const result = await batchUnpin(accessibleRunIds);

      const merged = {
        ...result,
        failed: [...failed, ...result.failed],
      };
      await recordAgentfsOp({
        ctx,
        action: "batch_unpin",
        success: merged.failed.length === 0,
        projectId: input.projectId ?? null,
        resource: { kind: "agentfs_batch", id: "unpin" },
        extra: {
          requested: input.runIds.length,
          accessible: accessibleRunIds.length,
          unpinned: merged.unpinned.length,
          notPinned: merged.notPinned.length,
          failed: merged.failed.length,
        },
      });
      return merged;
    }),

  batchExport: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "batch:/",
      }))
    )
    .input(
      z.object({
        runIds: z.array(z.string().min(1)).min(1).max(100),
        store: z.boolean().default(true),
        projectId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = getUserIdForAgentfsAccess(ctx);

      // Validate access to each run and collect projectIds
      const accessibleRunIds: string[] = [];
      const projectIdMap = new Map<string, string | null>();
      const failed: { id: string; success: boolean; error?: string }[] = [];

      for (const runId of input.runIds) {
        const access = await checkAgentfsAccess({
          userId,
          runId,
          requestedProjectId: input.projectId ?? null,
        });

        if (!access.allow) {
          failed.push({
            id: runId,
            success: false,
            error:
              access.reason === "run_not_owned"
                ? "agentfs_run_forbidden"
                : "agentfs_project_mismatch",
          });
        } else {
          accessibleRunIds.push(runId);
          projectIdMap.set(runId, access.projectId);
        }
      }

      // Export runs one by one to preserve project scoping
      const { batchExport } = await import("../../services/agentfs-batch");
      const archives: { runId: string; sha: string }[] = [];
      const exportFailed: { id: string; success: boolean; error?: string }[] =
        [];

      for (const runId of accessibleRunIds) {
        try {
          const result = await batchExport([runId], {
            store: input.store,
            projectId: projectIdMap.get(runId),
          });
          archives.push(...result.archives);
          exportFailed.push(...result.failed);
        } catch {
          exportFailed.push({
            id: runId,
            success: false,
            error: "agentfs_batch_export_failed",
          });
        }
      }

      const merged = {
        archives,
        failed: [...failed, ...exportFailed],
      };
      await recordAgentfsOp({
        ctx,
        action: "batch_export",
        success: merged.failed.length === 0,
        projectId: input.projectId ?? null,
        resource: { kind: "agentfs_batch", id: "export" },
        extra: {
          store: input.store,
          requested: input.runIds.length,
          accessible: accessibleRunIds.length,
          archives: merged.archives.length,
          failed: merged.failed.length,
        },
      });
      return merged;
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Advanced Search Procedures
  // ─────────────────────────────────────────────────────────────────────────

  searchFiles: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "search:/",
      }))
    )
    .input(
      z.object({
        pattern: z.string().min(1).max(500),
        runIds: z.array(z.string().min(1).max(200)).min(1).max(1000).optional(),
        projectId: z.string().uuid().optional(),
        agentType: z.string().optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        sensitivity: z.enum(["normal", "sensitive", "all"]).default("normal"),
        limit: z.number().int().min(1).max(1000).default(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const { searchFiles } = await import("../../services/agentfs-search");
      const runIds = await resolveSearchRunIds({
        ctx,
        projectId: input.projectId ?? null,
        runIds: input.runIds,
      });
      return searchFiles(input.pattern, {
        runIds,
        projectId: runIds ? undefined : input.projectId,
        agentType: input.agentType,
        dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
        dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
        sensitivity: input.sensitivity,
        limit: input.limit,
      });
    }),

  searchKv: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "search:/",
      }))
    )
    .input(
      z.object({
        keyPattern: z.string().min(1).max(500),
        valuePattern: z.string().min(1).max(500).optional(),
        runIds: z.array(z.string().min(1).max(200)).min(1).max(1000).optional(),
        projectId: z.string().uuid().optional(),
        agentType: z.string().optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const { searchKv } = await import("../../services/agentfs-search");
      const runIds = await resolveSearchRunIds({
        ctx,
        projectId: input.projectId ?? null,
        runIds: input.runIds,
      });
      return searchKv(
        input.keyPattern,
        {
          runIds,
          projectId: runIds ? undefined : input.projectId,
          agentType: input.agentType,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
          limit: input.limit,
        },
        input.valuePattern
      );
    }),

  searchToolCalls: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "search:/",
      }))
    )
    .input(
      z.object({
        namePattern: z.string().min(1).max(500),
        paramsPattern: z.string().min(1).max(500).optional(),
        runIds: z.array(z.string().min(1).max(200)).min(1).max(1000).optional(),
        projectId: z.string().uuid().optional(),
        agentType: z.string().optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const { searchToolCalls } = await import("../../services/agentfs-search");
      const runIds = await resolveSearchRunIds({
        ctx,
        projectId: input.projectId ?? null,
        runIds: input.runIds,
      });
      return searchToolCalls(
        input.namePattern,
        {
          runIds,
          projectId: runIds ? undefined : input.projectId,
          agentType: input.agentType,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
          limit: input.limit,
        },
        input.paramsPattern
      );
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Retention Policy Procedures
  // ─────────────────────────────────────────────────────────────────────────

  retentionPreview: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "retention:/",
      }))
    )
    .input(
      z.object({
        retentionDays: z.number().int().min(1).max(3650).optional(),
        casRetentionDays: z.number().int().min(1).max(3650).optional(),
        maxBytes: z.number().int().min(0).optional(),
        casMaxBytes: z.number().int().min(0).optional(),
      })
    )
    .query(async ({ input }) => {
      const { generateRetentionPreview } =
        await import("../../services/agentfs-retention");
      return generateRetentionPreview({
        retentionDays: input.retentionDays,
        casRetentionDays: input.casRetentionDays,
        maxBytes: input.maxBytes,
        casMaxBytes: input.casMaxBytes,
      });
    }),

  retentionSimulate: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "retention:/",
      }))
    )
    .input(
      z.object({
        retentionDays: z.number().int().min(1).max(3650).optional(),
        casRetentionDays: z.number().int().min(1).max(3650).optional(),
        maxBytes: z.number().int().min(0).optional(),
        casMaxBytes: z.number().int().min(0).optional(),
      })
    )
    .query(async ({ input }) => {
      const { simulateCleanup } =
        await import("../../services/agentfs-retention");
      return simulateCleanup({
        retentionDays: input.retentionDays,
        casRetentionDays: input.casRetentionDays,
        maxBytes: input.maxBytes,
        casMaxBytes: input.casMaxBytes,
      });
    }),

  retentionViolations: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "retention:/",
      }))
    )
    .query(async () => {
      const { getPolicyViolations } =
        await import("../../services/agentfs-retention");
      return getPolicyViolations();
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // CAS Management Procedures
  // ─────────────────────────────────────────────────────────────────────────

  casList: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "cas:/",
      }))
    )
    .input(
      z.object({
        cursor: z.string().min(1).max(500).optional(),
        projectId: z.string().uuid().optional(),
        runId: z.string().min(1).max(200).optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      })
    )
    .query(async ({ input }) => {
      const { listCasArchives } = await import("../../services/agentfs-cas");
      return listCasArchives({
        cursor: input.cursor,
        projectId: input.projectId,
        runId: input.runId,
        from: input.from ? new Date(input.from) : undefined,
        to: input.to ? new Date(input.to) : undefined,
        limit: input.limit,
      });
    }),

  casMetadata: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const sha = typeof rec.sha === "string" ? rec.sha : "unknown";
        return { kind: "agentfs_file", id: `cas:${sha}` };
      })
    )
    .input(z.object({ sha: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const { getCasMetadata } = await import("../../services/agentfs-cas");
      const archive = await getCasMetadata(input.sha);
      if (!archive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "CAS archive not found",
        });
      }
      return archive;
    }),

  casDelete: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const sha = typeof rec.sha === "string" ? rec.sha : "unknown";
        return { kind: "agentfs_file", id: `cas:${sha}` };
      })
    )
    .input(z.object({ sha: z.string().min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const { deleteCasArchive } = await import("../../services/agentfs-cas");
      const result = await deleteCasArchive(input.sha);
      if (!result.success) {
        await recordAgentfsOp({
          ctx,
          action: "cas_delete",
          success: false,
          sha: input.sha,
          resource: { kind: "agentfs_cas", id: input.sha },
          extra: { error: result.error ?? "agentfs_cas_delete_failed" },
        });

        if (result.error === "agentfs_cas_archive_not_found") {
          throw new TRPCError({ code: "NOT_FOUND", message: "not_found" });
        }
        if (result.error === "agentfs_cas_archive_pinned") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "pinned",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to delete CAS archive",
        });
      }

      await recordAgentfsOp({
        ctx,
        action: "cas_delete",
        success: true,
        sha: input.sha,
        resource: { kind: "agentfs_cas", id: input.sha },
      });
      return result;
    }),

  casStats: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "cas:/",
      }))
    )
    .query(async () => {
      const { getCasStorageStats } = await import("../../services/agentfs-cas");
      return getCasStorageStats();
    }),

  casCleanup: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "cas:/",
      }))
    )
    .mutation(async ({ ctx }) => {
      try {
        const { cleanupOrphanedCas } =
          await import("../../services/agentfs-cas");
        const result = await cleanupOrphanedCas();
        await recordAgentfsOp({
          ctx,
          action: "cas_cleanup",
          success: true,
          resource: { kind: "agentfs_cas", id: "/" },
          extra: result,
        });
        return result;
      } catch (error) {
        await recordAgentfsOp({
          ctx,
          action: "cas_cleanup",
          success: false,
          resource: { kind: "agentfs_cas", id: "/" },
          extra: {
            error: error instanceof Error ? error.message : String(error ?? ""),
          },
        });
        throw error;
      }
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Access Audit Procedures
  // ─────────────────────────────────────────────────────────────────────────

  auditLog: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "audit:/",
      }))
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200).optional(),
        userId: z.string().min(1).max(200).optional(),
        action: z.string().min(1).max(100).optional(),
        resource: z.string().min(1).max(500).optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        successOnly: z.boolean().optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = getUserIdForAgentfsAccess({ session: ctx.session });
      const { queryAuditLog } = await import("../../services/agentfs-audit");
      return queryAuditLog({
        runId: input.runId,
        userId,
        action: input.action,
        resource: input.resource,
        from: input.from ? new Date(input.from) : undefined,
        to: input.to ? new Date(input.to) : undefined,
        successOnly: input.successOnly,
        limit: input.limit,
      });
    }),

  auditRecent: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "audit:/",
      }))
    )
    .input(z.object({ limit: z.number().int().min(1).max(1000).default(50) }))
    .query(async ({ input, ctx }) => {
      const { getRecentActivity } =
        await import("../../services/agentfs-audit");
      const userId = getUserIdForAgentfsAccess({ session: ctx.session });
      const entries = await getRecentActivity(userId, input.limit);
      return { entries };
    }),

  auditStats: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "audit:/",
      }))
    )
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { getAccessStats } = await import("../../services/agentfs-audit");
      const userId = getUserIdForAgentfsAccess({ session: ctx.session });
      return getAccessStats(userId, new Date(input.from), new Date(input.to));
    }),
};
