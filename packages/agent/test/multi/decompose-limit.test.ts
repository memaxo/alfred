import type { ContextBundle } from "@alfred/type/plan";

import { decomposeTask } from "@alfred/agent/orchestrator/multi/decompose";
import { describe, expect, it } from "bun:test";

function makeBundle(paths: string[]): ContextBundle {
  return {
    maxTokens: 1000,
    estimatedTokens: 100,
    files: paths.map((path) => ({
      path,
      startLine: 1,
      endLine: 10,
      tokens: 10,
      content: `export const stub = "${path}";`,
    })),
    links: undefined,
    note: "test bundle",
  };
}

describe("decomposeTask limit enforcement", () => {
  it("truncates semantic decomposition when exceeding MAX_SUBTASKS", () => {
    const manyFiles = Array.from({ length: 50 }, (_, i) => `file${i}.ts`);
    const bundle = makeBundle(manyFiles);

    const tasks = decomposeTask("Implement many features", {
      requirement: "Implement many features",
      bundle,
    });

    expect(tasks.length).toBeLessThanOrEqual(10);
  });

  it("truncates bucket-based decomposition when exceeding MAX_SUBTASKS", () => {
    const manyFiles = Array.from({ length: 50 }, (_, i) => {
      const bucket =
        i % 3 === 0 ? "backend" : i % 3 === 1 ? "frontend" : "test";
      return `packages/${bucket}/file${i}.ts`;
    });
    const bundle = makeBundle(manyFiles);

    const tasks = decomposeTask("Implement many features", {
      requirement: "Implement many features",
      bundle,
    });

    expect(tasks.length).toBeLessThanOrEqual(10);
  });

  it("does not truncate when under limit", () => {
    const bundle = makeBundle([
      "packages/api/src/router.ts",
      "apps/web/src/app/page.tsx",
    ]);

    const tasks = decomposeTask("Implement feature", {
      requirement: "Implement feature",
      bundle,
    });

    expect(tasks.length).toBeLessThanOrEqual(10);
    expect(tasks.length).toBeGreaterThan(0);
  });
});
