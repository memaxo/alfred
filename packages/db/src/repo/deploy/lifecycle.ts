import { eq, sql } from "drizzle-orm";

import type { DeploymentInsert, DeploymentRecord } from "./types";

import { db } from "../../client";
import { deployments } from "../../schema/deploy";
import { sanitize } from "./utils";

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
): Promise<DeploymentRecord | null> {
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
): Promise<DeploymentRecord | null> {
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
  return (rows[0] as DeploymentRecord) ?? null;
}
