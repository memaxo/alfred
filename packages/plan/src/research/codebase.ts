import { logger } from "@alfred/logger";

const USE_CODEPRINT = process.env.CODEPRINT_ENABLED !== "0";

/**
 * Gather codebase context for internal research.
 * Uses @alfred/codeprint for fast keyword+rerank retrieval.
 * Falls back to legacy LLM-based context if codeprint fails.
 */
export async function gatherCodebaseContext(options: {
  requirement: string;
  workspace?: string;
  topK?: number;
}): Promise<string[]> {
  const workspace = options.workspace ?? process.cwd();
  const topK = options.topK ?? 10;

  if (USE_CODEPRINT) {
    try {
      const { findRelevantFiles } = await import("@alfred/codeprint");
      const results = await findRelevantFiles(
        workspace,
        options.requirement,
        topK
      );

      if (results.length > 0) {
        const first = results[0]!;
        logger.debug("codeprint_context_found", {
          count: results.length,
          method: first.method,
          topScore: first.score,
        });
        return results.map((r) => r.path);
      }
    } catch (error) {
      logger.warn("codeprint_failed_fallback", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fallback to legacy LLM-based context gathering
  try {
    const { gatherCodeContext } =
      await import("@alfred/agent/orchestrator/flow/context");
    const receipt = await gatherCodeContext({
      authz: undefined,
      cw: workspace,
      requirement: options.requirement,
      topK,
    });

    return (receipt.code ?? [])
      .map((item) => item.path)
      .filter((p): p is string => typeof p === "string");
  } catch (error) {
    logger.error("codebase_research_failed", {
      error: error instanceof Error ? error.message : String(error),
      requirement: options.requirement,
    });
    return [];
  }
}
