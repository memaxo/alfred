import {
  appendDecisionLogEntry,
  applyProgressUpdate,
} from "@alfred/agent/orchestrator/multi/execplan";
import { logger } from "@alfred/logger";
import { mkdir } from "node:fs/promises";
import * as path from "node:path";

/**
 * Safely read, mutate, and write an ExecPlan markdown file.
 * Creates parent directories if needed. No-op if mutation returns unchanged content.
 */
export async function mutateExecPlanFile(
  filePath: string,
  mutate: (markdown: string) => string
): Promise<void> {
  let current = "";
  try {
    const file = Bun.file(filePath);
    if (await file.exists()) {
      current = await file.text();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.warn("execplan_read_failed", {
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    try {
      await mkdir(path.dirname(filePath), { recursive: true });
    } catch (error) {
      logger.warn("execplan_dir_failed", {
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }

  const updated = mutate(current);
  if (updated === current) {
    return;
  }
  try {
    await Bun.write(filePath, updated);
  } catch (error) {
    logger.warn("execplan_write_failed", {
      path: filePath,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Append a progress entry to an ExecPlan file.
 */
export async function appendPlanProgressEntry(
  filePath: string,
  message: string,
  completed: boolean
): Promise<void> {
  const timestampIso = new Date().toISOString();
  await mutateExecPlanFile(filePath, (markdown) =>
    applyProgressUpdate(markdown, {
      timestampIso,
      message,
      completed,
    })
  );
}

/**
 * Append a decision log entry to an ExecPlan file.
 */
export async function appendDecisionEntry(
  filePath: string,
  decision: string,
  rationale?: string,
  note?: string
): Promise<void> {
  const timestampIso = new Date().toISOString();
  await mutateExecPlanFile(filePath, (markdown) =>
    appendDecisionLogEntry(markdown, {
      decision,
      rationale,
      note,
      dateIso: timestampIso,
      author: "runtime",
    })
  );
}
