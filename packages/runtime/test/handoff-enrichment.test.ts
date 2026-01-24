/**
 * Unit tests for structured handoff building and formatting.
 *
 * Tests buildStructuredHandoff, formatStructuredHandoffPrompt, and helper functions.
 */

import { type FailureContext, type StructuredHandoff } from "@alfred/type";
import { beforeEach, describe, expect, it, mock, vi } from "bun:test";

import { type AgentOutcome } from "../src/orchestrator/agent";

// Mock file change detection
mock.module("../src/orchestrator/changes.js", () => ({
  detectFileChanges: vi.fn().mockResolvedValue({
    created: ["src/new-feature.ts"],
    deleted: [],
    modified: ["src/app.ts", "src/utils.ts"],
  }),
  getGitDiffSummary: vi.fn().mockResolvedValue("+ 100 lines, - 20 lines"),
}));

// Mock summary generation
mock.module("../src/orchestrator/summary.js", () => ({
  generateWaveSummary: vi
    .fn()
    .mockResolvedValue("Wave completed with 2 successful tasks"),
}));

// Import after mocks
const { buildStructuredHandoff, formatStructuredHandoffPrompt } =
  await import("../src/orchestrator/handoff.js");

// Test fixtures
function createOutcome(overrides: Partial<AgentOutcome> = {}): AgentOutcome {
  return {
    agentId: "run-123:task-1",
    stuck: false,
    status: "success",
    durationSeconds: 30,
    role: "codex",
    result: {
      artifacts: [],
      changes: ["src/app.ts"],
      notes: [],
      summary: "Task completed",
    },
    ...overrides,
  };
}

function createFailureContext(
  overrides: Partial<FailureContext> = {}
): FailureContext {
  return {
    taskId: "task-1",
    runId: "run-123",
    status: "failure",
    toolErrors: [],
    loopDetections: [],
    escalations: [],
    reviewFailures: [],
    durationMs: 5000,
    ts: Date.now(),
    ...overrides,
  };
}

