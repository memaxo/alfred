import { eq, sql } from "drizzle-orm";
import { db } from "../../client";
import { deployments } from "../../schema/deploy";
import { findLatestDeployment, getDeploymentById } from "./read";
import type { DeploymentInsert, DeploymentRecord, UpsertDeploymentInput } from "./types";
import { sanitize } from "./utils";

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

export async function createDeployment(
  input: DeploymentInsert
): Promise<DeploymentRecord> {
  const [created] = await db.insert(deployments).values(input).returning();
  if (!created) {
    throw new Error("deployment_create_failed");
  }
  return created;
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

export async function deleteDeployment(
  deploymentId: string
): Promise<DeploymentRecord | null> {
  const rows = (await db
    .delete(deployments)
    .where(eq(deployments.id, deploymentId))
    .returning()) as DeploymentRecord[];
  return rows[0] ?? null;
}
