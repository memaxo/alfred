// AgentFS Domain Types
// Pure value objects and type definitions - no side effects

/**
 * Age basis for retention decisions.
 * Priority: lastAccessedAt > createdAt > mtime
 */
export type AgeBasis = "createdAt" | "lastAccessedAt" | "mtime";

/**
 * A candidate CAS entry for cleanup evaluation.
 */
export interface CasEntry {
  /** SHA-256 hash (content address) */
  readonly sha: string;
  /** Absolute path to .tar.gz archive */
  readonly abs: string;
  /** Absolute path to .json metadata */
  readonly metaAbs: string;
  /** Filesystem mtime in milliseconds */
  readonly mtimeMs: number;
  /** Basis timestamp for age calculation (ms since epoch) */
  readonly basisMs: number;
  /** Size in bytes */
  readonly sizeBytes: number;
  /** Which timestamp was used as basis */
  readonly basis: AgeBasis;
}

/**
 * A candidate run directory for cleanup evaluation.
 */
export interface RunEntry {
  /** Absolute path to run directory */
  readonly dir: string;
  /** Run ID (directory basename) */
  readonly runId: string;
  /** Database file mtime in milliseconds */
  readonly mtimeMs: number;
  /** Total size of run directory in bytes */
  readonly sizeBytes: number;
}

/**
 * Retention policy configuration.
 * Serializable, env-agnostic inputs for policy decisions.
 */
export interface RetentionPolicy {
  /** Retention window in days */
  readonly retentionDays: number;
  /** Maximum bytes allowed (null = unlimited) */
  readonly maxBytes: number | null;
  /** Maximum deletions per tick */
  readonly maxDeletes: number;
}

/**
 * CAS-specific retention policy.
 */
export interface CasRetentionPolicy extends RetentionPolicy {
  /** CAS-specific max bytes (null = unlimited) */
  readonly casMaxBytes: number | null;
}

/**
 * Decision outcome for a retention evaluation.
 */
export interface RetentionDecision {
  /** Action to take */
  readonly action: "delete" | "keep" | "autopin";
  /** Human-readable reason */
  readonly reason: string;
  /** Detailed context for logging */
  readonly details: RetentionDetails;
}

/**
 * Details for age-based deletion.
 */
export interface AgeDetails {
  readonly type: "age";
  readonly basis: AgeBasis;
  readonly basisMs: number;
  readonly cutoffMs: number;
  readonly ageDays: number;
}

/**
 * Details for size-cap-based deletion.
 */
export interface SizeCapDetails {
  readonly type: "size_cap";
  readonly maxBytes: number;
  readonly currentBytes: number;
  readonly remainingBytes: number;
}

/**
 * Details for orphaned file cleanup.
 */
export interface OrphanedDetails {
  readonly type: "orphaned";
  readonly orphanType: "metadata" | "keep" | "quarantine_json";
}

/**
 * Details for keep decision.
 */
export interface KeepDetails {
  readonly type: "keep";
  readonly reason: "pinned" | "recent" | "under_cap" | "quarantined";
}

/**
 * Details for autopin decision.
 */
export interface AutopinDetails {
  readonly type: "autopin";
  readonly reason: "failure_context";
}

export type RetentionDetails =
  | AgeDetails
  | SizeCapDetails
  | OrphanedDetails
  | KeepDetails
  | AutopinDetails;

/**
 * Cleanup execution context for a single tick.
 */
export interface CleanupContext {
  readonly now: Date;
  readonly nowMs: number;
  readonly cutoffMs: number;
}

/**
 * CAS cleanup execution context.
 */
export interface CasCleanupContext extends CleanupContext {
  readonly cutoffMs: number;
  readonly casMaxBytes: number | null;
}

/**
 * Result of a cleanup tick.
 */
export interface CleanupResult {
  readonly deleted: number;
  readonly bytesDeleted: number;
  readonly bytesRemaining: number;
  readonly decisions: readonly RetentionDecision[];
}
