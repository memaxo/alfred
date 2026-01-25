/**
 * @alfred/code-analysis
 * Code diff parsing and bug detection for ALFRED Reviews
 */

export * from "./detect.js";
export * from "./diff.js";
export * from "./types.js";

import type { AnalysisResult, DiffSource } from "./types.js";

import { detectBugs, getBugSeverityStats } from "./detect.js";
import { getDiffStats, parseDiffString } from "./diff.js";

/**
 * Analyze a diff and detect potential bugs
 */
export async function analyzeDiff(source: DiffSource): Promise<AnalysisResult> {
  let diffContent: string;

  if (source.type === "raw_diff" && source.rawDiff) {
    diffContent = source.rawDiff;
  } else if (source.type === "github_pr" && source.prUrl) {
    // TODO: Implement GitHub PR fetching
    throw new Error("GitHub PR fetching not yet implemented");
  } else if (source.type === "local_diff") {
    // TODO: Implement local git diff
    throw new Error("Local diff not yet implemented");
  } else {
    throw new Error("Invalid diff source");
  }

  const files = parseDiffString(diffContent);
  const bugs = detectBugs(files);
  const stats = getDiffStats(files);
  const severityStats = getBugSeverityStats(bugs);

  return {
    bugs,
    files,
    summary: {
      totalFiles: stats.totalFiles,
      totalAdditions: stats.totalAdditions,
      totalDeletions: stats.totalDeletions,
      bugCount: bugs.length,
      bySeverity: severityStats,
    },
  };
}

/**
 * Quick analysis for badge display
 */
export function quickAnalyze(diffContent: string): {
  fileCount: number;
  bugCount: number;
  criticalCount: number;
} {
  const files = parseDiffString(diffContent);
  const bugs = detectBugs(files);

  return {
    bugCount: bugs.length,
    criticalCount: bugs.filter((b) => b.severity === "critical").length,
    fileCount: files.length,
  };
}
