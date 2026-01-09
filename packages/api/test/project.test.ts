import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";

const mockProjectRepo = {
  getProjectById: mock(),
  getProjectsByUserId: mock(),
  updateProject: mock(),
  archiveProject: mock(),
  unarchiveProject: mock(),
};

const mockGetLinearByOAuth = mock();

mock.module("@alfred/db", () => ({
  projectRepo: mockProjectRepo,
}));

mock.module("@alfred/db/repo/linear", () => ({
  getLinearByOAuth: (...args: Parameters<typeof mockGetLinearByOAuth>) =>
    mockGetLinearByOAuth(...args),
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
  const originalLinearClientId = process.env.LINEAR_CLIENT_ID;

  const createCaller = (user: { id: string } | null = { id: "user-123" }) =>
    projectRouter.createCaller({
      session: user ? ({ user } as any) : null,
    } as any);

  beforeEach(() => {
    process.env.LINEAR_CLIENT_ID = "test-client-id";
    mockProjectRepo.getProjectById.mockReset();
    mockProjectRepo.getProjectsByUserId.mockReset();
    mockProjectRepo.updateProject.mockReset();
    mockProjectRepo.archiveProject.mockReset();
    mockProjectRepo.unarchiveProject.mockReset();
    mockGetLinearByOAuth.mockReset();
    mockLinearProject.mockClear();
    mockTeams.mockClear();
  });

  afterAll(() => {
    process.env.LINEAR_CLIENT_ID = originalLinearClientId;
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

      mockGetLinearByOAuth.mockResolvedValue({
        token: "tk",
        space: "space-123",
      });

      const linkSpy = spyOn(plan, "linkLinearProject");
      linkSpy.mockResolvedValue({
        ...mockProject,
        linearSpaceId: "space-123",
        linearProjectId: "lin-123",
        linearTeamId: "team-123",
      } as any);

      const caller = createCaller();
      const result = await caller.linkLinear({
        projectId: VALID_UUID,
        linearProjectId: "lin-123",
      });

      expect(result.linearProjectId).toBe("lin-123");
      expect(result.linearTeamId).toBe("team-123");

      expect(mockGetLinearByOAuth).toHaveBeenCalledWith("test-client-id");
      expect(linkSpy).toHaveBeenCalledWith(VALID_UUID, "lin-123", {
        linearSpaceId: "space-123",
      });

      linkSpy.mockRestore();
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

  describe("archive", () => {
    it("archives a project owned by the user", async () => {
      const project = { id: VALID_UUID, userId: "user-123" } as any;
      const archived = { ...project, archivedAt: new Date() } as any;

      mockProjectRepo.getProjectById
        .mockResolvedValueOnce(project)
        .mockResolvedValueOnce(archived);
      mockProjectRepo.archiveProject.mockResolvedValue(undefined);

      const caller = createCaller();
      const result = await caller.archive({ id: VALID_UUID, reason: "done" });

      expect(mockProjectRepo.archiveProject).toHaveBeenCalledWith(
        VALID_UUID,
        "done"
      );
      expect(result.archivedAt).toBeTruthy();
    });

    it("throws FORBIDDEN if archiving project owned by another user", async () => {
      mockProjectRepo.getProjectById.mockResolvedValue({
        id: VALID_UUID,
        userId: "other-user",
      } as any);

      const caller = createCaller();
      await expect(caller.archive({ id: VALID_UUID })).rejects.toThrow(
        TRPCError
      );
    });
  });

  describe("unarchive", () => {
    it("unarchives a project owned by the user", async () => {
      const project = {
        id: VALID_UUID,
        userId: "user-123",
        archivedAt: new Date(),
      } as any;
      const unarchived = { ...project, archivedAt: null } as any;

      mockProjectRepo.getProjectById
        .mockResolvedValueOnce(project)
        .mockResolvedValueOnce(unarchived);
      mockProjectRepo.unarchiveProject.mockResolvedValue(undefined);

      const caller = createCaller();
      const result = await caller.unarchive({ id: VALID_UUID });

      expect(mockProjectRepo.unarchiveProject).toHaveBeenCalledWith(VALID_UUID);
      expect(result.archivedAt).toBeFalsy();
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
