/**
 * Exa API Types
 *
 * Type definitions matching the Exa Search API response structure.
 * See: https://docs.exa.ai/reference/search
 */

import { z } from "zod";

/**
 * Exa search categories for filtering
 */
export type ExaCategory =
  | "company"
  | "research paper"
  | "news"
  | "pdf"
  | "github"
  | "tweet"
  | "personal site"
  | "financial report"
  | "people";

/**
 * Exa search type modes
 */
export type ExaSearchType = "auto" | "neural" | "keyword" | "fast" | "deep";

/**
 * Exa livecrawl modes
 */
export type ExaLivecrawl = "never" | "fallback" | "always" | "preferred";

/**
 * Exa subpage result (nested result without further nesting)
 */
export type ExaSubpage = {
  id?: string;
  url: string;
  title?: string;
  author?: string;
  publishedDate?: string;
  text?: string;
  summary?: string;
  highlights?: string[];
  highlightScores?: number[];
};

/**
 * Exa search result item
 * Matches the structure returned by POST /search
 */
export type ExaSearchResult = {
  id?: string;
  url: string;
  title?: string;
  author?: string;
  publishedDate?: string;
  score?: number;
  image?: string;
  favicon?: string;
  // Content fields (when contents requested)
  text?: string;
  highlights?: string[];
  highlightScores?: number[];
  summary?: string;
  // Nested results
  subpages?: ExaSubpage[];
  extras?: {
    links?: string[];
    imageLinks?: string[];
  };
};

/**
 * Exa cost breakdown for billing tracking
 */
export type ExaCost = {
  total: number;
  search?: number;
  contents?: number;
  breakdown?: {
    neuralSearch?: number;
    deepSearch?: number;
    contentText?: number;
    contentHighlight?: number;
    contentSummary?: number;
  };
};

/**
 * Exa search response envelope
 * Top-level response from POST /search
 */
export type ExaSearchResponse = {
  requestId: string;
  results: ExaSearchResult[];
  searchType?: ExaSearchType;
  context?: string; // LLM-optimized combined content string
  costDollars?: ExaCost;
};

/**
 * Exa contents response envelope
 * Top-level response from POST /contents
 */
export type ExaContentsResponse = {
  requestId?: string;
  contents?: Array<{
    url: string;
    text?: string;
    summary?: string;
    status?: number;
    contentType?: string;
  }>;
  costDollars?: ExaCost;
};

// Zod Schemas for runtime validation

export const exaCategorySchema = z.enum([
  "company",
  "research paper",
  "news",
  "pdf",
  "github",
  "tweet",
  "personal site",
  "financial report",
  "people",
]);

export const exaSearchTypeSchema = z.enum([
  "auto",
  "neural",
  "keyword",
  "fast",
  "deep",
]);

export const exaLivecrawlSchema = z.enum([
  "never",
  "fallback",
  "always",
  "preferred",
]);

export const exaSubpageSchema = z.object({
  id: z.string().optional(),
  url: z.string(),
  title: z.string().optional(),
  author: z.string().optional(),
  publishedDate: z.string().optional(),
  text: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  highlightScores: z.array(z.number()).optional(),
});

export const exaSearchResultSchema = z.object({
  id: z.string().optional(),
  url: z.string(),
  title: z.string().optional(),
  author: z.string().optional(),
  publishedDate: z.string().optional(),
  score: z.number().optional(),
  image: z.string().optional(),
  favicon: z.string().optional(),
  text: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  highlightScores: z.array(z.number()).optional(),
  summary: z.string().optional(),
  subpages: z.array(exaSubpageSchema).optional(),
  extras: z
    .object({
      links: z.array(z.string()).optional(),
      imageLinks: z.array(z.string()).optional(),
    })
    .optional(),
});

export const exaCostSchema = z.object({
  total: z.number(),
  search: z.number().optional(),
  contents: z.number().optional(),
  breakdown: z
    .object({
      neuralSearch: z.number().optional(),
      deepSearch: z.number().optional(),
      contentText: z.number().optional(),
      contentHighlight: z.number().optional(),
      contentSummary: z.number().optional(),
    })
    .optional(),
});

export const exaSearchResponseSchema = z.object({
  requestId: z.string(),
  results: z.array(exaSearchResultSchema),
  searchType: exaSearchTypeSchema.optional(),
  context: z.string().optional(),
  costDollars: exaCostSchema.optional(),
});

export const exaContentsResponseSchema = z.object({
  requestId: z.string().optional(),
  contents: z
    .array(
      z.object({
        url: z.string(),
        text: z.string().optional(),
        summary: z.string().optional(),
        status: z.number().optional(),
        contentType: z.string().optional(),
      })
    )
    .optional(),
  costDollars: exaCostSchema.optional(),
});
