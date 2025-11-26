import { describe, expect, it } from "bun:test";
import type { SubTask } from "@alfred/agent/orchestrator/multi/decompose";
import {
  appendDecisionLogEntry,
  appendSurpriseEntry,
  applyProgressUpdate,
  generateSubtaskExecPlanSkeleton,
  interpretExecPlan,
  planProgressUpdate,
} from "@alfred/agent/orchestrator/multi/execplan";

describe("execplan.interpretExecPlan", () => {
  it("parses a complete plan", () => {
    const md = `
# My Plan

## Progress

- [x] (2021-01-01) Done

## Surprises & Discoveries

- Found a bug.

## Decision Log

- Decided X.

## Outcomes & Retrospective

- All good.
`;
    const parsed = interpretExecPlan(md);
    expect(parsed.title).toBe("My Plan");
    expect(parsed.progressSection).toContain("- [x] (2021-01-01) Done");
    expect(parsed.surprisesSection).toContain("- Found a bug.");
    expect(parsed.decisionLogSection).toContain("- Decided X.");
    expect(parsed.outcomesSection).toContain("- All good.");
  });

  it("handles missing sections gracefully", () => {
    const md = "# Just Title";
    const parsed = interpretExecPlan(md);
    expect(parsed.title).toBe("Just Title");
    expect(parsed.progressSection).toBe("");
  });
});

describe("execplan.planProgressUpdate", () => {
  it("appends a new entry", () => {
    const existing = "- [ ] Old";
    const updated = planProgressUpdate(existing, {
      timestampIso: "2025-01-01",
      message: "New",
      completed: true,
    });
    expect(updated).toBe("- [ ] Old\n- [x] (2025-01-01) New");
  });

  it("creates first entry if empty", () => {
    const updated = planProgressUpdate("", {
      timestampIso: "2025-01-01",
      message: "First",
      completed: false,
    });
    expect(updated).toBe("- [ ] (2025-01-01) First");
  });
});

describe("execplan.applyProgressUpdate", () => {
  it("injects a new progress line into the markdown section", () => {
    const md = `# Plan

## Progress

- [ ] Old

## Decision Log

- Pending.
`;
    const updated = applyProgressUpdate(md, {
      timestampIso: "2025-02-01",
      message: "New work item",
      completed: false,
    });
    expect(updated).toContain("- [ ] Old");
    expect(updated).toContain("- [ ] (2025-02-01) New work item");
  });

  it("creates a new progress section when missing", () => {
    const md = "# Plan";
    const updated = applyProgressUpdate(md, {
      timestampIso: "2025-03-01",
      message: "Bootstrapped",
      completed: false,
    });
    expect(updated).toContain("## Progress");
    expect(updated).toContain("Bootstrapped");
  });
});

describe("execplan.appendDecisionLogEntry", () => {
  it("adds a decision log line with metadata", () => {
    const md = `# Plan

## Decision Log

- Decision: Existing.
  Rationale: Testing.
  Date/Author: Earlier
`;
    const updated = appendDecisionLogEntry(md, {
      decision: "Auto update",
      rationale: "Runtime captured status",
      author: "runtime",
      dateIso: "2025-02-01",
    });
    expect(updated).toContain("Decision: Auto update");
    expect(updated).toContain("Rationale: Runtime captured status");
    expect(updated).toContain("Date/Author: 2025-02-01 / runtime");
  });

  it("creates a new decision section when missing", () => {
    const updated = appendDecisionLogEntry("# Plan", {
      decision: "Start",
      rationale: "initial",
    });
    expect(updated).toContain("## Decision Log");
    expect(updated).toContain("Decision: Start");
  });
});

describe("execplan.appendSurpriseEntry", () => {
  it("appends an observation block", () => {
    const md = `# Plan

## Surprises & Discoveries

- Observation: None.
`;
    const updated = appendSurpriseEntry(md, {
      observation: "Agent stuck",
      evidence: "Tracker flagged no commands for 60s",
      action: "Escalate",
      dateIso: "2025-02-01",
    });
    expect(updated).toContain("Observation: Agent stuck");
    expect(updated).toContain("Evidence: Tracker flagged no commands for 60s");
    expect(updated).toContain("Action: Escalate");
    expect(updated).toContain("Date: 2025-02-01");
  });

  it("creates surprises section when missing", () => {
    const updated = appendSurpriseEntry("# Plan", {
      observation: "None",
    });
    expect(updated).toContain("## Surprises & Discoveries");
    expect(updated).toContain("Observation: None");
  });
});

describe("execplan.generateSubtaskExecPlanSkeleton", () => {
  it("generates a formatted markdown file", () => {
    const task: SubTask = {
      id: "T1",
      title: "Task 1",
      requirement: "Do something",
      deps: [],
      priority: 1,
      acceptance: ["It works"],
      filesHint: ["src/index.ts"],
    };

    const md = generateSubtaskExecPlanSkeleton(task, "run-123");

    expect(md).toContain("# Task 1 (Run run-123, T1)");
    expect(md).toContain("## Purpose / Big Picture");
    expect(md).toContain("Do something");
    expect(md).toContain("- It works");
    expect(md).toContain("- src/index.ts");
    expect(md).toContain("## Progress");
    expect(md).toContain("- [ ] (pending) Initialised ExecPlan skeleton.");
  });

  it("fills acceptance and file hints when missing", () => {
    const task: SubTask = {
      id: "T2",
      title: "Task 2",
      requirement: "",
      deps: [],
      priority: 0.5,
      acceptance: [],
      filesHint: [],
    };
    const md = generateSubtaskExecPlanSkeleton(task, "run-555");
    expect(md).toContain("Changes implemented and tests passing.");
    expect(md).toContain("See repository root for relevant files.");
  });
});
