// Integrity Scheduler
// Verifies SQLite and CAS integrity, quarantines corrupt data

import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CasEntry } from "../../../agentfs/domain";
import type {
  IntegrityResult,
  IntegritySchedulerOptions,
  IntegrityTickOptions,
} from "./types";

import { readAgentfsCasMeta } from "../../../agentfscas";
import {
  agentfsCasIntegrityChecksTotal,
  agentfsCasIntegrityCheckDurationSeconds,
  agentfsCasIntegrityQuarantinesTotal,
  agentfsIntegrityChecksTotal,
  agentfsIntegrityCheckDurationSeconds,
  agentfsIntegrityQuarantinesTotal,
} from "../../../metrics";

export type { IntegrityResult, IntegritySchedulerOptions };

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

async function quarantineRun(args: {
  root: string;
  runDir: string;
  runId: string;
  now: Date;
  reason: string;
  details?: unknown;
}): Promise<void> {
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

async function quarantineCas(args: {
  root: string;
  sha: string;
  now: Date;
  reason: string;
  details?: unknown;
  logger: Pick<Console, "info" | "warn" | "error">;
}): Promise<void> {
  const casDir = path.join(args.root, "cas");
  const quarantineRoot = path.join(args.root, "quarantine", "cas");
  await mkdir(quarantineRoot, { recursive: true });

  const safe = args.sha.toLowerCase();
  const suffix = args.now.toISOString().replaceAll(/[:.]/g, "-");
  const destDir = path.join(quarantineRoot, `${safe}-${suffix}`);
  await mkdir(destDir, { recursive: true });

  const tarAbs = path.join(casDir, `${safe}.tar.gz`);
  const metaAbs = path.join(casDir, `${safe}.json`);

  try {
    if (existsSync(tarAbs)) {
      await rename(tarAbs, path.join(destDir, `${safe}.tar.gz`));
    }
  } catch (error) {
    args.logger.warn?.("[agentfs-integrity] Failed to quarantine CAS archive", {
      error: error instanceof Error ? error.message : String(error),
      sha: args.sha,
    });
  }

  try {
    if (existsSync(metaAbs)) {
      await rename(metaAbs, path.join(destDir, `${safe}.json`));
    }
  } catch (error) {
    args.logger.warn?.(
      "[agentfs-integrity] Failed to quarantine CAS metadata",
      {
        error: error instanceof Error ? error.message : String(error),
        sha: args.sha,
      }
    );
  }

  try {
    await writeFile(
      path.join(destDir, "quarantine.json"),
      JSON.stringify(
        {
          at: args.now.toISOString(),
          details: args.details ?? null,
          reason: args.reason,
          sha: args.sha,
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

async function sha256File(absPath: string): Promise<string> {
  const file = Bun.file(absPath);
  const hash = createHash("sha256");
  const reader = file.stream().getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    hash.update(value);
  }
  return hash.digest("hex");
}

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
        sizeBytes: st.size,
      });
    } catch {
      // ignore
    }
  }

  return candidates;
}

