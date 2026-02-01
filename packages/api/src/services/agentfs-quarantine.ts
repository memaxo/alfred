// AgentFS Quarantine Service
// Quarantine lifecycle management API

import { existsSync } from "node:fs";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

import type { QuarantineEntry, QuarantineType } from "../agentfs/domain";

function getAgentfsDir(rootAbs?: string): string {
  return rootAbs
    ? path.join(rootAbs, ".agentfs")
    : path.join(process.cwd(), ".agentfs");
}

function getQuarantineDir(rootAbs?: string): string {
  return path.join(getAgentfsDir(rootAbs), "quarantine");
}

export interface QuarantineListOptions {
  cursor?: string;
  limit?: number;
  type?: QuarantineType;
  rootAbs?: string;
}

interface QuarantineMetadata {
  at: string;
  reason: string;
  runId?: string;
  sha?: string;
  details?: unknown;
}

async function readQuarantineMeta(
  itemDir: string
): Promise<QuarantineMetadata | null> {
  // Integrity scheduler writes quarantine.json, not meta.json
  const quarantinePath = path.join(itemDir, "quarantine.json");
  try {
    const content = await Bun.file(quarantinePath).text();
    return JSON.parse(content) as QuarantineMetadata;
  } catch {
    return null;
  }
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
        // Skip
      }
    }
  } catch {
    // Directory doesn't exist or not accessible
  }
  return total;
}

function isPinned(itemDir: string): boolean {
  return existsSync(path.join(itemDir, ".keep"));
}

export async function listQuarantine(
  options: QuarantineListOptions = {}
): Promise<{ entries: QuarantineEntry[]; nextCursor?: string }> {
  const quarantineDir = getQuarantineDir(options.rootAbs);
  const entries: QuarantineEntry[] = [];

  if (!existsSync(quarantineDir)) {
    return { entries };
  }

  const items = await readdir(quarantineDir, { withFileTypes: true });

  for (const item of items) {
    if (!item.isDirectory()) {
      continue;
    }

    const itemDir = path.join(quarantineDir, item.name);
    const meta = await readQuarantineMeta(itemDir);

    if (!meta) {
      continue;
    }

    // Determine type from metadata
    const type: QuarantineType = meta.sha ? "cas" : "run";

    if (options.type && type !== options.type) {
      continue;
    }

    // Calculate actual size
    const sizeBytes = await calculateDirSize(itemDir);

    // Determine original path
    let originalPath = "";
    if (meta.runId) {
      originalPath = path.join(getAgentfsDir(options.rootAbs), meta.runId);
    } else if (meta.sha) {
      originalPath = path.join(
        getAgentfsDir(options.rootAbs),
        "cas",
        `${meta.sha}.tar.gz`
      );
    }

    entries.push({
      id: meta.runId || meta.sha || item.name,
      type,
      originalPath,
      quarantinePath: itemDir,
      quarantinedAt: new Date(meta.at || Date.now()),
      reason: meta.reason as QuarantineEntry["reason"],
      details: meta.details || {},
      sizeBytes,
      pinned: isPinned(itemDir),
    });
  }

  // Sort by quarantine date (newest first)
  entries.sort((a, b) => b.quarantinedAt.getTime() - a.quarantinedAt.getTime());

  // Apply limit
  const limit = options.limit ?? 100;
  const limited = entries.slice(0, limit);

  return {
    entries: limited,
    nextCursor: entries.length > limit ? String(limit) : undefined,
  };
}

export interface InspectQuarantineOptions {
  rootAbs?: string;
}

