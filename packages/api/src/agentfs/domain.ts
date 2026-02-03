// AgentFS Domain Types
// Pure value objects and type definitions - no side effects

// ═════════════════════════════════════════════════════════════════════════════
// Core Retention Types
// ═════════════════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════════════════
// Quarantine Types
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Type of quarantined item.
 */
export type QuarantineType = "run" | "cas";

/**
 * Reason for quarantine.
 */
export type QuarantineReason =
  | "integrity_corrupt_db"
  | "integrity_corrupt_cas"
  | "manual"
  | "security_scan";

/**
 * A quarantined item (run or CAS archive).
 */
export interface QuarantineEntry {
  /** Unique identifier (runId for runs, sha for CAS) */
  readonly id: string;
  /** Type of quarantined item */
  readonly type: QuarantineType;
  /** Original path before quarantine */
  readonly originalPath: string;
  /** Current quarantine path */
  readonly quarantinePath: string;
  /** When quarantined */
  readonly quarantinedAt: Date;
  /** Why quarantined */
  readonly reason: QuarantineReason;
  /** Additional context (e.g., checksum mismatch details) */
  readonly details: unknown;
  /** Size in bytes */
  readonly sizeBytes: number;
  /** Whether item is pinned (should not be auto-deleted) */
  readonly pinned: boolean;
}

/**
 * Request to restore from quarantine.
 */
export interface QuarantineRestoreRequest {
  /** Run ID to restore (for runs) */
  readonly runId?: string;
  /** CAS SHA to restore (for CAS) */
  readonly casSha?: string;
  /** Target run ID (for restoring to different ID) */
  readonly targetRunId?: string;
}

/**
 * Result of quarantine restore operation.
 */
