import { projectRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";

import type { WorkflowRunLike } from "../pattern/extract.js";

import { getModelId, getOpenAI } from "../ai.js";

/**
 * Extract project conventions from a successful workflow run and update the project entity.
 */
export async function learnProjectConventions(
  run: WorkflowRunLike,
  projectId: string,
  summary: string
): Promise<void> {
  const project = await projectRepo.getProjectById(projectId);
  if (!project) {
    return;
  }

  // Use AI to extract conventions from the summary of changes
  try {
    const { object } = await generateObject({
      model: getOpenAI()(getModelId()) as unknown as LanguageModel,
      schema: z.object({
        conventions: z.array(
          z.object({
            id: z.string().describe("kebab-case identifier for the convention"),
            description: z
              .string()
              .describe("Clear, concise description of the learned convention"),
            type: z
              .enum(["naming", "structure", "tooling", "architecture"])
              .default("naming"),
          })
        ),
      }),
      prompt: `Analyze the following summary of successful changes in a software project and extract any recurring naming, structure, tooling, or architecture conventions.
      
Summary of Changes:
${summary}

Existing Project Config:
${JSON.stringify(project.config, null, 2)}

Return a list of NEW or REFINED conventions in JSON format.`,
    });

    if (object.conventions.length > 0) {
      const config = project.config as {
        conventions?: { id: string; description: string; type: string }[];
      };
      const existingConventions = config.conventions ?? [];
      const updatedConventions = [...existingConventions];

      for (const newConv of object.conventions) {
        const index = updatedConventions.findIndex((c) => c.id === newConv.id);
        const existing = updatedConventions[index];
        if (index !== -1 && existing) {
          updatedConventions[index] = {
            ...existing,
            ...newConv,
          };
        } else {
          updatedConventions.push(newConv);
        }
      }

      await projectRepo.updateProject(projectId, {
        config: {
          ...(project.config as Record<string, unknown>),
          conventions: updatedConventions,
        },
      });

      logger.info("project_conventions_learned", {
        projectId,
        runId: run.id,
        count: object.conventions.length,
      });
    }
  } catch (error) {
    logger.warn("convention_learning_failed", {
      projectId,
      runId: run.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
