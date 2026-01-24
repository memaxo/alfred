import { logger } from "@alfred/logger";

import { type WorkflowIntent } from "../intent/types.js";
import { gatherCodebaseContext } from "./codebase.js";
import { extractConventions } from "./conventions.js";
import { lookupPatterns } from "./patterns.js";
import { type Convention, type ResearchResult } from "./types.js";

/**
 * Gather internal research context for a workflow intent
 *
 * Aggregates codebase scanning, import analysis, pattern lookup, and convention extraction.
 */
export async function gatherInternalResearch(
  intent: WorkflowIntent,
  projectId?: string,
  options?: {
    maxFiles?: number; // Default: 10
    includePatterns?: boolean; // Default: true
    includeConventions?: boolean; // Default: true
  }
): Promise<ResearchResult["internal"]> {
  const startTime = Date.now();
  const maxFiles = options?.maxFiles ?? 10;
  const includePatterns = options?.includePatterns ?? true;
  const includeConventions = options?.includeConventions ?? true;

  try {
    // 1. Codebase context gathering (Wrap existing)
    const existingCode = await gatherCodebaseContext({
      requirement: intent.description,
      topK: maxFiles,
      workspace: intent.context.workspace,
    });

    // 2. Import analysis
    const { analyzeImports } =
      await import("@alfred/agent/orchestrator/reasoning/decompose-semantic");
    const imports = await analyzeImports({
      requirement: intent.description,
      workspace: intent.context.workspace,
    });

    // 3. Pattern lookup (Stub)
    const patterns = includePatterns
      ? await lookupPatterns(intent.description, projectId)
      : [];

    // 4. Convention extraction (Stub)
    const extractedConventions = includeConventions
      ? await extractConventions(projectId)
      : [];

    // Combine detected conventions from imports with extracted ones
    const conventions: Convention[] = includeConventions
      ? [
          ...extractedConventions,
          ...(imports?.detectedPatterns || []).map((p) => ({
            confidence: p.confidence,
            description: `Import pattern: ${p.pattern}`,
            id: `import-${p.pattern}`,
          })),
        ]
      : [];

    if (includePatterns && patterns.length === 0) {
      logger.debug("internal_research_patterns_unavailable", {
        intentId: intent.id,
      });
    }

    if (includeConventions && conventions.length === 0) {
      logger.debug("internal_research_conventions_unavailable", {
        intentId: intent.id,
      });
    }

    const durationMs = Date.now() - startTime;
    logger.info("internal_research_complete", {
      conventionsCount: conventions.length,
      durationMs,
      existingCodeCount: existingCode.length,
      intentId: intent.id,
      patternsCount: patterns.length,
    });

    return {
      conventions,
      existingCode,
      patterns,
    };
  } catch (error) {
    logger.error("internal_research_failed", {
      error: error instanceof Error ? error.message : String(error),
      intentId: intent.id,
    });
    return {
      conventions: [],
      existingCode: [],
      patterns: [],
    };
  }
}
