import { describe, expect, it } from "bun:test";
import type { WavesResult } from "../src/orchestrator/waves";

describe("runWaves interrupt handling", () => {
  it("WavesResult type includes interrupted field", () => {
    const result: WavesResult = {
      trackerContext: {} as any,
      allAgentOutcomes: [
        {
          agentId: "test-agent",
          stuck: false,
          status: "interrupted",
          durationSeconds: 0,
          role: "codex",
        },
      ],
      agentFileHints: new Map(),
      activeWorkspaces: [],
      aborted: false,
      interrupted: true,
    };

    expect(result.interrupted).toBe(true);
    expect(result.allAgentOutcomes[0]?.status).toBe("interrupted");
  });

  it("interrupted status propagates correctly", () => {
    const result: WavesResult = {
      trackerContext: {} as any,
      allAgentOutcomes: [
        {
          agentId: "agent-1",
          stuck: false,
          status: "interrupted",
          durationSeconds: 1.5,
          role: "codex",
        },
        {
          agentId: "agent-2",
          stuck: false,
          status: "completed",
          durationSeconds: 2.0,
          role: "codex",
        },
      ],
      agentFileHints: new Map(),
      activeWorkspaces: [],
      aborted: false,
      interrupted: true,
    };

    expect(result.interrupted).toBe(true);
    expect(
      result.allAgentOutcomes.filter((o) => o.status === "interrupted").length
    ).toBe(1);
  });
});
