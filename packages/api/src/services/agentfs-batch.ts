// AgentFS Batch Operations Service
// Bulk operations for managing 100+ runs efficiently

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  BatchDeleteResult,
  BatchExportResult,
  BatchItemResult,
  BatchPinResult,
  BatchUnpinResult,
} from "../agentfs/domain";

import { exportAgentfsRunToCas } from "../agentfscas";

function getAgentfsDir(rootAbs?: string): string {
  return rootAbs
    ? path.join(rootAbs, ".agentfs")
    : path.join(process.cwd(), ".agentfs");
}

export interface BatchDeleteOptions {
  dryRun?: boolean;
  rootAbs?: string;
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

function sanitizeRunId(runId: string): string {
  return runId.replaceAll(/[^a-zA-Z0-9-]/g, "-");
}

function isValidRunId(runId: string): boolean {
  // Run IDs should be alphanumeric with hyphens only
  return (
    /^[a-zA-Z0-9-]+$/.test(runId) && runId.length > 0 && runId.length <= 200
  );
}

export async function batchDelete(
  runIds: string[],
  options: BatchDeleteOptions = {}
): Promise<BatchDeleteResult> {
  const agentfsDir = getAgentfsDir(options.rootAbs);
  const deleted: BatchItemResult[] = [];
  const failed: BatchItemResult[] = [];
  const skippedPinned: string[] = [];
  let bytesFreed = 0;

  for (const runId of runIds) {
    if (!isValidRunId(runId)) {
      failed.push({
        id: runId,
        success: false,
        error: "agentfs_batch_invalid_run_id",
      });
      continue;
    }

    const safeRunId = sanitizeRunId(runId);
    const runDir = path.join(agentfsDir, safeRunId);

    // Safety check: ensure runDir is actually under agentfs
    if (!runDir.startsWith(agentfsDir)) {
      failed.push({
        id: runId,
        success: false,
        error: "agentfs_batch_invalid_path",
      });
      continue;
    }

    // Additional safety: never delete cas or quarantine directories
    if (
      safeRunId === "cas" ||
      safeRunId === "quarantine" ||
      safeRunId.startsWith("cas/") ||
      safeRunId.startsWith("quarantine/")
    ) {
      failed.push({
        id: runId,
        success: false,
        error: "agentfs_batch_protected_directory",
      });
      continue;
    }

    if (!existsSync(runDir)) {
      failed.push({
        id: runId,
        success: false,
        error: "agentfs_batch_run_not_found",
      });
      continue;
    }

    // Check if pinned
    if (existsSync(path.join(runDir, ".keep"))) {
      skippedPinned.push(runId);
      continue;
    }

    // Calculate size before deletion
    const size = await calculateDirSize(runDir);

    if (options.dryRun) {
      bytesFreed += size;
      deleted.push({ id: runId, success: true });
      continue;
    }

    // Actually delete using rm (recursive) instead of unlink
    try {
      await rm(runDir, { recursive: true, force: false });
      bytesFreed += size;
      deleted.push({ id: runId, success: true });
    } catch {
      failed.push({
        id: runId,
        success: false,
        error: "agentfs_batch_delete_failed",
      });
    }
  }

  return { deleted, failed, skippedPinned, bytesFreed };
}

export interface BatchPinOptions {
  rootAbs?: string;
}

export async function batchPin(
  runIds: string[],
  options: BatchPinOptions = {}
): Promise<BatchPinResult> {
  const agentfsDir = getAgentfsDir(options.rootAbs);
  const pinned: string[] = [];
  const alreadyPinned: string[] = [];
  const failed: BatchItemResult[] = [];

  for (const runId of runIds) {
    if (!isValidRunId(runId)) {
      failed.push({
        id: runId,
        success: false,
        error: "agentfs_batch_invalid_run_id",
      });
      continue;
    }

    const safeRunId = sanitizeRunId(runId);
    const runDir = path.join(agentfsDir, safeRunId);
    const keepFile = path.join(runDir, ".keep");

    // Safety check: ensure runDir is under agentfs
    if (!runDir.startsWith(agentfsDir)) {
      failed.push({
        id: runId,
        success: false,
        error: "agentfs_batch_invalid_path",
      });
      continue;
    }

    if (!existsSync(runDir)) {
      failed.push({
        id: runId,
        success: false,
        error: "agentfs_batch_run_not_found",
      });
      continue;
    }

    if (existsSync(keepFile)) {
      alreadyPinned.push(runId);
      continue;
    }

    try {
      await writeFile(keepFile, new Date().toISOString(), "utf8");
      pinned.push(runId);
    } catch {
      failed.push({
        id: runId,
        success: false,
        error: "agentfs_batch_pin_failed",
      });
    }
  }

  return { pinned, alreadyPinned, failed };
}

export interface BatchUnpinOptions {
  rootAbs?: string;
}

export async function batchUnpin(
  runIds: string[],
  options: BatchUnpinOptions = {}
): Promise<BatchUnpinResult> {
  const agentfsDir = getAgentfsDir(options.rootAbs);
  const unpinned: string[] = [];
  const notPinned: string[] = [];
  const failed: BatchItemResult[] = [];

  for (const runId of runIds) {
    if (!isValidRunId(runId)) {
      failed.push({
        id: runId,
        success: false,
        error: "agentfs_batch_invalid_run_id",
      });
      continue;
    }

    const safeRunId = sanitizeRunId(runId);
    const runDir = path.join(agentfsDir, safeRunId);
    const keepFile = path.join(runDir, ".keep");

    // Safety check: ensure runDir is under agentfs
    if (!runDir.startsWith(agentfsDir)) {
      failed.push({
        id: runId,
        success: false,
        error: "agentfs_batch_invalid_path",
      });
      continue;
    }

    if (!existsSync(runDir)) {
      failed.push({
        id: runId,
        success: false,
        error: "agentfs_batch_run_not_found",
      });
      continue;
    }

    if (!existsSync(keepFile)) {
      notPinned.push(runId);
      continue;
    }

    try {
      await unlink(keepFile);
      unpinned.push(runId);
    } catch {
      failed.push({
        id: runId,
        success: false,
        error: "agentfs_batch_unpin_failed",
      });
    }
  }

  return { unpinned, notPinned, failed };
}

export interface BatchExportOptions {
  store?: boolean;
  rootAbs?: string;
  projectId?: string | null;
}

export async function batchExport(
  runIds: string[],
  options: BatchExportOptions = {}
): Promise<BatchExportResult> {
  const agentfsDir = getAgentfsDir(options.rootAbs);
  const archives: { runId: string; sha: string }[] = [];
  const failed: BatchItemResult[] = [];

  for (const runId of runIds) {
    if (!isValidRunId(runId)) {
      failed.push({
        id: runId,
        success: false,
        error: "agentfs_batch_invalid_run_id",
      });
      continue;
    }

    const safeRunId = sanitizeRunId(runId);
    const runDir = path.join(agentfsDir, safeRunId);

    // Safety check: ensure runDir is under agentfs
    if (!runDir.startsWith(agentfsDir)) {
      failed.push({
        id: runId,
        success: false,
        error: "agentfs_batch_invalid_path",
      });
      continue;
    }

    if (!existsSync(runDir)) {
      failed.push({
        id: runId,
        success: false,
        error: "agentfs_batch_run_not_found",
      });
      continue;
    }

    try {
      if (options.store !== false) {
        // Use canonical CAS export from agentfscas.ts
        // agentfsDir already points to .agentfs, so relDir should be just the runId
        const result = await exportAgentfsRunToCas({
          runId: safeRunId,
          relDir: safeRunId,
          rootAbs: agentfsDir,
          projectId: options.projectId,
        });

        archives.push({ runId, sha: result.sha });
      } else {
        // Just calculate hash without storing
        const hash = createHash("sha256");
        const files = await readdir(runDir, { recursive: true });
        for (const f of files.sort()) {
          try {
            const filePath = path.join(runDir, f);
            const s = await stat(filePath);
            if (s.isFile()) {
              const content = await Bun.file(filePath).arrayBuffer();
              hash.update(new Uint8Array(content));
            }
          } catch {
            // Skip files we can't read
          }
        }
        const sha = hash.digest("hex");
        archives.push({ runId, sha });
      }
    } catch {
      failed.push({
        id: runId,
        success: false,
        error: "agentfs_batch_export_failed",
      });
    }
  }

  return { archives, failed };
}
