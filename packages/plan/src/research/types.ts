import type { ExaCategory, ExaSearchType } from "@alfred/type";

/**
 * Pattern: A learned template for workflow execution
 */
export interface LearnedPattern {
  id: string;
  name: string;
  confidence: number;
}

/**
 * Convention: A project-specific architectural rule
 */
export interface Convention {
  id: string;
  description: string;
  confidence: number;
}

/**
 * ResearchSource: A single external research source with Exa-aligned fields
 */
export interface ResearchSource {
  // Identity
  id: string;
  source: string; // URL or identifier
  title: string;
  author?: string;

  // Content
  summary: string;
  highlights?: string[];
  fullText?: string; // When context extraction is needed

  // Scoring
  reliability: number; // 0.0-1.0 domain + freshness
  relevanceScore: number; // 0.0-1.0 semantic match
  highlightScores?: number[]; // Per-highlight relevance from Exa

  // Metadata
  date?: Date;
  frameworkVersion?: string;
  category?: ExaCategory;

  // Nested sources (for deep research)
  subpages?: ResearchSource[];
  links?: string[];
}

/**
 * Research cost tracking
 */
export interface ResearchCost {
  total: number;
  search?: number;
  contents?: number;
  perSource?: number;
}

/**
 * Research metadata
 */
export interface ResearchMetadata {
  totalSources: number;
  tokenCount: number;
  researchDurationMs: number;
  searchType?: ExaSearchType;
  context?: string; // LLM-optimized combined content from Exa
  cost?: ResearchCost;
}

/**
 * ResearchResult: Structured research context for workflow planning
 */
export interface ResearchResult {
  external: ResearchSource[];
  internal: {
    existingCode: string[]; // File paths with relevant code
    patterns: LearnedPattern[]; // Workflow patterns
    conventions: Convention[]; // Project conventions
  };
  metadata: ResearchMetadata;
}

/**
 * Options for external research
 */
export interface ResearchOptions {
  maxResults?: number; // Default: 5
  minReliability?: number; // Default: 0.5
  dateFilter?: "recent" | "all"; // Default: "recent" (last 2 years)
  frameworkMatch?: boolean; // Default: true (match detected framework)
  category?: ExaCategory; // Filter by Exa category
  searchType?: ExaSearchType; // Exa search mode
  includeContext?: boolean; // Request LLM-optimized context string
}

// Re-export Exa types for convenience
export type { ExaCategory, ExaSearchType } from "@alfred/type";
