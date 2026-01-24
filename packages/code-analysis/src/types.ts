/**
 * Types for code diff analysis
 */

export interface ParsedFile {
  path: string;
  oldPath?: string;
  additions: number;
  deletions: number;
  hunks: ParsedHunk[];
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
  isBinary: boolean;
}

export interface ParsedHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
  changes: HunkChange[];
}

export interface HunkChange {
  type: "add" | "del" | "normal";
  content: string;
  lineNumber: number;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DetectedBug {
  id: string;
  file: string;
  line: number;
  severity: "critical" | "high" | "medium" | "low";
  type: BugType;
  description: string;
  suggestion?: string;
  confidence: number;
  source: "pattern" | "ast" | "typescript" | "llm";
}

export type BugType =
  | "security"
  | "performance"
  | "logic"
  | "memory"
  | "concurrency"
  | "error_handling"
  | "type_safety"
  | "style";

export interface AnalysisResult {
  files: ParsedFile[];
  bugs: DetectedBug[];
  summary: {
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
    bugCount: number;
    bySeverity: Record<DetectedBug["severity"], number>;
  };
}

export interface DiffSource {
  type: "github_pr" | "local_diff" | "raw_diff";
  prNumber?: number;
  prUrl?: string;
  baseBranch?: string;
  headBranch?: string;
  rawDiff?: string;
}
