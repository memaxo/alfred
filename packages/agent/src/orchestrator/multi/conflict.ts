export interface ConflictScanResult {
  files: string[];
  totalMarkers: number;
  counts: Record<string, number>;
}

const MARKER_PATTERNS = ["<<<<<<<", "=======", ">>>>>>>"];

export function countConflictMarkers(content: string): number {
  if (!content) {
    return 0;
  }
  let count = 0;
  for (const marker of MARKER_PATTERNS) {
    let idx = content.indexOf(marker);
    while (idx !== -1) {
      count += 1;
      idx = content.indexOf(marker, idx + marker.length);
    }
  }
  return count;
}

export function aggregateConflictMarkers(
  files: string[],
  counts: Record<string, number>
): ConflictScanResult {
  const filesWithMarkers: string[] = [];
  let totalMarkers = 0;
  for (const file of files) {
    const n = counts[file] ?? 0;
    if (n > 0) {
      filesWithMarkers.push(file);
      totalMarkers += n;
    }
  }
  return {
    files: filesWithMarkers,
    totalMarkers,
    counts,
  };
}

export function generateConflictExecPlanSkeleton(
  runId: string,
  result: ConflictScanResult
): string {
  const lines: string[] = [];
  lines.push(`# Conflict ExecPlan for run ${runId}`);
  lines.push("");
  lines.push(
    "This ExecPlan documents and analyses merge conflicts detected in the working tree."
  );
  lines.push("");
  lines.push("## Purpose");
  lines.push("");
  lines.push(
    "Understand where conflicts exist, why they happened, and what manual or future automated steps are required to resolve them safely."
  );
  lines.push("");
  lines.push("## Context");
  lines.push("");
  lines.push(
    `Total conflict markers detected: ${result.totalMarkers}. Files with markers: ${result.files.length}.`
  );
  lines.push("");
  if (result.files.length > 0) {
    lines.push("Files with conflict markers:");
    for (const file of result.files) {
      const n = result.counts[file] ?? 0;
      lines.push(`- ${file} (${n} markers)`);
    }
    lines.push("");
  }
  lines.push("## Plan");
  lines.push("");
  lines.push("- For each conflicted file, identify the competing changes.");
  lines.push(
    "- Propose how each conflict should be resolved (which side, or a merge of both)."
  );
  lines.push("- Note any areas requiring manual review or additional tests.");
  lines.push("");
  lines.push("## Progress");
  lines.push("");
  lines.push("- [ ] (pending) Conflicts analysed.");
  lines.push("");
  lines.push("## Surprises & Discoveries");
  lines.push("");
  lines.push("- Pending.");
  lines.push("");
  lines.push("## Decision Log");
  lines.push("");
  lines.push("- Pending.");
  lines.push("");
  lines.push("## Outcomes & Retrospective");
  lines.push("");
  lines.push("- Pending.");
  lines.push("");
  return lines.join("\n");
}
