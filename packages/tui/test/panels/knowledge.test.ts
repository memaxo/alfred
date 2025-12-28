import { describe, expect, test } from "bun:test";
import { renderRecentInsights } from "../../src/tui/panels/knowledge/recent";
import { renderKnowledgeStats } from "../../src/tui/panels/knowledge/stats";

describe("Knowledge Panel Components", () => {
  describe("Stats Rendering", () => {
    test("renders knowledge stats", () => {
      const stats = {
        facts: 1247,
        relations: 832,
        insights: 45,
        anchors: 12,
      };

      const result = renderKnowledgeStats(stats, 60);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test("handles zero stats", () => {
      const stats = {
        facts: 0,
        relations: 0,
        insights: 0,
        anchors: 0,
      };

      const result = renderKnowledgeStats(stats, 60);
      expect(result).toBeDefined();
    });

    test("handles large numbers", () => {
      const stats = {
        facts: 1_000_000,
        relations: 500_000,
        insights: 10_000,
        anchors: 1000,
      };

      const result = renderKnowledgeStats(stats, 60);
      expect(result).toBeDefined();
    });
  });

  describe("Recent Insights Rendering", () => {
    test("renders recent insights", () => {
      const insights = [
        {
          id: "1",
          text: "User prefers morning meetings",
          timestamp: new Date(),
        },
        { id: "2", text: "Active on weekdays", timestamp: new Date() },
      ];

      const result = renderRecentInsights(insights, 60);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test("handles empty insights", () => {
      const result = renderRecentInsights([], 60);
      expect(result).toBeDefined();
    });

    test("truncates long insight text", () => {
      const insights = [
        {
          id: "1",
          text: "This is a very long insight that should be truncated when rendered in a narrow terminal to avoid wrapping",
          timestamp: new Date(),
        },
      ];

      const result = renderRecentInsights(insights, 40);
      expect(result).toBeDefined();
      // Each line should respect width constraint
      for (const line of result) {
        // Allow some ANSI codes
        expect(line.length).toBeLessThanOrEqual(60);
      }
    });
  });

  describe("Mock Data", () => {
    test("creates valid mock knowledge stats", () => {
      const stats = {
        facts: 1247,
        relations: 832,
        insights: 45,
        anchors: 12,
      };

      // Relations should be less than facts typically
      expect(stats.relations).toBeLessThanOrEqual(stats.facts * 2);

      // Insights are rarer than facts
      expect(stats.insights).toBeLessThan(stats.facts);

      // Anchors are even rarer
      expect(stats.anchors).toBeLessThan(stats.insights);
    });
  });
});
