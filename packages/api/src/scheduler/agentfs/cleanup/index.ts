// Cleanup Scheduler
// Orchestrates run and CAS cleanup based on retention policy

import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { CasEntry, RunEntry } from "../../../agentfs/domain";
import type {
  CleanupResult,
  CleanupSchedulerOptions,
  CleanupTickOptions,
} from "./types";

import {
  parseCasMaxBytes,
  parseCasRetentionDays,
  parseMaxBytes,
  parseRetentionDays,
  shouldAutopinFailures,
  shouldDryRunCleanup,
} from "../../../agentfs/policy";
import { readAgentfsCasMeta } from "../../../agentfscas";
import {
  agentfsCleanupBytesGauge,
  agentfsCleanupRunsBytesGauge,
} from "../../../metrics";
import { evaluateCas, evaluateRuns } from "./core";
import { cleanupOrphans, executeCasCleanup, executeRunCleanup } from "./runner";

export type { CleanupResult, CleanupSchedulerOptions };

// Module-level state (encapsulated)
let schedulerHandle: NodeJS.Timeout | null = null;
let running = false;

/**
 * List run directories for cleanup evaluation.
 */
async function listRunEntries(args: {
  root: string;
  logger: Pick<Console, "info" | "warn" | "error">;
}): Promise<RunEntry[]> {
  const entries = await readdir(args.root, { withFileTypes: true });
  const candidates: RunEntry[] = [];

  for (const ent of entries) {
    if (!ent.isDirectory()) {
      continue;
    }
    if (ent.name === "quarantine" || ent.name === "cas") {
      continue;
    }

    const dir = path.join(args.root, ent.name);

    // Safety: never process quarantined runs
    if (dir.includes("quarantine")) {
      args.logger.warn?.("[agentfs-cleanup] Skipping quarantined run", { dir });
      continue;
    }

    const keep = path.join(dir, ".keep");
    if (existsSync(keep)) {
      continue;
    }

    const db = path.join(dir, "agentfs.db");
    try {
      const st = await stat(existsSync(db) ? db : dir);
      const sizeBytes = await sumDirectoryBytes(dir);
      candidates.push({ dir, mtimeMs: st.mtimeMs, runId: ent.name, sizeBytes });
    } catch {
      // ignore
    }
  }

  return candidates;
}

/**
 * List CAS entries for cleanup evaluation.
 */
async function listCasEntries(args: {
  root: string;
  logger: Pick<Console, "info" | "warn" | "error">;
}): Promise<CasEntry[]> {
  const casDir = path.join(args.root, "cas");
  if (!existsSync(casDir)) {
    return [];
  }

  const entries = await readdir(casDir, { withFileTypes: true });
  const candidates: CasEntry[] = [];

  for (const ent of entries) {
    if (!ent.isFile()) {
      continue;
    }
    if (!ent.name.endsWith(".tar.gz")) {
      continue;
    }

    const sha = ent.name.slice(0, -".tar.gz".length);
    if (!/^[a-f0-9]{64}$/i.test(sha)) {
      continue;
    }

    const shaLower = sha.toLowerCase();
    const abs = path.join(casDir, ent.name);
    const metaAbs = path.join(casDir, `${shaLower}.json`);

    try {
      const st = await stat(abs);
      const sizeBytes = st.size;

      let basisMs = st.mtimeMs;
      let basis: CasEntry["basis"] = "mtime";

      try {
        const meta = await readAgentfsCasMeta({
          rootAbs: args.root,
          sha: shaLower,
        });
        if (meta?.lastAccessedAt) {
          const lastAccessedMs = Date.parse(meta.lastAccessedAt);
          if (Number.isFinite(lastAccessedMs)) {
            basisMs = lastAccessedMs;
            basis = "lastAccessedAt";
          }
        } else if (meta?.createdAt) {
          const createdAtMs = Date.parse(meta.createdAt);
          if (Number.isFinite(createdAtMs)) {
            basisMs = createdAtMs;
            basis = "createdAt";
          }
        }
      } catch {
        // ignore
      }

      candidates.push({
        abs,
        basis,
        basisMs,
        metaAbs,
        mtimeMs: st.mtimeMs,
        sha: shaLower,
        sizeBytes,
      });
    } catch {
      // ignore
    }
  }

  return candidates;
}

