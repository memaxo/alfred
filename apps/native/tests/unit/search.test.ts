import { describe, expect, it } from "bun:test";

import { fuzzySearch } from "../../lib/search";

describe("search utilities", () => {
  const items = [
    {
      title: "Apple",
      description: "A red fruit",
      updated: "2024-01-01T10:00:00Z",
      due: "2024-01-05T10:00:00Z",
      fired: false,
    },
    {
      title: "Banana",
      description: "A yellow fruit",
      updated: "2024-01-02T10:00:00Z",
      due: "2024-01-04T10:00:00Z",
      fired: true,
    },
    {
      title: "Cherry",
      description: "A small red fruit",
      updated: "2024-01-03T10:00:00Z",
      due: "2024-01-06T10:00:00Z",
      fired: false,
    },
  ];

  describe("fuzzySearch", () => {
    it("should find items by title", () => {
      const results = fuzzySearch(items, "apple", (item) => [item.title]);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Apple");
    });
  });
});