describe("Handoff Enrichment", () => {
  describe("buildStructuredHandoff", () => {
    it("should build handoff with file changes", async () => {
      const outcomes = [createOutcome()];

      const handoff = await buildStructuredHandoff(
        "wave-1",
        "wave-2",
        outcomes,
        "/workspace"
      );

      expect(handoff.fromWaveId).toBe("wave-1");
      expect(handoff.filesModified).toContain("src/app.ts");
      expect(handoff.filesCreated).toContain("src/new-feature.ts");
      expect(handoff.filesDeleted).toEqual([]);
    });

    it("should extract task IDs from agent IDs", async () => {
      const outcomes = [
        createOutcome({ agentId: "run-123:task-1" }),
        createOutcome({ agentId: "run-123:task-2" }),
      ];

      const handoff = await buildStructuredHandoff(
        "wave-1",
        "wave-2",
        outcomes,
        "/workspace"
      );

      expect(handoff.fromTaskIds).toContain("task-1");
      expect(handoff.fromTaskIds).toContain("task-2");
    });

    it("should extract decisions from outcome notes", async () => {
      const outcomes = [
        createOutcome({
          result: {
            artifacts: [],
            changes: [],
            notes: [
              "DECISION:Use TypeScript|Better type safety for the codebase",
              "DECISION:Use Jest|Industry standard testing framework",
            ],
            summary: "Task done",
          },
        }),
      ];

      const handoff = await buildStructuredHandoff(
        "wave-1",
        "wave-2",
        outcomes,
        "/workspace"
      );

      expect(handoff.decisions).toHaveLength(2);
      expect(handoff.decisions[0].decision).toBe("Use TypeScript");
      expect(handoff.decisions[0].rationale).toBe(
        "Better type safety for the codebase"
      );
    });

    it("should extract tools to avoid from failure contexts", async () => {
      const outcomes = [
        createOutcome({
          failureContext: createFailureContext({
            toolErrors: [
              {
                tool: "shell",
                error: "Permission denied",
                count: 3,
                lastOccurrence: Date.now(),
              },
              {
                tool: "write",
                error: "Disk full",
                count: 2,
                lastOccurrence: Date.now(),
              },
              {
                tool: "read",
                error: "File not found",
                count: 1,
                lastOccurrence: Date.now(),
              },
            ],
          }),
          status: "failure",
        }),
      ];

      const handoff = await buildStructuredHandoff(
        "wave-1",
        "wave-2",
        outcomes,
        "/workspace"
      );

      // Only tools with count >= 2 should be included
      expect(handoff.toolsAvoided).toHaveLength(2);
      expect(
        handoff.toolsAvoided.find((t) => t.tool === "shell")
      ).toBeDefined();
      expect(
        handoff.toolsAvoided.find((t) => t.tool === "write")
      ).toBeDefined();
      expect(
        handoff.toolsAvoided.find((t) => t.tool === "read")
      ).toBeUndefined();
    });

    it("should deduplicate tools to avoid", async () => {
      const outcomes = [
        createOutcome({
          failureContext: createFailureContext({
            toolErrors: [
              {
                tool: "shell",
                error: "Error 1",
                count: 3,
                lastOccurrence: Date.now(),
              },
            ],
          }),
          status: "failure",
        }),
        createOutcome({
          failureContext: createFailureContext({
            toolErrors: [
              {
                tool: "shell",
                error: "Error 2",
                count: 5,
                lastOccurrence: Date.now(),
              },
            ],
          }),
          status: "failure",
        }),
      ];

      const handoff = await buildStructuredHandoff(
        "wave-1",
        "wave-2",
        outcomes,
        "/workspace"
      );

      // Should only have one entry for shell
      const shellEntries = handoff.toolsAvoided.filter(
        (t) => t.tool === "shell"
      );
      expect(shellEntries).toHaveLength(1);
    });

    it("should extract blockers from failed outcomes", async () => {
      const outcomes = [
        createOutcome({
          agentId: "run-123:auth-task",
          escalation: "Database connection failed",
          status: "failure",
        }),
        createOutcome({
          agentId: "run-123:stuck-task",
          status: "stuck",
          stuck: true,
        }),
      ];

      const handoff = await buildStructuredHandoff(
        "wave-1",
        "wave-2",
        outcomes,
        "/workspace"
      );

      expect(handoff.blockers).toHaveLength(2);
      expect(handoff.blockers.some((b) => b.includes("auth-task"))).toBe(true);
      expect(
        handoff.blockers.some((b) => b.includes("Database connection"))
      ).toBe(true);
      expect(handoff.blockers.some((b) => b.includes("stuck-task"))).toBe(true);
    });

    it("should include stuck reason in blockers", async () => {
      // Note: When stuck=true, the implementation uses generic "Agent stuck" message
      // stuckReason is only used when stuck=false but failureContext has stuckReason
      const outcomes = [
        createOutcome({
          agentId: "run-123:loop-task",
          status: "stuck",
          stuck: false, // Set to false so stuckReason is used instead of generic message
          failureContext: createFailureContext({
            stuckReason: "Detected repeated tool invocation pattern",
          }),
        }),
      ];

      const handoff = await buildStructuredHandoff(
        "wave-1",
        "wave-2",
        outcomes,
        "/workspace"
      );

      expect(handoff.blockers[0]).toContain("repeated tool invocation");
    });

    it("should have timestamp", async () => {
      const before = Date.now();
      const outcomes = [createOutcome()];

      const handoff = await buildStructuredHandoff(
        "wave-1",
        "wave-2",
        outcomes,
        "/workspace"
      );

      const after = Date.now();
      expect(handoff.ts).toBeGreaterThanOrEqual(before);
      expect(handoff.ts).toBeLessThanOrEqual(after);
    });

    it("should handle outcomes without failure context", async () => {
      const outcomes = [
        createOutcome({ status: "success" }),
        createOutcome({ status: "success" }),
      ];

      const handoff = await buildStructuredHandoff(
        "wave-1",
        "wave-2",
        outcomes,
        "/workspace"
      );

      expect(handoff.toolsAvoided).toEqual([]);
      expect(handoff.blockers).toEqual([]);
    });
  });

  describe("formatStructuredHandoffPrompt", () => {
    it("should format basic handoff information", () => {
      const handoff: StructuredHandoff = {
        blockers: [],
        decisions: [],
        filesCreated: ["src/new.ts"],
        filesDeleted: ["src/old.ts"],
        filesModified: ["src/app.ts"],
        fromTaskIds: ["task-1", "task-2"],
        fromWaveId: "wave-1",
        openQuestions: [],
        summary: "Wave 1 completed successfully",
        toolsAvoided: [],
        ts: Date.now(),
      };

      const prompt = formatStructuredHandoffPrompt(handoff);

      expect(prompt).toContain("PREVIOUS WAVE ACCOMPLISHMENTS");
      expect(prompt).toContain("wave-1");
      expect(prompt).toContain("Wave 1 completed successfully");
      expect(prompt).toContain("src/app.ts");
      expect(prompt).toContain("src/new.ts");
      expect(prompt).toContain("src/old.ts");
    });

    it("should include decisions section when present", () => {
      const handoff: StructuredHandoff = {
        blockers: [],
        decisions: [
          { decision: "Use React", rationale: "Better ecosystem" },
          { decision: "Use TypeScript", rationale: "Type safety" },
        ],
        filesCreated: [],
        filesDeleted: [],
        filesModified: [],
        fromTaskIds: [],
        fromWaveId: "wave-1",
        openQuestions: [],
        summary: "Wave completed",
        toolsAvoided: [],
        ts: Date.now(),
      };

      const prompt = formatStructuredHandoffPrompt(handoff);

      expect(prompt).toContain("Decisions Made:");
      expect(prompt).toContain("Use React");
      expect(prompt).toContain("Better ecosystem");
      expect(prompt).toContain("Use TypeScript");
    });

    it("should include tools to avoid section when present", () => {
      const handoff: StructuredHandoff = {
        blockers: [],
        decisions: [],
        filesCreated: [],
        filesDeleted: [],
        filesModified: [],
        fromTaskIds: [],
        fromWaveId: "wave-1",
        openQuestions: [],
        summary: "Wave completed",
        toolsAvoided: [
          { tool: "shell", reason: "Failed 5 times: Permission denied" },
          { tool: "rm", reason: "Destructive operation blocked" },
        ],
        ts: Date.now(),
      };

      const prompt = formatStructuredHandoffPrompt(handoff);

      expect(prompt).toContain("Tools to Avoid:");
      expect(prompt).toContain("shell");
      expect(prompt).toContain("Permission denied");
      expect(prompt).toContain("rm");
    });

    it("should include blockers section when present", () => {
      const handoff: StructuredHandoff = {
        blockers: [
          "Task auth-task: Database connection timeout",
          "Task api-task: Rate limit exceeded",
        ],
        decisions: [],
        filesCreated: [],
        filesDeleted: [],
        filesModified: [],
        fromTaskIds: [],
        fromWaveId: "wave-1",
        openQuestions: [],
        summary: "Wave completed with issues",
        toolsAvoided: [],
        ts: Date.now(),
      };

      const prompt = formatStructuredHandoffPrompt(handoff);

      expect(prompt).toContain("Known Blockers:");
      expect(prompt).toContain("auth-task");
      expect(prompt).toContain("Database connection timeout");
      expect(prompt).toContain("api-task");
    });

    it("should show None for empty file lists", () => {
      const handoff: StructuredHandoff = {
        blockers: [],
        decisions: [],
        filesCreated: [],
        filesDeleted: [],
        filesModified: [],
        fromTaskIds: [],
        fromWaveId: "wave-1",
        openQuestions: [],
        summary: "Wave completed",
        toolsAvoided: [],
        ts: Date.now(),
      };

      const prompt = formatStructuredHandoffPrompt(handoff);

      expect(prompt).toContain("Files Modified: None");
      expect(prompt).toContain("Files Created: None");
      expect(prompt).toContain("Files Deleted: None");
    });

    it("should not include optional sections when empty", () => {
      const handoff: StructuredHandoff = {
        blockers: [],
        decisions: [],
        filesCreated: [],
        filesDeleted: [],
        filesModified: [],
        fromTaskIds: [],
        fromWaveId: "wave-1",
        openQuestions: [],
        summary: "Wave completed",
        toolsAvoided: [],
        ts: Date.now(),
      };

      const prompt = formatStructuredHandoffPrompt(handoff);

      expect(prompt).not.toContain("Decisions Made:");
      expect(prompt).not.toContain("Tools to Avoid:");
      expect(prompt).not.toContain("Known Blockers:");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty outcomes array", async () => {
      const handoff = await buildStructuredHandoff(
        "wave-1",
        "wave-2",
        [],
        "/workspace"
      );

      expect(handoff.fromTaskIds).toEqual([]);
      expect(handoff.decisions).toEqual([]);
      expect(handoff.toolsAvoided).toEqual([]);
      expect(handoff.blockers).toEqual([]);
    });

    it("should handle malformed decision notes", async () => {
      const outcomes = [
        createOutcome({
          result: {
            artifacts: [],
            changes: [],
            notes: [
              "DECISION:", // Empty decision
              "DECISION:NoRationale", // Missing rationale
              "Not a decision note",
              "DECISION:Valid|Has rationale",
            ],
            summary: "Task done",
          },
        }),
      ];

      const handoff = await buildStructuredHandoff(
        "wave-1",
        "wave-2",
        outcomes,
        "/workspace"
      );

      // Should only include valid decisions
      expect(handoff.decisions.some((d) => d.decision === "Valid")).toBe(true);
    });

    it("should handle agent ID without colon separator", async () => {
      const outcomes = [createOutcome({ agentId: "simple-agent-id" })];

      const handoff = await buildStructuredHandoff(
        "wave-1",
        "wave-2",
        outcomes,
        "/workspace"
      );

      expect(handoff.fromTaskIds).toContain("simple-agent-id");
    });

    it("should truncate long error messages in tools to avoid", async () => {
      const longError = "A".repeat(500);
      const outcomes = [
        createOutcome({
          failureContext: createFailureContext({
            toolErrors: [
              {
                tool: "shell",
                error: longError,
                count: 3,
                lastOccurrence: Date.now(),
              },
            ],
          }),
          status: "failure",
        }),
      ];

      const handoff = await buildStructuredHandoff(
        "wave-1",
        "wave-2",
        outcomes,
        "/workspace"
      );

      // Error should be truncated
      expect(handoff.toolsAvoided[0].reason.length).toBeLessThan(200);
    });
  });
});
