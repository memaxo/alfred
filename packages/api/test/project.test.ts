import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const mockProjectRepo = {
  getProjectById: mock(),
  getProjectsByUserId: mock(),
  updateProject: mock(),
};

const mockGetLinearByWorkspace = mock();

mock.module("@alfred/db", () => ({
  projectRepo: mockProjectRepo,
  linearRepo: {
    getLinearByWorkspace: mockGetLinearByWorkspace,
  },
}));

const mockTeams = mock(() => ({
  nodes: [{ id: "team-123" }],
}));
const mockLinearProject = mock((id: string) => {
  if (id === "lin-123") {
    return {
      id: "lin-123",
      name: "Linear Project",
      teams: mockTeams,
      state: Promise.resolve({ name: "Started" }),
    };
  }
  return null;
});

mock.module("@linear/sdk", () => ({
  LinearClient: class {
    project = mockLinearProject;
  },
}));

import * as plan from "@alfred/plan";
import { TRPCError } from "@trpc/server";
import { projectRouter } from "../src/routers/project";

describe("projectRouter", () => {
  const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

  const createCaller = (user: { id: string } | null = { id: "user-123" }) =>
    projectRouter.createCaller({
      session: user ? ({ user } as any) : null,
    } as any);

  beforeEach(() => {
    mockProjectRepo.getProjectById.mockReset();
    mockProjectRepo.getProjectsByUserId.mockReset();
    mockProjectRepo.updateProject.mockReset();
    mockGetLinearByWorkspace.mockReset();
    mockLinearProject.mockClear();
    mockTeams.mockClear();
  });

  describe("detect", () => {
    it("detects a project for the authenticated user", async () => {
      const detectProjectSpy = spyOn(plan, "detectProject");
      const mockProject = { id: VALID_UUID, name: "test" } as any;
      detectProjectSpy.mockResolvedValue(mockProject);

      const caller = createCaller();
      const result = await caller.detect({
        workspace: "/path/to/workspace",
      });

      expect(result).toEqual(mockProject);
      expect(detectProjectSpy).toHaveBeenCalledWith(
        "/path/to/workspace",
        "user-123"
      );
      detectProjectSpy.mockRestore();
    });

    it("throws UNAUTHORIZED if no session", async () => {
      const caller = createCaller(null);
      await expect(caller.detect({ workspace: "/path" })).rejects.toThrow(
        TRPCError
      );
    });
  });

  describe("linkLinear", () => {
    it("links a Linear project if owned by user", async () => {
      const mockProject = {
        id: VALID_UUID,
        userId: "user-123",
        workspace: "/path",
        config: {},
      } as any;
      mockProjectRepo.getProjectById.mockResolvedValue(mockProject);
      mockGetLinearByWorkspace.mockResolvedValue({ token: "tk" });
      mockProjectRepo.updateProject.mockImplementation(async (_id: string, data: any) => ({
        ...mockProject,
        ...data,
      }));

      const caller = createCaller();
      const result = await caller.linkLinear({
        projectId: VALID_UUID,
        linearProjectId: "lin-123",
      });

      expect(result.linearProjectId).toBe("lin-123");
      expect(result.linearTeamId).toBe("team-123");
    });

    it("throws FORBIDDEN if linking project owned by another user", async () => {
      const mockProject = { id: VALID_UUID, userId: "other-user" } as any;
      mockProjectRepo.getProjectById.mockResolvedValue(mockProject);

      const caller = createCaller();
      await expect(
        caller.linkLinear({
          projectId: VALID_UUID,
          linearProjectId: "lin-123",
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("get", () => {
    it("returns a project by ID if owned by user", async () => {
      const mockProject = { id: VALID_UUID, userId: "user-123" } as any;
      mockProjectRepo.getProjectById.mockResolvedValue(mockProject);

      const caller = createCaller();
      const result = await caller.get({ id: VALID_UUID });

      expect(result).toEqual(mockProject);
    });

    it("throws FORBIDDEN if project owned by another user", async () => {
      const mockProject = { id: VALID_UUID, userId: "other-user" } as any;
      mockProjectRepo.getProjectById.mockResolvedValue(mockProject);

      const caller = createCaller();
      try {
        await caller.get({ id: VALID_UUID });
        expect.unreachable();
      } catch (error: any) {
        expect(error).toBeInstanceOf(TRPCError);
        expect(error.code).toBe("FORBIDDEN");
      }
    });

    it("throws NOT_FOUND if project does not exist", async () => {
      mockProjectRepo.getProjectById.mockResolvedValue(null);

      const caller = createCaller();
      try {
        await caller.get({ id: VALID_UUID });
        expect.unreachable();
      } catch (error: any) {
        expect(error).toBeInstanceOf(TRPCError);
        expect(error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("list", () => {
    it("lists projects for the authenticated user", async () => {
      const mockProjects = [{ id: "p1" }, { id: "p2" }] as any[];
      mockProjectRepo.getProjectsByUserId.mockResolvedValue(mockProjects);

      const caller = createCaller();
      const result = await caller.list();

      expect(result).toEqual(mockProjects);
      expect(mockProjectRepo.getProjectsByUserId).toHaveBeenCalledWith(
        "user-123"
      );
    });
  });
});
