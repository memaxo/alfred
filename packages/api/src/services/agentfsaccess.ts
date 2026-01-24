import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { isDbAvailable } from "../utils/service-availability";

export interface AgentfsAccessCheckInput {
  userId: string;
  runId: string;
  baseDir?: string | null;
  requestedProjectId?: string | null;
}

export type AgentfsAccessCheckResult =
  | { allow: true; projectId: string | null }
  | {
      allow: false;
      projectId: string | null;
      reason: "run_not_owned" | "project_mismatch";
    };

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

async function readRunProjectHint(args: {
  runId: string;
}): Promise<string | null> {
  const safe = args.runId.replaceAll(/[^a-zA-Z0-9-]/g, "-");
  if (!safe) {
    return null;
  }
  const p = path.join(process.cwd(), ".agentfs", safe, ".project");
  if (!existsSync(p)) {
    return null;
  }
  try {
    const raw = (await readFile(p, "utf8")).trim();
    return isUuid(raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function checkAgentfsAccess(
  args: AgentfsAccessCheckInput
): Promise<AgentfsAccessCheckResult> {
  const requestedProjectId = args.requestedProjectId ?? null;
  const dbOk = await isDbAvailable();
  if (!dbOk) {
    return { allow: true, projectId: null };
  }

  if (isUuid(args.runId)) {
    const { workflowRepo } = await import("@alfred/db");
    const run = await workflowRepo.getRun(args.runId);
    if (run) {
      const projectId =
        typeof run.projectId === "string" ? run.projectId : null;
      if (run.userId !== args.userId) {
        return { allow: false, projectId, reason: "run_not_owned" };
      }
      if (requestedProjectId && projectId && requestedProjectId !== projectId) {
        return { allow: false, projectId, reason: "project_mismatch" };
      }
      return { allow: true, projectId };
    }
  }

  if (args.baseDir) {
    const { projectRepo } = await import("@alfred/db");
    const project = await projectRepo.getProjectByWorkspace(
      args.userId,
      args.baseDir
    );
    if (project) {
      const projectId = project.id;
      if (requestedProjectId && requestedProjectId !== projectId) {
        return { allow: false, projectId, reason: "project_mismatch" };
      }
      return { allow: true, projectId };
    }
  }

  const hintedProjectId = await readRunProjectHint({ runId: args.runId });
  if (hintedProjectId) {
    const { projectRepo } = await import("@alfred/db");
    const project = await projectRepo.getProjectById(hintedProjectId);
    if (project && project.userId === args.userId) {
      const projectId = project.id;
      if (requestedProjectId && requestedProjectId !== projectId) {
        return { allow: false, projectId, reason: "project_mismatch" };
      }
      return { allow: true, projectId };
    }
  }

  return { allow: true, projectId: null };
}
