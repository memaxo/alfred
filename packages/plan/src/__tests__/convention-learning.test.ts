import { beforeEach, describe, expect, it, mock } from "bun:test";

import { learnProjectConventions } from "../project/conventions.js";

// Mock AI and DB
mock.module("ai", () => ({
  generateObject: async () => ({
    object: {
      conventions: [
        {
          id: "use-bun-test",
          description: "Project uses Bun test",
          type: "tooling",
        },
      ],
    },
  }),
}));

mock.module("@alfred/agent/v6", () => ({
  getOpenAI: () => () => ({ chat: () => ({}) }),
  getModelId: () => "gpt-4o-mini",
}));

const mockUpdateProject = mock(async () => ({}));
const mockGetProjectById = mock(async () => ({
  id: "proj-123",
  config: { conventions: [] },
}));

mock.module("@alfred/db", () => ({
  projectRepo: {
    getProjectById: mockGetProjectById,
    updateProject: mockUpdateProject,
  },
}));

describe("Project Convention Learning", () => {
  beforeEach(() => {
    mockUpdateProject.mockClear();
    mockGetProjectById.mockClear();
  });

  it("should extract and store new conventions from successful runs", async () => {
    const mockRun = { id: "run-123" } as any;

    await learnProjectConventions(mockRun, "proj-123", "Summary of success");

    expect(mockUpdateProject).toHaveBeenCalled();
    const callArgs = mockUpdateProject.mock.calls[0];
    expect(callArgs[1].config.conventions).toContainEqual(
      expect.objectContaining({ id: "use-bun-test" })
    );
  });

  it("should refine existing conventions if IDs match", async () => {
    mockGetProjectById.mockImplementation(
      async () =>
        ({
          id: "proj-123",
          config: {
            conventions: [
              { id: "use-bun-test", description: "Old desc", type: "tooling" },
            ],
          },
        }) as any
    );

    const mockRun = { id: "run-123" } as any;

    await learnProjectConventions(mockRun, "proj-123", "Refined success");

    const callArgs = mockUpdateProject.mock.calls[0];
    expect(callArgs[1].config.conventions[0].description).toBe(
      "Project uses Bun test"
    );
  });
});
