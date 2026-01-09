import { and, desc, eq, isNotNull, isNull, lte, or } from "drizzle-orm";
import { db } from "../../client";
import { deployments } from "../../schema/deploy";
import type { DeploymentRecord } from "./types";

export async function findLatestDeployment(
  userId: string,
  app: string,
  type: string
): Promise<DeploymentRecord | null> {
  const rows = await db
    .select()
    .from(deployments)
    .where(
      and(
        eq(deployments.userId, userId),
        eq(deployments.app, app),
        eq(deployments.type, type)
      )
    )
    .orderBy(desc(deployments.created))
    .limit(1);
  return rows[0] ?? null;
}

export async function getDeploymentById(
  deploymentId: string
): Promise<DeploymentRecord | null> {
  const rows = await db
    .select()
    .from(deployments)
    .where(eq(deployments.id, deploymentId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getDeploymentByApp(
  userId: string,
  app: string,
  type = "preview"
): Promise<DeploymentRecord | null> {
  return await findLatestDeployment(userId, app, type);
}

export async function listDeployments({
  userId,
  projectId,
  app,
  type,
  status,
}: {
  userId?: string;
  projectId?: string;
  app?: string;
  type?: string;
  status?: string;
} = {}): Promise<DeploymentRecord[]> {
  let where: any;
  const predicates: any[] = [];
  if (userId) {
    predicates.push(eq(deployments.userId, userId));
  }
  if (projectId) {
    predicates.push(eq(deployments.projectId, projectId));
  }
  if (app) {
    predicates.push(eq(deployments.app, app));
  }
  if (type) {
    predicates.push(eq(deployments.type, type));
  }
  if (status) {
    predicates.push(eq(deployments.status, status));
  }
  if (predicates.length > 0) {
    where = predicates.length === 1 ? predicates[0] : and(...predicates);
  }

  if (where) {
    return await db
      .select()
      .from(deployments)
      .where(where)
      .orderBy(desc(deployments.created));
  }
  return await db.select().from(deployments).orderBy(desc(deployments.created));
}

export async function getStaleDeployments(
  threshold: Date
): Promise<DeploymentRecord[]> {
  return await db
    .select()
    .from(deployments)
    .where(
      and(
        eq(deployments.status, "running"),
        or(
          isNull(deployments.lastHealthCheck),
          lte(deployments.lastHealthCheck, threshold)
        )
      )
    )
    .orderBy(desc(deployments.created));
}

export async function listActiveDeployments(): Promise<DeploymentRecord[]> {
  return await db
    .select()
    .from(deployments)
    .where(and(eq(deployments.status, "running"), isNotNull(deployments.url)))
    .orderBy(desc(deployments.created));
}
