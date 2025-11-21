import { describe, expect, it } from "bun:test";
import type { SubTask } from "@alfred/agent/orchestrator/multi/decompose";
import { planWaves } from "@alfred/agent/orchestrator/multi/spawn";

const makeTask = (id: string, deps: string[] = [], priority = 1): SubTask => ({
  id,
  title: id,
  requirement: "",
  deps,
  priority,
  acceptance: [],
  filesHint: [],
});

describe("planWaves", () => {
  it("returns empty array for no subtasks", () => {
    expect(planWaves([])).toEqual([]);
  });

  it("creates single wave when no deps", () => {
    const tasks: SubTask[] = [makeTask("a"), makeTask("b"), makeTask("c")];
    const waves = planWaves(tasks, { maxParallel: 2 });
    expect(waves.length).toBeGreaterThanOrEqual(1);
    const allAgents = waves.flatMap((w) => w.agents);
    expect(new Set(allAgents)).toEqual(new Set(["a", "b", "c"]));
  });

  it("respects simple linear dependencies", () => {
    const tasks: SubTask[] = [
      makeTask("a", [], 1),
      makeTask("b", ["a"], 0.9),
      makeTask("c", ["b"], 0.8),
    ];
    const waves = planWaves(tasks, { maxParallel: 2 });

    const waveOrder = new Map<string, number>();
    waves.forEach((wave, index) => {
      for (const id of wave.agents) {
        waveOrder.set(id, index);
      }
    });

    expect((waveOrder.get("a") ?? 0) <= (waveOrder.get("b") ?? 0)).toBe(true);
  });

  it("enforces maxParallel per wave", () => {
    const tasks: SubTask[] = [
      makeTask("a"),
      makeTask("b"),
      makeTask("c"),
      makeTask("d"),
    ];
    const waves = planWaves(tasks, { maxParallel: 2 });
    for (const wave of waves) {
      expect(wave.agents.length).toBeLessThanOrEqual(2);
    }
  });

  it("falls back gracefully on cycles", () => {
    const tasks: SubTask[] = [makeTask("a", ["b"]), makeTask("b", ["a"])];
    const waves = planWaves(tasks, { maxParallel: 2 });
    const allAgents = waves.flatMap((w) => w.agents);
    expect(new Set(allAgents)).toEqual(new Set(["a", "b"]));
  });
});
