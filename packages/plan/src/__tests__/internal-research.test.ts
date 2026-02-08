import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import * as codebase from "../research/codebase.js";
import * as conventions from "../research/conventions.js";
import * as patterns from "../research/patterns.js";

// Import the thing we're testing
const { gatherInternalResearch } = await import("../research/internal.js");

describe("Internal Research", () => {
  let codebaseSpy: ReturnType<typeof spyOn>;
  let lookupPatternsSpy: ReturnType<typeof spyOn>;
  let extractConventionsSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    codebaseSpy = spyOn(codebase, "gatherCodebaseContext").mockResolvedValue([
      "packages/api/src/routers/plan.ts",
      "packages/plan/src/research/internal.ts",
    ]);

    lookupPatternsSpy = spyOn(patterns, "lookupPatterns").mockResolvedValue([]);
    extractConventionsSpy = spyOn(
      conventions,
      "extractConventions"
    ).mockResolvedValue([]);
  });

  afterEach(() => {
    codebaseSpy.mockRestore();
    lookupPatternsSpy.mockRestore();
    extractConventionsSpy.mockRestore();
  });

  const mockIntent = {
    id: "test-id",
    description: "Add internal research to plan router",
    userId: "user-123",
    source: "chat" as const,
    timestamp: new Date(),
    context: {
      workspace: "/Users/test/alfred",
      existingPatterns: [],
      constraints: [],
    },
  };

  describe("Success Paths", () => {
    it("should gather codebase context", async () => {
      const result = await gatherInternalResearch(mockIntent);

      expect(result.existingCode).toContain("packages/api/src/routers/plan.ts");
      expect(result.existingCode).toContain(
        "packages/plan/src/research/internal.ts"
      );
    });

    it("should propagate projectId to lookup and extract functions", async () => {
      const projectId = "project-123";
      await gatherInternalResearch(mockIntent, projectId);

      expect(lookupPatternsSpy).toHaveBeenCalledWith(
        mockIntent.description,
        projectId
      );
      expect(extractConventionsSpy).toHaveBeenCalledWith(projectId);
    });

    it("should respect options to exclude patterns or conventions", async () => {
      const result = await gatherInternalResearch(mockIntent, undefined, {
        includePatterns: false,
        includeConventions: false,
      });

      expect(result.patterns).toEqual([]);
      expect(result.conventions).toEqual([]);
      expect(lookupPatternsSpy).not.toHaveBeenCalled();
      expect(extractConventionsSpy).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should return empty result when codebase context fails", async () => {
      codebaseSpy.mockRejectedValue(new Error("search failed"));

      const result = await gatherInternalResearch(mockIntent);

      expect(result.existingCode).toEqual([]);
      expect(result.conventions).toEqual([]);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty intent description", async () => {
      const emptyIntent = { ...mockIntent, description: "" };
      const result = await gatherInternalResearch(emptyIntent);

      expect(result).toBeDefined();
      expect(codebaseSpy).toHaveBeenCalled();
    });

    it("should handle missing workspace context", async () => {
      const noWorkspaceIntent = {
        ...mockIntent,
        context: { ...mockIntent.context, workspace: undefined },
      };
      const result = await gatherInternalResearch(noWorkspaceIntent);

      expect(result).toBeDefined();
      expect(codebaseSpy).toHaveBeenCalled();
    });
  });
});
