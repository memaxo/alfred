import { describe, expect, it } from "bun:test";
import type { WorkingSet } from "@alfred/type/sense";
import { scoreRoute } from "../src";

describe("scoreRoute", () => {
  it("suggests reminder for time-like language", () => {
    const scored = scoreRoute({
      text: "Remind me tomorrow at 5pm to call mom.",
    });

    expect(scored.outcome.kind).toBe("reminder");
    expect(scored.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("suggests note for generic captures", () => {
    const scored = scoreRoute({
      text: "Idea: tighten pipeline boundaries in docs.",
    });

    expect(scored.outcome.kind).toBe("note");
    expect(scored.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("propagates working set project focus as outcome projectId", () => {
    const workingSet: WorkingSet = {
      userId: "user-1",
      items: [{ kind: "project", id: "project-1", label: "Project One" }],
      focus: { kind: "project", id: "project-1", label: "Project One" },
      updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    };

    const scored = scoreRoute({
      text: "Draft the spec for Sense MVP.",
      workingSet,
    });

    expect(scored.outcome.projectId).toBe("project-1");
  });
});
