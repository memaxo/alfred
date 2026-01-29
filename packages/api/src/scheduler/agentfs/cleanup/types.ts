// Cleanup Scheduler Types

import type { AgentfsCleanupSchedulerOptions } from "../../agentfs";

export interface CleanupSchedulerOptions {
  intervalMs?: number;
  jitterMs?: number;
  retentionDays?: number;
  casRetentionDays?: number;
  casMaxDeletes?: number;
  maxDeletes?: number;
  maxBytes?: number | null;
  casMaxBytes?: number | null;
  dryRun?: boolean;
  logger?: Pick<Console, "info" | "warn" | "error">;
  now?: () => Date;
  deps?: {
    hasFailureContext?: (runId: string, dbPath: string) => Promise<boolean>;
  };
}

export interface CleanupTickOptions extends Required<
  Omit<CleanupSchedulerOptions, "deps" | "maxBytes" | "casMaxBytes">
> {
  deps?: CleanupSchedulerOptions["deps"];
  maxBytes: number | null;
  casMaxBytes: number | null;
}

export interface CleanupResult {
  runsDeleted: number;
  runsAutopinned: number;
  casDeleted: number;
  bytesDeleted: number;
  dryRun: boolean;
}

// Re-export for compatibility
export type { AgentfsCleanupSchedulerOptions };
