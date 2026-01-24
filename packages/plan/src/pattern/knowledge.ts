import type { WorkflowPattern } from "@alfred/db/repo/pattern";

import { ensureMirrorNodes } from "@alfred/db/repo/graph/write";
import { logger } from "@alfred/logger";

/**
 * Sync a WorkflowPattern to the Knowledge Graph for semantic matching.
 */
export async function syncPatternToKnowledgeGraph(
  pattern: WorkflowPattern
): Promise<void> {
  try {
    await ensureMirrorNodes("user", [
      {
        kind: "workflow_pattern",
        id: pattern.id,
        label: `Pattern: ${pattern.trigger}`,
        properties: {
          trigger: pattern.trigger,
          successRate: pattern.successRate,
          avgDurationMs: pattern.avgDurationMs,
          usageCount: pattern.usageCount,
          entity: { kind: "workflow_pattern", id: pattern.id },
        },
      },
    ]);

    logger.debug("pattern_synced_to_knowledge_graph", {
      patternId: pattern.id,
      trigger: pattern.trigger,
    });
  } catch (error) {
    logger.warn("pattern_knowledge_sync_failed", {
      patternId: pattern.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
