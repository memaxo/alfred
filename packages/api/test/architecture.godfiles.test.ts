import { describe, expect, test } from "bun:test";

type Target = {
  path: string;
  maxLines: number;
};

async function countLines(path: string): Promise<number> {
  const text = await Bun.file(path).text();
  // Count newline boundaries; handle files without trailing newline.
  const parts = text.split(/\r?\n/);
  const last = parts.at(-1);
  return last === "" ? Math.max(0, parts.length - 1) : parts.length;
}

describe("architecture: godfile guardrails", () => {
  test("critical router files stay under size budgets", async () => {
    // This is a *ratchet*, not an aspirational target:
    // keep the worst offenders from growing while we refactor them down.
    //
    // Once the Concierge Focus refactor milestones land, we should tighten these
    // to the true architectural budgets (e.g. workflow router <= 500 lines).
    const targets: Target[] = [
      { path: "packages/api/src/routers/workflow.ts", maxLines: 500 },
      { path: "packages/api/src/routers/voice.ts", maxLines: 750 },
      { path: "packages/api/src/routers/plan.ts", maxLines: 950 },
      { path: "packages/api/src/routers/agentfs.ts", maxLines: 950 },
      { path: "packages/api/src/routers/codex.ts", maxLines: 900 },
    ];

    const results: Array<{ target: Target; lines: number }> = [];
    for (const target of targets) {
      const lines = await countLines(target.path);
      results.push({ target, lines });
    }

    // Emit a helpful summary for local iteration.
    const summary = results
      .map(
        ({ target, lines }) =>
          `${target.path} lines=${lines} max=${target.maxLines}`
      )
      .join("\n");
    console.log(summary);

    for (const { target, lines } of results) {
      expect(lines).toBeLessThanOrEqual(target.maxLines);
    }
  });
});
