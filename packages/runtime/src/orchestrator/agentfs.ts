import { logger } from "@alfred/logger";
import path from "node:path";

const DEFAULT_CONTAINER_CW = "/workspace";

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "-");
}

async function resolveProjectId(args: {
  runId: string;
  workspace: string;
  userId?: string;
}): Promise<string | undefined> {
  const url = process.env.DATABASE_URL;
  if (url && !url.startsWith("sqlite")) {
    try {
      const workflowRepo = await import("@alfred/db/repo/workflow");
      const run = await workflowRepo.getRun(args.runId);
      if (run?.projectId) {
        return run.projectId;
      }
    } catch (error) {
      logger.debug("agentfs_container_projectid_lookup_failed", {
        runId: args.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (args.userId) {
    try {
      const { detectProject } = await import("@alfred/plan");
      const project = await detectProject(args.workspace, args.userId);
      return project.id;
    } catch (error) {
      logger.debug("agentfs_container_project_detect_failed", {
        runId: args.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return;
}

export function resolveAgentfsContainerCw(args: {
  workspaceRoot: string;
  workingDirectory: string;
  containerBaseCw?: string;
}): string {
  const baseCw = args.containerBaseCw ?? DEFAULT_CONTAINER_CW;
  const rel = path.relative(args.workspaceRoot, args.workingDirectory);
  const relPosix = rel.split(path.sep).join(path.posix.sep);
  if (relPosix && !relPosix.startsWith("..") && relPosix !== ".") {
    return path.posix.join(baseCw, relPosix);
  }
  return baseCw;
}

export async function resolveAgentfsContainer(args: {
  runId: string;
  workspace: string;
  userId?: string;
}): Promise<{ containerName: string; containerBaseCw: string }> {
  const projectId = await resolveProjectId(args);
  const containerName = projectId
    ? `alfred-agentfs-project-${sanitizeId(projectId)}`
    : `alfred-agentfs-${sanitizeId(args.runId)}`;
  return { containerName, containerBaseCw: DEFAULT_CONTAINER_CW };
}
