// packages/plan/src/__tests__/project.test.ts
import { describe, expect, it, mock, beforeEach } from "bun:test";
import { detectProject } from "../project/detect.js";
import { detectFramework, detectPackageManager } from "../project/config.js";

// Mock @alfred/db
mock.module("@alfred/db", () => ({
  projectRepo: {
    getProjectByWorkspace: mock(async () => null),
    updateProjectLastActive: mock(async () => {}),
    createProject: mock(async (data: any) => ({ id: "project-123", ...data })),
  },
}));

describe("Project Detection", () => {
  beforeEach(() => {
    mock.restore();
  });

  it("should detect framework from package.json", () => {
    expect(detectFramework({ dependencies: { next: "14.0.0" } })).toBe("nextjs");
    expect(detectFramework({ dependencies: { "@tanstack/start": "1.0.0" } })).toBe("tanstack");
    expect(detectFramework({ dependencies: { expo: "50.0.0" } })).toBe("expo");
    expect(detectFramework({ dependencies: { react: "18.2.0" } })).toBe("react");
    expect(detectFramework({ dependencies: {} })).toBe("unknown");
  });

  it("should extract project name from workspace path", async () => {
    const { projectRepo } = await import("@alfred/db");
    
    // We need to re-import detectProject after mocking db
    const { detectProject } = await import("../project/detect.js");

    const project = await detectProject("/Users/test/my-project", "user-123");
    
    expect(project.name).toBe("my-project");
    expect(project.slug).toBe("my-project");
    expect(project.userId).toBe("user-123");
    expect(project.workspace).toBe("/Users/test/my-project");
  });

  it("should slugify project names", async () => {
    const { detectProject } = await import("../project/detect.js");
    const project = await detectProject("/Users/test/My Project!", "user-123");
    expect(project.slug).toBe("my-project");
  });
});
