import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  agentfsCompactionDurationSeconds,
  agentfsCompactionRunsTotal,
  agentfsIntegrityCheckDurationSeconds,
  agentfsIntegrityChecksTotal,
  agentfsIntegrityQuarantinesTotal,
} from "../metrics";

export interface AgentfsCleanupSchedulerOptions {
  intervalMs?: number;
  jitterMs?: number;
  retentionDays?: number;
  casRetentionDays?: number;
  casMaxDeletes?: number;
  maxDeletes?: number;
  logger?: Pick<Console, "info" | "warn" | "error">;
  now?: () => Date;
  deps?: {
    hasFailureContext?: (runId: string, dbPath: string) => Promise<boolean>;
  };
}

let schedulerHandle: NodeJS.Timeout | null = null;
let running = false;

function shouldAutopinFailures(): boolean {
  const raw = process.env.ALFRED_AGENTFS_AUTOPIN_FAILURES;
  if (!raw) {
    return true;
  }
  return raw !== "0";
}

async function hasFailureContext(
  runId: string,
  dbPath: string
): Promise<boolean> {
  const { AlfredAgentFS } = await import("@alfred/agent/agentfs/index");
  const id = `cleanup-${runId}`.slice(0, 64);
  const fsdb = await AlfredAgentFS.open({ id, path: dbPath }, runId);

  try {
    const entries = await fsdb.kv.list("failure:");
    return entries.length > 0;
  } finally {
    await fsdb.close();
  }
}

function parseRetentionDays(): number {
  const raw = process.env.ALFRED_AGENTFS_RETENTION_DAYS;
  if (!raw) {
    return 14;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return 14;
  }
  return n;
}

function parseCasRetentionDays(): number {
  const raw = process.env.ALFRED_AGENTFS_CAS_RETENTION_DAYS;
  if (!raw) {
    return 30;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return 30;
  }
  return n;
}

async function cleanupCas(args: {
  root: string;
  now: Date;
  retentionDays: number;
  maxDeletes: number;
  logger: Pick<Console, "info" | "warn" | "error">;
}) {
  const casDir = path.join(args.root, "cas");
  if (!existsSync(casDir)) {
    return;
  }

  const cutoffMs =
    args.now.getTime() - args.retentionDays * 24 * 60 * 60 * 1000;
  const entries = await readdir(casDir, { withFileTypes: true });
  const candidates: { sha: string; abs: string; mtimeMs: number }[] = [];

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
    const abs = path.join(casDir, ent.name);
    try {
      const st = await stat(abs);
      candidates.push({ abs, mtimeMs: st.mtimeMs, sha: sha.toLowerCase() });
    } catch {
      // ignore
    }
  }

  candidates.sort((a, b) => a.mtimeMs - b.mtimeMs);

  let deleted = 0;
  for (const c of candidates) {
    if (deleted >= args.maxDeletes) {
      break;
    }
    if (c.mtimeMs > cutoffMs) {
      continue;
    }

    const keepAbs = path.join(casDir, `${c.sha}.keep`);
    if (existsSync(keepAbs)) {
      continue;
    }

    try {
      await rm(c.abs, { force: true });
      await rm(path.join(casDir, `${c.sha}.json`), { force: true });
      await rm(keepAbs, { force: true });
      deleted += 1;
    } catch (error) {
      args.logger.warn?.("[agentfs-cleanup] Failed to delete CAS artifact", {
        error: error instanceof Error ? error.message : String(error),
        sha: c.sha,
      });
    }
  }

  if (deleted > 0) {
    args.logger.info?.("[agentfs-cleanup] CAS cleanup complete", {
      deleted,
      retentionDays: args.retentionDays,
    });
  }
}

