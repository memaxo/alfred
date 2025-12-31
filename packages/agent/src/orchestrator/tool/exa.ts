/**
 * Exa SDK Client
 *
 * Wraps the exa-js SDK for use in ALFRED web search tool.
 * See: https://docs.exa.ai/sdks/typescript-sdk-specification
 */

import type {
  ExaCost,
  ExaResearchResponse,
  ExaResearchResult,
  ExaSearchResult,
  ExaSearchType,
} from "@alfred/type";
import Exa from "exa-js";

let cachedClient: Exa | null = null;

/**
 * Check if Exa API key is configured
 */
export function hasExaApiKey(): boolean {
  const key = process.env.EXA_API_KEY;
  return Boolean(key && key.trim().length > 0);
}

/**
 * Get or create Exa client singleton
 */
export function getExaClient(): Exa {
  if (!cachedClient) {
    const key = process.env.EXA_API_KEY;
    if (!key) {
      throw new Error("web_exa_missing_api_key");
    }
    cachedClient = new Exa(key);
  }
  return cachedClient;
}

// Exa SDK category type
type ExaCategory =
  | "company"
  | "research paper"
  | "news"
  | "pdf"
  | "github"
  | "tweet"
  | "personal site"
  | "linkedin profile"
  | "financial report"
  | "people";

// Text options for SDK
type TextOptions = { maxCharacters?: number; includeHtmlTags?: boolean };

// Highlights options for SDK
type HighlightsOptions = {
  numSentences?: number;
  highlightsPerUrl?: number;
  query?: string;
};

// Summary options for SDK
type SummaryOptions = { query?: string };

/**
 * Options for Exa search
 */
export type ExaSearchOptions = {
  numResults?: number;
  type?: ExaSearchType;
  category?: ExaCategory | string;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  startCrawlDate?: string;
  endCrawlDate?: string;
  includeText?: string[];
  excludeText?: string[];
  // Content options (under 'contents' in v2)
  text?: boolean | TextOptions;
  highlights?: boolean | HighlightsOptions;
  summary?: boolean | SummaryOptions;
  // Context for RAG
  context?: boolean | { maxCharacters?: number };
  // Subpages and extras
  subpages?: number;
  subpageTarget?: string | string[];
  livecrawl?: "never" | "fallback" | "always" | "preferred";
};

/**
 * Options for Exa research
 */
export type ExaResearchOptions = {
  model?: "exa-research" | "exa-research-gpt-4o";
  instructions: string;
  outputSchema?: Record<string, unknown>;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  numResults?: number;
};

/**
 * Normalized search result from Exa SDK
 */
export type NormalizedExaResult = ExaSearchResult & {
  snippet?: string;
};

// Convert boolean options to SDK-compatible format
function toSdkOption<T>(value: boolean | T | undefined): true | T | undefined {
  if (value === false || value === undefined) {
    return;
  }
  if (value === true) {
    return true;
  }
  return value;
}

/**
 * Perform Exa search using the SDK
 */
