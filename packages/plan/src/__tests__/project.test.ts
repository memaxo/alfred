// packages/plan/src/__tests__/project.test.ts
import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockGetByWorkspace = mock();
const mockUpdateLastActive = mock();
const mockCreateProject = mock();

mock.module("@alfred/db", () => ({
  projectRepo: {
    getProjectByWorkspace: mockGetByWorkspace,
    updateProjectLastActive: mockUpdateLastActive,
    createProject: mockCreateProject,
  },
}));

import { detectFramework } from "../project/config.js";

describe("Project Detection", () => {
  beforeEach(() => {
    mockGetByWorkspace.mockReset();
    mockGetByWorkspace.mockResolvedValue(null);

    mockUpdateLastActive.mockReset();
    mockUpdateLastActive.mockResolvedValue(undefined);

    mockCreateProject.mockReset();
    mockCreateProject.mockImplementation(async (data: any) => ({
      id: "project-123",
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  });

  it("should detect framework from package.json", () => {
    expect(detectFramework({ dependencies: { next: "14.0.0" } })).toBe(
      "nextjs"
    );
    expect(
      detectFramework({ dependencies: { "@tanstack/start": "1.0.0" } })
    ).toBe("tanstack");
    expect(detectFramework({ dependencies: { expo: "50.0.0" } })).toBe("expo");
    expect(detectFramework({ dependencies: { react: "18.2.0" } })).toBe(
      "react"
    );
    expect(detectFramework({ dependencies: {} })).toBe("unknown");
  });

  it("should extract project name from workspace path", async () => {
    const { detectProject } = await import("../project/detect.js");
    const project = await detectProject("/Users/test/my-project", "user-123");

    expect(project).toBeDefined();
    expect(project.name).toBe("my-project");
    expect(project.slug).toBe("my-project");
    expect(project.userId).toBe("user-123");
    expect(project.workspace).toBe("/Users/test/my-project");
    expect(mockCreateProject).toHaveBeenCalled();
  });

  it("should slugify project names", async () => {
    const { detectProject } = await import("../project/detect.js");
    const project = await detectProject("/Users/test/My Project!", "user-123");
    expect(project).toBeDefined();
    expect(project.slug).toBe("my-project");
  });

  it("should return existing project and update lastActiveAt", async () => {
    const { detectProject } = await import("../project/detect.js");
    const mockProject = {
      id: "existing-123",
      userId: "user-123",
      name: "existing",
      slug: "existing",
      workspace: "/Users/test/existing",
    };
    mockGetByWorkspace.mockResolvedValue(mockProject);

    const project = await detectProject("/Users/test/existing", "user-123");

    expect(project).toBeDefined();
    expect(project.id).toBe("existing-123");
    expect(mockUpdateLastActive).toHaveBeenCalledWith("existing-123");
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  it("should handle project creation failure", async () => {
    const { detectProject } = await import("../project/detect.js");
    mockCreateProject.mockRejectedValue(new Error("db_error"));

    await expect(detectProject("/Users/test/new", "user-123")).rejects.toThrow(
      "db_error"
    );
  });
});
