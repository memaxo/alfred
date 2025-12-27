import { linearRepo, projectRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import { LinearClient } from "@linear/sdk";
import type { Project } from "./types.js";

/**
 * Get a Linear client for a given project or space
 */
async function getLinearClient(space: string): Promise<LinearClient> {
  const installation = await linearRepo.getLinearByWorkspace(space);
  if (!installation) {
    throw new Error(`Linear installation not found for space: ${space}`);
  }

  return new LinearClient({
    accessToken: installation.token,
  });
}

/**
 * Link an ALFRED Project to a Linear Project
 */
export async function linkLinearProject(
  projectId: string,
  linearProjectId: string,
  options?: {
    syncMetadata?: boolean; // Default: true
  }
): Promise<Project> {
  const project = await projectRepo.getProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const client = await getLinearClient(project.workspace);

  // 1. Resolve Linear Project to get team IDs
  const linearProject = await client.project(linearProjectId);
  if (!linearProject) {
    throw new Error(`Linear Project not found: ${linearProjectId}`);
  }

  const teams = await linearProject.teams();
  const teamIds = teams.nodes.map((t) => t.id);

  if (teamIds.length === 0) {
    throw new Error(`Linear Project ${linearProjectId} has no teams`);
  }

  // 2. Update project with Linear IDs
  const updatedProject = await projectRepo.updateProject(projectId, {
    linearProjectId,
    linearTeamId: teamIds[0], // Use first team
  });

  // 3. Sync metadata if requested
  if (options?.syncMetadata !== false) {
    await syncProjectMetadata(projectId, linearProjectId);
  }

  return updatedProject;
}

/**
 * Sync metadata from Linear Project to ALFRED Project
 */
export async function syncProjectMetadata(
  projectId: string,
  linearProjectId: string
): Promise<void> {
  const project = await projectRepo.getProjectById(projectId);
  if (!project) {
    return;
  }

  const client = await getLinearClient(project.workspace);
  const linearProject = await client.project(linearProjectId);
  if (!linearProject) {
    return;
  }

  const state = await linearProject.state;

  // Sync name, description, status
  await projectRepo.updateProject(projectId, {
    name: linearProject.name ?? project.name,
    config: {
      ...(project.config as Record<string, unknown>),
      linear: {
        name: linearProject.name,
        description: linearProject.description,
        status: typeof state === "string" ? state : (state as any)?.name,
        startDate: linearProject.startDate,
        targetDate: linearProject.targetDate,
      },
    },
  });

  logger.info("project_metadata_synced", {
    projectId,
    linearProjectId,
    name: linearProject.name,
  });
}

/**
 * Sync logic triggered on workflow start
 */
export async function syncOnWorkflowStart(
  projectId: string,
  _workflowId: string
): Promise<void> {
  const project = await projectRepo.getProjectById(projectId);
  if (!project?.linearProjectId) {
    return; // No Linear link, skip sync
  }

  // Future: Update Linear Project last activity if API supports it
  // For now, just log or trigger a background metadata sync
  try {
    await syncProjectMetadata(projectId, project.linearProjectId);
  } catch (error) {
    logger.warn("workflow_start_linear_sync_failed", {
      projectId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
