import { exaCategorySchema, exaSearchTypeSchema } from "@alfred/type";
import { z } from "zod";

/**
 * Zod schema for LearnedPattern
 */
export const learnedPatternSchema = z.object({
  id: z.string().uuid().or(z.string()),
  name: z.string(),
  confidence: z.number().min(0).max(1),
});

/**
 * Zod schema for Convention
 */
export const conventionSchema = z.object({
  id: z.string().uuid().or(z.string()),
  description: z.string(),
  confidence: z.number().min(0).max(1),
});

/**
 * Zod schema for ResearchSource (non-recursive base)
 */
const researchSourceBaseSchema = z.object({
  // Identity
  id: z.string(),
  source: z.string().url().or(z.string()),
  title: z.string(),
  author: z.string().optional(),

  // Content
  summary: z.string(),
  highlights: z.array(z.string()).optional(),
  fullText: z.string().optional(),

  // Scoring
  reliability: z.number().min(0).max(1),
  relevanceScore: z.number().min(0).max(1),
  highlightScores: z.array(z.number()).optional(),

  // Metadata
  date: z.date().optional(),
  frameworkVersion: z.string().optional(),
  category: exaCategorySchema.optional(),

  // Links
  links: z.array(z.string()).optional(),
});

/**
 * Zod schema for ResearchSource with recursive subpages
 */
export const researchSourceSchema: z.ZodType<ResearchSourceType> =
  researchSourceBaseSchema.extend({
    subpages: z.lazy(() => z.array(researchSourceSchema)).optional(),
  });

/**
 * ResearchSource type for schema typing
 */
type ResearchSourceType = z.infer<typeof researchSourceBaseSchema> & {
  subpages?: ResearchSourceType[];
};

/**
 * Zod schema for ResearchCost
 */
export const researchCostSchema = z.object({
  total: z.number().nonnegative(),
  search: z.number().nonnegative().optional(),
  contents: z.number().nonnegative().optional(),
  perSource: z.number().nonnegative().optional(),
});

/**
 * Zod schema for ResearchMetadata
 */
export const researchMetadataSchema = z.object({
  totalSources: z.number().int().nonnegative(),
  tokenCount: z.number().int().nonnegative(),
  researchDurationMs: z.number().int().nonnegative(),
  searchType: exaSearchTypeSchema.optional(),
  context: z.string().optional(),
  cost: researchCostSchema.optional(),
});

/**
 * Zod schema for ResearchResult
 */
export const researchResultSchema = z.object({
  external: z.array(researchSourceSchema),
  internal: z.object({
    existingCode: z.array(z.string()),
    patterns: z.array(learnedPatternSchema),
    conventions: z.array(conventionSchema),
  }),
  metadata: researchMetadataSchema,
});

/**
 * Zod schema for ResearchOptions
 */
export const researchOptionsSchema = z.object({
  maxResults: z.number().int().min(1).max(20).default(5),
  minReliability: z.number().min(0).max(1).default(0.5),
  dateFilter: z.enum(["recent", "all"]).default("recent"),
  frameworkMatch: z.boolean().default(true),
  category: exaCategorySchema.optional(),
  searchType: exaSearchTypeSchema.optional(),
  includeContext: z.boolean().optional(),
});