async function checkCasIntegrity(args: {
  root: string;
  maxChecks: number;
  minAgeMs: number;
  now: Date;
  logger: Pick<Console, "info" | "warn" | "error">;
}): Promise<{ checked: number; quarantined: number }> {
  const casDir = path.join(args.root, "cas");
  if (!existsSync(casDir)) {
    return { checked: 0, quarantined: 0 };
  }

  const entries = await listCasEntries({
    root: args.root,
    logger: args.logger,
  });
  const nowMs = args.now.getTime();

  const candidates = entries
    .filter((e) => nowMs - e.mtimeMs >= args.minAgeMs)
    .sort((a, b) => a.mtimeMs - b.mtimeMs)
    .slice(0, args.maxChecks);

  let checked = 0;
  let quarantined = 0;

  for (const entry of candidates) {
    const startedMs = Date.now();
    let result: "ok" | "corrupt" | "error" = "ok";

    try {
      const computedSha = await sha256File(entry.abs);
      if (computedSha.toLowerCase() !== entry.sha.toLowerCase()) {
        result = "corrupt";
        agentfsCasIntegrityChecksTotal.inc({ result });
        agentfsCasIntegrityCheckDurationSeconds.observe(
          { result },
          (Date.now() - startedMs) / 1000
        );

        await quarantineCas({
          details: { expected: entry.sha, got: computedSha },
          logger: args.logger,
          now: args.now,
          reason: "sha_mismatch",
          root: args.root,
          sha: entry.sha,
        });
        quarantined += 1;
        agentfsCasIntegrityQuarantinesTotal.inc();
        continue;
      }

      agentfsCasIntegrityChecksTotal.inc({ result: "ok" });
      agentfsCasIntegrityCheckDurationSeconds.observe(
        { result: "ok" },
        (Date.now() - startedMs) / 1000
      );
      checked += 1;
    } catch (error) {
      result = "error";
      agentfsCasIntegrityChecksTotal.inc({ result });
      agentfsCasIntegrityCheckDurationSeconds.observe(
        { result },
        (Date.now() - startedMs) / 1000
      );
      args.logger.warn?.("[agentfs-integrity] CAS integrity check failed", {
        error: error instanceof Error ? error.message : String(error),
        sha: entry.sha,
      });
    }
  }

  return { checked, quarantined };
}

async function tick(options: IntegrityTickOptions): Promise<IntegrityResult> {
  if (running) {
    options.logger.warn?.(
      "[agentfs-integrity] Tick skipped because previous run is still in progress."
    );
    return { checked: 0, quarantined: 0 };
  }

  running = true;
  try {
    const root = path.join(process.cwd(), ".agentfs");
    if (!existsSync(root)) {
      return { checked: 0, quarantined: 0 };
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

    // CAS integrity checks
    if (options.checkCas) {
      const casResult = await checkCasIntegrity({
        logger: options.logger,
        maxChecks: options.maxChecks - checked,
        minAgeMs: options.minAgeMs,
        now,
        root,
      });
      checked += casResult.checked;
      quarantined += casResult.quarantined;
    }

    if (checked > 0 || quarantined > 0) {
      options.logger.info?.("[agentfs-integrity] Tick complete", {
        checked,
        quarantined,
      });
    }

    return { checked, quarantined };
  } catch (error) {
    options.logger.error?.("[agentfs-integrity] Tick failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { checked: 0, quarantined: 0 };
  } finally {
    running = false;
  }
}

export async function runIntegrityTick(
  options: IntegritySchedulerOptions = {}
): Promise<IntegrityResult> {
  return tick({
    checkCas: options.checkCas ?? true,
    intervalMs: options.intervalMs ?? 24 * 60 * 60 * 1000,
    jitterMs: options.jitterMs ?? 60 * 1000,
    logger: options.logger ?? console,
    maxChecks: options.maxChecks ?? 10,
    minAgeMs: options.minAgeMs ?? 60 * 60 * 1000,
    now: options.now ?? (() => new Date()),
  });
}

export function startIntegrityScheduler(
  options: IntegritySchedulerOptions = {}
): void {
  if (process.env.SCHED_AGENTFS_INTEGRITY !== "1") {
    options.logger?.info?.(
      "[agentfs-integrity] Scheduler disabled (set SCHED_AGENTFS_INTEGRITY=1 to enable)."
    );
    return;
  }

  if (schedulerHandle) {
    options.logger?.warn?.("[agentfs-integrity] Scheduler already running.");
    return;
  }

  const opts: IntegrityTickOptions = {
    checkCas: options.checkCas ?? true,
    intervalMs: options.intervalMs ?? 24 * 60 * 60 * 1000,
    jitterMs: options.jitterMs ?? 60 * 1000,
    logger: options.logger ?? console,
    maxChecks: options.maxChecks ?? 10,
    minAgeMs: options.minAgeMs ?? 60 * 60 * 1000,
    now: options.now ?? (() => new Date()),
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
    opts.logger.error?.("[agentfs-integrity] Initial scheduler run failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    scheduleNext();
  });
}

export function stopIntegrityScheduler(): void {
  if (schedulerHandle) {
    clearTimeout(schedulerHandle);
    schedulerHandle = null;
  }
}
