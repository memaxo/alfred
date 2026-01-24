import type { ContextBundle } from "@alfred/type/plan";

import {
  __internals,
  decomposeTask,
} from "@alfred/agent/orchestrator/multi/decompose";
import { describe, expect, it } from "bun:test";

type BundleOptions = {
  includeContent?: boolean;
};

function makeBundle(
  paths: string[],
  options: BundleOptions = { includeContent: false }
): ContextBundle {
  const includeContent = options.includeContent ?? false;
  return {
    maxTokens: 1000,
    estimatedTokens: 100,
    files: paths.map((path) => ({
      path,
      startLine: 1,
      endLine: 10,
      tokens: 10,
      content: includeContent ? `export const stub = "${path}";` : undefined,
    })),
    links: undefined,
    note: "test bundle",
  };
}

describe("decomposeTask", () => {
  it("returns single generic subtask when no context bundle", () => {
    const tasks = decomposeTask("Add feature X", {
      requirement: "Add feature X",
      bundle: null,
    });

    expect(tasks.length).toBe(1);
    expect(tasks[0]?.deps).toEqual([]);
  });

  it("creates backend, frontend, and test subtasks with dependencies", () => {
    const bundle = makeBundle([
      "packages/api/src/router.ts",
      "apps/web/src/app/page.tsx",
      "tests/runtime/router.test.ts",
    ]);

    const tasks = decomposeTask("Implement end-to-end feature", {
      requirement: "Implement end-to-end feature",
      bundle,
    });

    const backend = tasks.find((t) => t.title.includes("Backend"));
    const frontend = tasks.find((t) => t.title.includes("Frontend"));
    const tests = tasks.find((t) => t.title.includes("Tests"));

    expect(backend).toBeDefined();
    expect(frontend).toBeDefined();
    expect(tests).toBeDefined();

    if (!(backend && frontend && tests)) {
      return;
    }

    // Frontend should depend on backend when both exist.
    expect(frontend.deps).toContain(backend.id);
    expect(tests.deps).toEqual(
      expect.arrayContaining([backend.id, frontend.id])
    );
  });

  it("produces deterministic ids for identical input", () => {
    const bundle = makeBundle([
      "packages/api/src/router.ts",
      "apps/web/src/app/page.tsx",
    ]);

    const first = decomposeTask("Deterministic requirement", {
      requirement: "Deterministic requirement",
      bundle,
    });
    const second = decomposeTask("Deterministic requirement", {
      requirement: "Deterministic requirement",
      bundle,
    });

    expect(first).toEqual(second);
  });

  it("defaults blank requirements to a generic instruction", () => {
    const tasks = decomposeTask("   ", {
      requirement: "   ",
      bundle: makeBundle([], { includeContent: false }),
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.requirement).toBe("Implement the requested change.");
  });

  it("falls back to prefix hints when only misc files are detected", () => {
    const bundle = makeBundle(["docs/readme.md"], { includeContent: false });
    const tasks = decomposeTask("Document behavior", {
      requirement: "Document behavior",
      bundle,
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.filesHint).toEqual(["docs"]);
  });

  it("prefers semantic decomposition when file contents exist", () => {
    const bundle = makeBundle(
      [
        "packages/api/src/router.ts",
        "apps/web/src/app/page.tsx",
        "apps/web/src/components/Header.tsx",
      ],
      { includeContent: true }
    );

    const tasks = decomposeTask("Implement semantic split", {
      requirement: "Implement semantic split",
      bundle,
    });

    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(tasks.some((task) => task.id.startsWith("task_api"))).toBe(true);
    expect(tasks.some((task) => task.id.startsWith("task_web"))).toBe(true);
  });
});

describe("plan helpers internals", () => {
  it("classifies paths into buckets", () => {
    const { classifyPath } = __internals;
    expect(classifyPath("packages/api/src/router.ts")).toBe("backend");
    expect(classifyPath("apps/web/src/app/page.tsx")).toBe("frontend");
    expect(classifyPath("tests/runtime/__tests__/router.test.ts")).toBe("test");
  });

  it("normalises prefixes and ensures uniqueness", () => {
    const { normalisePrefix, uniq } = __internals;
    expect(normalisePrefix("a/b/c.ts")).toBe("a/b");
    expect(normalisePrefix("c.ts")).toBe(".");
    expect(uniq(["a", "a", "b"])).toEqual(["a", "b"]);
  });

  it("produces stable ids for identical seeds", () => {
    const { stableId } = __internals;
    const first = stableId("seed");
    expect(first).toBeDefined();
    expect(first).toBe(stableId("seed"));
  });
});
