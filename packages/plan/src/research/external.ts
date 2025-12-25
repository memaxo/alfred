import { gatherWebContext } from "@alfred/agent/orchestrator/flow/context";
import type { WorkflowIntent } from "../intent/types.js";
import { applyDateFilter, detectFrameworkVersion } from "./filter.js";
import { calculateReliability, calculateRelevance } from "./score.js";
import type {
  ResearchOptions,
  ResearchResult,
  ResearchSource,
} from "./types.js";

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
 * Wraps existing web search infrastructure and transforms it into structured ResearchResult
 */
export async function gatherExternalResearch(
  intent: WorkflowIntent,
  options?: ResearchOptions
): Promise<ResearchResult["external"]> {
  const maxResults = options?.maxResults ?? 5;
  const minReliability = options?.minReliability ?? 0.5;
  const dateFilter = options?.dateFilter ?? "recent";

  // 1. Gather web context using existing agent infrastructure
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
 * Gather full research result with metadata
 *
 * Returns the complete ResearchResult structure including metadata
 */
export async function gatherFullResearch(
  intent: WorkflowIntent,
  options?: ResearchOptions
): Promise<ResearchResult> {
  const startTime = Date.now();
  const external = await gatherExternalResearch(intent, options);
  const durationMs = Date.now() - startTime;

  // Calculate approximate token count (rough estimate: 4 chars per token)
  const tokenCount = external.reduce((sum, source) => {
    const textLength =
      source.title.length +
      source.summary.length +
      (source.highlights?.join(" ").length ?? 0);
    return sum + Math.ceil(textLength / 4);
  }, 0);

  return {
    external,
    internal: {
      existingCode: [],
      patterns: [],
      conventions: [],
    },
    metadata: {
      totalSources: external.length,
      tokenCount,
      researchDurationMs: durationMs,
      // searchType and context would come from the web receipt if available
    },
  };
}
