import { requireRecentBiometric } from "@alfred/auth/biometric";
import { db } from "@alfred/db";
import {
  approveApproval,
  denyApproval,
  getAuditLogs,
  getPendingApprovals,
} from "@alfred/db/repo/policy";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { session as sessionTable } from "@alfred/db/schema/auth";
import { metricsRegistry } from "@alfred/metrics/registry";
import { TRPCError } from "@trpc/server";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { collectPerformanceTelemetry } from "../performance/telemetry";
import { protectedProcedure, router } from "../trpc";
import { getVoicePools } from "../voice/pools";
import { collectVoiceTelemetry } from "../voice/telemetry";

type SessionRecord = {
  id?: string;
  token?: string;
};

async function ensureRecentBiometric(session: unknown): Promise<void> {
  const sessionRecord = (
    session as { session?: SessionRecord } | null | undefined
  )?.session;
  const sessionId = sessionRecord?.id ?? sessionRecord?.token;
  if (!sessionId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  try {
    await requireRecentBiometric(sessionId);
  } catch (error) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: error instanceof Error ? error.message : "biometric_required",
    });
  }
}

// In-memory alert storage (would be persisted in production after migration)
type MetricAlert = {
  id: string;
  name: string;
  query: string;
  condition: string;
  severity: "info" | "warning" | "critical";
  enabled: boolean;
  createdAt: Date;
};
const alertsStore = new Map<string, MetricAlert>();

// Default constraint definitions
const DEFAULT_CONSTRAINTS = [
  {
    id: "constraint-filesystem-write",
    scope: "filesystem",
    rule: "Require approval for write operations outside workspace",
    level: "strict" as const,
    enabled: true,
  },
  {
    id: "constraint-network-external",
    scope: "network",
    rule: "Log all external network requests",
    level: "monitor" as const,
    enabled: true,
  },
  {
    id: "constraint-system-exec",
    scope: "system",
    rule: "Require biometric for system command execution",
    level: "strict" as const,
    enabled: true,
  },
  {
    id: "constraint-sensitive-data",
    scope: "sensitive",
    rule: "Mask PII in all logs and outputs",
    level: "strict" as const,
    enabled: true,
  },
];