export async function exaSearch(
  query: string,
  options: ExaSearchOptions = {}
): Promise<{
  results: NormalizedExaResult[];
  searchType?: ExaSearchType;
  context?: string;
  cost?: ExaCost;
}> {
  const client = getExaClient();

  // Determine if we need contents (v2 uses 'contents' object)
  const contents =
    options.text ||
    options.highlights ||
    options.summary ||
    options.context ||
    options.subpages
      ? {
          text: toSdkOption(options.text),
          highlights: toSdkOption(options.highlights),
          summary: toSdkOption(options.summary),
          subpages: options.subpages,
          subpageTarget: options.subpageTarget,
          livecrawl: options.livecrawl,
        }
      : undefined;

  // Validate category is a known Exa category
  const category = options.category as ExaCategory | undefined;

  // v2 search unified search and contents
  const response = await client.search(query, {
    numResults: options.numResults ?? 10,
    type: options.type ?? "auto",
    category,
    includeDomains: options.includeDomains,
    excludeDomains: options.excludeDomains,
    startPublishedDate: options.startPublishedDate,
    endPublishedDate: options.endPublishedDate,
    startCrawlDate: options.startCrawlDate,
    endCrawlDate: options.endCrawlDate,
    includeText: options.includeText,
    excludeText: options.excludeText,
    ...(contents ? { contents } : {}),
    // @ts-expect-error - Exa SDK v2 types for search options with contents are incomplete
  } as typeof queryOptions);

  // Cast results to access potential fields (SDK v2 structure)
  type ResultWithContents = {
    id: string;
    url: string;
    title?: string | null;
    author?: string | null;
    publishedDate?: string | null;
    score?: number;
    image?: string | null;
    favicon?: string | null;
    text?: string | null;
    highlights?: string[];
    highlightScores?: number[];
    summary?: string | null;
    subpages?: Array<{
      id?: string;
      url: string;
      title?: string | null;
      author?: string | null;
      publishedDate?: string | null;
      text?: string | null;
      summary?: string | null;
      highlights?: string[];
      highlightScores?: number[];
    }>;
    extras?: {
      links?: string[];
      imageLinks?: string[];
    };
  };

  const rawResults = (response.results ?? []) as ResultWithContents[];

  // Normalize results
  const results: NormalizedExaResult[] = rawResults.map((result) => ({
    id: result.id,
    url: result.url,
    title: result.title ?? undefined,
    author: result.author ?? undefined,
    publishedDate: result.publishedDate ?? undefined,
    score: result.score,
    image: result.image ?? undefined,
    favicon: result.favicon ?? undefined,
    text: result.text ?? undefined,
    highlights: result.highlights,
    highlightScores: result.highlightScores,
    summary: result.summary ?? undefined,
    subpages: result.subpages?.map((sub) => ({
      id: sub.id,
      url: sub.url,
      title: sub.title ?? undefined,
      author: sub.author ?? undefined,
      publishedDate: sub.publishedDate ?? undefined,
      text: sub.text ?? undefined,
      summary: sub.summary ?? undefined,
      highlights: sub.highlights,
      highlightScores: sub.highlightScores,
    })),
    extras: result.extras
      ? {
          links: result.extras.links,
          imageLinks: result.extras.imageLinks,
        }
      : undefined,
    // Generate snippet from available content
    snippet: generateSnippet(result),
  }));

  // @ts-expect-error - Exa SDK response types are incomplete for searchType, context, and costDollars
  const responseWithMeta = response as {
    searchType?: ExaSearchType;
    context?: string;
    costDollars?: ExaCost;
  };

  return {
    results,
    searchType: responseWithMeta.searchType,
    context: responseWithMeta.context,
    cost: responseWithMeta.costDollars,
  };
}

/**
 * Get contents for specific URLs using Exa SDK
 */
export async function exaGetContents(
  urls: string[],
  options: {
    text?: boolean | TextOptions;
    highlights?: boolean | HighlightsOptions;
    summary?: boolean | SummaryOptions;
    livecrawl?: "never" | "fallback" | "always" | "preferred";
  } = {}
): Promise<{
  contents: Array<{
    url: string;
    title?: string;
    author?: string;
    publishedDate?: string;
    text?: string;
    summary?: string;
    highlights?: string[];
    highlightScores?: number[];
  }>;
  cost?: ExaCost;
}> {
  const client = getExaClient();

  const response = await client.getContents(urls, {
    text: toSdkOption(options.text) ?? true,
    highlights: toSdkOption(options.highlights),
    summary: toSdkOption(options.summary),
    livecrawl: options.livecrawl,
  } as Record<string, unknown>);

  // Cast to access potential content fields
  type ContentResult = {
    url: string;
    title?: string | null;
    author?: string | null;
    publishedDate?: string | null;
    text?: string | null;
    summary?: string | null;
    highlights?: string[];
    highlightScores?: number[];
  };

  const rawResults = (response.results ?? []) as ContentResult[];

  const contents = rawResults.map((result) => ({
    url: result.url,
    title: result.title ?? undefined,
    author: result.author ?? undefined,
    publishedDate: result.publishedDate ?? undefined,
    text: result.text ?? undefined,
    summary: result.summary ?? undefined,
    highlights: result.highlights,
    highlightScores: result.highlightScores,
  }));

  return {
    contents,
    cost: (response as Record<string, unknown>).costDollars as
      | ExaCost
      | undefined,
  };
}

