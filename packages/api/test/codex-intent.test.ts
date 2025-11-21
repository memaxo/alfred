import { describe, expect, it } from "bun:test";
import { codexIntentRouter } from "../src/routers/codex-intent";

describe("codex-intent router (unit - no mocks)", () => {
  describe("router structure", () => {
    it("exports valid router object", () => {
      expect(codexIntentRouter).toBeDefined();
      expect(typeof codexIntentRouter).toBe("object");
    });

    it("has run procedure", () => {
      expect(codexIntentRouter.run).toBeDefined();
    });
  });
});
