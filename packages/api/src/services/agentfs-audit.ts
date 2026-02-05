// AgentFS Access Audit Service (DB-backed)
//
// Uses the central policy audit log table (`db_logs`) for storage.

import type {
  AuditAction,
  AuditLogEntry,
  AuditLogResult,
} from "../agentfs/domain";

const ACTION_PREFIX = "agentfs.op.";
const ALLOWED_ACTIONS: ReadonlySet<string> = new Set([
  "file_read",
  "file_write",
  "run_clone",
  "checkpoint_restore",
  "cas_export",
  "cas_restore",
  "cas_delete",
  "cas_cleanup",
  "quarantine_restore",
  "run_delete",
  "pin_set",
  "pin_clear",
  "batch_delete",
  "batch_export",
  "batch_pin",
  "batch_unpin",
]);

function parseJsonField(value: unknown): unknown {
  if (!value || typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeActionFilter(action: string): string {
  return action.startsWith(ACTION_PREFIX)
    ? action
    : `${ACTION_PREFIX}${action}`;
}

function parseAction(action: string): AuditAction | null {
  if (action.startsWith(ACTION_PREFIX)) {
    const suffix = action.slice(ACTION_PREFIX.length);
    return ALLOWED_ACTIONS.has(suffix) ? (suffix as AuditAction) : null;
  }
  return ALLOWED_ACTIONS.has(action) ? (action as AuditAction) : null;
}

function parseResource(resource: string): { runId?: string; casSha?: string } {
  if (resource.startsWith("agentfs_run:")) {
    return { runId: resource.slice("agentfs_run:".length) };
  }
  if (resource.startsWith("agentfs_cas:")) {
    return { casSha: resource.slice("agentfs_cas:".length) };
  }
  if (resource.startsWith("agentfs_file:")) {
    const rest = resource.slice("agentfs_file:".length);
    const idx = rest.indexOf(":");
    if (idx > 0) {
      return { runId: rest.slice(0, idx) };
    }
  }
  if (resource.startsWith("agentfs_quarantine:")) {
    const rest = resource.slice("agentfs_quarantine:".length);
    if (rest.startsWith("run:")) {
      return { runId: rest.slice("run:".length) };
    }
    if (rest.startsWith("cas:")) {
      return { casSha: rest.slice("cas:".length) };
    }
  }
  return {};
}

export interface AuditQuery {
  runId?: string;
  userId?: string;
  action?: string;
  resource?: string;
  from?: Date;
  to?: Date;
  successOnly?: boolean;
  limit?: number;
}

export interface QueryAuditLogOptions {
  rootAbs?: string;
}

export async function queryAuditLog(
  query: AuditQuery = {},
  options: QueryAuditLogOptions = {}
): Promise<AuditLogResult> {
  void options;

  if (!process.env.DATABASE_URL) {
    return { entries: [], totalCount: 0, hasMore: false };
  }

  const policyRepo = await import("@alfred/db/repo/policy");
  const action = query.action ? normalizeActionFilter(query.action) : undefined;

  const resourceAll =
    query.runId && query.resource ? [query.runId, query.resource] : undefined;
  const resource =
    query.runId && !query.resource
      ? query.runId
      : (!query.runId && query.resource
        ? query.resource
        : undefined);

  const decision =
    query.successOnly === true
      ? "allow"
      : (query.successOnly === false
        ? "deny"
        : undefined);

  const { rows, totalCount } = await policyRepo.queryAuditLogs({
    userId: query.userId,
    actionPrefix: ACTION_PREFIX,
    action,
    resource,
    resourceAll,
    from: query.from,
    to: query.to,
    decision,
    limit: query.limit ?? 100,
    offset: 0,
  });

  const entries: AuditLogEntry[] = [];
  for (const row of rows) {
    const actionParsed = parseAction(row.action);
    if (!actionParsed) {
      continue;
    }

    const timestampRaw = row.timestamp;
    const timestamp =
      timestampRaw instanceof Date
        ? timestampRaw
        : (typeof timestampRaw === "string" || typeof timestampRaw === "number"
          ? new Date(timestampRaw)
          : new Date(0));
    const details = parseJsonField(row.context);
    const resourceIds = parseResource(row.resource);
    const detailsRec =
      details && typeof details === "object"
        ? (details as Record<string, unknown>)
        : null;
    const runId =
      resourceIds.runId ??
      (detailsRec && typeof detailsRec.runId === "string"
        ? detailsRec.runId
        : undefined);
    const casSha =
      resourceIds.casSha ??
      (detailsRec && typeof detailsRec.sha === "string"
        ? detailsRec.sha
        : undefined);
    const decisionAllow = row.decision === "allow";
    const success =
      typeof (details as { success?: unknown } | null)?.success === "boolean"
        ? (details as { success: boolean }).success
        : decisionAllow;

    const ipAddress =
      typeof (details as { ip?: unknown } | null)?.ip === "string"
        ? (details as { ip: string }).ip
        : undefined;
    const userAgent =
      typeof (details as { userAgent?: unknown } | null)?.userAgent === "string"
        ? (details as { userAgent: string }).userAgent
        : undefined;

    entries.push({
      id: row.id,
      timestamp,
      userId: row.userId,
      action: actionParsed,
      runId,
      casSha,
      details: details ?? {},
      ipAddress,
      userAgent,
      success,
    });
  }

  return { entries, totalCount, hasMore: totalCount > entries.length };
}

export interface GetRecentActivityOptions {
  rootAbs?: string;
}

export async function getRecentActivity(
  userId: string,
  limit: number = 50,
  options: GetRecentActivityOptions = {}
): Promise<readonly AuditLogEntry[]> {
  const result = await queryAuditLog({ userId, limit }, options);
  return result.entries;
}

export interface GetAccessStatsOptions {
  rootAbs?: string;
}

export async function getAccessStats(
  userId: string,
  from: Date,
  to: Date,
  options: GetAccessStatsOptions = {}
): Promise<{
  totalRequests: number;
  successRate: number;
  topActions: { action: string; count: number }[];
  topUsers: { userId: string; count: number }[];
}> {
  const result = await queryAuditLog(
    { userId, from, to, limit: 10_000 },
    options
  );
  const { entries } = result;

  const actionCounts = new Map<string, number>();
  const userCounts = new Map<string, number>();
  let successCount = 0;

  for (const entry of entries) {
    actionCounts.set(entry.action, (actionCounts.get(entry.action) || 0) + 1);
    userCounts.set(entry.userId, (userCounts.get(entry.userId) || 0) + 1);
    if (entry.success === true) {
      successCount++;
    }
  }

  const topActions = [...actionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([action, count]) => ({ action, count }));

  const topUsers = [...userCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId, count]) => ({ userId, count }));

  return {
    totalRequests: entries.length,
    successRate: entries.length > 0 ? successCount / entries.length : 0,
    topActions,
    topUsers,
  };
}
