import type { deployments } from "../../schema/deploy";

export type DeploymentInsert = typeof deployments.$inferInsert;
export type DeploymentRecord = typeof deployments.$inferSelect;

export interface UpsertDeploymentInput {
  userId: string;
  projectId?: string | null;
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
}
