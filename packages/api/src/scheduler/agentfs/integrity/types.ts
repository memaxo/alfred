// Integrity Scheduler Types

export interface IntegritySchedulerOptions {
  intervalMs?: number;
  jitterMs?: number;
  minAgeMs?: number;
  maxChecks?: number;
  checkCas?: boolean;
  logger?: Pick<Console, "info" | "warn" | "error">;
  now?: () => Date;
}

export interface IntegrityTickOptions extends Required<IntegritySchedulerOptions> {}

export interface IntegrityResult {
  checked: number;
  quarantined: number;
}
