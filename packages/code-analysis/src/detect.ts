/**
 * Bug detection utilities
 * Pattern-based detection for common issues in code diffs
 */

import { type DetectedBug, type ParsedFile } from "./types.js";

let bugIdCounter = 0;
function generateBugId(): string {
  return `bug-${++bugIdCounter}-${Date.now().toString(36)}`;
}

/**
 * Pattern definitions for common bugs
 */
interface BugPattern {
  name: string;
  regex: RegExp;
  severity: DetectedBug["severity"];
  type: DetectedBug["type"];
  description: string;
  suggestion?: string;
  fileExtensions?: string[];
}

const BUG_PATTERNS: BugPattern[] = [
  // Security issues
  {
    description: "Hardcoded secret or API key detected",
    name: "hardcoded_secret",
    regex: /(api[_-]?key|secret|password|token)\s*[=:]\s*['"][^'"]+['"]/i,
    severity: "critical",
    suggestion: "Use environment variables or a secrets manager",
    type: "security",
  },
  {
    description: "Potential SQL injection vulnerability",
    name: "sql_injection",
    regex: /\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE|DROP)/i,
    severity: "critical",
    suggestion: "Use parameterized queries instead of string interpolation",
    type: "security",
  },
  {
    description: "Use of eval() detected",
    fileExtensions: ["js", "ts", "jsx", "tsx"],
    name: "eval_usage",
    regex: /\beval\s*\(/,
    severity: "high",
    suggestion: "Avoid eval() as it can execute arbitrary code",
    type: "security",
  },

  // Error handling
  {
    description: "Empty catch block swallows errors",
    fileExtensions: ["js", "ts", "jsx", "tsx", "java", "kt"],
    name: "empty_catch",
    regex: /catch\s*\([^)]*\)\s*\{\s*\}/,
    severity: "medium",
    suggestion: "Log the error or handle it appropriately",
    type: "error_handling",
  },
  {
    description: "Catch block only logs error without proper handling",
    fileExtensions: ["js", "ts", "jsx", "tsx"],
    name: "console_error_only",
    regex: /catch.*\{[^}]*console\.(log|error)[^}]*\}/s,
    severity: "low",
    suggestion: "Consider re-throwing or implementing error recovery",
    type: "error_handling",
  },

  // Performance issues
  {
    description: "Potential N+1 query pattern in loop",
    fileExtensions: ["js", "ts", "jsx", "tsx"],
    name: "n_plus_one_potential",
    regex: /for\s*\([^)]+\)[^{]*\{[^}]*await\s+/,
    severity: "medium",
    suggestion: "Consider batching operations or using Promise.all",
    type: "performance",
  },
  {
    description: "Synchronous file operation blocks event loop",
    fileExtensions: ["js", "ts"],
    name: "sync_file_operation",
    regex: /\b(readFileSync|writeFileSync|existsSync)\b/,
    severity: "medium",
    suggestion: "Use async versions or move to worker thread",
    type: "performance",
  },

  // Logic issues
  {
    description: "Assignment in conditional expression",
    fileExtensions: ["js", "ts", "jsx", "tsx", "c", "cpp", "java"],
    name: "assignment_in_condition",
    regex: /if\s*\([^=]*[^=!<>]=[^=][^)]*\)/,
    severity: "medium",
    suggestion: "Use comparison (==, ===) instead of assignment (=)",
    type: "logic",
  },
  {
    description: "Condition is always true",
    name: "always_true_condition",
    regex: /if\s*\(\s*(true|1)\s*\)/,
    severity: "low",
    suggestion: "Remove the condition or fix the logic",
    type: "logic",
  },

  // Type safety
  {
    description: 'Use of "any" type reduces type safety',
    fileExtensions: ["ts", "tsx"],
    name: "any_type_usage",
    regex: /:\s*any\b/,
    severity: "low",
    suggestion: "Use a more specific type or unknown",
    type: "type_safety",
  },
  {
    description: "TypeScript error suppression",
    fileExtensions: ["ts", "tsx"],
    name: "ts_ignore",
    regex: /@ts-(ignore|nocheck)/,
    severity: "low",
    suggestion: "Fix the underlying type error instead of suppressing",
    type: "type_safety",
  },

  // Memory issues
  {
    description: "Event listener without corresponding removal",
    fileExtensions: ["js", "ts", "jsx", "tsx"],
    name: "event_listener_leak",
    regex: /addEventListener\([^)]+\)(?!.*removeEventListener)/,
    severity: "medium",
    suggestion: "Add cleanup in useEffect return or componentWillUnmount",
    type: "memory",
  },

  // Concurrency issues
  {
    description: "Potential race condition with shared state",
    fileExtensions: ["js", "ts", "jsx", "tsx"],
    name: "race_condition_potential",
    regex: /let\s+\w+\s*=.*\n.*await\s+.*\n.*\w+\s*=/,
    severity: "medium",
    suggestion: "Use locks or atomic operations",
    type: "concurrency",
  },
];

/**
 * Detect bugs in a single file's changes
 */
export function detectBugsInFile(file: ParsedFile): DetectedBug[] {
  const bugs: DetectedBug[] = [];
  const ext = file.path.split(".").pop() ?? "";

  for (const hunk of file.hunks) {
    for (const change of hunk.changes) {
      // Only check added lines
      if (change.type !== "add") {
        continue;
      }

      for (const pattern of BUG_PATTERNS) {
        // Skip if pattern doesn't apply to this file type
        if (pattern.fileExtensions && !pattern.fileExtensions.includes(ext)) {
          continue;
        }

        if (pattern.regex.test(change.content)) {
          bugs.push({
            id: generateBugId(),
            file: file.path,
            line: change.lineNumber,
            severity: pattern.severity,
            type: pattern.type,
            description: pattern.description,
            suggestion: pattern.suggestion,
            confidence: 0.7, // Pattern matching has moderate confidence
            source: "pattern",
          });
        }
      }
    }
  }

  return bugs;
}

/**
 * Detect bugs across all files in a diff
 */
export function detectBugs(files: ParsedFile[]): DetectedBug[] {
  const allBugs: DetectedBug[] = [];

  for (const file of files) {
    if (file.isBinary) {
      continue;
    }
    allBugs.push(...detectBugsInFile(file));
  }

  // Sort by severity (critical first)
  const severityOrder: Record<DetectedBug["severity"], number> = {
    critical: 0,
    high: 1,
    low: 3,
    medium: 2,
  };

  allBugs.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return allBugs;
}

/**
 * Get bug severity statistics
 */
export function getBugSeverityStats(
  bugs: DetectedBug[]
): Record<DetectedBug["severity"], number> {
  return {
    critical: bugs.filter((b) => b.severity === "critical").length,
    high: bugs.filter((b) => b.severity === "high").length,
    low: bugs.filter((b) => b.severity === "low").length,
    medium: bugs.filter((b) => b.severity === "medium").length,
  };
}

/**
 * Filter bugs by severity threshold
 */
export function filterBugsBySeverity(
  bugs: DetectedBug[],
  minSeverity: DetectedBug["severity"]
): DetectedBug[] {
  const severityOrder: Record<DetectedBug["severity"], number> = {
    critical: 0,
    high: 1,
    low: 3,
    medium: 2,
  };

  const threshold = severityOrder[minSeverity];
  return bugs.filter((b) => severityOrder[b.severity] <= threshold);
}