export interface QuarantineRestoreResult {
  readonly success: boolean;
  /** New path after restore */
  readonly newPath: string;
  /** Any error message */
  readonly error?: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// Storage Metrics Types
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Storage usage for a single run.
 */
export interface RunStorageMetrics {
  readonly runId: string;
  readonly sizeBytes: number;
  readonly fileCount: number;
  readonly ageDays: number;
  readonly pinned: boolean;
  readonly projectId: string | null;
  readonly retentionDays: number | null;
  /** Last accessed timestamp (if available) */
  readonly lastAccessedAt: Date | null;
}

/**
 * CAS archive metrics.
 */
export interface CasStorageMetrics {
  readonly archiveCount: number;
  readonly totalBytes: number;
  readonly pinnedCount: number;
  readonly pinnedBytes: number;
}

/**
 * Per-project storage breakdown.
 */
export interface ProjectStorageMetrics {
  readonly projectId: string;
  readonly runsBytes: number;
  readonly casBytes: number;
  readonly runCount: number;
  readonly archiveCount: number;
}

/**
 * Complete storage metrics response.
 */
export interface StorageMetrics {
  /** Aggregate totals */
  readonly total: {
    readonly runsBytes: number;
    readonly casBytes: number;
    readonly quarantineBytes: number;
    readonly totalBytes: number;
  };
  /** Individual run metrics */
  readonly runs: readonly RunStorageMetrics[];
  /** CAS summary */
  readonly cas: CasStorageMetrics;
  /** Per-project breakdown */
  readonly byProject: readonly ProjectStorageMetrics[];
  /** Metrics computed at */
  readonly computedAt: Date;
}

// ═════════════════════════════════════════════════════════════════════════════
// Batch Operations Types
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Result of a single batch operation item.
 */
export interface BatchItemResult {
  readonly id: string;
  readonly success: boolean;
  readonly error?: string;
}

/**
 * Result of batch delete operation.
 */
export interface BatchDeleteResult {
  readonly deleted: readonly BatchItemResult[];
  readonly failed: readonly BatchItemResult[];
  readonly skippedPinned: readonly string[];
  readonly bytesFreed: number;
}

/**
 * Result of batch pin/unpin operation.
 */
export interface BatchPinResult {
  readonly pinned: readonly string[];
  readonly alreadyPinned: readonly string[];
  readonly failed: readonly BatchItemResult[];
}

/**
 * Result of batch unpin operation.
 */
export interface BatchUnpinResult {
  readonly unpinned: readonly string[];
  readonly notPinned: readonly string[];
  readonly failed: readonly BatchItemResult[];
}

/**
 * Result of batch export to CAS.
 */
export interface BatchExportResult {
  readonly archives: readonly {
    readonly runId: string;
    readonly sha: string;
  }[];
  readonly failed: readonly BatchItemResult[];
}

// ═════════════════════════════════════════════════════════════════════════════
// Search Types
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Search result for file content.
 */
export interface FileSearchResult {
  readonly runId: string;
  readonly filePath: string;
  readonly matches: readonly {
    readonly line: number;
    readonly column: number;
    readonly context: string;
  }[];
}

/**
 * Search result for KV entries.
 */
export interface KvSearchResult {
  readonly runId: string;
  readonly key: string;
  readonly value: unknown;
  readonly updatedAt: Date;
}

/**
 * Search result for tool calls.
 */
export interface ToolCallSearchResult {
  readonly runId: string;
  readonly toolCall: {
    readonly id: string;
    readonly name: string;
    readonly parameters: unknown;
    readonly result: unknown;
    readonly timestamp: Date;
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Retention Policy Types
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Item that would be deleted in retention preview.
 */
export interface RetentionPreviewItem {
  readonly id: string;
  readonly type: "run" | "cas";
  readonly reason: "age" | "size_cap";
  readonly ageDays: number;
  readonly sizeBytes: number;
}

/**
 * Item that would be autopinned.
 */
export interface RetentionAutopinItem {
  readonly id: string;
  readonly type: "run" | "cas";
  readonly reason: string;
}

/**
 * Retention policy preview result.
 */
export interface RetentionPreview {
  readonly runsToDelete: readonly RetentionPreviewItem[];
  readonly casToDelete: readonly RetentionPreviewItem[];
  readonly runsToAutopin: readonly RetentionAutopinItem[];
  readonly casToAutopin: readonly RetentionAutopinItem[];
  readonly bytesToFree: number;
  readonly totalRuns: number;
  readonly totalCas: number;
  readonly parameters: {
    readonly retentionDays: number;
    readonly casRetentionDays: number;
    readonly maxBytes: number | null;
    readonly casMaxBytes: number | null;
  };
}

/**
 * Result of immediate cleanup execution.
 */
export interface CleanupNowResult {
  readonly runsDeleted: number;
  readonly casDeleted: number;
  readonly bytesFreed: number;
  readonly dryRun: boolean;
}

// ═════════════════════════════════════════════════════════════════════════════
// CAS Management Types
// ═════════════════════════════════════════════════════════════════════════════

/**
 * CAS archive information.
 */
export interface CasArchiveInfo {
  readonly sha: string;
  readonly runId: string;
  readonly sizeBytes: number;
  readonly createdAt: Date;
  readonly lastAccessedAt: Date | null;
  readonly pinned: boolean;
  readonly projectId: string | null;
  readonly metadata: unknown;
}

/**
 * CAS list response with pagination.
 */
export interface CasListResult {
  readonly archives: readonly CasArchiveInfo[];
  readonly nextCursor?: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// Access Audit Types
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Type of audit action.
 */
export type AuditAction =
  | "file_read"
  | "file_write"
  | "run_clone"
  | "checkpoint_restore"
  | "cas_export"
  | "cas_restore"
  | "cas_delete"
  | "cas_cleanup"
  | "quarantine_restore"
  | "run_delete"
  | "pin_set"
  | "pin_clear"
  | "batch_delete"
  | "batch_export"
  | "batch_pin"
  | "batch_unpin";

/**
 * Audit log entry.
 */
export interface AuditLogEntry {
  readonly id: string;
  readonly timestamp: Date;
  readonly userId: string;
  readonly action: AuditAction;
  readonly runId?: string;
  readonly casSha?: string;
  readonly details: unknown;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly success?: boolean;
}

/**
 * Audit log query result.
 */
export interface AuditLogResult {
  readonly entries: readonly AuditLogEntry[];
  readonly totalCount: number;
  readonly hasMore: boolean;
}

// ═════════════════════════════════════════════════════════════════════════════
// Type Aliases for Service Compatibility
// ═════════════════════════════════════════════════════════════════════════════

/** @deprecated Use QuarantineEntry */
export type QuarantineItem = QuarantineEntry;

/** @deprecated Use CasArchiveInfo */
export type CasArchive = CasArchiveInfo;

/** @deprecated Use AuditLogEntry */
export type AccessAuditEntry = AuditLogEntry;

/** CAS list options */
export interface CasListOptions {
  readonly projectId?: string;
  readonly runId?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly limit?: number;
}

/** Audit query filters */
export interface AuditQuery {
  readonly runId?: string;
  readonly userId?: string;
  readonly action?: string;
  readonly resource?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly successOnly?: boolean;
  readonly limit?: number;
}
