// Compact Scheduler Types

export interface CompactSchedulerOptions {
  intervalMs?: number;
  jitterMs?: number;
  minAgeDays?: number;
  maxRuns?: number;
  vacuum?: boolean;
  logger?: Pick<Console, "info" | "warn" | "error">;
  now?: () => Date;
}

export interface CompactTickOptions extends Required<CompactSchedulerOptions> {}

export interface CompactResult {
  compacted: number;
}
