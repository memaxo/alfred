import { describe, expect, it } from "bun:test";

import { generateShareLink } from "../../lib/linking";

describe("linking utilities", () => {
  describe("generateShareLink", () => {
    it("should generate a valid note share link", () => {
      const link = generateShareLink("note", "123");
      expect(link).toContain("alfred://notes/123");
    });
  });
});
