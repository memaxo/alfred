import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockGetProjectById = mock();
const mockUpdateProject = mock();
const mockGetLinearByWorkspace = mock();

mock.module("@alfred/db", () => ({
  projectRepo: {
    getProjectById: mockGetProjectById,
    updateProject: mockUpdateProject,
  },
  linearRepo: {
    getLinearByWorkspace: mockGetLinearByWorkspace,
  },
}));

// Mock Linear SDK
const mockTeams = mock(() => ({
  nodes: [{ id: "team-123" }],
}));
const mockProject = mock((id: string) => {
  if (id === "linear-123") {
    return {
      id: "linear-123",
      name: "Linear Project",
      description: "Desc",
      startDate: "2026-01-01",
      targetDate: "2026-12-31",
      teams: mockTeams,
      state: Promise.resolve({ name: "Started" }),
    };
  }
  return null;
});

mock.module("@linear/sdk", () => ({
  LinearClient: class {
    project = mockProject;
  },
}));

describe("Linear Sync", () => {
  beforeEach(() => {
    mockGetProjectById.mockReset();
    mockUpdateProject.mockReset();
    mockGetLinearByWorkspace.mockReset();
    mockTeams.mockClear();
    mockProject.mockClear();
  });

  it("should link a project and sync metadata", async () => {
    const { linkLinearProject } = await import("../project/linear.js");
    const alfredProjectId = "123e4567-e89b-12d3-a456-426614174000";
    const linearProjectId = "linear-123";

    mockGetProjectById.mockResolvedValue({
      id: alfredProjectId,
      workspace: "/path/to/project",
      linearSpaceId: "space-123",
      config: {},
    });

    mockGetLinearByWorkspace.mockResolvedValue({
      token: "lin_token_123",
    });

    mockUpdateProject.mockImplementation(async (_id: string, data: any) => ({
      id: alfredProjectId,
      ...data,
    }));

    const result = await linkLinearProject(alfredProjectId, linearProjectId);

    expect(result.linearProjectId).toBe(linearProjectId);
    expect(result.linearTeamId).toBe("team-123");
    expect(result.linearSpaceId).toBe("space-123");
    expect(mockUpdateProject).toHaveBeenCalled();

    // Check that metadata was synced (call to updateProject includes config.linear)
    const updateCalls = mockUpdateProject.mock.calls;
    const hasLinearMeta = updateCalls.some(
      (call) => call[1].config?.linear?.name === "Linear Project"
    );
    expect(hasLinearMeta).toBe(true);
  });

  it("should throw if project not found", async () => {
    const { linkLinearProject } = await import("../project/linear.js");
    mockGetProjectById.mockResolvedValue(null);
    await expect(linkLinearProject("bad-id", "lin-123")).rejects.toThrow(
      "Project not found"
    );
  });

  it("should throw if Linear installation not found", async () => {
    const { linkLinearProject } = await import("../project/linear.js");
    mockGetProjectById.mockResolvedValue({
      id: "id",
      workspace: "/path",
      linearSpaceId: "space-123",
    });
    mockGetLinearByWorkspace.mockResolvedValue(null);

    await expect(linkLinearProject("id", "lin-123")).rejects.toThrow(
      "Linear installation not found"
    );
  });

  it("should throw if Linear project not found", async () => {
    const { linkLinearProject } = await import("../project/linear.js");
    mockGetProjectById.mockResolvedValue({
      id: "id",
      workspace: "/path",
      linearSpaceId: "space-123",
    });
    mockGetLinearByWorkspace.mockResolvedValue({ token: "tk" });
    mockProject.mockResolvedValue(null);

    await expect(linkLinearProject("id", "not-found")).rejects.toThrow(
      "Linear Project not found"
    );
  });

  it("should throw if Linear workspace id is missing", async () => {
    const { linkLinearProject } = await import("../project/linear.js");
    mockGetProjectById.mockResolvedValue({
      id: "id",
      workspace: "/path",
      linearSpaceId: null,
    });

    await expect(linkLinearProject("id", "lin-123")).rejects.toThrow(
      "linear_space_required"
    );
  });
});
