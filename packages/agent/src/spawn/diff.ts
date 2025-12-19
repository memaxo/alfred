/**
 * Utilities for parsing poof upper layer changes and applying diffs.
 *
 * Poof uses overlayfs to capture filesystem changes:
 * - Regular files in upper = added or modified files
 * - Character devices (whiteouts) in upper = deleted files
 * - Empty directories in upper = new directories
 */

import {
  accessSync,
  constants as fsConstants,
  cpSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { spawn } from "bun";

/** Type of filesystem change */
export type PoofChangeType = "added" | "modified" | "deleted";

/** A single filesystem change */
export type PoofChange = {
  /** Path relative to the target directory */
  path: string;
  /** Type of change */
  type: PoofChangeType;
  /** Whether this is a directory */
  isDirectory: boolean;
};

/** Summary of changes */
export type PoofChangeSummary = {
  /** Total number of changes */
  total: number;
  /** Number of added files/directories */
  added: number;
  /** Number of modified files */
  modified: number;
  /** Number of deleted files/directories */
  deleted: number;
  /** List of changes */
  changes: PoofChange[];
};

/**
 * Parse the upper layer directory to extract changes.
 *
 * The upper layer contains:
 * - Regular files: Added or modified (check if exists in target)
 * - Character devices: Whiteout markers for deleted files
 * - Directories: Recursively scanned for changes
 */
export async function parseUpperLayer(
  upperDir: string,
  targetDir: string
): Promise<PoofChange[]> {
  const changes: PoofChange[] = [];

  // The upper layer mirrors the filesystem structure
  // Changes to targetDir are in upperDir + targetDir path
  const changesPath = path.join(upperDir, targetDir);

  try {
    accessSync(changesPath, fsConstants.R_OK);
  } catch {
    // No changes to target directory
    return changes;
  }

  await collectChanges(changesPath, targetDir, changesPath, changes);
  return changes;
}

/**
 * Recursively collect changes from the upper layer.
 */
async function collectChanges(
  currentPath: string,
  targetDir: string,
  stripPrefix: string,
  changes: PoofChange[]
): Promise<void> {
  let entries: string[];
  try {
    entries = readdirSync(currentPath);
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry);
    let stats;

    try {
      stats = statSync(fullPath);
    } catch {
      continue;
    }

    // Build display path (relative to target)
    const displayPath = fullPath.startsWith(stripPrefix)
      ? fullPath.slice(stripPrefix.length)
      : fullPath;

    const relativePath = displayPath.startsWith("/")
      ? displayPath.slice(1)
      : displayPath;

    if (stats.isDirectory()) {
      // Check if directory is empty (new dir) or has contents
      let hasChildren = false;
      try {
        const subEntries = readdirSync(fullPath);
        hasChildren = subEntries.length > 0;
      } catch {
        // Treat as empty
      }

      if (hasChildren) {
        // Recurse into subdirectories
        await collectChanges(fullPath, targetDir, stripPrefix, changes);
      } else {
        // Empty directory = new directory
        changes.push({
          path: relativePath,
          type: "added",
          isDirectory: true,
        });
      }
    } else if (stats.isCharacterDevice()) {
      // Whiteout = file was deleted
      changes.push({
        path: relativePath,
        type: "deleted",
        isDirectory: false,
      });
    } else if (stats.isFile()) {
      // Check if file exists in target (modified) or not (added)
      const targetPath = path.join(targetDir, relativePath);
      let existsInTarget = false;
      try {
        accessSync(targetPath, fsConstants.F_OK);
        existsInTarget = true;
      } catch {
        // File does not exist in target
      }

      changes.push({
        path: relativePath,
        type: existsInTarget ? "modified" : "added",
        isDirectory: false,
      });
    }
  }
}

/**
 * Generate a diff summary from changes.
 */
export function summarizeChanges(changes: PoofChange[]): PoofChangeSummary {
  let added = 0;
  let modified = 0;
  let deleted = 0;

  for (const change of changes) {
    switch (change.type) {
      case "added":
        added++;
        break;
      case "modified":
        modified++;
        break;
      case "deleted":
        deleted++;
        break;
    }
  }

  return {
    total: changes.length,
    added,
    modified,
    deleted,
    changes,
  };
}

/**
 * Generate a git-style diff between upper layer and target.
 *
 * Uses `git diff --no-index` for a clean diff output.
 */
export async function generateDiff(
  upperDir: string,
  targetDir: string
): Promise<string> {
  const changesPath = path.join(upperDir, targetDir);

  try {
    accessSync(changesPath, fsConstants.R_OK);
  } catch {
    return "";
  }

  // Use git diff --no-index for clean diff output
  const proc = spawn(
    ["git", "--no-pager", "diff", "--no-index", targetDir, changesPath],
    {
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  const stdout = await new Response(proc.stdout).text();
  await proc.exited;

  // git diff --no-index returns exit code 1 if there are differences
  // which is expected behavior
  return stdout;
}

/**
 * Apply changes from upper layer to target directory.
 *
 * Uses `cp -r -T` to copy the upper layer contents over the target.
 */
export async function applyUpperLayer(
  upperDir: string,
  targetDir: string
): Promise<void> {
  const changesPath = path.join(upperDir, targetDir);

  try {
    accessSync(changesPath, fsConstants.R_OK);
  } catch {
    // No changes to apply
    return;
  }

  // Use cpSync to copy changes
  cpSync(changesPath, targetDir, {
    recursive: true,
    force: true,
    preserveTimestamps: true,
  });
}

/**
 * Discard changes by removing the upper directory.
 */
export function discardUpperLayer(upperDir: string): void {
  rmSync(upperDir, { recursive: true, force: true });
}

/**
 * Format changes as a human-readable string.
 */
export function formatChanges(changes: PoofChange[]): string {
  const lines: string[] = [];

  for (const change of changes) {
    const prefix =
      change.type === "added" ? "+" : change.type === "deleted" ? "-" : "~";

    const suffix = change.isDirectory ? "/" : "";
    lines.push(`${prefix} ${change.path}${suffix}`);
  }

  return lines.join("\n");
}

/**
 * Check if there are any changes in the upper layer.
 */
export async function hasChanges(
  upperDir: string,
  targetDir: string
): Promise<boolean> {
  const changes = await parseUpperLayer(upperDir, targetDir);
  return changes.length > 0;
}
