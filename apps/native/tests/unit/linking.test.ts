import { beforeAll, describe, expect, it, mock } from "bun:test";

mock.module("expo-linking", () => ({
  createURL: () => "alfred://",
  parse: (url: string) => ({ path: url.replace("alfred://", "") }),
}));

let generateShareLink: (
  type: "note" | "reminder" | "workflow",
  id: string
) => string;

beforeAll(async () => {
  ({ generateShareLink } = await import("../../lib/linking"));
});

describe("linking utilities", () => {
  describe("generateShareLink", () => {
    it("should generate a valid note share link", () => {
      const link = generateShareLink("note", "123");
      expect(link).toContain("alfred://notes/123");
    });
  });
});
