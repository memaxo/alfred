// Cleanup Scheduler Core Logic
// Pure functions for determining what to clean up

import { existsSync } from "node:fs";
import path from "node:path";

import type { CasEntry, RunEntry } from "../../../agentfs/domain";
import type { CleanupTickOptions } from "./types";

import {
  calculateCutoffMs,
  sortCasByPriority,
  sortRunsByAge,
} from "../../../agentfs/policy";

export interface RunEvaluation {
  entry: RunEntry;
  runId: string;
  isPinned: boolean;
  overrideDays: number | null;
  hasFailureContext: boolean;
}

export interface CasEvaluation {
  entry: CasEntry;
  isPinned: boolean;
}

export type RunCleanupDeleteReason = "age" | "size_cap";
export type RunCleanupAutopinReason = "failure_context";
export type RunCleanupReason = RunCleanupDeleteReason | RunCleanupAutopinReason;

export type EvaluatedRun =
  | { entry: RunEntry; action: "delete"; reason: RunCleanupDeleteReason }
  | { entry: RunEntry; action: "autopin"; reason: RunCleanupAutopinReason };

export type CasCleanupReason = "age" | "size_cap";
export interface EvaluatedCas {
  entry: CasEntry;
  action: "delete";
  reason: CasCleanupReason;
}

/**
 * Read retention override from .retention file.
 */
export async function readRetentionOverrideDays(
  dir: string
): Promise<number | null> {
  const p = path.join(dir, ".retention");
  if (!existsSync(p)) {
    return null;
  }
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = (await readFile(p, "utf8")).trim();
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) {
      return null;
    }
    return n;
  } catch {
    return null;
  }
}

/**
 * Evaluate a batch of run entries for cleanup.
 * Returns actions to take without performing them.
 */
export async function evaluateRuns(
  entries: readonly RunEntry[],
  options: Pick<
    CleanupTickOptions,
    "retentionDays" | "maxDeletes" | "maxBytes"
  >,
  context: { nowMs: number; now: Date },
  flags: Map<string, { isPinned: boolean; hasFailureContext: boolean }>
): Promise<EvaluatedRun[]> {
  const sorted = sortRunsByAge(entries);
  const results: EvaluatedRun[] = [];
  let bytesRemaining = sorted.reduce((sum, e) => sum + e.sizeBytes, 0);

  for (const entry of sorted) {
    if (results.length >= options.maxDeletes) {
      break;
    }

    const entryFlags = flags.get(entry.runId) ?? {
      hasFailureContext: false,
      isPinned: false,
    };

    if (entryFlags.isPinned) {
      bytesRemaining -= entry.sizeBytes;
      continue;
    }

    const overrideDays = await readRetentionOverrideDays(entry.dir);
    const retentionDays = overrideDays ?? options.retentionDays;
    const cutoffMs = calculateCutoffMs(context.nowMs, retentionDays);

    const isOld = entry.mtimeMs <= cutoffMs;

    // Check size cap
    let overCap = false;
    if (options.maxBytes !== null) {
      overCap = bytesRemaining > options.maxBytes;
    }

    if (!isOld && !overCap) {
      bytesRemaining -= entry.sizeBytes;
      continue;
    }

    // Check failure auto-pin
    if (entryFlags.hasFailureContext) {
      results.push({
        action: "autopin",
        entry,
        reason: "failure_context",
      });
      bytesRemaining -= entry.sizeBytes;
      continue;
    }

    // Mark for deletion
    results.push({
      action: "delete",
      entry,
      reason: isOld ? "age" : "size_cap",
    });
    bytesRemaining -= entry.sizeBytes;
  }

  return results;
}

/**
 * Evaluate a batch of CAS entries for cleanup.
 */
export function evaluateCas(
  entries: readonly CasEntry[],
  options: Pick<
    CleanupTickOptions,
    "casRetentionDays" | "casMaxDeletes" | "casMaxBytes"
  >,
  context: { nowMs: number },
  pinnedShas: ReadonlySet<string>
): EvaluatedCas[] {
  const sorted = sortCasByPriority(entries);
  const results: EvaluatedCas[] = [];
  let bytesRemaining = sorted.reduce((sum, e) => sum + e.sizeBytes, 0);
  const cutoffMs = calculateCutoffMs(context.nowMs, options.casRetentionDays);

  for (const entry of sorted) {
    if (results.length >= options.casMaxDeletes) {
      break;
    }

    const isPinned = pinnedShas.has(entry.sha);

    if (isPinned) {
      bytesRemaining -= entry.sizeBytes;
      continue;
    }

    const isOld = entry.basisMs <= cutoffMs;

    // Check size cap
    let overCap = false;
    if (options.casMaxBytes !== null) {
      overCap = bytesRemaining > options.casMaxBytes;
    }

    if (!isOld && !overCap) {
      bytesRemaining -= entry.sizeBytes;
      continue;
    }

    results.push({
      action: "delete",
      entry,
      reason: isOld ? "age" : "size_cap",
    });
    bytesRemaining -= entry.sizeBytes;
  }

  return results;
}
