import { beforeEach, describe, expect, it, mock } from "bun:test";
import { managePatternLifecycle } from "../pattern/lifecycle.js";

// Mock @alfred/db
const mockUpdatePattern = mock(async () => ({}));
const mockListAllPatterns = mock(async () => []);

mock.module("@alfred/db", () => ({
  patternRepo: {
    updatePattern: mockUpdatePattern,
    listAllPatterns: mockListAllPatterns,
  },
}));

describe("Pattern Lifecycle Management", () => {
  beforeEach(() => {
    mockUpdatePattern.mockClear();
    mockListAllPatterns.mockClear();
  });

  it("should retire patterns unused for more than 30 days", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 31);

    mockListAllPatterns.mockImplementation(
      async () =>
        [
          {
            id: "old-pattern",
            trigger: "test",
            status: "active",
            lastUsedAt: oldDate,
            successRate: "0.9000",
            usageCount: 10,
          },
        ] as any
    );

    await managePatternLifecycle();

    expect(mockUpdatePattern).toHaveBeenCalledWith("old-pattern", {
      status: "retired",
    });
  });

  it("should quarantine patterns with low success rate", async () => {
    mockListAllPatterns.mockImplementation(
      async () =>
        [
          {
            id: "failing-pattern",
            trigger: "test",
            status: "active",
            lastUsedAt: new Date(),
            successRate: "0.2000", // < 0.3
            usageCount: 6, // > 5
          },
        ] as any
    );

    await managePatternLifecycle();

    expect(mockUpdatePattern).toHaveBeenCalledWith("failing-pattern", {
      status: "quarantined",
    });
  });

  it("should not quarantine patterns with insufficient usage", async () => {
    mockListAllPatterns.mockImplementation(
      async () =>
        [
          {
            id: "new-failing-pattern",
            trigger: "test",
            status: "active",
            lastUsedAt: new Date(),
            successRate: "0.1000",
            usageCount: 2, // <= 5
          },
        ] as any
    );

    await managePatternLifecycle();

    expect(mockUpdatePattern).not.toHaveBeenCalled();
  });
});
