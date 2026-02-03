// AgentFS CAS Management Service
// Content-addressed storage lifecycle

import { existsSync } from "node:fs";
import { readdir, unlink } from "node:fs/promises";
import path from "node:path";

import type { CasArchiveInfo, CasListResult } from "../agentfs/domain";

import { readAgentfsCasMeta } from "../agentfscas";

function getCasDir(): string {
  return path.join(process.cwd(), ".agentfs", "cas");
}

async function readCasMetadata(
  sha: string,
  rootAbs?: string
): Promise<CasArchiveInfo | null> {
  const meta = await readAgentfsCasMeta({ sha, rootAbs });
  if (!meta) {
    return null;
  }

  // Check for .keep file to determine pinned status (scheduler convention)
  const casDir = rootAbs
    ? path.join(rootAbs, "cas")
    : path.join(process.cwd(), ".agentfs", "cas");
  const isPinned = existsSync(path.join(casDir, `${sha}.keep`));

  return {
    sha: meta.sha,
    runId: meta.runId,
    sizeBytes: meta.sizeBytes,
    createdAt: new Date(meta.createdAt),
    lastAccessedAt: meta.lastAccessedAt ? new Date(meta.lastAccessedAt) : null,
    pinned: isPinned,
    projectId: meta.projectId,
    metadata: {},
  };
}

function isPinned(sha: string, rootAbs?: string): boolean {
  const casDir = rootAbs
    ? path.join(rootAbs, "cas")
    : path.join(process.cwd(), ".agentfs", "cas");
  return existsSync(path.join(casDir, `${sha}.keep`));
}

export interface CasListOptions {
  cursor?: string;
  projectId?: string;
  runId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  rootAbs?: string;
}

export async function listCasArchives(
  options: CasListOptions = {}
): Promise<CasListResult> {
  const casDir = options.rootAbs
    ? path.join(options.rootAbs, "cas")
    : getCasDir();
  const archives: CasArchiveInfo[] = [];

  if (!existsSync(casDir)) {
    return { archives };
  }

  const entries = await readdir(casDir);
  const shaList = entries
    .filter((e) => e.endsWith(".json"))
    .map((e) => e.replace(".json", ""));

  for (const sha of shaList) {
    const meta = await readCasMetadata(sha, options.rootAbs);
    if (!meta) {
      continue;
    }

    // Apply filters
    if (options.projectId && meta.projectId !== options.projectId) {
      continue;
    }
    if (options.runId && meta.runId !== options.runId) {
      continue;
    }
    if (options.from && meta.createdAt < options.from) {
      continue;
    }
    if (options.to && meta.createdAt > options.to) {
      continue;
    }

    archives.push(meta);
  }

  // Sort by creation date (newest first), tie-break by sha (desc) for stable cursoring.
  archives.sort((a, b) => {
    const t = b.createdAt.getTime() - a.createdAt.getTime();
    if (t !== 0) {
      return t;
    }
    return b.sha.localeCompare(a.sha);
  });

  // Apply limit
  const limit = options.limit ?? 100;
  const cursor = options.cursor ? parseCasCursor(options.cursor) : null;
  const filtered = cursor
    ? archives.filter((a) => isAfterCasCursor(a, cursor))
    : archives;
  const limited = filtered.slice(0, limit);

  return {
    archives: limited,
    nextCursor:
      filtered.length > limit
        ? formatCasCursor(limited.at(-1) ?? null)
        : undefined,
  };
}

function parseCasCursor(
  cursor: string
): { createdAtMs: number; sha: string } | null {
  const [tsRaw, sha] = cursor.split(":", 2);
  if (!tsRaw || !sha) {
    return null;
  }
  const createdAtMs = Number(tsRaw);
  if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) {
    return null;
  }
  if (!/^[a-f0-9]{64}$/i.test(sha)) {
    return null;
  }
  return { createdAtMs, sha: sha.toLowerCase() };
}

function formatCasCursor(item: CasArchiveInfo | null): string | undefined {
  if (!item) {
    return undefined;
  }
  return `${item.createdAt.getTime()}:${item.sha}`;
}

function isAfterCasCursor(
  item: CasArchiveInfo,
  cursor: { createdAtMs: number; sha: string }
): boolean {
  const t = item.createdAt.getTime();
  if (t < cursor.createdAtMs) {
    return true;
  }
  if (t > cursor.createdAtMs) {
    return false;
  }
  // Same timestamp: we sort sha desc, so "after" means smaller sha.
  return item.sha < cursor.sha;
}

