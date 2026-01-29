// Compact Scheduler
// Runs SQLite optimization (PRAGMA optimize, VACUUM) on old AgentFS databases

import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type {
  CompactResult,
  CompactSchedulerOptions,
  CompactTickOptions,
} from "./types";

import {
  agentfsCompactionDurationSeconds,
  agentfsCompactionRunsTotal,
} from "../../../metrics";

export type { CompactResult, CompactSchedulerOptions };

// Module-level state
let schedulerHandle: NodeJS.Timeout | null = null;
let running = false;

async function findDbPath(dir: string): Promise<string | null> {
  const primary = path.join(dir, "agentfs.db");
  if (existsSync(primary)) {
    return primary;
  }
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const db = entries.find((e) => e.isFile() && e.name.endsWith(".db"));
    return db ? path.join(dir, db.name) : null;
  } catch {
    return null;
  }
}

async function tick(options: CompactTickOptions): Promise<CompactResult> {
  if (running) {
    options.logger.warn?.(
      "[agentfs-compact] Tick skipped because previous run is still in progress."
    );
    return { compacted: 0 };
  }

  running = true;
  try {
    const root = path.join(process.cwd(), ".agentfs");
    if (!existsSync(root)) {
      return { compacted: 0 };
    }

    const now = options.now();
    const nowMs = now.getTime();
    const minAgeMs = options.minAgeDays * 24 * 60 * 60 * 1000;

    const entries = await readdir(root, { withFileTypes: true });
    const candidates: {
      runId: string;
      dbPath: string;
      mtimeMs: number;
    }[] = [];

    for (const ent of entries) {
      if (!ent.isDirectory()) {
        continue;
      }
      if (ent.name === "quarantine" || ent.name === "cas") {
        continue;
      }

      const runDir = path.join(root, ent.name);
      const dbPath = await findDbPath(runDir);
      if (!dbPath) {
        continue;
      }

      try {
        const st = await stat(dbPath);
        const ageMs = nowMs - st.mtimeMs;
        if (ageMs < minAgeMs) {
          continue;
        }
        candidates.push({ dbPath, mtimeMs: st.mtimeMs, runId: ent.name });
      } catch {
        // ignore
      }
    }

    candidates.sort((a, b) => a.mtimeMs - b.mtimeMs);

    let compacted = 0;
    for (const c of candidates) {
      if (compacted >= options.maxRuns) {
        break;
      }

      try {
        const db = new Database(c.dbPath);
        try {
          // PRAGMA optimize
          const t0Optimize = Date.now();
          db.run("PRAGMA optimize");
          agentfsCompactionRunsTotal.inc({ op: "optimize" });
          agentfsCompactionDurationSeconds.observe(
            { op: "optimize" },
            (Date.now() - t0Optimize) / 1000
          );

          // VACUUM if enabled
          if (options.vacuum) {
            const t0Vacuum = Date.now();
            db.run("VACUUM");
            agentfsCompactionRunsTotal.inc({ op: "vacuum" });
            agentfsCompactionDurationSeconds.observe(
              { op: "vacuum" },
              (Date.now() - t0Vacuum) / 1000
            );
          }
        } finally {
          db.close();
        }
        compacted += 1;
      } catch (error) {
        options.logger.warn?.("[agentfs-compact] Failed to compact run", {
          error: error instanceof Error ? error.message : String(error),
          runId: c.runId,
        });
      }
    }

    if (compacted > 0) {
      options.logger.info?.("[agentfs-compact] Tick complete", { compacted });
    }

    return { compacted };
  } catch (error) {
    options.logger.error?.("[agentfs-compact] Tick failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { compacted: 0 };
  } finally {
    running = false;
  }
}

export async function runCompactTick(
  options: CompactSchedulerOptions = {}
): Promise<CompactResult> {
  return tick({
    intervalMs: options.intervalMs ?? 24 * 60 * 60 * 1000,
    jitterMs: options.jitterMs ?? 60 * 1000,
    logger: options.logger ?? console,
    maxRuns: options.maxRuns ?? 5,
    minAgeDays: options.minAgeDays ?? 7,
    now: options.now ?? (() => new Date()),
    vacuum: options.vacuum ?? process.env.ALFRED_AGENTFS_COMPACT_VACUUM === "1",
  });
}

export function startCompactScheduler(
  options: CompactSchedulerOptions = {}
): void {
  if (process.env.SCHED_AGENTFS_COMPACT !== "1") {
    options.logger?.info?.(
      "[agentfs-compact] Scheduler disabled (set SCHED_AGENTFS_COMPACT=1 to enable)."
    );
    return;
  }

  if (schedulerHandle) {
    options.logger?.warn?.("[agentfs-compact] Scheduler already running.");
    return;
  }

  const opts: CompactTickOptions = {
    intervalMs: options.intervalMs ?? 24 * 60 * 60 * 1000,
    jitterMs: options.jitterMs ?? 60 * 1000,
    logger: options.logger ?? console,
    maxRuns: options.maxRuns ?? 5,
    minAgeDays: options.minAgeDays ?? 7,
    now: options.now ?? (() => new Date()),
    vacuum: options.vacuum ?? process.env.ALFRED_AGENTFS_COMPACT_VACUUM === "1",
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
    opts.logger.error?.("[agentfs-compact] Initial scheduler run failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    scheduleNext();
  });
}

export function stopCompactScheduler(): void {
  if (schedulerHandle) {
    clearTimeout(schedulerHandle);
    schedulerHandle = null;
  }
}
