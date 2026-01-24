import * as flowctx from "@alfred/agent/orchestrator/flow/context";
import * as semantic from "@alfred/agent/orchestrator/reasoning/decompose-semantic";
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import * as conventions from "../research/conventions.js";
import * as patterns from "../research/patterns.js";

// Import the thing we're testing
const { gatherInternalResearch } = await import("../research/internal.js");

describe("Internal Research", () => {
  let buildSpy: any;
  let analyzeImportsSpy: any;
  let lookupPatternsSpy: any;
  let extractConventionsSpy: any;

  beforeEach(() => {
    // Use spyOn instead of mock.module to avoid global mock leakage
    buildSpy = spyOn(flowctx, "gatherCodeContext").mockResolvedValue({
      code: [
        {
          id: "1",
          kind: "code",
          path: "packages/api/src/routers/plan.ts",
          score: 1,
        },
        {
          id: "2",
          kind: "code",
          path: "packages/plan/src/research/internal.ts",
          score: 1,
        },
      ],
      created: new Date(),
      summary: "stub",
    } as any);

    analyzeImportsSpy = spyOn(semantic, "analyzeImports").mockResolvedValue({
      detectedPatterns: [{ pattern: "tRPC Router", confidence: 0.9 }],
    });

    lookupPatternsSpy = spyOn(patterns, "lookupPatterns").mockResolvedValue([]);
    extractConventionsSpy = spyOn(
      conventions,
      "extractConventions"
    ).mockResolvedValue([]);
  });

  afterEach(() => {
    buildSpy.mockRestore();
    analyzeImportsSpy.mockRestore();
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
    it("should gather codebase context and analyze imports", async () => {
      const result = await gatherInternalResearch(mockIntent);

      expect(result.existingCode).toContain("packages/api/src/routers/plan.ts");
      expect(result.existingCode).toContain(
        "packages/plan/src/research/internal.ts"
      );
      expect(result.conventions.length).toBeGreaterThan(0);
      expect(result.conventions[0].description).toContain("tRPC Router");
      expect(result.patterns).toEqual([]); // Stub
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
    it("should return empty results if gatherCodeContext fails", async () => {
      buildSpy.mockRejectedValue(new Error("gather failed"));

      const result = await gatherInternalResearch(mockIntent);

      expect(result.existingCode).toEqual([]);
    });

    it("should handle analyzeImports failure gracefully", async () => {
      analyzeImportsSpy.mockRejectedValue(new Error("Import analysis failed"));

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
      expect(buildSpy).toHaveBeenCalled();
    });

    it("should handle missing workspace context", async () => {
      const noWorkspaceIntent = {
        ...mockIntent,
        context: { ...mockIntent.context, workspace: undefined },
      };
      const result = await gatherInternalResearch(noWorkspaceIntent);

      expect(result).toBeDefined();
      expect(buildSpy).toHaveBeenCalled();
    });
  });
});