/**
 * Generate snippet from Exa result content
 */
function generateSnippet(
  result: Record<string, unknown>,
  maxLength = 220
): string | undefined {
  const summary = result.summary as string | undefined;
  const highlights = result.highlights as string[] | undefined;
  const text = result.text as string | undefined;

  const source = summary ?? highlights?.[0] ?? text;
  if (!source) {
    return;
  }

  const compact = source.replace(/\s+/g, " ").trim();
  if (compact.length === 0) {
    return;
  }
  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 3).trimEnd()}...`;
}

/**
 * Find similar links using Exa SDK
 */
export async function exaFindSimilar(
  url: string,
  options: {
    numResults?: number;
    includeDomains?: string[];
    excludeDomains?: string[];
    startPublishedDate?: string;
    endPublishedDate?: string;
    excludeSourceDomain?: boolean;
  } = {}
): Promise<{
  results: NormalizedExaResult[];
  cost?: ExaCost;
}> {
  const client = getExaClient();

  const response = await client.findSimilar(url, {
    numResults: options.numResults ?? 10,
    includeDomains: options.includeDomains,
    excludeDomains: options.excludeDomains,
    startPublishedDate: options.startPublishedDate,
    endPublishedDate: options.endPublishedDate,
    excludeSourceDomain: options.excludeSourceDomain,
  });

  const results: NormalizedExaResult[] = (response.results ?? []).map(
    (result) => ({
      id: result.id,
      url: result.url,
      title: result.title ?? undefined,
      author: result.author ?? undefined,
      publishedDate: result.publishedDate ?? undefined,
      score: result.score,
    })
  );

  return {
    results,
    // @ts-expect-error - Exa SDK response types are incomplete for costDollars
    cost: (response as { costDollars?: ExaCost }).costDollars,
  };
}

/**
 * Perform Exa research using the research endpoint
 */
export async function exaResearch(
  options: ExaResearchOptions
): Promise<ExaResearchResponse> {
  const client = getExaClient();

  // @ts-expect-error - Exa SDK types for research.create are incomplete
  const response = await (
    client as {
      research: { create: (opts: unknown) => Promise<{ researchId: string }> };
    }
  ).research.create({
    model: options.model ?? "exa-research",
    instructions: options.instructions,
    outputSchema: options.outputSchema,
    includeDomains: options.includeDomains,
    excludeDomains: options.excludeDomains,
    startPublishedDate: options.startPublishedDate,
    endPublishedDate: options.endPublishedDate,
    numResults: options.numResults,
  });

  return {
    researchId: response.researchId,
  };
}

/**
 * Poll Exa research until finished
 */
export async function exaPollResearch(
  researchId: string
): Promise<ExaResearchResult> {
  const client = getExaClient();

  // @ts-expect-error - Exa SDK types for research.pollUntilFinished are incomplete
  const result = await (
    client as {
      research: { pollUntilFinished: (id: string) => Promise<unknown> };
    }
  ).research.pollUntilFinished(researchId);

  return {
    researchId,
    status: (result as { status: string }).status,
    // @ts-expect-error - Exa SDK result types for research are incomplete
    results: (result as { results?: unknown[] }).results?.map((r) => ({
      ...(r as Record<string, unknown>),
      snippet: generateSnippet(r as Record<string, unknown>),
    })),
    // @ts-expect-error - Exa SDK result types don't include these fields
    data: (result as { data?: unknown }).data,
    costDollars: (result as { costDollars?: number }).costDollars,
  };
}
