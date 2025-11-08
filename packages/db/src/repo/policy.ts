/**
 * ALFRED Policy Repository
 * Audit logs and approval queue operations
 */

import { and, asc, desc, eq, lt } from "drizzle-orm";
import { db } from "../index";
import { approvals, auditLogs } from "../schema/policy";

type AuditLogInsert = typeof auditLogs.$inferInsert;
type ApprovalInsert = typeof approvals.$inferInsert;

interface AuditLogParams {
  userId: string;
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
  action,
  resource,
  decision,
  traceId,
  obligations,
  context,
}: AuditLogParams) {
  const record: AuditLogInsert = {
    userId,
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
  offset = 0
) {
  const where = action
    ? and(eq(auditLogs.userId, userId), eq(auditLogs.action, action))
    : eq(auditLogs.userId, userId);
  return db
    .select()
    .from(auditLogs)
    .where(where)
    .orderBy(desc(auditLogs.timestamp))
    .limit(limit)
    .offset(offset);
}

export async function getAuditLogsByTrace(traceId: string) {
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.traceId, traceId))
    .orderBy(asc(auditLogs.timestamp));
}

// Approval operations
export async function createApproval(params: {
  userId: string;
  action: string;
  resource: string;
  traceId?: string;
  context?: unknown;
  expiresAt?: Date;
  metadata?: unknown;
}) {
  const record: ApprovalInsert = {
    userId: params.userId,
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

export async function getApproval(approvalId: string) {
  const [row] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, approvalId))
    .limit(1);
  return row ?? null;
}

export async function getPendingApprovals(userId: string) {
  return db
    .select()
    .from(approvals)
    .where(and(eq(approvals.userId, userId), eq(approvals.status, "pending")))
    .orderBy(asc(approvals.created));
}

export async function approveApproval(approvalId: string, approvedBy: string) {
  const [row] = await db
    .update(approvals)
    .set({ status: "approved", approvedBy, approvedAt: new Date() })
    .where(eq(approvals.id, approvalId))
    .returning();
  return row ?? null;
}

export async function denyApproval(approvalId: string, approvedBy: string) {
  const [row] = await db
    .update(approvals)
    .set({ status: "denied", approvedBy, approvedAt: new Date() })
    .where(eq(approvals.id, approvalId))
    .returning();
  return row ?? null;
}

export async function expireApprovals() {
  return db
    .update(approvals)
    .set({ status: "denied", approvedBy: "system", approvedAt: new Date() })
    .where(
      and(eq(approvals.status, "pending"), lt(approvals.expiresAt, new Date()))
    )
    .returning();
}