export interface GetCasMetadataOptions {
  rootAbs?: string;
}

export async function getCasMetadata(
  sha: string,
  options: GetCasMetadataOptions = {}
): Promise<CasArchiveInfo | null> {
  return readCasMetadata(sha, options.rootAbs);
}

export interface DeleteCasArchiveOptions {
  rootAbs?: string;
}

export async function deleteCasArchive(
  sha: string,
  options: DeleteCasArchiveOptions = {}
): Promise<{ success: boolean; newPath: string; error?: string }> {
  const casDir = options.rootAbs
    ? path.join(options.rootAbs, "cas")
    : getCasDir();
  const metaPath = path.join(casDir, `${sha}.json`);
  const dataPath = path.join(casDir, `${sha}.tar.gz`);
  const keepPath = path.join(casDir, `${sha}.keep`);

  // Check if archive exists
  const metaExists = existsSync(metaPath);
  const dataExists = existsSync(dataPath);

  if (!metaExists && !dataExists) {
    return {
      success: false,
      newPath: "",
      error: "agentfs_cas_archive_not_found",
    };
  }

  // Check if pinned using .keep file convention
  if (existsSync(keepPath)) {
    return {
      success: false,
      newPath: "",
      error: "agentfs_cas_archive_pinned",
    };
  }

  // Delete files
  try {
    if (metaExists) {
      await unlink(metaPath);
    }
    if (dataExists) {
      await unlink(dataPath);
    }
    return { success: true, newPath: "" };
  } catch {
    return {
      success: false,
      newPath: "",
      error: "agentfs_cas_delete_failed",
    };
  }
}

export async function getCasStorageStats(): Promise<{
  totalArchives: number;
  totalBytes: number;
  averageSize: number;
  largestArchive: { sha: string; sizeBytes: number } | null;
  oldestArchive: { sha: string; createdAt: Date } | null;
}> {
  const { archives } = await listCasArchives({ limit: 10_000 });

  if (archives.length === 0) {
    return {
      totalArchives: 0,
      totalBytes: 0,
      averageSize: 0,
      largestArchive: null,
      oldestArchive: null,
    };
  }

  const totalBytes = archives.reduce((sum, a) => sum + a.sizeBytes, 0);
  const largest = archives.reduce((max, a) =>
    a.sizeBytes > max.sizeBytes ? a : max
  );
  const oldest = archives.reduce((old, a) =>
    a.createdAt < old.createdAt ? a : old
  );

  return {
    totalArchives: archives.length,
    totalBytes,
    averageSize: Math.floor(totalBytes / archives.length),
    largestArchive: { sha: largest.sha, sizeBytes: largest.sizeBytes },
    oldestArchive: { sha: oldest.sha, createdAt: oldest.createdAt },
  };
}

export interface CleanupOrphanedCasOptions {
  rootAbs?: string;
}

export async function cleanupOrphanedCas(
  options: CleanupOrphanedCasOptions = {}
): Promise<{
  scanned: number;
  orphaned: number;
  bytesRecovered: number;
}> {
  const casDir = options.rootAbs
    ? path.join(options.rootAbs, "cas")
    : getCasDir();
  let scanned = 0;
  let orphaned = 0;
  let bytesRecovered = 0;

  if (!existsSync(casDir)) {
    return { scanned, orphaned, bytesRecovered };
  }

  const entries = await readdir(casDir);
  const shaList = entries
    .filter((e) => e.endsWith(".json"))
    .map((e) => e.replace(".json", ""));

  for (const sha of shaList) {
    scanned++;
    const meta = await readCasMetadata(sha, options.rootAbs);

    // Skip pinned archives
    if (isPinned(sha, options.rootAbs)) {
      continue;
    }

    // Check for orphan: metadata exists but data file doesn't
    const dataPath = path.join(casDir, `${sha}.tar.gz`);
    const hasData = existsSync(dataPath);

    if (meta && !hasData) {
      // Orphan: metadata without data
      const result = await deleteCasArchive(sha, { rootAbs: options.rootAbs });
      if (result.success) {
        orphaned++;
        bytesRecovered += meta.sizeBytes;
      }
    }
  }

  return { scanned, orphaned, bytesRecovered };
}
