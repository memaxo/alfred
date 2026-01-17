import { beforeEach, describe, expect, it, mock } from "bun:test";

// Track generateObject calls
let generateObjectCalls: Array<{ prompt: string }> = [];

// Mock AI SDK generateObject for batch path classification
mock.module("ai", () => ({
  generateObject: async (args: { prompt: string; schema: unknown }) => {
    generateObjectCalls.push({ prompt: args.prompt });

    // Parse the prompt to extract paths and assign buckets based on content
    const lines = args.prompt.split("\n");
    const assignments: Array<{ index: number; bucket: string }> = [];

    for (const line of lines) {
      const match = line.match(/^(\d+):\s*(.+)$/);
      if (match) {
        const index = Number.parseInt(match[1], 10);
        const path = match[2].toLowerCase();

        // Simulate LLM classification
        let bucket = "misc";
        if (
          path.includes("/api/") ||
          path.includes("/server/") ||
          path.includes("/routers/")
        ) {
          bucket = "backend";
        } else if (
          path.includes(".test.") ||
          path.includes(".spec.") ||
          path.includes("__tests__")
        ) {
          bucket = "test";
        } else if (
          path.includes("/components/") ||
          path.includes("/pages/") ||
          path.endsWith(".tsx")
        ) {
          bucket = "frontend";
        }

        assignments.push({ index, bucket });
      }
    }

    return { object: { assignments } };
  },
}));

// Mock logger
mock.module("@alfred/logger", () => ({
  logger: {
    debug: () => {},
    warn: () => {},
    error: () => {},
    info: () => {},
  },
}));

// Import AFTER mocks
const {
  classifyPath,
  classifyPathHeuristic,
  classifyPaths,
  classifyPathsWithMetadata,
  PATH_BUCKETS,
} = await import("../classify/path.js");

describe("classifyPath", () => {
  beforeEach(() => {
    generateObjectCalls = [];
  });

  // Create a mock model for testing
  const mockModel = {
    doGenerate: async () => ({}),
    doStream: async () => ({}),
    provider: "test",
    specificationVersion: "v1" as const,
    modelId: "test-model",
  };

  describe("classifyPathHeuristic", () => {
    it("should classify backend paths", () => {
      expect(classifyPathHeuristic("packages/api/src/routers/user.ts")).toBe(
        "backend"
      );
      expect(classifyPathHeuristic("src/server/index.ts")).toBe("backend");
      expect(classifyPathHeuristic("app/api/route.ts")).toBe("backend");
      expect(classifyPathHeuristic("src/component.server.ts")).toBe("backend");
    });

    it("should classify frontend paths", () => {
      expect(classifyPathHeuristic("src/components/Button.tsx")).toBe(
        "frontend"
      );
      expect(classifyPathHeuristic("app/pages/index.tsx")).toBe("frontend");
      expect(classifyPathHeuristic("src/hooks/useAuth.ts")).toBe("frontend");
      expect(classifyPathHeuristic("src/component.client.tsx")).toBe(
        "frontend"
      );
    });

    it("should classify test paths", () => {
      expect(classifyPathHeuristic("src/__tests__/user.test.ts")).toBe("test");
      expect(classifyPathHeuristic("src/user.test.ts")).toBe("test");
      expect(classifyPathHeuristic("src/user.spec.ts")).toBe("test");
      expect(classifyPathHeuristic("test/integration.test.tsx")).toBe("test");
    });

    it("should classify misc paths", () => {
      expect(classifyPathHeuristic("package.json")).toBe("misc");
      expect(classifyPathHeuristic("README.md")).toBe("misc");
      expect(classifyPathHeuristic("scripts/build.ts")).toBe("misc");
    });

    it("should prioritize test over frontend for .test.tsx files", () => {
      expect(classifyPathHeuristic("src/components/Button.test.tsx")).toBe(
        "test"
      );
    });
  });

  describe("classifyPath (sync)", () => {
    it("should use heuristic classification", () => {
      expect(classifyPath("packages/api/src/routers/user.ts")).toBe("backend");
      expect(classifyPath("src/components/Button.tsx")).toBe("frontend");
      expect(classifyPath("src/__tests__/user.test.ts")).toBe("test");
    });
  });

  describe("classifyPaths (batch)", () => {
    it("should classify multiple paths with heuristics when no model", async () => {
      const paths = [
        "packages/api/src/routers/user.ts",
        "src/components/Button.tsx",
        "src/__tests__/user.test.ts",
      ];

      const result = await classifyPaths(paths, {});

      expect(result.get("packages/api/src/routers/user.ts")).toBe("backend");
      expect(result.get("src/components/Button.tsx")).toBe("frontend");
      expect(result.get("src/__tests__/user.test.ts")).toBe("test");

      // No LLM calls without model
      expect(generateObjectCalls.length).toBe(0);
    });

    it("should use LLM when model provided", async () => {
      const paths = [
        "packages/api/src/routers/user.ts",
        "src/components/Button.tsx",
      ];

      const result = await classifyPaths(paths, {
        model: mockModel as any,
        modelKey: "test/model",
      });

      // LLM should have been called
      expect(generateObjectCalls.length).toBe(1);
      expect(generateObjectCalls[0].prompt).toContain(
        "packages/api/src/routers/user.ts"
      );

      // Should return correct classifications
      expect(result.get("packages/api/src/routers/user.ts")).toBe("backend");
      expect(result.get("src/components/Button.tsx")).toBe("frontend");
    });

    it("should return empty map for empty paths", async () => {
      const result = await classifyPaths([], {});
      expect(result.size).toBe(0);
    });
  });

  describe("classifyPathsWithMetadata", () => {
    it("should return metadata with LLM classification", async () => {
      const paths = [
        "packages/api/src/routers/user.ts",
        "src/components/Button.tsx",
      ];

      const result = await classifyPathsWithMetadata(paths, {
        model: mockModel as any,
        modelKey: "test/model",
      });

      expect(result.assignments.size).toBe(2);
      expect(result.source).toBe("llm");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should return empty result for empty paths", async () => {
      const result = await classifyPathsWithMetadata([], {
        model: mockModel as any,
        modelKey: "test/model",
      });

      expect(result.assignments.size).toBe(0);
      expect(result.source).toBe("fallback");
      expect(result.latencyMs).toBe(0);
    });
  });

  describe("PATH_BUCKETS", () => {
    it("should export all expected buckets", () => {
      expect(PATH_BUCKETS).toContain("backend");
      expect(PATH_BUCKETS).toContain("frontend");
      expect(PATH_BUCKETS).toContain("test");
      expect(PATH_BUCKETS).toContain("misc");
      expect(PATH_BUCKETS.length).toBe(4);
    });
  });
});
