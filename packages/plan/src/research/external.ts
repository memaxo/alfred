import { logger } from "@alfred/logger";
import type { WorkflowIntent } from "../intent/types.js";
import { aggregateResearch } from "./aggregate.js";
import { applyDateFilter, detectFrameworkVersion } from "./filter.js";
import { gatherInternalResearch } from "./internal.js";
import { calculateRelevance, calculateReliability } from "./score.js";
import type {
  ResearchOptions,
  ResearchResult,
  ResearchSource,
} from "./types.js";

/**
 * Lazy load agent tools to break circular dependency
 */
async function getAgentTools() {
  const { gatherWebContext } = await import(
    "@alfred/agent/orchestrator/flow/context"
  );
  const { toolWeb } = await import("@alfred/agent/orchestrator/tool/web");
  return { gatherWebContext, toolWeb };
}

/**
 * Transform a search receipt item to a ResearchSource with all Exa fields
 */
function transformToResearchSource(
  source: {
    id: string;
    url?: string;
    title?: string;
    author?: string;
    snippet?: string;
    reason?: string;
    publishedDate?: string;
    highlights?: string[];
    highlightScores?: number[];
    summary?: string;
    links?: string[];
    subpages?: Array<{
      url?: string;
      title?: string;
      author?: string;
      summary?: string;
      snippet?: string;
      highlights?: string[];
      highlightScores?: number[];
      publishedDate?: string;
    }>;
  },
  intentDescription: string
): ResearchSource {
  const publishedDate = source.publishedDate
    ? new Date(source.publishedDate)
    : undefined;
  const content = source.snippet ?? source.reason ?? source.summary ?? "";

  const reliability = calculateReliability({
    url: source.url ?? "",
    publishedDate,
    content,
  });

  const relevanceScore = calculateRelevance(
    {
      title: source.title ?? "",
      summary: source.snippet ?? source.summary ?? "",
      content,
    },
    intentDescription
  );

  const frameworkVersion = detectFrameworkVersion(content);

  // Transform subpages recursively
  const subpages: ResearchSource[] | undefined = source.subpages?.map((sub) =>
    transformToResearchSource(
      {
        id: sub.url ?? "",
        url: sub.url,
        title: sub.title,
        author: sub.author,
        snippet: sub.snippet,
        summary: sub.summary,
        highlights: sub.highlights,
        highlightScores: sub.highlightScores,
        publishedDate: sub.publishedDate,
      },
      intentDescription
    )
  );

  return {
    id: source.id,
    source: source.url ?? source.id,
    title: source.title ?? source.url ?? "Untitled Source",
    author: source.author,
    summary: source.snippet ?? source.summary ?? source.reason ?? "",
    highlights: source.highlights,
    highlightScores: source.highlightScores,
    reliability,
    relevanceScore,
    date: publishedDate,
    frameworkVersion,
    links: source.links,
    subpages: subpages && subpages.length > 0 ? subpages : undefined,
  };
}

/**
 * Gather external research context for a workflow intent
 *
 * Wraps existing web search infrastructure and transforms it into structured ResearchResult.
 * If searchType is 'deep', it uses Exa's research endpoint for high-quality structured data.
 */
export async function gatherExternalResearch(
  intent: WorkflowIntent,
  options?: ResearchOptions
): Promise<ResearchResult["external"]> {
  const maxResults = options?.maxResults ?? 5;
  const minReliability = options?.minReliability ?? 0.5;
  const dateFilter = options?.dateFilter ?? "recent";

  // If deep research is requested and we have Exa, use the research action
  const hasExa = Boolean(
    process.env.EXA_API_KEY && process.env.EXA_API_KEY.trim().length > 0
  );

  if (options?.searchType === "deep" && hasExa) {
    try {
      const { toolWeb } = await getAgentTools();
      const researchOutput = await toolWeb.execute({
        input: {
          action: "research",
          provider: "exa",
          authz: intent.userId,
          research: {
            instructions: `Research the following requirement for an AI-native workflow: "${intent.description}".
Gather high-quality documentation, code examples, and best practices.
Identify specific framework versions and compatibility constraints.`,
            numResults: maxResults,
          },
        },
      });

      if (researchOutput.ok && researchOutput.results) {
        return researchOutput.results.map((source) =>
          transformToResearchSource(
            source as Parameters<typeof transformToResearchSource>[0],
            intent.description
          )
        );
      }
    } catch (error) {
      // Fallback to regular search on error
      logger.error("deep_research_failed", {
        error: error instanceof Error ? error.message : String(error),
        intentId: intent.id,
      });
    }
  }

  // 1. Gather web context using existing agent infrastructure
  const { gatherWebContext } = await getAgentTools();
  const webReceipt = await gatherWebContext({
    requirement: intent.description,
    topK: maxResults * 2, // Fetch more to allow for filtering
    authz: intent.userId,
  });

  if (!webReceipt.web || webReceipt.web.length === 0) {
    return [];
  }

  // 2. Transform and score results with all Exa fields
  const external: ResearchSource[] = webReceipt.web.map((source) =>
    transformToResearchSource(source, intent.description)
  );

  // 3. Apply reliability filter
  const filteredByReliability = external.filter(
    (r) => r.reliability >= minReliability
  );

  // 4. Apply date filtering
  const filteredByDate = applyDateFilter(filteredByReliability, dateFilter);

  // 5. Sort by relevance and reliability, then take top K
  return filteredByDate
    .sort((a, b) => {
      const scoreA = a.relevanceScore * 0.7 + a.reliability * 0.3;
      const scoreB = b.relevanceScore * 0.7 + b.reliability * 0.3;
      return scoreB - scoreA;
    })
    .slice(0, maxResults);
}

/**
 * Gather full research result with metadata and aggregation
 *
 * Returns the complete ResearchResult structure including metadata,
 * deduplicated and prioritized.
 */
export async function gatherFullResearch(
  intent: WorkflowIntent,
  options?: ResearchOptions,
  projectId?: string
): Promise<ResearchResult> {
  // 1. Gather external research
  const external = await gatherExternalResearch(intent, options);

  // 2. Gather internal research (codebase, patterns, conventions)
  const internal = await gatherInternalResearch(intent, projectId);

  // 3. Aggregate into unified result
  return aggregateResearch(external, internal, {
    maxTokens: 8000,
    deduplicate: true,
    prioritize: "balanced",
  });
}
