// packages/plan/src/project/detect.ts
import { projectRepo } from "@alfred/db";

import type { Project } from "./types.js";

import { detectConfig } from "./config.js";

/**
 * Detect or create a project based on workspace path and user ID
 */
export async function detectProject(
  workspace: string,
  userId: string
): Promise<Project> {
  // 1. Check if project exists for user+workspace
  const existing = await projectRepo.getProjectByWorkspace(userId, workspace);
  if (existing) {
    if (existing.archivedAt) {
      await projectRepo.unarchiveProject(existing.id);
    }
    await projectRepo.updateProjectLastActive(existing.id);
    return (await projectRepo.getProjectById(existing.id)) ?? existing;
  }

  // 2. Auto-create project from workspace
  const name = extractProjectName(workspace);
  const slug = slugify(name);
  const config = await detectConfig(workspace);

  const project = await projectRepo.createProject({
    userId,
    name,
    slug,
    workspace,
    config,
  });

  return project;
}

/**
 * Extract project name from workspace path
 */
function extractProjectName(workspace: string): string {
  // Handle trailing slashes
  const parts = workspace.replace(/\/+$/, "").split("/");
  return parts.pop() ?? "unknown";
}

/**
 * Create a URL-safe slug from a string
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}
