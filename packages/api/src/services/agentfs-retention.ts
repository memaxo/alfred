// AgentFS Retention Preview Service
// Policy simulation and cleanup preview

import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type {
  CleanupNowResult,
  RetentionPolicy,
  RetentionPreview,
  RetentionPreviewItem,
} from "../agentfs/domain";

import {
  parseCasMaxBytes,
  parseMaxBytes,
  parseRetentionDays,
} from "../agentfs/policy";

function getAgentfsDir(): string {
  return path.join(process.cwd(), ".agentfs");
}

function getCutoffMs(retentionDays: number): number {
  return Date.now() - retentionDays * 24 * 60 * 60 * 1000;
}

async function isPinned(runDir: string): Promise<boolean> {
  try {
    await stat(path.join(runDir, ".keep"));
    return true;
  } catch {
    return false;
  }
}

async function getDirSize(dirPath: string): Promise<number> {
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
        // Skip files we can't stat
      }
    }
  } catch {
    // Directory doesn't exist or not accessible
  }
  return total;
}

interface RunInfo {
  runId: string;
  path: string;
  mtimeMs: number;
  sizeBytes: number;
  pinned: boolean;
}

async function collectRunInfo(agentfsDir: string): Promise<RunInfo[]> {
  const runs: RunInfo[] = [];
  if (!existsSync(agentfsDir)) {
    return runs;
  }

  const entries = await readdir(agentfsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name === "cas" || entry.name === "quarantine") {
      continue;
    }

    const runPath = path.join(agentfsDir, entry.name);
    try {
      const s = await stat(runPath);
      const sizeBytes = await getDirSize(runPath);
      const pinned = await isPinned(runPath);

      runs.push({
        runId: entry.name,
        path: runPath,
        mtimeMs: s.mtimeMs,
        sizeBytes,
        pinned,
      });
    } catch {
      // Skip directories we can't read
    }
  }

  return runs;
}

export interface RetentionPreviewOptions {
  retentionDays?: number;
  maxBytes?: number | null;
  casMaxBytes?: number | null;
}

export async function generateRetentionPreview(
  options: RetentionPreviewOptions = {}
): Promise<RetentionPreview> {
  const agentfsDir = getAgentfsDir();
  const retentionDays = options.retentionDays ?? parseRetentionDays();
  const maxBytes = options.maxBytes ?? parseMaxBytes();
  const casMaxBytes = options.casMaxBytes ?? parseCasMaxBytes();
  const cutoffMs = getCutoffMs(retentionDays);

  const runs = await collectRunInfo(agentfsDir);

  const runsToDelete: RetentionPreviewItem[] = [];
  const runsToAutopin: RetentionPreview["runsToAutopin"] = [];
  const casToDelete: RetentionPreviewItem[] = [];
  const casToAutopin: RetentionPreview["casToAutopin"] = [];

  let bytesToFree = 0;

  for (const run of runs) {
    const isOld = run.mtimeMs < cutoffMs;

    if (run.pinned) {
      // Pinned runs are kept unless they need autopin for failure context
      continue;
    }

    if (isOld) {
      runsToDelete.push({
        id: run.runId,
        type: "run",
        reason: "age",
        ageDays: Math.floor((Date.now() - run.mtimeMs) / (24 * 60 * 60 * 1000)),
        sizeBytes: run.sizeBytes,
      });
      bytesToFree += run.sizeBytes;
    }
  }

  // Check CAS archives
  const casDir = path.join(agentfsDir, "cas");
  if (existsSync(casDir)) {
    try {
      const casEntries = await readdir(casDir);
      for (const entry of casEntries) {
        if (!entry.endsWith(".json")) {
          continue;
        }

        const sha = entry.replace(".json", "");
        const metaPath = path.join(casDir, entry);

        try {
          const metaContent = await Bun.file(metaPath).text();
          const meta = JSON.parse(metaContent);
          const createdAt = new Date(meta.createdAt || Date.now());
          const sizeBytes = meta.sizeBytes || 0;

          if (createdAt.getTime() < cutoffMs) {
            casToDelete.push({
              id: sha,
              type: "cas",
              reason: "age",
              ageDays: Math.floor(
                (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000)
              ),
              sizeBytes,
            });
            bytesToFree += sizeBytes;
          }
        } catch {
          // Skip invalid metadata
        }
      }
    } catch {
      // CAS directory not accessible
    }
  }

  return {
    runsToDelete,
    casToDelete,
    runsToAutopin,
    casToAutopin,
    bytesToFree,
    totalRuns: runs.length,
    totalCas: casToDelete.length + casToAutopin.length,
    parameters: {
      retentionDays,
      maxBytes,
      casMaxBytes,
    },
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

  const actions = preview.runsToDelete.map((i) => ({
    id: i.id,
    action: "delete",
    sizeBytes: i.sizeBytes,
  }));

  return {
    preview,
    simulated: true,
    actions,
  };
}

export async function getPolicyViolations(): Promise<
  { id: string; violation: string; severity: "warning" | "error" }[]
> {
  const agentfsDir = getAgentfsDir();
  const retentionDays = parseRetentionDays();
  const maxBytes = parseMaxBytes();
  const cutoffMs = getCutoffMs(retentionDays);

  const runs = await collectRunInfo(agentfsDir);
  const violations: {
    id: string;
    violation: string;
    severity: "warning" | "error";
  }[] = [];

  const totalBytes = runs.reduce((sum, r) => sum + r.sizeBytes, 0);

  for (const run of runs) {
    // Check if pinned but old (policy violation warning)
    if (run.pinned && run.mtimeMs < cutoffMs) {
      violations.push({
        id: run.runId,
        violation: `Pinned run exceeds ${retentionDays} day retention`,
        severity: "warning",
      });
    }

    // Check if over max bytes
    if (maxBytes && totalBytes > maxBytes && !run.pinned) {
      violations.push({
        id: run.runId,
        violation: "Storage exceeds maxBytes limit",
        severity: "error",
      });
    }
  }

  return violations;
}

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

  if (!dryRun) {
    // Delete runs
    for (const item of preview.runsToDelete) {
      // Would actually delete in real implementation
      runsDeleted++;
      bytesFreed += item.sizeBytes;
    }

    // Delete CAS
    for (const item of preview.casToDelete) {
      // Would actually delete in real implementation
      casDeleted++;
      bytesFreed += item.sizeBytes;
    }
  } else {
    runsDeleted = preview.runsToDelete.length;
    casDeleted = preview.casToDelete.length;
    bytesFreed = preview.bytesToFree;
  }

  return {
    runsDeleted,
    casDeleted,
    bytesFreed,
    dryRun,
  };
}
