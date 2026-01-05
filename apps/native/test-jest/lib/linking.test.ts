import { generateShareLink, parseDeepLink } from "@/lib/linking";

describe("linking utilities", () => {
  describe("generateShareLink", () => {
    it("should generate a valid note share link", () => {
      const link = generateShareLink("note", "123");
      expect(link).toContain("https://alfred.app/notes/123");
    });

    it("should generate a valid reminder share link", () => {
      const link = generateShareLink("reminder", "456");
      expect(link).toContain("https://alfred.app/reminders/456");
    });
  });

  describe("parseDeepLink", () => {
    it("should parse a note deep link", () => {
      const result = parseDeepLink("alfred://notes/123");
      expect(result).toMatchObject({ type: "note", id: "123" });
    });

    it("should parse a reminder deep link", () => {
      const result = parseDeepLink("alfred://reminders/456");
      expect(result).toMatchObject({ type: "reminder", id: "456" });
    });

    it("should return null for invalid links", () => {
      const result = parseDeepLink("invalid://link");
      expect(result).toMatchObject({ type: "unknown" });
    });
  });
});
