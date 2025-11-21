import { describe, expect, it } from "bun:test";
import {
  aggregateConflictMarkers,
  countConflictMarkers,
} from "@alfred/agent/orchestrator/multi/conflict";

describe("conflict.countConflictMarkers", () => {
  it("returns 0 for empty content", () => {
    expect(countConflictMarkers("")).toBe(0);
  });

  it("counts standard git conflict markers", () => {
    const content = [
      "<<<<<<< HEAD",
      "some change",
      "=======",
      "other change",
      ">>>>>>> branch",
    ].join("\n");
    expect(countConflictMarkers(content)).toBe(3);
  });

  it("handles multiple conflict blocks", () => {
    const content = [
      "<<<<<<< A",
      "x",
      "=======",
      "y",
      ">>>>>>> B",
      "<<<<<<< C",
      "u",
      "=======",
      "v",
      ">>>>>>> D",
    ].join("\n");
    expect(countConflictMarkers(content)).toBe(6);
  });
});

describe("conflict.aggregateConflictMarkers", () => {
  it("aggregates per-file counts", () => {
    const files = ["a.ts", "b.ts", "c.ts"];
    const counts = { "a.ts": 2, "b.ts": 0, "c.ts": 1 };
    const result = aggregateConflictMarkers(files, counts);
    expect(result.files).toEqual(["a.ts", "c.ts"]);
    expect(result.totalMarkers).toBe(3);
    expect(result.counts).toEqual(counts);
  });
});

describe("conflict.generateConflictExecPlanSkeleton", () => {
  const { generateConflictExecPlanSkeleton } = require("@alfred/agent/orchestrator/multi/conflict");

  it("generates expected markdown structure", () => {
    const result = {
      files: ["conflicted.ts"],
      totalMarkers: 3,
      counts: { "conflicted.ts": 3 },
    };
    const md = generateConflictExecPlanSkeleton("run-conflict", result);

    expect(md).toContain("# Conflict ExecPlan for run run-conflict");
    expect(md).toContain("Total conflict markers detected: 3");
    expect(md).toContain("- conflicted.ts (3 markers)");
    expect(md).toContain("## Plan");
    expect(md).toContain("- [ ] (pending) Conflicts analysed.");
  });
});

