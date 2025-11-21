import { describe, expect, it } from "bun:test";
import {
  buildCodexLearningContext,
  findSimilarCodexExecutions,
} from "../src/repo/codex-learning";

describe("codex-learning (unit - no DB)", () => {
  describe("findSimilarCodexExecutions", () => {
    it("should have valid function signature", () => {
      expect(typeof findSimilarCodexExecutions).toBe("function");
    });
  });

  describe("buildCodexLearningContext", () => {
    it("should have valid function signature", () => {
      expect(typeof buildCodexLearningContext).toBe("function");
    });
  });
});