async function sumDirectoryBytes(dir: string): Promise<number> {
  try {
    const { readdir } = await import("node:fs/promises");
    const ents = await readdir(dir, { withFileTypes: true, recursive: true });
    let total = 0;
    for (const ent of ents) {
      if (!ent.isFile()) {
        continue;
      }
      try {
        const { stat } = await import("node:fs/promises");
        const st = await stat(path.join(ent.parentPath ?? dir, ent.name));
        total += st.isFile() ? st.size : 0;
      } catch {
        // ignore
      }
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Execute a single cleanup tick.
 */
async function tick(options: CleanupTickOptions): Promise<CleanupResult> {
  if (running) {
    options.logger.warn?.(
      "[agentfs-cleanup] Tick skipped because previous run is still in progress."
    );
    return {
      runsDeleted: 0,
      runsAutopinned: 0,
      casDeleted: 0,
      bytesDeleted: 0,
      dryRun: options.dryRun,
    };
  }

  running = true;
  try {
    const root = path.join(process.cwd(), ".agentfs");
    if (!existsSync(root)) {
      return {
        runsDeleted: 0,
        runsAutopinned: 0,
        casDeleted: 0,
        bytesDeleted: 0,
        dryRun: options.dryRun,
      };
    }

    const now = options.now();
    const nowMs = now.getTime();

    // Process runs
    const runEntries = await listRunEntries({ root, logger: options.logger });
    const totalRunBytes = runEntries.reduce((sum, e) => sum + e.sizeBytes, 0);
    agentfsCleanupRunsBytesGauge.set(totalRunBytes);

    // Build flags map
    const runFlags = new Map<
      string,
      { isPinned: boolean; hasFailureContext: boolean }
    >();
    for (const entry of runEntries) {
      const isPinned = existsSync(path.join(entry.dir, ".keep"));
      let hasFailureContext = false;
      if (shouldAutopinFailures()) {
        try {
          const check = options.deps?.hasFailureContext;
          if (check) {
            hasFailureContext = await check(
              entry.runId,
              `.agentfs/${entry.runId}/agentfs.db`
            );
          }
        } catch {
          // ignore
        }
      }
      runFlags.set(entry.runId, { hasFailureContext, isPinned });
    }

    const evaluatedRuns = await evaluateRuns(
      runEntries,
      options,
      { now, nowMs },
      runFlags
    );
    const runResult = await executeRunCleanup(evaluatedRuns, {
      dryRun: options.dryRun,
      logger: options.logger,
      now,
      root,
    });

    // Process CAS
    const casEntries = await listCasEntries({ root, logger: options.logger });
    const totalCasBytes = casEntries.reduce((sum, e) => sum + e.sizeBytes, 0);
    agentfsCleanupBytesGauge.set(totalCasBytes);

    const pinnedShas = new Set(
      casEntries
        .filter((e) => existsSync(path.join(root, "cas", `${e.sha}.keep`)))
        .map((e) => e.sha)
    );

    const evaluatedCas = evaluateCas(
      casEntries,
      options,
      { nowMs },
      pinnedShas
    );
    const casResult = await executeCasCleanup(evaluatedCas, {
      casDir: path.join(root, "cas"),
      dryRun: options.dryRun,
      logger: options.logger,
      now,
      root,
    });

    // Cleanup orphans
    await cleanupOrphans(
      path.join(root, "cas"),
      options.logger,
      options.dryRun
    );

    if (runResult.deleted > 0 || casResult.deleted > 0) {
      options.logger.info?.("[agentfs-cleanup] Cleanup complete", {
        casDeleted: casResult.deleted,
        dryRun: options.dryRun,
        runsDeleted: runResult.deleted,
        runsAutopinned: runResult.autopinned,
      });
    }

    return {
      bytesDeleted: casResult.bytesDeleted,
      casDeleted: casResult.deleted,
      dryRun: options.dryRun,
      runsAutopinned: runResult.autopinned,
      runsDeleted: runResult.deleted,
    };
  } catch (error) {
    options.logger.error?.("[agentfs-cleanup] Tick failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      runsDeleted: 0,
      runsAutopinned: 0,
      casDeleted: 0,
      bytesDeleted: 0,
      dryRun: options.dryRun,
    };
  } finally {
    running = false;
  }
}

/**
 * Run a single cleanup tick with options.
 */
export async function runCleanupTick(
  options: CleanupSchedulerOptions = {}
): Promise<CleanupResult> {
  return tick({
    casMaxBytes: options.casMaxBytes ?? parseCasMaxBytes(),
    casMaxDeletes: options.casMaxDeletes ?? 50,
    casRetentionDays: options.casRetentionDays ?? parseCasRetentionDays(),
    deps: options.deps,
    dryRun: options.dryRun ?? shouldDryRunCleanup(),
    intervalMs: options.intervalMs ?? 6 * 60 * 60 * 1000,
    jitterMs: options.jitterMs ?? 60 * 1000,
    logger: options.logger ?? console,
    maxBytes: options.maxBytes ?? parseMaxBytes(),
    maxDeletes: options.maxDeletes ?? 25,
    now: options.now ?? (() => new Date()),
    retentionDays: options.retentionDays ?? parseRetentionDays(),
  });
}

/**
 * Start the cleanup scheduler.
 */
export function startCleanupScheduler(
  options: CleanupSchedulerOptions = {}
): void {
  if (process.env.SCHED_AGENTFS_CLEANUP !== "1") {
    options.logger?.info?.(
      "[agentfs-cleanup] Scheduler disabled (set SCHED_AGENTFS_CLEANUP=1 to enable)."
    );
    return;
  }

  if (schedulerHandle) {
    options.logger?.warn?.("[agentfs-cleanup] Scheduler already running.");
    return;
  }

  const opts: Required<
    Omit<CleanupTickOptions, "deps" | "maxBytes" | "casMaxBytes">
  > & {
    deps?: CleanupSchedulerOptions["deps"];
    maxBytes: number | null;
    casMaxBytes: number | null;
  } = {
    casMaxBytes: options.casMaxBytes ?? parseCasMaxBytes(),
    casMaxDeletes: options.casMaxDeletes ?? 50,
    casRetentionDays: options.casRetentionDays ?? parseCasRetentionDays(),
    deps: options.deps,
    dryRun: options.dryRun ?? shouldDryRunCleanup(),
    intervalMs: options.intervalMs ?? 6 * 60 * 60 * 1000,
    jitterMs: options.jitterMs ?? 60 * 1000,
    logger: options.logger ?? console,
    maxBytes: options.maxBytes ?? parseMaxBytes(),
    maxDeletes: options.maxDeletes ?? 25,
    now: options.now ?? (() => new Date()),
    retentionDays: options.retentionDays ?? parseRetentionDays(),
  };

  const run = () => tick(opts);

  const scheduleNext = () => {
    const delay = opts.intervalMs + Math.random() * opts.jitterMs;
    schedulerHandle = setTimeout(async () => {
      await run();
      scheduleNext();
    }, delay);
    schedulerHandle.unref();
  };

  void run().then(scheduleNext, (error) => {
    opts.logger.error?.("[agentfs-cleanup] Initial scheduler run failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    scheduleNext();
  });
}

/**
 * Stop the cleanup scheduler.
 */
export function stopCleanupScheduler(): void {
  if (schedulerHandle) {
    clearTimeout(schedulerHandle);
    schedulerHandle = null;
  }
}
