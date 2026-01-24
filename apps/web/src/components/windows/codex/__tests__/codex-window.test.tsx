import "@/test/dom";
import { mapAutonomyToAcpMode } from "@alfred/protocol";
import { describe, expect, it } from "bun:test";

// Focus on testing ACP integration which doesn't require React component rendering
// Component rendering tests require extensive mocking - keeping unit tests here

describe("CodexWindow ACP compliance", () => {
  describe("autonomy level mapping", () => {
    it("maps read to ACP ask mode", () => {
      const mode = mapAutonomyToAcpMode("read");
      expect(mode.id).toBe("ask");
      expect(mode.name).toBe("Ask");
    });

    it("maps low to ACP ask mode", () => {
      const mode = mapAutonomyToAcpMode("low");
      expect(mode.id).toBe("ask");
      expect(mode.name).toBe("Ask");
    });

    it("maps medium to ACP code mode", () => {
      const mode = mapAutonomyToAcpMode("medium");
      expect(mode.id).toBe("code");
      expect(mode.name).toBe("Code");
    });

    it("maps high to ACP code mode", () => {
      const mode = mapAutonomyToAcpMode("high");
      expect(mode.id).toBe("code");
      expect(mode.name).toBe("Code");
    });
  });

  describe("mode metadata", () => {
    it("provides descriptions for all autonomy levels", () => {
      const levels = ["read", "low", "medium", "high"] as const;
      for (const level of levels) {
        const mode = mapAutonomyToAcpMode(level);
        expect(mode.description).toBeDefined();
        expect(mode.description.length).toBeGreaterThan(0);
      }
    });

    it("ask mode describes permission-based behavior", () => {
      const mode = mapAutonomyToAcpMode("read");
      expect(mode.description.toLowerCase()).toContain("permission");
    });

    it("code mode describes tool access", () => {
      const mode = mapAutonomyToAcpMode("high");
      expect(mode.description.toLowerCase()).toContain("tool");
    });
  });

  describe("mode id values", () => {
    it("returns valid ACP session mode IDs", () => {
      const validIds = ["ask", "code", "architect"];
      const levels = ["read", "low", "medium", "high"] as const;

      for (const level of levels) {
        const mode = mapAutonomyToAcpMode(level);
        expect(validIds).toContain(mode.id);
      }
    });
  });
});
