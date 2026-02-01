// AgentFS Metrics Service
// Storage analytics and metrics collection

import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { RunStorageMetrics, StorageMetrics } from "../agentfs/domain";

function getAgentfsDir(): string {
  return path.join(process.cwd(), ".agentfs");
}

async function calculateDirSize(dirPath: string): Promise<number> {
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

export async function calculateStorageMetrics(): Promise<StorageMetrics> {
  const agentfsDir = getAgentfsDir();

  let runsBytes = 0;
  let casBytes = 0;
  let quarantineBytes = 0;
  const runs: RunStorageMetrics[] = [];
  const byProject = new Map<string, StorageMetrics["byProject"][number]>();

  if (!existsSync(agentfsDir)) {
    return {
      total: { runsBytes: 0, casBytes: 0, quarantineBytes: 0, totalBytes: 0 },
      runs: [],
      cas: { archiveCount: 0, totalBytes: 0, pinnedCount: 0, pinnedBytes: 0 },
      byProject: [],
      computedAt: new Date(),
    };
  }

  const entries = await readdir(agentfsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const fullPath = path.join(agentfsDir, entry.name);

    if (entry.name === "cas") {
      casBytes = await calculateDirSize(fullPath);
    } else if (entry.name === "quarantine") {
      quarantineBytes = await calculateDirSize(fullPath);
    } else {
      // Regular run directory
      const sizeBytes = await calculateDirSize(fullPath);
      runsBytes += sizeBytes;

      // Check for .keep file (pinned)
      const pinned = existsSync(path.join(fullPath, ".keep"));

      // Check for .project file
      let projectId: string | null = null;
      try {
        const projectFile = path.join(fullPath, ".project");
        if (existsSync(projectFile)) {
          projectId = await Bun.file(projectFile).text();
        }
      } catch {
        projectId = null;
      }

      // Check for .retention file
      let retentionDays: number | null = null;
      try {
        const retentionFile = path.join(fullPath, ".retention");
        if (existsSync(retentionFile)) {
          const raw = await Bun.file(retentionFile).text();
          const n = Number.parseInt(raw.trim(), 10);
          if (Number.isFinite(n) && n > 0) {
            retentionDays = n;
          }
        }
      } catch {
        retentionDays = null;
      }

      // Get mtime for age calculation
      let mtime: Date = new Date();
      try {
        const s = await stat(fullPath);
        ({ mtime } = s);
      } catch {
        // Use current time
      }
      const ageDays = Math.floor(
        (Date.now() - mtime.getTime()) / (24 * 60 * 60 * 1000)
      );

      // Count files
      let fileCount = 0;
      try {
        const files = await readdir(fullPath, { recursive: true });
        fileCount = files.length;
      } catch {
        fileCount = 0;
      }

      runs.push({
        runId: entry.name,
        sizeBytes,
        fileCount,
        ageDays,
        pinned,
        projectId,
        retentionDays,
        lastAccessedAt: mtime,
      });

      // Aggregate by project
      if (projectId) {
        const existing = byProject.get(projectId);
        if (existing) {
          byProject.set(projectId, {
            ...existing,
            runsBytes: existing.runsBytes + sizeBytes,
            runCount: existing.runCount + 1,
          });
        } else {
          byProject.set(projectId, {
            projectId,
            runsBytes: sizeBytes,
            casBytes: 0,
            runCount: 1,
            archiveCount: 0,
          });
        }
      }
    }
  }

  // Calculate CAS metrics
  const casDir = path.join(agentfsDir, "cas");
  let archiveCount = 0;
  let pinnedCount = 0;
  let pinnedBytes = 0;

  if (existsSync(casDir)) {
    try {
      const casFiles = await readdir(casDir);
      for (const f of casFiles) {
        if (f.endsWith(".tar.gz")) {
          archiveCount++;
          // Check for .keep file
          const keepFile = path.join(casDir, f.replace(".tar.gz", ".keep"));
          if (existsSync(keepFile)) {
            pinnedCount++;
            try {
              const s = await stat(path.join(casDir, f));
              pinnedBytes += s.size;
            } catch {
              // Ignore
            }
          }
        }
      }
    } catch {
      // CAS directory not accessible
    }
  }

  return {
    total: {
      runsBytes,
      casBytes,
      quarantineBytes,
      totalBytes: runsBytes + casBytes + quarantineBytes,
    },
    runs,
    cas: {
      archiveCount,
      totalBytes: casBytes,
      pinnedCount,
      pinnedBytes,
    },
    byProject: [...byProject.values()],
    computedAt: new Date(),
  };
}

export async function getCasMetrics(): Promise<{
  hits: number;
  misses: number;
  ratio: number;
}> {
  // These would be tracked in a real implementation
  // For now, return placeholder values
  return {
    hits: 0,
    misses: 0,
    ratio: 0,
  };
}
