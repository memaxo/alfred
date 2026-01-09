import { beforeEach, describe, expect, it, mock } from "bun:test";

const getProjectByIdMock = mock(async () => ({
  id: "proj-123",
  config: {
    conventions: [
      { id: "c1", description: "Use Bun test", confidence: 0.9 },
      { id: "c2", description: "Prefer tRPC" },
      { id: 123, description: "Invalid" },
    ],
  },
}));

mock.module("@alfred/db", () => ({
  projectRepo: {
    getProjectById: (...args: unknown[]) =>
      (getProjectByIdMock as any)(...args),
  },
}));

const { extractConventions } = await import("../research/conventions.js");

describe("extractConventions", () => {
  beforeEach(() => {
    getProjectByIdMock.mockClear();
  });

  it("extracts conventions from project config", async () => {
    const result = await extractConventions("proj-123");

    expect(getProjectByIdMock).toHaveBeenCalledWith("proj-123");
    expect(result).toEqual([
      { id: "c1", description: "Use Bun test", confidence: 0.9 },
      { id: "c2", description: "Prefer tRPC", confidence: 0.75 },
    ]);
  });

  it("returns empty list when projectId is missing", async () => {
    const result = await extractConventions();
    expect(result).toEqual([]);
    expect(getProjectByIdMock).not.toHaveBeenCalled();
  });
});
