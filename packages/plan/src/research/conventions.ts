import { projectRepo } from "@alfred/db";
import { logger } from "@alfred/logger";

import type { Convention } from "./types.js";

type StoredConvention = {
  id?: unknown;
  description?: unknown;
  confidence?: unknown;
};

/**
 * Extract project-specific conventions
 */
export async function extractConventions(
  projectId?: string
): Promise<Convention[]> {
  if (!projectId) {
    return [];
  }

  try {
    const project = await projectRepo.getProjectById(projectId);
    if (!project) {
      return [];
    }

    const config = project.config as Record<string, unknown> | null;
    const raw = config?.conventions;

    if (!Array.isArray(raw)) {
      return [];
    }

    const out: Convention[] = [];
    for (const item of raw as StoredConvention[]) {
      if (!item || typeof item !== "object") {
        continue;
      }

      if (typeof item.id !== "string" || typeof item.description !== "string") {
        continue;
      }

      const conf =
        typeof item.confidence === "number" && Number.isFinite(item.confidence)
          ? Math.max(0, Math.min(1, item.confidence))
          : 0.75;

      out.push({
        id: item.id,
        description: item.description,
        confidence: conf,
      });
    }

    return out;
  } catch (error) {
    logger.debug("internal_research_conventions_extract_failed", {
      error: error instanceof Error ? error.message : String(error),
      projectId,
    });
    return [];
  }
}
