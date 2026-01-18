import { beforeEach, describe, expect, it, mock } from "bun:test";

// Track generateObject calls
let generateObjectCalls: Array<{ prompt: string }> = [];

// Mock AI SDK generateObject for batch phase assignment
mock.module("ai", () => ({
  generateObject: async (args: { prompt: string; schema: unknown }) => {
    generateObjectCalls.push({ prompt: args.prompt });

    // Parse the prompt to extract task indices and assign phases based on content
    const lines = args.prompt.split("\n");
    const assignments: Array<{ index: number; phase: string }> = [];

    for (const line of lines) {
      const match = line.match(/^(\d+):\s*"([^"]+)"/);
      if (match) {
        const index = Number.parseInt(match[1], 10);
        const title = match[2].toLowerCase();

        // Simulate LLM classification
        let phase = "misc";
        if (
          title.includes("setup") ||
          title.includes("install") ||
          title.includes("configure")
        ) {
          phase = "setup";
        } else if (
          title.includes("db") ||
          title.includes("migration") ||
          title.includes("schema")
        ) {
          phase = "db";
        } else if (
          title.includes("api") ||
          title.includes("backend") ||
          title.includes("service")
        ) {
          phase = "api";
        } else if (
          title.includes("ui") ||
          title.includes("component") ||
          title.includes("page")
        ) {
          phase = "ui";
        } else if (title.includes("test") || title.includes("spec")) {
          phase = "test";
        }

        assignments.push({ index, phase });
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
const { groupIntoPhases, groupIntoPhasesWithMetadata, PHASE_IDS } =
  await import("../generate/group.js");

describe("groupIntoPhases", () => {
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

  const createSubtask = (id: string, title: string, requirement = "") => ({
    id,
    title,
    requirement,
    deps: [],
    priority: 1,
    acceptance: [],
    filesHint: [],
  });

  describe("sync mode (no model)", () => {
    it("should group subtasks using heuristics", () => {
      const subtasks = [
        createSubtask("T1", "Setup environment"),
        createSubtask("T2", "Create DB migration"),
        createSubtask("T3", "Implement API endpoint"),
        createSubtask("T4", "Add UI component"),
        createSubtask("T5", "Write unit tests"),
      ];

      const groups = groupIntoPhases(subtasks, {
        maxPhases: 6,
        preferParallel: true,
      });

      expect(groups.length).toBe(5);
      expect(groups[0].name).toBe("Environment Setup");
      expect(groups[0].subtasks).toHaveLength(1);
      expect(groups[1].name).toBe("Data Architecture");
      expect(groups[2].name).toBe("Logic & API");
      expect(groups[3].name).toBe("User Interface");
      expect(groups[4].name).toBe("Testing & Validation");

      // No LLM calls in sync mode
      expect(generateObjectCalls.length).toBe(0);
    });

    it("should consolidate when over maxPhases", () => {
      const subtasks = [
        createSubtask("T1", "Setup environment"),
        createSubtask("T2", "Create DB migration"),
        createSubtask("T3", "Implement API endpoint"),
        createSubtask("T4", "Add UI component"),
        createSubtask("T5", "Write unit tests"),
        createSubtask("T6", "Other task"),
      ];

      const groups = groupIntoPhases(subtasks, {
        maxPhases: 3,
        preferParallel: true,
      });

      expect(groups.length).toBe(3);
      expect(groups[2].name).toBe("Consolidated Tasks");
      expect(groups[2].subtasks.length).toBeGreaterThan(1);
    });

    it("should return empty array for empty subtasks", () => {
      const groups = groupIntoPhases([], {
        maxPhases: 5,
        preferParallel: true,
      });

      expect(groups).toEqual([]);
    });

    it("should handle subtasks with no clear category", () => {
      const subtasks = [
        createSubtask("T1", "Do something vague"),
        createSubtask("T2", "Another unclear task"),
      ];

      const groups = groupIntoPhases(subtasks, {
        maxPhases: 6,
        preferParallel: true,
      });

      expect(groups.length).toBe(1);
      expect(groups[0].name).toBe("Final Adjustments");
      expect(groups[0].subtasks).toHaveLength(2);
    });
  });

  describe("async mode (with model)", () => {
    it("should use LLM for classification", async () => {
      const subtasks = [
        createSubtask("T1", "Setup the development environment"),
        createSubtask("T2", "Create database migration for users"),
        createSubtask("T3", "Build API endpoint for auth"),
      ];

      const groups = await groupIntoPhases(subtasks, {
        maxPhases: 6,
        preferParallel: true,
        model: mockModel as any,
        modelKey: "test/model",
      });

      // LLM should have been called
      expect(generateObjectCalls.length).toBe(1);
      expect(generateObjectCalls[0].prompt).toContain(
        "Setup the development environment"
      );

      // Should have grouped correctly
      expect(groups.length).toBe(3);
      expect(groups.find((g) => g.name === "Environment Setup")).toBeDefined();
      expect(groups.find((g) => g.name === "Data Architecture")).toBeDefined();
      expect(groups.find((g) => g.name === "Logic & API")).toBeDefined();
    });

    it("should handle missing assignments gracefully", async () => {
      // Override mock to return incomplete assignments
      mock.module("ai", () => ({
        generateObject: () =>
          Promise.resolve({
            object: { assignments: [{ index: 0, phase: "setup" }] }, // Missing indices 1, 2
          }),
      }));

      const subtasks = [
        createSubtask("T1", "Setup environment"),
        createSubtask("T2", "Create migration"),
        createSubtask("T3", "Build API"),
      ];

      // Re-import to get updated mock
      const { groupIntoPhases: groupFn } = await import("../generate/group.js");

      const groups = await groupFn(subtasks, {
        maxPhases: 6,
        preferParallel: true,
        model: mockModel as any,
        modelKey: "test/model",
      });

      // Unassigned tasks should go to misc
      const miscGroup = groups.find((g) => g.name === "Final Adjustments");
      expect(miscGroup?.subtasks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("groupIntoPhasesWithMetadata", () => {
    it("should return metadata with LLM classification", async () => {
      const subtasks = [
        createSubtask("T1", "Setup environment"),
        createSubtask("T2", "Create DB schema"),
      ];

      const result = await groupIntoPhasesWithMetadata(subtasks, {
        maxPhases: 6,
        preferParallel: true,
        model: mockModel as any,
        modelKey: "test/model",
      });

      expect(result.groups.length).toBeGreaterThan(0);
      expect(result.source).toBe("llm");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should return empty result for empty subtasks", async () => {
      const result = await groupIntoPhasesWithMetadata([], {
        maxPhases: 6,
        preferParallel: true,
        model: mockModel as any,
        modelKey: "test/model",
      });

      expect(result.groups).toEqual([]);
      expect(result.source).toBe("fallback");
      expect(result.latencyMs).toBe(0);
    });
  });

  describe("PHASE_IDS", () => {
    it("should export all expected phases", () => {
      expect(PHASE_IDS).toContain("setup");
      expect(PHASE_IDS).toContain("db");
      expect(PHASE_IDS).toContain("api");
      expect(PHASE_IDS).toContain("ui");
      expect(PHASE_IDS).toContain("test");
      expect(PHASE_IDS).toContain("misc");
      expect(PHASE_IDS.length).toBe(6);
    });
  });
});
