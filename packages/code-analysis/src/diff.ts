/**
 * Diff parsing utilities
 * Converts unified diff format into structured data for review UI
 */

import parseDiff from "parse-diff";

import type { HunkChange, ParsedFile, ParsedHunk } from "./types.js";

/**
 * Parse a unified diff string into structured file and hunk data
 */
export function parseDiffString(diffContent: string): ParsedFile[] {
  const parsed = parseDiff(diffContent);

  return parsed.map(
    (file): ParsedFile => ({
      additions: file.additions,
      deletions: file.deletions,
      hunks: file.chunks.map(convertChunk),
      isBinary: (file as { binary?: boolean }).binary ?? false,
      isDeleted: file.deleted ?? false,
      isNew: file.new ?? false,
      isRenamed: file.from !== file.to && !file.new && !file.deleted,
      oldPath: file.from !== file.to ? (file.from ?? undefined) : undefined,
      path: file.to ?? file.from ?? "unknown",
    })
  );
}

function convertChunk(chunk: parseDiff.Chunk): ParsedHunk {
  return {
    changes: chunk.changes.map(convertChange),
    content: chunk.content,
    newLines: chunk.newLines,
    newStart: chunk.newStart,
    oldLines: chunk.oldLines,
    oldStart: chunk.oldStart,
  };
}

function convertChange(change: parseDiff.Change): HunkChange {
  const base = {
    content: change.content,
  };

  if (change.type === "add") {
    return {
      ...base,
      type: "add",
      lineNumber: change.ln,
      newLineNumber: change.ln,
    };
  }
  if (change.type === "del") {
    return {
      ...base,
      type: "del",
      lineNumber: change.ln,
      oldLineNumber: change.ln,
    };
  }
  return {
    ...base,
    type: "normal",
    lineNumber: change.ln1 ?? change.ln2 ?? 0,
    oldLineNumber: change.ln1,
    newLineNumber: change.ln2,
  };
}

/**
 * Get file extension from path
 */
export function getFileExtension(filePath: string): string {
  const parts = filePath.split(".");
  return parts.length > 1 ? (parts.at(-1) ?? "") : "";
}

/**
 * Group files by directory for hierarchical display
 */
export function groupFilesByDirectory(
  files: ParsedFile[]
): Map<string, ParsedFile[]> {
  const grouped = new Map<string, ParsedFile[]>();

  for (const file of files) {
    const parts = file.path.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";

    if (!grouped.has(dir)) {
      grouped.set(dir, []);
    }
    grouped.get(dir)!.push(file);
  }

  return grouped;
}

/**
 * Get summary statistics for a diff
 */
export function getDiffStats(files: ParsedFile[]): {
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  newFiles: number;
  deletedFiles: number;
  modifiedFiles: number;
} {
  return {
    deletedFiles: files.filter((f) => f.isDeleted).length,
    modifiedFiles: files.filter((f) => !(f.isNew || f.isDeleted)).length,
    newFiles: files.filter((f) => f.isNew).length,
    totalAdditions: files.reduce((sum, f) => sum + f.additions, 0),
    totalDeletions: files.reduce((sum, f) => sum + f.deletions, 0),
    totalFiles: files.length,
  };
}

/**
 * Categorize files by type for the review UI
 */
export function categorizeFiles(files: ParsedFile[]): {
  source: ParsedFile[];
  tests: ParsedFile[];
  config: ParsedFile[];
  docs: ParsedFile[];
  other: ParsedFile[];
} {
  const result = {
    config: [] as ParsedFile[],
    docs: [] as ParsedFile[],
    other: [] as ParsedFile[],
    source: [] as ParsedFile[],
    tests: [] as ParsedFile[],
  };

  for (const file of files) {
    const path = file.path.toLowerCase();
    const ext = getFileExtension(path);

    if (
      path.includes("test") ||
      path.includes("spec") ||
      path.includes("__tests__")
    ) {
      result.tests.push(file);
    } else if (["md", "txt", "rst", "adoc"].includes(ext)) {
      result.docs.push(file);
    } else if (
      ["json", "yaml", "yml", "toml", "ini", "env"].includes(ext) ||
      path.includes("config") ||
      path.includes(".rc")
    ) {
      result.config.push(file);
    } else if (
      [
        "ts",
        "tsx",
        "js",
        "jsx",
        "py",
        "rs",
        "go",
        "java",
        "kt",
        "swift",
      ].includes(ext)
    ) {
      result.source.push(file);
    } else {
      result.other.push(file);
    }
  }

  return result;
}
