import { afterEach, describe, expect, it } from "bun:test";
import { realpathSync } from "node:fs";
import { mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SubTask } from "@alfred/agent/orchestrator/multi/decompose";
import type { WorkflowEvent } from "@alfred/type/plan";
import {
  hydrateTrackerContext,
  normalizeWorkingDirectory,
} from "../src/orchestrator/hydrate";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = path.join(
    tmpdir(),
    `hydrate-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(dir, { recursive: true });
  tempDirs.push(dir);
  return realpathSync(dir);
}

afterEach(async () => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

describe("normalizeWorkingDirectory", () => {
  it("returns workspaceRoot when candidate is empty", async () => {
    const workspaceRoot = await createTempDir();

    const result = normalizeWorkingDirectory("", workspaceRoot);

    expect(result).toBe(workspaceRoot);
  });

  it("returns workspaceRoot when candidate is whitespace", async () => {
    const workspaceRoot = await createTempDir();

    const result = normalizeWorkingDirectory("   ", workspaceRoot);

    expect(result).toBe(workspaceRoot);
  });

  it("normalizes valid subdirectory path", async () => {
    const workspaceRoot = await createTempDir();
    const subDir = path.join(workspaceRoot, "src");
    await mkdir(subDir);

    const result = normalizeWorkingDirectory(subDir, workspaceRoot);

    expect(result).toBe(subDir);
  });

  it("throws when candidate is outside workspace root", async () => {
    const workspaceRoot = await createTempDir();
    const outsideDir = await createTempDir();

    expect(() =>
      normalizeWorkingDirectory(outsideDir, workspaceRoot)
    ).toThrow();
  });

  it("throws on symlink escape attempt", async () => {
    const workspaceRoot = await createTempDir();
    const outsideDir = await createTempDir();
    const symlinkPath = path.join(workspaceRoot, "escape");

    await symlink(outsideDir, symlinkPath);

    expect(() =>
      normalizeWorkingDirectory(symlinkPath, workspaceRoot)
    ).toThrow();
  });
});

describe("hydrateTrackerContext", () => {
  const mockSubTasks: SubTask[] = [
    {
      id: "task-1",
      title: "Task 1",
      requirement: "Do something",
      deps: [],
      priority: 1,
      acceptance: [],
      filesHint: [],
    },
  ];

  it("returns empty context for undefined history", () => {
    const ctx = hydrateTrackerContext(undefined, mockSubTasks);

    expect(ctx.state.waves).toEqual({});
  });

  it("returns empty context for empty history", () => {
    const ctx = hydrateTrackerContext([], mockSubTasks);

    expect(ctx.state.waves).toEqual({});
  });

  it("marks completed waves from history", () => {
    const history: WorkflowEvent[] = [
      {
        type: "event",
        kind: "wave-result",
        data: { waveId: "wave_0", status: "completed" },
      } as any,
    ];

    const ctx = hydrateTrackerContext(history, mockSubTasks);

    expect(ctx.state.waves.wave_0?.status).toBe("completed");
  });

  it("marks partial waves as failed for resumability", () => {
    const history: WorkflowEvent[] = [
      {
        type: "event",
        kind: "wave-result",
        data: { waveId: "wave_0", status: "partial" },
      } as any,
    ];

    const ctx = hydrateTrackerContext(history, mockSubTasks);

    expect(ctx.state.waves.wave_0?.status).toBe("failed");
  });

  it("initializes dependency indices from subtasks", () => {
    const subTasks: SubTask[] = [
      {
        id: "task-a",
        title: "Task A",
        requirement: "First",
        deps: [],
        priority: 1,
        acceptance: [],
        filesHint: [],
      },
      {
        id: "task-b",
        title: "Task B",
        requirement: "Second",
        deps: ["task-a"],
        priority: 0.9,
        acceptance: [],
        filesHint: [],
      },
    ];

    const ctx = hydrateTrackerContext([], subTasks);

    expect(ctx.dependsOn.get("task-b")?.has("task-a")).toBe(true);
    expect(ctx.blockedBy.get("task-a")?.has("task-b")).toBe(true);
  });
});
