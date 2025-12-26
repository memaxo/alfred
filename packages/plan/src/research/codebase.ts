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
    const { gatherCodeContext } = await import("@alfred/agent/orchestrator/flow/context");
    const receipt = await gatherCodeContext({
      requirement: options.requirement,
      cw: options.workspace ?? process.cwd(),
      topK: options.topK ?? 10,
      authz: undefined,
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
