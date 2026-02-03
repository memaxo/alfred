// AgentFS Retention Preview Service
// Policy simulation and cleanup preview
//
// This module intentionally reuses the cleanup scheduler evaluation logic so
// preview/simulate/violations remain consistent with real cleanup behavior.

import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type {
  CasEntry,
  CleanupNowResult,
  RetentionAutopinItem,
  RetentionPolicy,
  RetentionPreview,
  RetentionPreviewItem,
  RunEntry,
} from "../agentfs/domain";

import {
  calculateCutoffMs,
  parseCasMaxBytes,
  parseCasRetentionDays,
  parseMaxBytes,
  parseRetentionDays,
  shouldAutopinFailures,
} from "../agentfs/policy";
import { readAgentfsCasMeta } from "../agentfscas";
import { evaluateCas, evaluateRuns } from "../scheduler/agentfs/cleanup/core";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_DELETES = 25;
const DEFAULT_CAS_MAX_DELETES = 50;

function getAgentfsDir(): string {
  return path.join(process.cwd(), ".agentfs");
}

async function sumDirectoryBytes(dirPath: string): Promise<number> {
  let total = 0;
  try {
    const entries = await readdir(dirPath, { recursive: true });
    for (const entry of entries) {
      try {
        const s = await stat(path.join(dirPath, entry));
        if (s.isFile()) {
          total += s.size;
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return total;
}

async function listUnpinnedRunEntries(args: {
  rootAbs: string;
}): Promise<RunEntry[]> {
  if (!existsSync(args.rootAbs)) {
    return [];
  }

  const entries = await readdir(args.rootAbs, { withFileTypes: true });
  const candidates: RunEntry[] = [];

  for (const ent of entries) {
    if (!ent.isDirectory()) {
      continue;
    }
    if (ent.name === "quarantine" || ent.name === "cas") {
      continue;
    }

    const dir = path.join(args.rootAbs, ent.name);

    // Safety: never process quarantined runs
    if (dir.includes("quarantine")) {
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

async function listCasEntries(args: { rootAbs: string }): Promise<CasEntry[]> {
  const casDir = path.join(args.rootAbs, "cas");
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
          rootAbs: args.rootAbs,
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

async function buildRunFlags(args: {
  entries: readonly RunEntry[];
  deps?: RetentionPreviewOptions["deps"];
}): Promise<Map<string, { isPinned: boolean; hasFailureContext: boolean }>> {
  const flags = new Map<
    string,
    { isPinned: boolean; hasFailureContext: boolean }
  >();

  for (const entry of args.entries) {
    const isPinned = existsSync(path.join(entry.dir, ".keep"));
    let hasFailureContext = false;

    if (shouldAutopinFailures() && args.deps?.hasFailureContext) {
      try {
        hasFailureContext = await args.deps.hasFailureContext(
          entry.runId,
          `.agentfs/${entry.runId}/agentfs.db`
        );
      } catch {
        hasFailureContext = false;
      }
    }

    flags.set(entry.runId, { hasFailureContext, isPinned });
  }

  return flags;
}

function toPreviewItem(args: {
  id: string;
  type: "run" | "cas";
  reason: "age" | "size_cap";
  nowMs: number;
  basisMs: number;
  sizeBytes: number;
}): RetentionPreviewItem {
  const ageDays = Math.floor((args.nowMs - args.basisMs) / DAY_MS);
  return {
    ageDays,
    id: args.id,
    reason: args.reason,
    sizeBytes: args.sizeBytes,
    type: args.type,
  };
}

export interface RetentionPreviewOptions {
  retentionDays?: number;
  casRetentionDays?: number;
  maxBytes?: number | null;
  casMaxBytes?: number | null;
  rootAbs?: string;
  now?: Date;
  deps?: {
    hasFailureContext?: (runId: string, dbPath: string) => Promise<boolean>;
  };
}

export async function generateRetentionPreview(
  options: RetentionPreviewOptions = {}
): Promise<RetentionPreview> {
  const rootAbs = options.rootAbs ?? getAgentfsDir();
  const retentionDays = options.retentionDays ?? parseRetentionDays();
  const casRetentionDays = options.casRetentionDays ?? parseCasRetentionDays();
  const maxBytes = options.maxBytes ?? parseMaxBytes();
  const casMaxBytes = options.casMaxBytes ?? parseCasMaxBytes();
  const now = options.now ?? new Date();
  const nowMs = now.getTime();

  const runs = await listUnpinnedRunEntries({ rootAbs });
  const runFlags = await buildRunFlags({ entries: runs, deps: options.deps });
  const evaluatedRuns = await evaluateRuns(
    runs,
    { maxBytes, maxDeletes: DEFAULT_MAX_DELETES, retentionDays },
    { now, nowMs },
    runFlags
  );

  const runsToDelete: RetentionPreviewItem[] = [];
  const runsToAutopin: RetentionAutopinItem[] = [];
  const casToDelete: RetentionPreviewItem[] = [];
  const casToAutopin: RetentionPreview["casToAutopin"] = [];
  let bytesToFree = 0;

  for (const item of evaluatedRuns) {
    if (item.action === "autopin") {
      runsToAutopin.push({
        id: item.entry.runId,
        type: "run",
        reason: item.reason,
      });
      continue;
    }
    if (item.action === "delete") {
      runsToDelete.push(
        toPreviewItem({
          basisMs: item.entry.mtimeMs,
          id: item.entry.runId,
          nowMs,
          reason: item.reason,
          sizeBytes: item.entry.sizeBytes,
          type: "run",
        })
      );
      bytesToFree += item.entry.sizeBytes;
    }
  }

  const casEntries = await listCasEntries({ rootAbs });
  const pinnedShas = new Set(
    casEntries
      .filter((e) => existsSync(path.join(rootAbs, "cas", `${e.sha}.keep`)))
      .map((e) => e.sha)
  );
  const evaluatedCas = evaluateCas(
    casEntries,
    { casMaxBytes, casMaxDeletes: DEFAULT_CAS_MAX_DELETES, casRetentionDays },
    { nowMs },
    pinnedShas
  );

  for (const item of evaluatedCas) {
    if (item.action !== "delete") {
      continue;
    }
    casToDelete.push(
      toPreviewItem({
        basisMs: item.entry.basisMs,
        id: item.entry.sha,
        nowMs,
        reason: item.reason,
        sizeBytes: item.entry.sizeBytes,
        type: "cas",
      })
    );
    bytesToFree += item.entry.sizeBytes;
  }

  return {
    bytesToFree,
    casToAutopin,
    casToDelete,
    parameters: {
      casMaxBytes,
      casRetentionDays,
      maxBytes,
      retentionDays,
    },
    runsToAutopin,
    runsToDelete,
    totalCas: casEntries.length,
    totalRuns: runs.length,
  };
}

export async function simulateCleanup(
  options: RetentionPreviewOptions = {}
): Promise<{
  preview: RetentionPreview;
  simulated: boolean;
  actions: { id: string; action: string; sizeBytes: number }[];
}> {
  const preview = await generateRetentionPreview(options);

  const actions = [
    ...preview.runsToDelete.map((i) => ({
      id: i.id,
      action: "delete",
      sizeBytes: i.sizeBytes,
    })),
    ...preview.casToDelete.map((i) => ({
      id: i.id,
      action: "delete",
      sizeBytes: i.sizeBytes,
    })),
    ...preview.runsToAutopin.map((i) => ({
      id: i.id,
      action: "autopin",
      sizeBytes: 0,
    })),
  ];

  return {
    preview,
    simulated: true,
    actions,
  };
}

export async function getPolicyViolations(args?: {
  rootAbs?: string;
  now?: Date;
}): Promise<
  { id: string; violation: string; severity: "warning" | "error" }[]
> {
  const rootAbs = args?.rootAbs ?? getAgentfsDir();
  if (!existsSync(rootAbs)) {
    return [];
  }

  const nowMs = (args?.now ?? new Date()).getTime();
  const retentionDays = parseRetentionDays();
  const casRetentionDays = parseCasRetentionDays();
  const maxBytes = parseMaxBytes();
  const casMaxBytes = parseCasMaxBytes();

  const violations: {
    id: string;
    violation: string;
    severity: "warning" | "error";
  }[] = [];

  // Pinned run age warnings.
  const runCutoffMs = calculateCutoffMs(nowMs, retentionDays);
  try {
    const entries = await readdir(rootAbs, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) {
        continue;
      }
      if (ent.name === "cas" || ent.name === "quarantine") {
        continue;
      }
      const dir = path.join(rootAbs, ent.name);
      const keep = path.join(dir, ".keep");
      if (!existsSync(keep)) {
        continue;
      }

      const db = path.join(dir, "agentfs.db");
      try {
        const st = await stat(existsSync(db) ? db : dir);
        if (st.mtimeMs <= runCutoffMs) {
          const ageDays = Math.floor((nowMs - st.mtimeMs) / DAY_MS);
          violations.push({
            id: ent.name,
            violation: `Pinned run exceeds ${retentionDays} day retention (age=${ageDays}d)`,
            severity: "warning",
          });
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  // Unpinned run size cap violations.
  if (maxBytes !== null) {
    const runs = await listUnpinnedRunEntries({ rootAbs });
    const total = runs.reduce((sum, r) => sum + r.sizeBytes, 0);
    if (total > maxBytes) {
      violations.push({
        id: "runs",
        violation: `Unpinned runs exceed maxBytes (${total}/${maxBytes})`,
        severity: "error",
      });
    }
  }

  // CAS violations.
  const casEntries = await listCasEntries({ rootAbs });
  const pinnedShas = new Set(
    casEntries
      .filter((e) => existsSync(path.join(rootAbs, "cas", `${e.sha}.keep`)))
      .map((e) => e.sha)
  );

  const casCutoffMs = calculateCutoffMs(nowMs, casRetentionDays);
  for (const entry of casEntries) {
    if (!pinnedShas.has(entry.sha)) {
      continue;
    }
    if (entry.basisMs <= casCutoffMs) {
      const ageDays = Math.floor((nowMs - entry.basisMs) / DAY_MS);
      violations.push({
        id: entry.sha,
        violation: `Pinned CAS exceeds ${casRetentionDays} day retention (basis=${entry.basis}, age=${ageDays}d)`,
        severity: "warning",
      });
    }
  }

  if (casMaxBytes !== null) {
    const total = casEntries
      .filter((e) => !pinnedShas.has(e.sha))
      .reduce((sum, e) => sum + e.sizeBytes, 0);
    if (total > casMaxBytes) {
      violations.push({
        id: "cas",
        violation: `Unpinned CAS exceeds casMaxBytes (${total}/${casMaxBytes})`,
        severity: "error",
      });
    }
  }

  return violations;
}

// -----------------------------------------------------------------------------
// Legacy API (not currently exposed via router)
// -----------------------------------------------------------------------------

export async function cleanupNow(
  policy: RetentionPolicy,
  dryRun = false
): Promise<CleanupNowResult> {
  const preview = await generateRetentionPreview({
    retentionDays: policy.retentionDays,
    maxBytes: policy.maxBytes ?? null,
  });

  let runsDeleted = 0;
  let casDeleted = 0;
  let bytesFreed = 0;

  if (dryRun) {
    return {
      runsDeleted: preview.runsToDelete.length,
      casDeleted: preview.casToDelete.length,
      bytesFreed: preview.bytesToFree,
      dryRun: true,
    };
  }

  for (const item of preview.runsToDelete) {
    runsDeleted++;
    bytesFreed += item.sizeBytes;
  }
  for (const item of preview.casToDelete) {
    casDeleted++;
    bytesFreed += item.sizeBytes;
  }

  return {
    runsDeleted,
    casDeleted,
    bytesFreed,
    dryRun: false,
  };
}
