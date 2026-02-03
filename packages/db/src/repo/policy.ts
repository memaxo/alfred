/**
 * ALFRED Policy Repository
 * Audit logs and approval queue operations
 */

import {
  and,
  asc,
  desc,
  eq,
  gte,
  like,
  lt,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "../client";
import { approvals, auditLogs } from "../schema/policy";

type AuditLogInsert = typeof auditLogs.$inferInsert;
type ApprovalInsert = typeof approvals.$inferInsert;

interface AuditLogParams {
  userId: string;
  projectId?: string;
  action: string;
  resource: { kind: string; id?: string };
  decision: "allow" | "deny";
  traceId?: string | null;
  obligations?: unknown[];
  context?: unknown;
}

// Audit log operations
export async function createAuditLog({
  userId,
  projectId,
  action,
  resource,
  decision,
  traceId,
  obligations,
  context,
}: AuditLogParams): Promise<typeof auditLogs.$inferSelect | undefined> {
  const record: AuditLogInsert = {
    userId,
    projectId,
    action,
    resource: resource.id ? `${resource.kind}:${resource.id}` : resource.kind,
    decision,
    traceId: traceId ?? null,
    obligations: obligations ?? null,
    context: context ?? null,
  };

  const [row] = await db.insert(auditLogs).values(record).returning();
  return row;
}

export async function getAuditLogs(
  userId: string,
  action?: string,
  limit = 100,
  offset = 0,
  projectId?: string
): Promise<(typeof auditLogs.$inferSelect)[]> {
  const conditions = [eq(auditLogs.userId, userId)];
  if (action) {
    conditions.push(eq(auditLogs.action, action));
  }
  if (projectId) {
    conditions.push(eq(auditLogs.projectId, projectId));
  }

  return await db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.timestamp))
    .limit(limit)
    .offset(offset);
}

export interface AuditLogQuery {
  readonly userId?: string;
  readonly projectId?: string;
  readonly action?: string;
  readonly actionPrefix?: string;
  readonly resource?: string;
  readonly resourceAll?: readonly string[];
  readonly from?: Date;
  readonly to?: Date;
  readonly decision?: "allow" | "deny";
  readonly limit?: number;
  readonly offset?: number;
}

export async function queryAuditLogs(
  query: AuditLogQuery
): Promise<{ rows: (typeof auditLogs.$inferSelect)[]; totalCount: number }> {
  const conditions: SQL[] = [];
  if (query.userId) {
    conditions.push(eq(auditLogs.userId, query.userId));
  }
  if (query.projectId) {
    conditions.push(eq(auditLogs.projectId, query.projectId));
  }
  if (query.actionPrefix) {
    conditions.push(like(auditLogs.action, `${query.actionPrefix}%`));
  }
  if (query.action) {
    conditions.push(eq(auditLogs.action, query.action));
  }
  if (query.resource) {
    conditions.push(like(auditLogs.resource, `%${query.resource}%`));
  }
  if (query.resourceAll && query.resourceAll.length > 0) {
    for (const part of query.resourceAll) {
      if (part.length === 0) {
        continue;
      }
      conditions.push(like(auditLogs.resource, `%${part}%`));
    }
  }
  if (query.from) {
    conditions.push(gte(auditLogs.timestamp, query.from));
  }
  if (query.to) {
    conditions.push(lte(auditLogs.timestamp, query.to));
  }
  if (query.decision) {
    conditions.push(eq(auditLogs.decision, query.decision));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const limit = Math.max(1, query.limit ?? 100);
  const offset = Math.max(0, query.offset ?? 0);

  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(where);
  const totalCount = countRows[0]?.count ?? 0;

  const rows = await db
    .select()
    .from(auditLogs)
    .where(where)
    .orderBy(desc(auditLogs.timestamp))
    .limit(limit)
    .offset(offset);

  return { rows, totalCount: Number(totalCount) };
}

export async function getAuditLogsByTrace(
  traceId: string
): Promise<(typeof auditLogs.$inferSelect)[]> {
  return await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.traceId, traceId))
    .orderBy(asc(auditLogs.timestamp));
}

// Approval operations
export async function createApproval(params: {
  userId: string;
  projectId?: string;
  action: string;
  resource: string;
  traceId?: string;
  context?: unknown;
  expiresAt?: Date;
  metadata?: unknown;
}): Promise<typeof approvals.$inferSelect | undefined> {
  const record: ApprovalInsert = {
    userId: params.userId,
    projectId: params.projectId ?? null,
    action: params.action,
    resource: params.resource,
    traceId: params.traceId ?? null,
    context: params.context ?? null,
    expiresAt: params.expiresAt ?? null,
    metadata: params.metadata ?? null,
  };

  const [row] = await db.insert(approvals).values(record).returning();
  return row;
}

export async function getApproval(
  approvalId: string
): Promise<typeof approvals.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, approvalId))
    .limit(1);
  return row ?? null;
}

export async function getPendingApprovals(
  userId: string,
  projectId?: string
): Promise<(typeof approvals.$inferSelect)[]> {
  const conditions = [
    eq(approvals.userId, userId),
    eq(approvals.status, "pending"),
  ];
  if (projectId) {
    conditions.push(eq(approvals.projectId, projectId));
  }

  return await db
    .select()
    .from(approvals)
    .where(and(...conditions))
    .orderBy(asc(approvals.created));
}

export async function approveApproval(
  approvalId: string,
  approvedBy: string
): Promise<typeof approvals.$inferSelect | null> {
  const [row] = await db
    .update(approvals)
    .set({ status: "approved", approvedBy, approvedAt: new Date() })
    .where(eq(approvals.id, approvalId))
    .returning();
  return row ?? null;
}

export async function denyApproval(
  approvalId: string,
  approvedBy: string
): Promise<typeof approvals.$inferSelect | null> {
  const [row] = await db
    .update(approvals)
    .set({ status: "denied", approvedBy, approvedAt: new Date() })
    .where(eq(approvals.id, approvalId))
    .returning();
  return row ?? null;
}

export async function expireApprovals(): Promise<
  (typeof approvals.$inferSelect)[]
> {
  return await db
    .update(approvals)
    .set({ status: "denied", approvedBy: "system", approvedAt: new Date() })
    .where(
      and(eq(approvals.status, "pending"), lt(approvals.expiresAt, new Date()))
    )
    .returning();
}