export async function inspectQuarantineItem(
  id: string,
  options: InspectQuarantineOptions = {}
): Promise<QuarantineEntry | null> {
  const quarantineDir = getQuarantineDir(options.rootAbs);

  // Find the item directory (it may have a timestamp suffix)
  const items = await readdir(quarantineDir, { withFileTypes: true });
  const itemDirEnt = items.find(
    (item) => item.isDirectory() && item.name.startsWith(id)
  );

  if (!itemDirEnt) {
    return null;
  }

  const itemDir = path.join(quarantineDir, itemDirEnt.name);
  const meta = await readQuarantineMeta(itemDir);

  if (!meta) {
    return null;
  }

  const type: QuarantineType = meta.sha ? "cas" : "run";
  const sizeBytes = await calculateDirSize(itemDir);

  let originalPath = "";
  if (meta.runId) {
    originalPath = path.join(getAgentfsDir(options.rootAbs), meta.runId);
  } else if (meta.sha) {
    originalPath = path.join(
      getAgentfsDir(options.rootAbs),
      "cas",
      `${meta.sha}.tar.gz`
    );
  }

  return {
    id: meta.runId || meta.sha || itemDirEnt.name,
    type,
    originalPath,
    quarantinePath: itemDir,
    quarantinedAt: new Date(meta.at || Date.now()),
    reason: meta.reason as QuarantineEntry["reason"],
    details: meta.details || {},
    sizeBytes,
    pinned: isPinned(itemDir),
  };
}

export interface RestoreQuarantineOptions {
  rootAbs?: string;
}

export async function restoreQuarantineItem(
  id: string,
  options: RestoreQuarantineOptions = {}
): Promise<{ success: boolean; newPath: string; error?: string }> {
  const quarantineDir = getQuarantineDir(options.rootAbs);
  const agentfsDir = getAgentfsDir(options.rootAbs);

  // Find the item directory
  const items = await readdir(quarantineDir, { withFileTypes: true });
  const itemDirEnt = items.find(
    (item) => item.isDirectory() && item.name.startsWith(id)
  );

  if (!itemDirEnt) {
    return {
      success: false,
      newPath: "",
      error: "agentfs_quarantine_not_found",
    };
  }

  const itemDir = path.join(quarantineDir, itemDirEnt.name);
  const meta = await readQuarantineMeta(itemDir);

  if (!meta) {
    return {
      success: false,
      newPath: "",
      error: "agentfs_quarantine_corrupt_metadata",
    };
  }

  // Determine target path - MUST be under .agentfs
  let targetPath: string;

  if (meta.runId) {
    // Restore run to .agentfs/<runId>/
    targetPath = path.join(agentfsDir, meta.runId);
  } else if (meta.sha) {
    // Restore CAS to .agentfs/cas/ directory
    const casDir = path.join(agentfsDir, "cas");
    await mkdir(casDir, { recursive: true });

    // Move files from quarantine/cas/<sha>-<timestamp>/ to cas/
    const quarantinedFiles = await readdir(itemDir);
    for (const file of quarantinedFiles) {
      if (file === "quarantine.json") {
        continue; // Don't restore the quarantine metadata file
      }
      const dstPath = path.join(casDir, file);

      // Check if target already exists
      if (existsSync(dstPath)) {
        return {
          success: false,
          newPath: "",
          error: "agentfs_quarantine_target_exists",
        };
      }
    }

    // Move all files except quarantine.json
    for (const file of quarantinedFiles) {
      if (file === "quarantine.json") {
        continue;
      }
      const srcPath = path.join(itemDir, file);
      const dstPath = path.join(casDir, file);
      await rename(srcPath, dstPath);
    }

    // Remove the now-empty quarantine directory
    await rm(itemDir, { recursive: true, force: true });

    return {
      success: true,
      newPath: casDir,
    };
  } else {
    return {
      success: false,
      newPath: "",
      error: "agentfs_quarantine_no_target",
    };
  }

  // Security check: ensure target is under .agentfs
  if (!targetPath.startsWith(agentfsDir)) {
    return {
      success: false,
      newPath: "",
      error: "agentfs_quarantine_invalid_target",
    };
  }

  // Check if pinned
  if (isPinned(itemDir)) {
    return {
      success: false,
      newPath: "",
      error: "agentfs_quarantine_pinned",
    };
  }

  // Check if target already exists
  if (existsSync(targetPath)) {
    return {
      success: false,
      newPath: "",
      error: "agentfs_quarantine_target_exists",
    };
  }

  try {
    await rename(itemDir, targetPath);
    return { success: true, newPath: targetPath };
  } catch {
    return {
      success: false,
      newPath: "",
      error: "agentfs_quarantine_restore_failed",
    };
  }
}
