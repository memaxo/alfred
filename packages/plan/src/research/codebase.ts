import { ContextBuilder } from "@alfred/runtime/context";
import { logger } from "@alfred/logger";

/**
 * Gather codebase context for internal research
 * Wraps existing ContextBuilder.gatherCodeContext()
 */
export async function gatherCodebaseContext(options: {
  requirement: string;
  workspace?: string;
  topK?: number;
}): Promise<string[]> {
  try {
    const contextBuilder = new ContextBuilder();
    // ContextBuilder.build() handles gatherCodeContext internally
    const context = await contextBuilder.build({
      requirement: options.requirement,
      workspace: options.workspace,
      topK: options.topK ?? 10,
    });

    // Transform receipts -> ResearchResult.internal.existingCode
    // filter(Boolean) to ensure we only return strings
    return (context.receipts.code || [])
      .map((f) => f.path)
      .filter((p): p is string => typeof p === "string");
  } catch (error) {
    logger.error("codebase_research_failed", {
      error: error instanceof Error ? error.message : String(error),
      requirement: options.requirement,
    });
    return [];
  }
}
