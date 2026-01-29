// Cleanup Scheduler Runner
// Side effects: filesystem operations, metrics, logging

import { existsSync } from "node:fs";
import { readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CasEntry, RunEntry } from "../../../agentfs/domain";
import type { EvaluatedCas, EvaluatedRun } from "./core";

import {
  agentfsCasCleanupBasisTotal,
  agentfsCleanupDeletesTotal,
} from "../../../metrics";

export interface RunContext {
  root: string;
  now: Date;
  logger: Pick<Console, "info" | "warn" | "error">;
  dryRun: boolean;
}

export interface CasContext extends RunContext {
  casDir: string;
}

/**
 * Execute run cleanup actions.
 */
export async function executeRunCleanup(
  evaluated: readonly EvaluatedRun[],
  context: RunContext
): Promise<{ deleted: number; autopinned: number }> {
  let deleted = 0;
  let autopinned = 0;

  for (const item of evaluated) {
    if (item.action === "autopin") {
      await autopinRun(item.entry, context);
      autopinned++;
    } else if (item.action === "delete") {
      const success = await deleteRun(item.entry, item.reason, context);
      if (success) {deleted++;}
    }
  }

  return { deleted, autopinned };
}

/**
 * Execute CAS cleanup actions.
 */
export async function executeCasCleanup(
  evaluated: readonly EvaluatedCas[],
  context: CasContext
): Promise<{ deleted: number; bytesDeleted: number }> {
  let deleted = 0;
  let bytesDeleted = 0;

  for (const item of evaluated) {
    const success = await deleteCas(item.entry, item.reason, context);
    if (success) {
      deleted++;
      bytesDeleted += item.entry.sizeBytes;
    }
  }

  return { deleted, bytesDeleted };
}

async function autopinRun(entry: RunEntry, context: RunContext): Promise<void> {
  const keep = path.join(entry.dir, ".keep");

  if (context.dryRun) {
    context.logger.info?.("[agentfs-cleanup] Would autopin run (dry-run)", {
      reason: "failure_context",
      runId: entry.runId,
    });
    return;
  }

  try {
    await writeFile(
      keep,
      JSON.stringify(
        { at: context.now.toISOString(), reason: "failure_context" },
        null,
        2
      ),
      "utf8"
    );
  } catch (error) {
    context.logger.warn?.("[agentfs-cleanup] Failed to autopin run", {
      error: error instanceof Error ? error.message : String(error),
      runId: entry.runId,
    });
  }
}

async function deleteRun(
  entry: RunEntry,
  reason: string,
  context: RunContext
): Promise<boolean> {
  const nowMs = context.now.getTime();
  const cutoffMs = nowMs - 14 * 24 * 60 * 60 * 1000; // Approximate

  const details =
    reason === "age"
      ? { mtimeMs: entry.mtimeMs, cutoffMs }
      : { runBytesRemaining: 0 }; // Will be calculated at batch level

  if (context.dryRun) {
    context.logger.info?.(
      "[agentfs-cleanup] Would delete run directory (dry-run)",
      {
        details,
        reason,
        runId: entry.runId,
        sizeBytes: entry.sizeBytes,
      }
    );
    return true;
  }

  try {
    await rm(entry.dir, { force: true, recursive: true });
    agentfsCleanupDeletesTotal.inc({ type: "run" });
    context.logger.info?.("[agentfs-cleanup] Deleted run directory", {
      details,
      reason,
      runId: entry.runId,
      sizeBytes: entry.sizeBytes,
    });
    return true;
  } catch (error) {
    context.logger.warn?.("[agentfs-cleanup] Failed to delete directory", {
      dir: entry.dir,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function deleteCas(
  entry: CasEntry,
  reason: string,
  context: CasContext
): Promise<boolean> {
  const nowMs = context.now.getTime();
  const cutoffMs = nowMs - 30 * 24 * 60 * 60 * 1000; // Approximate

  const details =
    reason === "age"
      ? { basis: entry.basis, basisMs: entry.basisMs, cutoffMs }
      : { bytesRemaining: 0 };

  if (context.dryRun) {
    context.logger.info?.(
      "[agentfs-cleanup] Would delete CAS artifact (dry-run)",
      {
        details,
        reason,
        sha: entry.sha,
        sizeBytes: entry.sizeBytes,
      }
    );
    return true;
  }

  try {
    await rm(entry.abs, { force: true });
    await rm(entry.metaAbs, { force: true });
    agentfsCleanupDeletesTotal.inc({ type: "cas" });
    agentfsCasCleanupBasisTotal.inc({ basis: entry.basis });
    context.logger.info?.("[agentfs-cleanup] Deleted CAS artifact", {
      details,
      reason,
      sha: entry.sha,
      sizeBytes: entry.sizeBytes,
    });
    return true;
  } catch (error) {
    context.logger.warn?.("[agentfs-cleanup] Failed to delete CAS artifact", {
      error: error instanceof Error ? error.message : String(error),
      sha: entry.sha,
    });
    return false;
  }
}

/**
 * Clean up orphaned metadata and .keep files.
 */
export async function cleanupOrphans(
  casDir: string,
  logger: Pick<Console, "info" | "warn" | "error">,
  dryRun: boolean
): Promise<void> {
  const allFiles = await readdir(casDir, { withFileTypes: true });

  for (const ent of allFiles) {
    if (!ent.isFile()) {continue;}

    if (ent.name.endsWith(".json")) {
      await cleanupOrphanedMeta(ent.name, casDir, logger, dryRun);
    } else if (ent.name.endsWith(".keep")) {
      await cleanupOrphanedKeep(ent.name, casDir, logger, dryRun);
    }
  }
}

async function cleanupOrphanedMeta(
  filename: string,
  casDir: string,
  logger: Pick<Console, "info" | "warn" | "error">,
  dryRun: boolean
): Promise<void> {
  const sha = filename.slice(0, -".json".length);
  if (!/^[a-f0-9]{64}$/i.test(sha)) {return;}

  const tarAbs = path.join(casDir, `${sha.toLowerCase()}.tar.gz`);
  if (existsSync(tarAbs)) {return;}

  const metaAbs = path.join(casDir, filename);

  if (dryRun) {
    logger.info?.(
      "[agentfs-cleanup] Would delete orphaned CAS metadata (dry-run)",
      {
        sha: sha.toLowerCase(),
      }
    );
    return;
  }

  try {
    await rm(metaAbs, { force: true });
    logger.info?.("[agentfs-cleanup] Deleted orphaned CAS metadata", {
      sha: sha.toLowerCase(),
    });
  } catch (error) {
    logger.warn?.("[agentfs-cleanup] Failed to delete orphaned metadata", {
      error: error instanceof Error ? error.message : String(error),
      sha: sha.toLowerCase(),
    });
  }
}

async function cleanupOrphanedKeep(
  filename: string,
  casDir: string,
  logger: Pick<Console, "info" | "warn" | "error">,
  dryRun: boolean
): Promise<void> {
  const sha = filename.slice(0, -".keep".length);
  if (!/^[a-f0-9]{64}$/i.test(sha)) {return;}

  const tarAbs = path.join(casDir, `${sha.toLowerCase()}.tar.gz`);
  if (existsSync(tarAbs)) {return;}

  const keepAbs = path.join(casDir, filename);

  if (dryRun) {
    logger.info?.(
      "[agentfs-cleanup] Would delete orphaned CAS .keep (dry-run)",
      {
        sha: sha.toLowerCase(),
      }
    );
    return;
  }

  try {
    await rm(keepAbs, { force: true });
  } catch {
    // ignore
  }
}
