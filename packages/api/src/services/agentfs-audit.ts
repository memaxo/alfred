// AgentFS Access Audit Service
// Audit log querying and compliance

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import type { AuditLogEntry, AuditLogResult } from "../agentfs/domain";

const AUDIT_LOG_FILENAME = "audit.log";

interface AuditLogLine {
  timestamp: string;
  level: string;
  runId?: string;
  userId?: string;
  action: string;
  resource: string;
  success: boolean;
  details?: Record<string, unknown>;
}

function getAgentfsDir(rootAbs?: string): string {
  return rootAbs
    ? path.join(rootAbs, ".agentfs")
    : path.join(process.cwd(), ".agentfs");
}

async function readAuditLogFile(filePath: string): Promise<AuditLogLine[]> {
  try {
    const content = await Bun.file(filePath).text();
    const lines = content.trim().split("\n");
    const entries: AuditLogLine[] = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        entries.push(parsed);
      } catch {
        // Skip malformed lines
      }
    }

    return entries;
  } catch {
    return [];
  }
}

function generateStableId(entry: AuditLogLine): string {
  // Create deterministic ID from entry data instead of Math.random()
  const hash = createHash("sha256");
  hash.update(entry.timestamp);
  hash.update(entry.action);
  hash.update(entry.resource);
  hash.update(entry.runId || "");
  return hash.digest("hex").slice(0, 16);
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

function matchesQuery(entry: AuditLogLine, query: AuditQuery): boolean {
  if (query.runId && entry.runId !== query.runId) {
    return false;
  }
  if (query.userId && entry.userId !== query.userId) {
    return false;
  }
  if (query.action && entry.action !== query.action) {
    return false;
  }
  if (query.resource && !entry.resource.includes(query.resource)) {
    return false;
  }
  if (query.from) {
    const entryTime = new Date(entry.timestamp).getTime();
    if (entryTime < query.from.getTime()) {
      return false;
    }
  }
  if (query.to) {
    const entryTime = new Date(entry.timestamp).getTime();
    if (entryTime > query.to.getTime()) {
      return false;
    }
  }
  if (query.successOnly !== undefined && entry.success !== query.successOnly) {
    return false;
  }

  return true;
}

export interface QueryAuditLogOptions {
  rootAbs?: string;
}

export async function queryAuditLog(
  query: AuditQuery = {},
  options: QueryAuditLogOptions = {}
): Promise<AuditLogResult> {
  const agentfsDir = getAgentfsDir(options.rootAbs);
  const entries: AuditLogEntry[] = [];

  // Read global audit log if it exists
  const globalLogPath = path.join(agentfsDir, AUDIT_LOG_FILENAME);
  if (existsSync(globalLogPath)) {
    const lines = await readAuditLogFile(globalLogPath);
    for (const line of lines) {
      if (matchesQuery(line, query)) {
        entries.push({
          id: generateStableId(line),
          timestamp: new Date(line.timestamp),
          userId: line.userId || "system",
          action: line.action as AuditLogEntry["action"],
          runId: line.runId,
          casSha: undefined,
          details: line.details || {},
          ipAddress: line.details?.ip as string | undefined,
          userAgent: line.details?.userAgent as string | undefined,
          success: line.success,
        });
      }
    }
  }

  // Read per-run audit logs if runId filter is set or we're doing a full scan
  if (query.runId || !query.action) {
    try {
      const runDirs = await readdir(agentfsDir, { withFileTypes: true });
      for (const dir of runDirs) {
        if (!dir.isDirectory()) {
          continue;
        }
        if (dir.name === "cas" || dir.name === "quarantine") {
          continue;
        }

        // If querying specific runId, only check that run
        if (query.runId && dir.name !== query.runId) {
          continue;
        }

        const runLogPath = path.join(agentfsDir, dir.name, AUDIT_LOG_FILENAME);
        if (existsSync(runLogPath)) {
          const lines = await readAuditLogFile(runLogPath);
          for (const line of lines) {
            if (matchesQuery(line, query)) {
              entries.push({
                id: generateStableId(line),
                timestamp: new Date(line.timestamp),
                userId: line.userId || "system",
                action: line.action as AuditLogEntry["action"],
                runId: line.runId || dir.name,
                casSha: undefined,
                details: line.details || {},
                ipAddress: line.details?.ip as string | undefined,
                userAgent: line.details?.userAgent as string | undefined,
                success: line.success,
              });
            }
          }
        }
      }
    } catch {
      // Directory doesn't exist or not readable
    }
  }

  // Sort by timestamp (newest first)
  entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Apply limit
  const limit = query.limit ?? 100;
  const limited = entries.slice(0, limit);

  return {
    entries: limited,
    totalCount: entries.length,
    hasMore: entries.length > limit,
  };
}

export interface GetRecentActivityOptions {
  rootAbs?: string;
}

export async function getRecentActivity(
  limit: number = 50,
  options: GetRecentActivityOptions = {}
): Promise<readonly AuditLogEntry[]> {
  const result = await queryAuditLog({ limit }, options);
  return result.entries;
}

export interface GetAccessStatsOptions {
  rootAbs?: string;
}

export async function getAccessStats(
  from: Date,
  to: Date,
  options: GetAccessStatsOptions = {}
): Promise<{
  totalRequests: number;
  successRate: number;
  topActions: { action: string; count: number }[];
  topUsers: { userId: string; count: number }[];
}> {
  const result = await queryAuditLog({ from, to, limit: 10_000 }, options);
  const { entries } = result;

  const actionCounts = new Map<string, number>();
  const userCounts = new Map<string, number>();
  let successCount = 0;

  for (const entry of entries) {
    actionCounts.set(entry.action, (actionCounts.get(entry.action) || 0) + 1);
    userCounts.set(entry.userId, (userCounts.get(entry.userId) || 0) + 1);
    // Fix: Use entry.success instead of entry.action for success count
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
