import { filterFunctions, fuzzySearch, sortFunctions } from "@/lib/search";

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

  describe(fuzzySearch, () => {
    it("should find items by title", () => {
      const results = fuzzySearch(items, "apple", (item) => [item.title]);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Apple");
    });

    it("should find items by description", () => {
      const results = fuzzySearch(items, "small", (item) => [item.description]);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Cherry");
    });

    it("should be case insensitive", () => {
      const results = fuzzySearch(items, "BANANA", (item) => [item.title]);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Banana");
    });
  });

  describe(sortFunctions, () => {
    it("should sort by date newest first", () => {
      const itemsWithCreatedAt = items.map((item) => ({
        ...item,
        createdAt: item.updated,
      }));
      const sorted = [...itemsWithCreatedAt].sort(sortFunctions.dateNewest);
      expect(sorted[0].title).toBe("Cherry");
      expect(sorted[2].title).toBe("Apple");
    });

    it("should sort by title ascending", () => {
      const sorted = [...items].sort(sortFunctions.titleAsc);
      expect(sorted[0].title).toBe("Apple");
      expect(sorted[2].title).toBe("Cherry");
    });
  });

  describe(filterFunctions, () => {
    it("should filter by pending status", () => {
      const filtered = items.filter(filterFunctions.isPending);
      expect(filtered).toHaveLength(2);
      expect(filtered.every((i) => !i.fired)).toBeTruthy();
    });

    it("should filter by completed status", () => {
      const filtered = items.filter(filterFunctions.isCompleted);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].fired).toBeTruthy();
    });
  });
});
