/**
 * ALFRED Deployments Repository
 * Durable deployment tracking operations.
 */

import { and, desc, eq, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../index";
import { deployments } from "../schema/deploy";

type DeploymentInsert = typeof deployments.$inferInsert;
type DeploymentRecord = typeof deployments.$inferSelect;

type UpsertDeploymentInput = {
  userId: string;
  app: string;
  type?: "preview" | "production" | string;
  status?: string;
  domain?: string | null;
  url?: string | null;
  branch?: string | null;
  commit?: string | null;
  containerName?: string | null;
  containerId?: string | null;
  lxcId?: string | null;
  port?: number | null;
  ports?: Array<{ host: number; container: number }> | null;
  healthUrl?: string | null;
  metadata?: unknown;
};

function sanitize<T extends Record<string, unknown>>(
  value: Partial<T>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      patch[key] = entry;
    }
  }
  return patch;
}

async function findLatestDeployment(userId: string, app: string, type: string) {
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

export async function upsertDeployment(
  input: UpsertDeploymentInput
): Promise<DeploymentRecord> {
  const type = input.type ?? "preview";
  const existing = await findLatestDeployment(input.userId, input.app, type);
  const payload: DeploymentInsert = {
    userId: input.userId,
    app: input.app,
    type,
    status: input.status ?? "pending",
    domain: input.domain ?? null,
    url: input.url ?? null,
    branch: input.branch ?? null,
    commit: input.commit ?? null,
    containerName: input.containerName ?? null,
    containerId: input.containerId ?? null,
    lxcId: input.lxcId ?? null,
    port: input.port ?? null,
    ports: input.ports ?? null,
    healthUrl: input.healthUrl ?? null,
    metadata: input.metadata ?? null,
  };

  if (existing) {
    const patch = sanitize<DeploymentInsert>({
      status: payload.status,
      domain: payload.domain,
      url: payload.url,
      branch: payload.branch,
      commit: payload.commit,
      containerName: payload.containerName,
      containerId: payload.containerId,
      lxcId: payload.lxcId,
      port: payload.port,
      ports: payload.ports,
      healthUrl: payload.healthUrl,
      metadata: payload.metadata,
    });
    patch.updated = sql`NOW()`;

    const rows = (await db
      .update(deployments)
      .set(patch)
      .where(eq(deployments.id, existing.id))
      .returning()) as DeploymentRecord[];
    const updated = (rows[0] ?? existing) as DeploymentRecord;
    return updated;
  }

  const [created] = await db.insert(deployments).values(payload).returning();
  if (!created) {
    throw new Error("deployment_upsert_failed");
  }
  return created;
}

export async function createDeployment(input: DeploymentInsert) {
  const [created] = await db.insert(deployments).values(input).returning();
  if (!created) {
    throw new Error("deployment_create_failed");
  }
  return created;
}

export async function getDeploymentById(deploymentId: string) {
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
) {
  return findLatestDeployment(userId, app, type);
}

export async function listDeployments({
  userId,
  app,
  type,
  status,
}: {
  userId?: string;
  app?: string;
  type?: string;
  status?: string;
} = {}) {
  let where;
  const predicates = [];
  if (userId) {
    predicates.push(eq(deployments.userId, userId));
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
    return db
      .select()
      .from(deployments)
      .where(where)
      .orderBy(desc(deployments.created));
  }
  return db.select().from(deployments).orderBy(desc(deployments.created));
}

export async function updateDeployment(
  deploymentId: string,
  updates: Partial<DeploymentInsert>
): Promise<DeploymentRecord | null> {
  const patch = sanitize<DeploymentInsert>(updates);
  if (Object.keys(patch).length === 0) {
    return getDeploymentById(deploymentId);
  }
  patch.updated = sql`NOW()`;
  const rows = (await db
    .update(deployments)
    .set(patch)
    .where(eq(deployments.id, deploymentId))
    .returning()) as DeploymentRecord[];
  return rows[0] ?? null;
}

export async function setDeploymentStatus(
  deploymentId: string,
  status: string,
  {
    domain,
    url,
    containerName,
    containerId,
    lxcId,
    port,
    ports,
    healthUrl,
    metadata,
  }: {
    domain?: string | null;
    url?: string | null;
    containerName?: string | null;
    containerId?: string | null;
    lxcId?: string | null;
    port?: number | null;
    ports?: Array<{ host: number; container: number }> | null;
    healthUrl?: string | null;
    metadata?: unknown;
  } = {}
) {
  const patch = sanitize<DeploymentInsert>({
    status,
    domain: domain ?? undefined,
    url: url ?? undefined,
    containerName: containerName ?? undefined,
    containerId: containerId ?? undefined,
    lxcId: lxcId ?? undefined,
    port: port ?? undefined,
    ports: ports ?? undefined,
    healthUrl: healthUrl ?? undefined,
    metadata,
  });
  patch.updated = sql`NOW()`;
  if (status === "running" || status === "active") {
    patch.deployed = sql`NOW()`;
  }
  if (status === "stopped" || status === "removed") {
    patch.stopped = sql`NOW()`;
  }
  const rows = (await db
    .update(deployments)
    .set(patch)
    .where(eq(deployments.id, deploymentId))
    .returning()) as DeploymentRecord[];
  return rows[0] ?? null;
}

export async function recordHealthCheck(
  deploymentId: string,
  healthStatus: string,
  { healthUrl }: { healthUrl?: string | null } = {}
) {
  const patch = sanitize<DeploymentInsert>({
    healthStatus,
    healthUrl,
  });
  patch.lastHealthCheck = sql`NOW()`;
  patch.updated = sql`NOW()`;

  const rows = await db
    .update(deployments)
    .set(patch)
    .where(eq(deployments.id, deploymentId))
    .returning();
  return rows[0] ?? null;
}

export async function deleteDeployment(deploymentId: string) {
  const rows = (await db
    .delete(deployments)
    .where(eq(deployments.id, deploymentId))
    .returning()) as DeploymentRecord[];
  return rows[0] ?? null;
}

export async function getStaleDeployments(threshold: Date) {
  return db
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

export async function listActiveDeployments() {
  return db
    .select()
    .from(deployments)
    .where(and(eq(deployments.status, "running"), isNotNull(deployments.url)))
    .orderBy(desc(deployments.created));
}
