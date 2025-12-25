import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  appendDecisionEntry,
  appendPlanProgressEntry,
  mutateExecPlanFile,
} from "../src/orchestrator/execplan";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = path.join(
    tmpdir(),
    `execplan-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

describe("mutateExecPlanFile", () => {
  it("creates file and parent directories if they do not exist", async () => {
    const dir = await createTempDir();
    const filePath = path.join(dir, "nested", "deep", "plan.md");

    await mutateExecPlanFile(filePath, () => "# New Plan\n");

    const content = await readFile(filePath, "utf8");
    expect(content).toBe("# New Plan\n");
  });

  it("mutates existing file content", async () => {
    const dir = await createTempDir();
    const filePath = path.join(dir, "plan.md");
    await writeFile(filePath, "# Plan\n\nOriginal content");

    await mutateExecPlanFile(filePath, (md) =>
      md.replace("Original", "Updated")
    );

    const content = await readFile(filePath, "utf8");
    expect(content).toBe("# Plan\n\nUpdated content");
  });

  it("does not write if mutation returns unchanged content", async () => {
    const dir = await createTempDir();
    const filePath = path.join(dir, "plan.md");
    const original = "# Plan\n\nContent";
    await writeFile(filePath, original);

    await mutateExecPlanFile(filePath, (md) => md);

    const content = await readFile(filePath, "utf8");
    expect(content).toBe(original);
  });
});

describe("appendPlanProgressEntry", () => {
  it("appends progress entry to existing file", async () => {
    const dir = await createTempDir();
    const filePath = path.join(dir, "plan.md");
    await writeFile(filePath, "# Plan\n\n## Progress\n\n");

    await appendPlanProgressEntry(filePath, "Task started", false);

    const content = await readFile(filePath, "utf8");
    expect(content).toContain("Task started");
    expect(content).toContain("## Progress");
  });

  it("creates file if it does not exist", async () => {
    const dir = await createTempDir();
    const filePath = path.join(dir, "new-plan.md");

    await appendPlanProgressEntry(filePath, "Initial progress", false);

    const content = await readFile(filePath, "utf8");
    expect(content).toContain("Initial progress");
  });
});

describe("appendDecisionEntry", () => {
  it("appends decision entry with rationale", async () => {
    const dir = await createTempDir();
    const filePath = path.join(dir, "plan.md");
    await writeFile(filePath, "# Plan\n\n## Decision Log\n\n");

    await appendDecisionEntry(filePath, "Use TypeScript", "Better type safety");

    const content = await readFile(filePath, "utf8");
    expect(content).toContain("Use TypeScript");
    expect(content).toContain("Better type safety");
  });

  it("appends decision entry with optional note", async () => {
    const dir = await createTempDir();
    const filePath = path.join(dir, "plan.md");
    await writeFile(filePath, "# Plan\n\n## Decision Log\n\n");

    await appendDecisionEntry(
      filePath,
      "Refactor API",
      "Cleaner code",
      "Agent alpha"
    );

    const content = await readFile(filePath, "utf8");
    expect(content).toContain("Refactor API");
    expect(content).toContain("Agent alpha");
  });
});
