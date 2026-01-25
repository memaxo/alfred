import type { SubTask } from "@alfred/agent/orchestrator/multi/decompose";

import {
  __internals,
  buildAgentSpec,
  planWaves,
} from "@alfred/agent/orchestrator/multi/spawn";
import { subtaskPlanPath } from "@alfred/agent/orchestrator/plans";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const makeTask = (id: string, deps: string[] = [], priority = 1): SubTask => ({
  acceptance: [],
  deps,
  filesHint: [],
  id,
  priority,
  requirement: "",
  title: id,
});

const originalUseContainers = process.env.ORCH_USE_CONTAINERS;
let testDir: string;

beforeAll(() => {
  testDir = mkdtempSync(join(tmpdir(), "spawn-test-"));
});

afterAll(() => {
  rmSync(testDir, { force: true, recursive: true });
});

afterEach(() => {
  if (originalUseContainers === undefined) {
    process.env.ORCH_USE_CONTAINERS = undefined;
    return;
  }
  process.env.ORCH_USE_CONTAINERS = originalUseContainers;
});

describe("buildAgentSpec", () => {
  it("derives exec plan path and context metadata", () => {
    const spec = buildAgentSpec(makeTask("sub-1"), "run-123", testDir, {
      auto: "medium",
      linear: {
        authz: "token",
        issueId: "ISS-1",
        sessionId: "LIN-1",
        space: "focus",
      },
    });

    expect(spec.agentId).toBe("run-123:sub-1");
    expect(spec.execPlanPath).toBe(
      subtaskPlanPath(testDir, "run-123", "sub-1")
    );
    expect(spec.auto).toBe("medium");
    expect(spec.context.relevantFiles).toEqual([]);
    expect(spec.context.linearSessionId).toBe("LIN-1");
    expect(spec.context.linearSpace).toBe("focus");
    expect(spec.environment).toBe("agentfs");
  });

  it("uses container isolation by default", () => {
    const spec = buildAgentSpec(makeTask("sub-2"), "run-456", testDir, {
      maxParallel: 4,
    });
    expect(spec.environment).toBe("agentfs");
  });

  it("confirms agentfs environment with ORCH_USE_CONTAINERS=1", () => {
    process.env.ORCH_USE_CONTAINERS = "1";
    const spec = buildAgentSpec(makeTask("sub-3"), "run-789", testDir);
    expect(spec.environment).toBe("agentfs");
  });
});

describe("planWaves", () => {
  it("returns empty array for no subtasks", () => {
    expect(planWaves([])).toEqual([]);
  });

  it("creates waves respecting dependency order", () => {
    const tasks: SubTask[] = [
      makeTask("backend"),
      makeTask("frontend", ["backend"], 0.9),
      makeTask("tests", ["frontend"], 0.8),
    ];
    const waves = planWaves(tasks, { maxParallel: 2 });

    const waveOrder = new Map<string, number>();
    waves.forEach((wave, index) => {
      for (const id of wave.agents) {
        waveOrder.set(id, index);
      }
    });

    expect(
      (waveOrder.get("backend") ?? 0) <= (waveOrder.get("frontend") ?? 0)
    ).toBe(true);
    expect(
      (waveOrder.get("frontend") ?? 0) <= (waveOrder.get("tests") ?? 0)
    ).toBe(true);
  });

  it("caps agents per wave according to maxParallel", () => {
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

describe("spawn internals", () => {
  it("builds dependency graphs and in-degree maps", () => {
    const { buildDepGraph, computeInDegree } = __internals;
    const tasks = [
      makeTask("a", ["b", "c"]),
      makeTask("b", []),
      makeTask("c", ["b"]),
    ];

    const graph = buildDepGraph(tasks);
    expect(graph.get("a")).toEqual(new Set(["b", "c"]));
    expect(graph.get("c")).toEqual(new Set(["b"]));

    const degrees = computeInDegree(graph);
    expect(degrees.get("a")).toBe(2);
    expect(degrees.get("b")).toBe(0);
  });
});
