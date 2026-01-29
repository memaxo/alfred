// AgentFS Retention Policy
// Pure functions for retention decisions - no side effects, no filesystem I/O

import type {
  AgeDetails,
  AutopinDetails,
  CasCleanupContext,
  CasEntry,
  CasRetentionPolicy,
  KeepDetails,
  RetentionDecision,
  RetentionPolicy,
  RunEntry,
  SizeCapDetails,
} from "./domain";

// =============================================================================
// Retention Override Parsing
// =============================================================================

/**
 * Read retention override days from a .retention file content.
 * Returns null if invalid or empty.
 */
export function parseRetentionOverrideDays(content: string): number | null {
  const raw = content.trim();
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

// =============================================================================
// Environment Parsing (Deterministic, no side effects on runtime state)
// =============================================================================

/**
 * Parse retention days from env (default: 14).
 * Invalid values return default.
 */
export function parseRetentionDays(
  env: Record<string, string | undefined> = process.env
): number {
  const raw = env.ALFRED_AGENTFS_RETENTION_DAYS;
  if (!raw) {
    return 14;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return 14;
  }
  return n;
}

/**
 * Parse CAS retention days from env (default: 30).
 */
export function parseCasRetentionDays(
  env: Record<string, string | undefined> = process.env
): number {
  const raw = env.ALFRED_AGENTFS_CAS_RETENTION_DAYS;
  if (!raw) {
    return 30;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return 30;
  }
  return n;
}

/**
 * Parse max bytes from env (default: null = unlimited).
 * Invalid values return null.
 */
export function parseMaxBytes(
  env: Record<string, string | undefined> = process.env
): number | null {
  const raw = env.ALFRED_AGENTFS_MAX_BYTES;
  if (!raw) {
    return null;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

/**
 * Parse CAS max bytes from env (default: null = unlimited).
 */
export function parseCasMaxBytes(
  env: Record<string, string | undefined> = process.env
): number | null {
  const raw = env.ALFRED_AGENTFS_CAS_MAX_BYTES;
  if (!raw) {
    return null;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

/**
 * Check if dry-run mode is enabled.
 */
export function shouldDryRunCleanup(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.ALFRED_AGENTFS_CLEANUP_DRY_RUN === "1";
}

/**
 * Check if failure auto-pin is enabled (default: true).
 */
export function shouldAutopinFailures(
  env: Record<string, string | undefined> = process.env
): boolean {
  const raw = env.ALFRED_AGENTFS_AUTOPIN_FAILURES;
  if (!raw) {
    return true;
  }
  return raw !== "0";
}

// =============================================================================
// Retention Decisions (Pure)
// =============================================================================

/**
 * Calculate cutoff timestamp for age-based retention.
 */
export function calculateCutoffMs(
  nowMs: number,
  retentionDays: number
): number {
  return nowMs - retentionDays * 24 * 60 * 60 * 1000;
}

/**
 * Decide retention action for a run entry.
 * Pure function - no side effects.
 */
export function decideRunRetention(
  entry: RunEntry,
  policy: RetentionPolicy,
  context: {
    nowMs: number;
    cutoffMs: number;
    hasOverride: boolean;
    overrideDays: number | null;
  },
  flags: { isPinned: boolean; hasFailureContext: boolean }
): RetentionDecision {
  // Pinned runs are never deleted
  if (flags.isPinned) {
    const details: KeepDetails = {
      reason: "pinned",
      type: "keep",
    };
    return {
      action: "keep",
      details,
      reason: "Run is pinned",
    };
  }

  // Check for retention override
  const effectiveRetentionDays = context.overrideDays ?? policy.retentionDays;
  const effectiveCutoffMs =
    context.overrideDays !== null
      ? calculateCutoffMs(context.nowMs, context.overrideDays)
      : context.cutoffMs;

  // Check age
  const isOld = entry.mtimeMs <= effectiveCutoffMs;

  if (!isOld) {
    const details: KeepDetails = {
      reason: "recent",
      type: "keep",
    };
    return {
      action: "keep",
      details,
      reason: `Run is younger than ${effectiveRetentionDays} days`,
    };
  }

  // Age threshold met - check for failure auto-pin
  if (flags.hasFailureContext) {
    const details: AutopinDetails = {
      reason: "failure_context",
      type: "autopin",
    };
    return {
      action: "autopin",
      details,
      reason: "Run contains failure context",
    };
  }

  // Mark for deletion by age
  const ageDays = Math.floor(
    (context.nowMs - entry.mtimeMs) / (24 * 60 * 60 * 1000)
  );
  const details: AgeDetails = {
    ageDays,
    basis: "mtime",
    basisMs: entry.mtimeMs,
    cutoffMs: effectiveCutoffMs,
    type: "age",
  };
  return {
    action: "delete",
    details,
    reason: "Run exceeded retention period",
  };
}

/**
 * Decide retention action for a CAS entry.
 * Pure function - no side effects.
 */
export function decideCasRetention(
  entry: CasEntry,
  policy: CasRetentionPolicy,
  context: { nowMs: number; cutoffMs: number },
  flags: { isPinned: boolean }
): RetentionDecision {
  // Pinned CAS entries are never deleted
  if (flags.isPinned) {
    const details: KeepDetails = {
      reason: "pinned",
      type: "keep",
    };
    return {
      action: "keep",
      details,
      reason: "CAS archive is pinned",
    };
  }

  // Check age
  const isOld = entry.basisMs <= context.cutoffMs;

  if (!isOld) {
    const details: KeepDetails = {
      reason: "recent",
      type: "keep",
    };
    return {
      action: "keep",
      details,
      reason: `CAS archive is younger than ${policy.retentionDays} days`,
    };
  }

  // Mark for deletion by age
  const ageDays = Math.floor(
    (context.nowMs - entry.basisMs) / (24 * 60 * 60 * 1000)
  );
  const details: AgeDetails = {
    ageDays,
    basis: entry.basis,
    basisMs: entry.basisMs,
    cutoffMs: context.cutoffMs,
    type: "age",
  };
  return {
    action: "delete",
    details,
    reason: "CAS archive exceeded retention period",
  };
}

/**
 * Check if CAS entry should be deleted for size cap.
 * Pure function - evaluates against current remaining bytes.
 */
export function checkCasSizeCap(
  entry: CasEntry,
  casMaxBytes: number,
  bytesRemaining: number
): { shouldDelete: boolean; details?: SizeCapDetails } {
  const overCap = bytesRemaining > casMaxBytes;

  if (!overCap) {
    return { shouldDelete: false };
  }

  const details: SizeCapDetails = {
    currentBytes: bytesRemaining,
    maxBytes: casMaxBytes,
    remainingBytes: bytesRemaining - entry.sizeBytes,
    type: "size_cap",
  };

  return { shouldDelete: true, details };
}

/**
 * Check if run entry should be deleted for size cap.
 */
export function checkRunSizeCap(
  entry: RunEntry,
  maxBytes: number,
  bytesRemaining: number
): { shouldDelete: boolean; details?: SizeCapDetails } {
  const overCap = bytesRemaining > maxBytes;

  if (!overCap) {
    return { shouldDelete: false };
  }

  const details: SizeCapDetails = {
    currentBytes: bytesRemaining,
    maxBytes,
    remainingBytes: bytesRemaining - entry.sizeBytes,
    type: "size_cap",
  };

  return { shouldDelete: true, details };
}

// =============================================================================
// Sorting (Pure)
// =============================================================================

/**
 * Sort CAS entries by age (oldest first).
 * For equal ages, larger files first (recover more space sooner).
 */
export function sortCasByPriority(entries: readonly CasEntry[]): CasEntry[] {
  return [...entries].sort((a, b) => {
    const ageDiff = a.basisMs - b.basisMs;
    if (ageDiff !== 0) {
      return ageDiff;
    }
    // Secondary: larger files first
    return b.sizeBytes - a.sizeBytes;
  });
}

/**
 * Sort run entries by age (oldest first).
 */
export function sortRunsByAge(entries: readonly RunEntry[]): RunEntry[] {
  return [...entries].sort((a, b) => a.mtimeMs - b.mtimeMs);
}

// =============================================================================
// Batch Evaluation
// =============================================================================

/**
 * Evaluate a batch of CAS entries for cleanup.
 * Returns entries to delete (age OR size cap), respecting maxDeletes.
 */
export function evaluateCasBatch(
  entries: readonly CasEntry[],
  policy: CasRetentionPolicy,
  context: CasCleanupContext,
  pinnedShas: ReadonlySet<string>
): { entry: CasEntry; decision: RetentionDecision }[] {
  const sorted = sortCasByPriority(entries);
  const results: { entry: CasEntry; decision: RetentionDecision }[] = [];
  let bytesRemaining = sorted.reduce((sum, e) => sum + e.sizeBytes, 0);

  for (const entry of sorted) {
    if (results.length >= policy.maxDeletes) {
      break;
    }

    const isPinned = pinnedShas.has(entry.sha);
    const ageDecision = decideCasRetention(entry, policy, context, {
      isPinned,
    });

    // Pinned entries are never deleted
    if (ageDecision.action === "keep" && isPinned) {
      bytesRemaining -= entry.sizeBytes;
      continue;
    }

    // Check age-based deletion
    if (ageDecision.action === "delete") {
      bytesRemaining -= entry.sizeBytes;
      results.push({ entry, decision: ageDecision });
      continue;
    }

    // Check size-cap-based deletion (only if not pinned)
    if (!isPinned && policy.casMaxBytes !== null) {
      const sizeCheck = checkCasSizeCap(
        entry,
        policy.casMaxBytes,
        bytesRemaining
      );
      if (sizeCheck.shouldDelete && sizeCheck.details) {
        bytesRemaining -= entry.sizeBytes;
        results.push({
          entry,
          decision: {
            action: "delete",
            details: sizeCheck.details,
            reason: "CAS archive deleted to satisfy size cap",
          },
        });
        continue;
      }
    }

    bytesRemaining -= entry.sizeBytes;
  }

  return results;
}

/**
 * Evaluate a batch of run entries for cleanup.
 */
export function evaluateRunBatch(
  entries: readonly RunEntry[],
  policy: RetentionPolicy,
  context: { nowMs: number; cutoffMs: number },
  flags: Map<
    string,
    {
      isPinned: boolean;
      overrideDays: number | null;
      hasFailureContext: boolean;
    }
  >
): { entry: RunEntry; decision: RetentionDecision }[] {
  const sorted = sortRunsByAge(entries);
  const results: { entry: RunEntry; decision: RetentionDecision }[] = [];
  let bytesRemaining = sorted.reduce((sum, e) => sum + e.sizeBytes, 0);

  for (const entry of sorted) {
    if (results.length >= policy.maxDeletes) {
      break;
    }

    const entryFlags = flags.get(entry.runId) ?? {
      hasFailureContext: false,
      isPinned: false,
      overrideDays: null,
    };

    const decision = decideRunRetention(
      entry,
      policy,
      {
        cutoffMs: context.cutoffMs,
        hasOverride: entryFlags.overrideDays !== null,
        nowMs: context.nowMs,
        overrideDays: entryFlags.overrideDays,
      },
      {
        hasFailureContext: entryFlags.hasFailureContext,
        isPinned: entryFlags.isPinned,
      }
    );

    // Handle pinned runs
    if (decision.action === "keep" && entryFlags.isPinned) {
      bytesRemaining -= entry.sizeBytes;
      continue;
    }

    // Handle autopin
    if (decision.action === "autopin") {
      results.push({ entry, decision });
      bytesRemaining -= entry.sizeBytes;
      continue;
    }

    // Check age-based deletion
    if (decision.action === "delete") {
      const ageDetails = decision.details as { type: "age" } | undefined;
      if (ageDetails?.type === "age") {
        bytesRemaining -= entry.sizeBytes;
        results.push({ entry, decision });
        continue;
      }
    }

    // Check size-cap-based deletion (only if not pinned)
    if (!entryFlags.isPinned && policy.maxBytes !== null) {
      const sizeCheck = checkRunSizeCap(entry, policy.maxBytes, bytesRemaining);
      if (sizeCheck.shouldDelete && sizeCheck.details) {
        bytesRemaining -= entry.sizeBytes;
        results.push({
          entry,
          decision: {
            action: "delete",
            details: sizeCheck.details,
            reason: "Run deleted to satisfy size cap",
          },
        });
        continue;
      }
    }

    bytesRemaining -= entry.sizeBytes;
  }

  return results;
}
