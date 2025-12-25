import { describe, expect, it, mock, spyOn } from "bun:test";
import type { AgentOutcome } from "../orchestrator/agent.js";
import {
  formatHandoffPrompt,
  generateHandoff,
} from "../orchestrator/handoff.js";

// Mock AI and agent/v6
mock.module("ai", () => ({
  generateText: async () => ({ text: "Summary of changes." }),
}));

mock.module("@alfred/agent/v6", () => ({
  getOpenAI: () => () => ({ chat: () => ({}) }),
  getModelId: () => "gpt-4o-mini",
}));

describe("Cross-Agent Context Handoff", () => {
  const mockOutcome: AgentOutcome = {
    agentId: "agent-1",
    stuck: false,
    status: "completed",
    durationSeconds: 10,
    role: "codex",
    result: {
      summary: "Fixed the bug in auth logic.",
      artifacts: [],
      changes: ["src/auth.ts"],
      notes: [],
    },
  };

  it("should generate handoff with file changes and summary", async () => {
    // Mock Bun.spawn for git commands
    const spawnSpy = spyOn(Bun, "spawn").mockImplementation((args: any) => {
      const subCommand = args[1];

      let output = "";
      if (subCommand === "status") {
        output = "M  src/auth.ts\n?? src/new-file.ts\nD  src/old-file.ts";
      } else if (subCommand === "diff") {
        output = "src/auth.ts | 10 +++\n1 file changed, 10 insertions(+)";
      }

      return {
        stdout: new Response(output).body,
        exited: Promise.resolve(0),
      } as any;
    });

    const handoff = await generateHandoff(
      "wave-1",
      "wave-2",
      [mockOutcome],
      "/mock/workspace"
    );

    expect(handoff.fromWaveId).toBe("wave-1");
    expect(handoff.toWaveId).toBe("wave-2");
    expect(handoff.summary).toBe("Summary of changes.");
    expect(handoff.changes.modified).toContain("src/auth.ts");
    expect(handoff.changes.created).toContain("src/new-file.ts");
    expect(handoff.changes.deleted).toContain("src/old-file.ts");
    expect(handoff.gitDiff).toContain("src/auth.ts | 10 +++");

    spawnSpy.mockRestore();
  });

  it("should format handoff into a prompt snippet", () => {
    const handoff = {
      fromWaveId: "wave-1",
      toWaveId: "wave-2",
      summary: "Refactored tests.",
      changes: {
        modified: ["test/app.test.ts"],
        created: [],
        deleted: [],
      },
      gitDiff: "test/app.test.ts | 5 +-",
      timestamp: new Date(),
    };

    const prompt = formatHandoffPrompt(handoff);

    expect(prompt).toContain(
      "PREVIOUS WAVE ACCOMPLISHMENTS (Handoff from wave-1)"
    );
    expect(prompt).toContain("Summary: Refactored tests.");
    expect(prompt).toContain("Files Modified: test/app.test.ts");
    expect(prompt).toContain("Git Diff Summary:");
    expect(prompt).toContain("test/app.test.ts | 5 +-");
  });
});