async function readRetentionOverrideDays(dir: string): Promise<number | null> {
  const p = path.join(dir, ".retention");
  if (!existsSync(p)) {
    return null;
  }
  try {
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

type TickOptions = Required<Omit<AgentfsCleanupSchedulerOptions, "deps">> & {
  deps?: AgentfsCleanupSchedulerOptions["deps"];
};

async function tick(options: TickOptions) {
  if (running) {
    options.logger.warn?.(
      "[agentfs-cleanup] Tick skipped because previous run is still in progress."
    );
    return;
  }

  running = true;
  try {
    const root = path.join(process.cwd(), ".agentfs");
    if (!existsSync(root)) {
      return;
    }

    const entries = await readdir(root, { withFileTypes: true });
    const now = options.now();
    const nowMs = now.getTime();

    const candidates: { dir: string; mtimeMs: number }[] = [];
    for (const ent of entries) {
      if (!ent.isDirectory()) {
        continue;
      }
      if (ent.name === "quarantine" || ent.name === "cas") {
        continue;
      }
      const dir = path.join(root, ent.name);
      const keep = path.join(dir, ".keep");
      if (existsSync(keep)) {
        continue;
      }

      const db = path.join(dir, "agentfs.db");
      try {
        const st = await stat(existsSync(db) ? db : dir);
        candidates.push({ dir, mtimeMs: st.mtimeMs });
      } catch {
        // ignore
      }
    }

    candidates.sort((a, b) => a.mtimeMs - b.mtimeMs);

    let deleted = 0;
    for (const c of candidates) {
      if (deleted >= options.maxDeletes) {
        break;
      }

      const overrideDays = await readRetentionOverrideDays(c.dir);
      const retentionDays = overrideDays ?? options.retentionDays;
      const cutoffMs = nowMs - retentionDays * 24 * 60 * 60 * 1000;
      if (c.mtimeMs > cutoffMs) {
        continue;
      }

      if (shouldAutopinFailures()) {
        const runId = path.basename(c.dir);
        const dbPath = `.agentfs/${runId}/agentfs.db`;
        try {
          const check = options.deps?.hasFailureContext ?? hasFailureContext;
          if (await check(runId, dbPath)) {
            const keep = path.join(c.dir, ".keep");
            await writeFile(
              keep,
              JSON.stringify(
                { at: now.toISOString(), reason: "failure_context" },
                null,
                2
              ),
              "utf8"
            );
            continue;
          }
        } catch {
          // ignore
        }
      }
      try {
        await rm(c.dir, { force: true, recursive: true });
        deleted += 1;
      } catch (error) {
        options.logger.warn?.("[agentfs-cleanup] Failed to delete directory", {
          dir: c.dir,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (deleted > 0) {
      options.logger.info?.("[agentfs-cleanup] Cleanup complete", {
        deleted,
        retentionDays: options.retentionDays,
      });
    }

    await cleanupCas({
      logger: options.logger,
      maxDeletes: options.casMaxDeletes,
      now,
      retentionDays: options.casRetentionDays,
      root,
    });
  } catch (error) {
    options.logger.error?.("[agentfs-cleanup] Tick failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    running = false;
  }
}

export async function runAgentfsCleanupTick(
  options: AgentfsCleanupSchedulerOptions = {}
) {
  await tick({
    casMaxDeletes: options.casMaxDeletes ?? 50,
    casRetentionDays: options.casRetentionDays ?? parseCasRetentionDays(),
    deps: options.deps,
    intervalMs: options.intervalMs ?? 6 * 60 * 60 * 1000,
    jitterMs: options.jitterMs ?? 60 * 1000,
    logger: options.logger ?? console,
    maxDeletes: options.maxDeletes ?? 25,
    now: options.now ?? (() => new Date()),
    retentionDays: options.retentionDays ?? parseRetentionDays(),
  });
}

export function startAgentfsCleanupScheduler({
  intervalMs = 6 * 60 * 60 * 1000,
  jitterMs = 60 * 1000,
  retentionDays = parseRetentionDays(),
  casRetentionDays = parseCasRetentionDays(),
  casMaxDeletes = 50,
  maxDeletes = 25,
  logger = console,
  now = () => new Date(),
  deps,
}: AgentfsCleanupSchedulerOptions = {}) {
  if (process.env.SCHED_AGENTFS_CLEANUP !== "1") {
    logger.info?.(
      "[agentfs-cleanup] Scheduler disabled (set SCHED_AGENTFS_CLEANUP=1 to enable)."
    );
    return;
  }

  if (schedulerHandle) {
    logger.warn?.("[agentfs-cleanup] Scheduler already running.");
    return;
  }

  const run = () =>
    tick({
      casMaxDeletes,
      casRetentionDays,
      deps,
      intervalMs,
      jitterMs,
      logger,
      maxDeletes,
      now,
      retentionDays,
    });

  const scheduleNext = () => {
    const delay = intervalMs + Math.random() * jitterMs;
    schedulerHandle = setTimeout(async () => {
      await run();
      scheduleNext();
    }, delay);
    schedulerHandle.unref();
  };

  void run().then(scheduleNext, (error) => {
    logger.error?.("[agentfs-cleanup] Initial scheduler run failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    scheduleNext();
  });
}

export function stopAgentfsCleanupScheduler() {
  if (schedulerHandle) {
    clearTimeout(schedulerHandle);
    schedulerHandle = null;
  }
}

export interface AgentfsIntegritySchedulerOptions {
  intervalMs?: number;
  jitterMs?: number;
  minAgeMs?: number;
  maxChecks?: number;
  logger?: Pick<Console, "info" | "warn" | "error">;
  now?: () => Date;
}

let integrityHandle: NodeJS.Timeout | null = null;
let integrityRunning = false;

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

async function quarantineRun(args: {
  root: string;
  runDir: string;
  runId: string;
  now: Date;
  reason: string;
  details?: unknown;
}) {
  const quarantineRoot = path.join(args.root, "quarantine");
  await mkdir(quarantineRoot, { recursive: true });
  const safe = args.runId.replaceAll(/[^a-zA-Z0-9-]/g, "-");
  const suffix = args.now.toISOString().replaceAll(/[:.]/g, "-");
  const dest = path.join(quarantineRoot, `${safe}-${suffix}`);
  await rename(args.runDir, dest);
  try {
    await writeFile(
      path.join(dest, "quarantine.json"),
      JSON.stringify(
        {
          at: args.now.toISOString(),
          details: args.details ?? null,
          reason: args.reason,
          runId: args.runId,
        },
        null,
        2
      ),
      "utf8"
    );
  } catch {
    // ignore
  }
}

type IntegrityTickOptions = Required<AgentfsIntegritySchedulerOptions>;

async function integrityTick(options: IntegrityTickOptions) {
  if (integrityRunning) {
    options.logger.warn?.(
      "[agentfs-integrity] Tick skipped because previous run is still in progress."
    );
    return;
  }

  integrityRunning = true;
  try {
    const root = path.join(process.cwd(), ".agentfs");
    if (!existsSync(root)) {
      return;
    }

    const now = options.now();
    const nowMs = now.getTime();

    const entries = await readdir(root, { withFileTypes: true });
    const candidates: {
      runId: string;
      runDir: string;
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
        if (ageMs < options.minAgeMs) {
          continue;
        }
        candidates.push({
          dbPath,
          mtimeMs: st.mtimeMs,
          runDir,
          runId: ent.name,
        });
      } catch {
        // ignore
      }
    }

    candidates.sort((a, b) => a.mtimeMs - b.mtimeMs);

    let checked = 0;
    let quarantined = 0;

    for (const c of candidates) {
      if (checked >= options.maxChecks) {
        break;
      }
      checked += 1;

      const startedMs = Date.now();
      let result: "ok" | "corrupt" | "error" = "ok";

      let ok = false;
      let details: unknown = null;
      try {
        const db = new Database(c.dbPath, { readonly: true });
        try {
          const rows = db.query("PRAGMA integrity_check").all() as Record<
            string,
            unknown
          >[];
          const values = rows
            .map((r) => Object.values(r)[0])
            .filter((v): v is string => typeof v === "string");
          ok = values.length === 1 && values[0] === "ok";
          details = values.slice(0, 5);
        } finally {
          db.close();
        }
      } catch (error) {
        ok = false;
        result = "error";
        details = {
          error: error instanceof Error ? error.message : String(error),
        };
      }

      if (!ok && result !== "error") {
        result = "corrupt";
      }

      agentfsIntegrityChecksTotal.inc({ result });
      agentfsIntegrityCheckDurationSeconds.observe(
        { result },
        (Date.now() - startedMs) / 1000
      );

      if (!ok) {
        try {
          await quarantineRun({
            details,
            now,
            reason: "sqlite_integrity_check_failed",
            root,
            runDir: c.runDir,
            runId: c.runId,
          });
          quarantined += 1;
          agentfsIntegrityQuarantinesTotal.inc();
        } catch (error) {
          options.logger.warn?.(
            "[agentfs-integrity] Failed to quarantine run",
            {
              error: error instanceof Error ? error.message : String(error),
              runId: c.runId,
            }
          );
        }
      }
    }

    if (checked > 0) {
      options.logger.info?.("[agentfs-integrity] Tick complete", {
        checked,
        quarantined,
      });
    }
  } catch (error) {
    options.logger.error?.("[agentfs-integrity] Tick failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    integrityRunning = false;
  }
}

export async function runAgentfsIntegrityTick(
  options: AgentfsIntegritySchedulerOptions = {}
) {
  await integrityTick({
    intervalMs: options.intervalMs ?? 24 * 60 * 60 * 1000,
    jitterMs: options.jitterMs ?? 60 * 1000,
    logger: options.logger ?? console,
    maxChecks: options.maxChecks ?? 10,
    minAgeMs: options.minAgeMs ?? 60 * 60 * 1000,
    now: options.now ?? (() => new Date()),
  });
}

export function startAgentfsIntegrityScheduler({
  intervalMs = 24 * 60 * 60 * 1000,
  jitterMs = 60 * 1000,
  minAgeMs = 60 * 60 * 1000,
  maxChecks = 10,
  logger = console,
  now = () => new Date(),
}: AgentfsIntegritySchedulerOptions = {}) {
  if (process.env.SCHED_AGENTFS_INTEGRITY !== "1") {
    logger.info?.(
      "[agentfs-integrity] Scheduler disabled (set SCHED_AGENTFS_INTEGRITY=1 to enable)."
    );
    return;
  }

  if (integrityHandle) {
    logger.warn?.("[agentfs-integrity] Scheduler already running.");
    return;
  }

  const run = () =>
    integrityTick({
      intervalMs,
      jitterMs,
      logger,
      maxChecks,
      minAgeMs,
      now,
    });

  const scheduleNext = () => {
    const delay = intervalMs + Math.random() * jitterMs;
    integrityHandle = setTimeout(async () => {
      await run();
      scheduleNext();
    }, delay);
    integrityHandle.unref();
  };

  void run().then(scheduleNext, (error) => {
    logger.error?.("[agentfs-integrity] Initial scheduler run failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    scheduleNext();
  });
}

export function stopAgentfsIntegrityScheduler() {
  if (integrityHandle) {
    clearTimeout(integrityHandle);
    integrityHandle = null;
  }
}

export interface AgentfsCompactSchedulerOptions {
  intervalMs?: number;
  jitterMs?: number;
  minAgeDays?: number;
  maxRuns?: number;
  vacuum?: boolean;
  logger?: Pick<Console, "info" | "warn" | "error">;
  now?: () => Date;
}

let compactHandle: NodeJS.Timeout | null = null;
let compactRunning = false;

type CompactTickOptions = Required<AgentfsCompactSchedulerOptions>;

async function compactTick(options: CompactTickOptions) {
  if (compactRunning) {
    options.logger.warn?.(
      "[agentfs-compact] Tick skipped because previous run is still in progress."
    );
    return;
  }

  compactRunning = true;
  try {
    const root = path.join(process.cwd(), ".agentfs");
    if (!existsSync(root)) {
      return;
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
          {
            const t0 = Date.now();
            db.run("PRAGMA optimize");
            agentfsCompactionRunsTotal.inc({ op: "optimize" });
            agentfsCompactionDurationSeconds.observe(
              { op: "optimize" },
              (Date.now() - t0) / 1000
            );
          }
          if (options.vacuum) {
            const t0 = Date.now();
            db.run("VACUUM");
            agentfsCompactionRunsTotal.inc({ op: "vacuum" });
            agentfsCompactionDurationSeconds.observe(
              { op: "vacuum" },
              (Date.now() - t0) / 1000
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
  } catch (error) {
    options.logger.error?.("[agentfs-compact] Tick failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    compactRunning = false;
  }
}

export async function runAgentfsCompactTick(
  options: AgentfsCompactSchedulerOptions = {}
) {
  await compactTick({
    intervalMs: options.intervalMs ?? 24 * 60 * 60 * 1000,
    jitterMs: options.jitterMs ?? 60 * 1000,
    logger: options.logger ?? console,
    maxRuns: options.maxRuns ?? 5,
    minAgeDays: options.minAgeDays ?? 7,
    now: options.now ?? (() => new Date()),
    vacuum: options.vacuum ?? process.env.ALFRED_AGENTFS_COMPACT_VACUUM === "1",
  });
}

export function startAgentfsCompactScheduler({
  intervalMs = 24 * 60 * 60 * 1000,
  jitterMs = 60 * 1000,
  minAgeDays = 7,
  maxRuns = 5,
  vacuum = process.env.ALFRED_AGENTFS_COMPACT_VACUUM === "1",
  logger = console,
  now = () => new Date(),
}: AgentfsCompactSchedulerOptions = {}) {
  if (process.env.SCHED_AGENTFS_COMPACT !== "1") {
    logger.info?.(
      "[agentfs-compact] Scheduler disabled (set SCHED_AGENTFS_COMPACT=1 to enable)."
    );
    return;
  }

  if (compactHandle) {
    logger.warn?.("[agentfs-compact] Scheduler already running.");
    return;
  }

  const run = () =>
    compactTick({
      intervalMs,
      jitterMs,
      logger,
      maxRuns,
      minAgeDays,
      now,
      vacuum,
    });

  const scheduleNext = () => {
    const delay = intervalMs + Math.random() * jitterMs;
    compactHandle = setTimeout(async () => {
      await run();
      scheduleNext();
    }, delay);
    compactHandle.unref();
  };

  void run().then(scheduleNext, (error) => {
    logger.error?.("[agentfs-compact] Initial scheduler run failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    scheduleNext();
  });
}

export function stopAgentfsCompactScheduler() {
  if (compactHandle) {
    clearTimeout(compactHandle);
    compactHandle = null;
  }
}
