import { describe, expect, it } from "bun:test";
import type { ContextBundle } from "@alfred/type/plan";
import { decomposeTask, __internals } from "@alfred/agent/orchestrator/multi/decompose";

function makeBundle(paths: string[]): ContextBundle {
  return {
    maxTokens: 1000,
    estimatedTokens: 100,
    files: paths.map((path) => ({
      path,
      startLine: 1,
      endLine: 10,
      tokens: 10,
      content: "// stub",
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
    expect(tasks[0]!.deps).toEqual([]);
  });

  it("creates backend and frontend subtasks with deps", () => {
    const bundle = makeBundle([
      "packages/api/src/router.ts",
      "apps/web/src/app/page.tsx",
      "packages/api/src/router.test.ts",
    ]);

    const tasks = decomposeTask("Implement end-to-end feature", {
      requirement: "Implement end-to-end feature",
      bundle,
    });

    const backend = tasks.find((t) => t.title.includes("Backend"));
    const frontend = tasks.find((t) => t.title.includes("Frontend"));

    expect(backend).toBeDefined();
    expect(frontend).toBeDefined();

    if (!backend || !frontend) return;

    // Frontend should depend on backend when both exist.
    expect(frontend.deps).toContain(backend.id);

  });

  it("is deterministic for same input", () => {
    const bundle = makeBundle([
      "packages/api/src/router.ts",
      "apps/web/src/app/page.tsx",
    ]);

    const a = decomposeTask("Deterministic requirement", {
      requirement: "Deterministic requirement",
      bundle,
    });
    const b = decomposeTask("Deterministic requirement", {
      requirement: "Deterministic requirement",
      bundle,
    });

    expect(a).toEqual(b);
  });
});

describe("plan helpers internals", () => {
  it("classifies paths into buckets", () => {
    const { classifyPath } = __internals;
    expect(classifyPath("packages/api/src/router.ts")).toBe("backend");
    expect(classifyPath("apps/web/src/app/page.tsx")).toBe("frontend");
    expect(classifyPath("packages/api/src/router.test.ts")).toBe("backend");
  });

  it("normalises prefixes and ensures uniqueness", () => {
    const { normalisePrefix, uniq } = __internals;
    expect(normalisePrefix("a/b/c.ts")).toBe("a/b");
    expect(normalisePrefix("c.ts")).toBe(".");
    expect(uniq(["a", "a", "b"])).toEqual(["a", "b"]);
  });
});