export const adminRouter = router({
  getVoiceStats: protectedProcedure.query(async ({ ctx }) => {
    await ensureRecentBiometric(ctx.session);
    const telemetry = await collectVoiceTelemetry();
    try {
      const { voiceRegistry } = getVoicePools();
      return { ...voiceRegistry.getStats(), telemetry };
    } catch (_error) {
      // If pools are not initialized (e.g. VOICE_PROVIDER set to cloud/default), return empty stats
      return {
        generatedAt: Date.now(),
        activeSessions: 0,
        sttPool: null,
        ttsPool: null,
        message: "Voice pools not active (likely using cloud provider)",
        telemetry,
      };
    }
  }),

  getPerformanceStats: protectedProcedure.query(async ({ ctx }) => {
    await ensureRecentBiometric(ctx.session);
    return collectPerformanceTelemetry();
  }),

  restartVoicePool: protectedProcedure
    .input(z.object({ pool: z.enum(["stt", "tts"]) }))
    .mutation(async ({ ctx, input }) => {
      await ensureRecentBiometric(ctx.session);
      const { sttPool, ttsPool } = getVoicePools();

      if (input.pool === "stt") {
        await sttPool.shutdown();
        await sttPool.initialize();
        return { success: true, pool: "stt" };
      }

      if (input.pool === "tts") {
        await ttsPool.shutdown();
        await ttsPool.initialize();
        return { success: true, pool: "tts" };
      }
    }),

  clearVoiceSessions: protectedProcedure.mutation(async ({ ctx }) => {
    await ensureRecentBiometric(ctx.session);
    const { voiceRegistry } = getVoicePools();
    const cleared = voiceRegistry.clearSessions();
    return { cleared };
  }),

  // Policy procedures
  policyList: protectedProcedure
    .input(
      z.object({
        action: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional().default(100),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await ensureRecentBiometric(ctx.session);
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const logs = await getAuditLogs(
        userId,
        input.action,
        input.limit,
        input.offset
      );

      return {
        decisions: logs.map((log) => ({
          id: log.id,
          action: log.action,
          resource: log.resource,
          decision: log.decision,
          obligations: log.obligations,
          context: log.context,
          timestamp: log.timestamp?.toISOString(),
          traceId: log.traceId,
        })),
        total: logs.length,
      };
    }),

  policyConstraints: protectedProcedure.query(async ({ ctx }) => {
    await ensureRecentBiometric(ctx.session);
    return { constraints: DEFAULT_CONSTRAINTS };
  }),

  // Approvals procedures
  approvalsList: protectedProcedure.query(async ({ ctx }) => {
    await ensureRecentBiometric(ctx.session);
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const pending = await getPendingApprovals(userId);
    return {
      requests: pending.map((approval) => ({
        id: approval.id,
        action: approval.action,
        resource: approval.resource,
        context: approval.context,
        status: approval.status,
        created: approval.created?.toISOString(),
        expiresAt: approval.expiresAt?.toISOString(),
        metadata: approval.metadata,
      })),
    };
  }),

  approvalsResolve: protectedProcedure
    .input(
      z.object({
        approvalId: z.string().uuid(),
        decision: z.enum(["approve", "deny"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureRecentBiometric(ctx.session);
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const result =
        input.decision === "approve"
          ? await approveApproval(input.approvalId, userId)
          : await denyApproval(input.approvalId, userId);

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "approval_not_found",
        });
      }

      return {
        id: result.id,
        status: result.status,
        resolvedBy: result.approvedBy,
        resolvedAt: result.approvedAt?.toISOString(),
      };
    }),

  // Sessions procedures
  sessionsList: protectedProcedure.query(async ({ ctx }) => {
    await ensureRecentBiometric(ctx.session);
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const sessions = await db
      .select()
      .from(sessionTable)
      .where(
        and(
          eq(sessionTable.userId, userId),
          gt(sessionTable.expiresAt, new Date())
        )
      );

    const currentSessionId =
      (ctx.session as { session?: { id?: string } })?.session?.id ?? null;

    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        isCurrent: s.id === currentSessionId,
      })),
    };
  }),

  sessionsRevoke: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureRecentBiometric(ctx.session);
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      // Ensure user can only revoke their own sessions
      const [targetSession] = await db
        .select()
        .from(sessionTable)
        .where(
          and(
            eq(sessionTable.id, input.sessionId),
            eq(sessionTable.userId, userId)
          )
        )
        .limit(1);

      if (!targetSession) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "session_not_found",
        });
      }

      // Delete the session
      await db.delete(sessionTable).where(eq(sessionTable.id, input.sessionId));

      return { revoked: true, sessionId: input.sessionId };
    }),

  // Metrics procedures
  metricsList: protectedProcedure.query(async ({ ctx }) => {
    await ensureRecentBiometric(ctx.session);

    const metricsJson = await metricsRegistry.getMetricsAsJSON();

    return {
      metrics: metricsJson.map((m) => ({
        name: m.name,
        help: m.help,
        type: m.type,
        values: m.values,
      })),
    };
  }),

  metricsQuery: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(1000),
      })
    )
    .query(async ({ ctx, input }) => {
      await ensureRecentBiometric(ctx.session);

      // Simple metric name matching (not full PromQL, but useful for basic queries)
      const metricsJson = await metricsRegistry.getMetricsAsJSON();
      const queryLower = input.query.toLowerCase();

      const matched = metricsJson.filter(
        (m) =>
          m.name.toLowerCase().includes(queryLower) ||
          m.help.toLowerCase().includes(queryLower)
      );

      return {
        query: input.query,
        results: matched.map((m) => ({
          name: m.name,
          help: m.help,
          type: m.type,
          values: m.values,
        })),
        matchedCount: matched.length,
      };
    }),

  // Alerts procedures
  alertsList: protectedProcedure.query(async ({ ctx }) => {
    await ensureRecentBiometric(ctx.session);

    const alerts = [...alertsStore.values()];
    return {
      alerts: alerts.map((a) => ({
        id: a.id,
        name: a.name,
        query: a.query,
        condition: a.condition,
        severity: a.severity,
        enabled: a.enabled,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }),

  alertsCreate: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        query: z.string().min(1).max(500),
        condition: z.string().min(1).max(200),
        severity: z.enum(["info", "warning", "critical"]).default("warning"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureRecentBiometric(ctx.session);

      const alert: MetricAlert = {
        id: crypto.randomUUID(),
        name: input.name,
        query: input.query,
        condition: input.condition,
        severity: input.severity,
        enabled: true,
        createdAt: new Date(),
      };

      alertsStore.set(alert.id, alert);

      return {
        id: alert.id,
        created: true,
      };
    }),

  alertsToggle: protectedProcedure
    .input(
      z.object({
        alertId: z.string().uuid(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureRecentBiometric(ctx.session);

      const alert = alertsStore.get(input.alertId);
      if (!alert) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "alert_not_found",
        });
      }

      alert.enabled = input.enabled;
      alertsStore.set(input.alertId, alert);

      return {
        id: alert.id,
        enabled: alert.enabled,
      };
    }),

  alertsDelete: protectedProcedure
    .input(z.object({ alertId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ensureRecentBiometric(ctx.session);

      if (!alertsStore.has(input.alertId)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "alert_not_found",
        });
      }

      alertsStore.delete(input.alertId);

      return { deleted: true, alertId: input.alertId };
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Task Manager Procedures
  // ─────────────────────────────────────────────────────────────────────────

  processesList: protectedProcedure.query(async ({ ctx }) => {
    await ensureRecentBiometric(ctx.session);

    try {
      // Get Docker containers as processes
      const proc = Bun.spawn(
        ["docker", "stats", "--no-stream", "--format", "{{json .}}"],
        { stdout: "pipe", stderr: "pipe" }
      );

      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      // Parse docker stats output
      const containerProcesses = stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            const stats = JSON.parse(line) as {
              ID?: string;
              Name?: string;
              CPUPerc?: string;
              MemUsage?: string;
            };
            return {
              id: stats.ID ?? "",
              name: stats.Name ?? "unknown",
              type: stats.Name?.includes("agent") ? "agent" : "service",
              status: "running" as const,
              cpu: Number.parseFloat(stats.CPUPerc?.replace("%", "") ?? "0"),
              memory: parseMemoryMB(stats.MemUsage ?? "0"),
              uptime: 0, // Docker doesn't give uptime in stats
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as Array<{
        id: string;
        name: string;
        type: string;
        status: "running" | "idle" | "stopped";
        cpu: number;
        memory: number;
        uptime: number;
      }>;

      // Add current Node process info
      const nodeProcess = {
        id: `node-${process.pid}`,
        name: "api-server",
        type: "service" as const,
        status: "running" as const,
        cpu: 0, // Would need sampling over time
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        uptime: Math.floor(process.uptime()),
      };

      return {
        processes: [nodeProcess, ...containerProcesses],
      };
    } catch {
      // Fallback if Docker is not available
      return {
        processes: [
          {
            id: `node-${process.pid}`,
            name: "api-server",
            type: "service" as const,
            status: "running" as const,
            cpu: 0,
            memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            uptime: Math.floor(process.uptime()),
          },
        ],
      };
    }
  }),

  taskHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      await ensureRecentBiometric(ctx.session);
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      try {
        // Get recent workflow runs for this user
        const runs = await workflowRepo.listRuns({
          userId,
          limit: input.limit,
        });

        const history = runs.map((run) => {
          const startTime = run.created ?? new Date();
          const endTime = run.completedAt ?? new Date();
          const durationMs = endTime.getTime() - startTime.getTime();

          return {
            id: run.id,
            type: "agent" as const,
            name: run.requirement ?? `Run ${run.id.slice(0, 8)}`,
            status: mapRunStatus(run.status),
            startTime: startTime.toISOString(),
            duration: Math.round(durationMs / 1000),
            tokenUsage: undefined,
          };
        });

        return { history };
      } catch {
        return { history: [] };
      }
    }),

  networkConnections: protectedProcedure.query(async ({ ctx }) => {
    await ensureRecentBiometric(ctx.session);

    try {
      // Use lsof to get network connections (macOS/Linux)
      const proc = Bun.spawn(["lsof", "-i", "-P", "-n", "-F", "pcn"], {
        stdout: "pipe",
        stderr: "pipe",
      });

      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      // Parse lsof output (simplified)
      const lines = stdout.split("\n");
      const connections: Array<{
        id: string;
        localAddress: string;
        remoteAddress: string;
        protocol: "tcp" | "udp";
        state: "established" | "listening" | "time_wait";
        process: string;
      }> = [];

      let currentProcess = "";
      let currentId = 0;

      for (const line of lines) {
        if (line.startsWith("c")) {
          currentProcess = line.slice(1);
        } else if (line.startsWith("n")) {
          const addr = line.slice(1);
          if (addr.includes(":")) {
            currentId++;
            const isListening =
              addr.includes("*:") || addr.includes("0.0.0.0:");
            connections.push({
              id: String(currentId),
              localAddress: addr.split("->")[0] ?? addr,
              remoteAddress: addr.split("->")[1] ?? "0.0.0.0:*",
              protocol: "tcp",
              state: isListening ? "listening" : "established",
              process: currentProcess,
            });
          }
        }
      }

      return { connections: connections.slice(0, 50) };
    } catch {
      // Fallback with static data
      return {
        connections: [
          {
            id: "1",
            localAddress: "127.0.0.1:3000",
            remoteAddress: "0.0.0.0:*",
            protocol: "tcp" as const,
            state: "listening" as const,
            process: "api-server",
          },
        ],
      };
    }
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

function parseMemoryMB(memStr: string): number {
  // Parse strings like "128MiB / 1GiB" or "128MB"
  const match = /(\d+(?:\.\d+)?)\s*(MiB|MB|GiB|GB|KiB|KB)/i.exec(memStr);
  if (!(match?.[1] && match[2])) {
    return 0;
  }

  const value = Number.parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  if (unit.includes("g")) {
    return Math.round(value * 1024);
  }
  if (unit.includes("k")) {
    return Math.round(value / 1024);
  }
  return Math.round(value);
}

function mapRunStatus(
  status: string | null | undefined
): "success" | "failure" | "cancelled" {
  if (!status) {
    return "success";
  }
  if (status === "completed" || status === "done") {
    return "success";
  }
  if (status === "failed" || status === "error") {
    return "failure";
  }
  if (status === "cancelled" || status === "aborted") {
    return "cancelled";
  }
  return "success"; // Default for completed runs
}
