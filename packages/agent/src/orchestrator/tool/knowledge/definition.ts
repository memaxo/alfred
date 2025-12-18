/**
 * Knowledge Graph Tool Schemas
 * Input/output schemas for knowledge graph agent tools
 */

import { z } from "zod";

// ============================================================================
// knowledge_query
// ============================================================================

export const knowledgeQueryInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Natural language query to search the knowledge graph"),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe("Maximum results (default: 10)"),
  resource: z
    .string()
    .optional()
    .describe("Filter by resource scope (e.g., 'user', 'runtime:<id>')"),
  includeEdges: z
    .boolean()
    .optional()
    .describe("Include related edges in results"),
  authz: z.string().optional().describe("Authorization token"),
});

export const knowledgeQueryOutputSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      kind: z.string(),
      properties: z.record(z.string(), z.unknown()).optional(),
    })
  ),
  edges: z
    .array(
      z.object({
        fromId: z.string(),
        toId: z.string(),
        kind: z.string(),
      })
    )
    .optional(),
  total: z.number(),
});

export type KnowledgeQueryInput = z.infer<typeof knowledgeQueryInputSchema>;
export type KnowledgeQueryOutput = z.infer<typeof knowledgeQueryOutputSchema>;

// ============================================================================
// knowledge_extract
// ============================================================================

export const knowledgeExtractInputSchema = z.object({
  content: z.string().min(1).describe("Text content to extract knowledge from"),
  source: z
    .string()
    .min(1)
    .describe("Source identifier (e.g., 'conversation', 'document:123')"),
  resource: z
    .string()
    .default("user")
    .describe("Resource scope (default: 'user')"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Extraction confidence override (0-1)"),
  authz: z.string().optional().describe("Authorization token"),
});

export const knowledgeExtractOutputSchema = z.object({
  extracted: z.number().describe("Number of facts extracted"),
  facts: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      kind: z.string(),
    })
  ),
  relations: z.array(
    z.object({
      fromId: z.string(),
      toId: z.string(),
      kind: z.string(),
    })
  ),
});

export type KnowledgeExtractInput = z.infer<typeof knowledgeExtractInputSchema>;
export type KnowledgeExtractOutput = z.infer<
  typeof knowledgeExtractOutputSchema
>;

// ============================================================================
// knowledge_connect
// ============================================================================

export const knowledgeConnectInputSchema = z.object({
  fromId: z.string().min(1).describe("Source node ID"),
  toId: z.string().min(1).describe("Target node ID"),
  kind: z
    .enum(["relates_to", "blocks", "depends_on", "is_a", "part_of"])
    .optional()
    .describe("Edge type (default: 'relates_to')"),
  resource: z.string().optional().describe("Resource scope (default: 'user')"),
  properties: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Additional edge properties"),
  authz: z.string().optional().describe("Authorization token"),
});

export const knowledgeConnectOutputSchema = z.object({
  edgeId: z.string(),
  fromId: z.string(),
  toId: z.string(),
  kind: z.string(),
});

export type KnowledgeConnectInput = z.infer<typeof knowledgeConnectInputSchema>;
export type KnowledgeConnectOutput = z.infer<
  typeof knowledgeConnectOutputSchema
>;

// ============================================================================
// knowledge_correct
// ============================================================================

export const knowledgeCorrectInputSchema = z.object({
  nodeId: z.string().min(1).optional().describe("Node ID to correct"),
  factId: z
    .string()
    .min(1)
    .optional()
    .describe("Fact identifier (stored as memory_nodes.hash)"),
  edgeId: z.string().min(1).optional().describe("Edge ID to correct"),
  resource: z
    .string()
    .default("user")
    .describe("Resource scope (default: 'user')"),
  correction: z.object({
    type: z.enum(["update", "delete"]).describe("Correction operation"),
    newValue: z
      .string()
      .min(1)
      .optional()
      .describe("New label value (required for node label update)"),
    reason: z
      .string()
      .min(1)
      .describe("Why this correction is needed (required)"),
    propertiesPatch: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Patch to merge into node properties (for node updates)"),
    metadataPatch: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Patch to merge into edge metadata (for edge updates)"),
  }),
  confirm: z
    .boolean()
    .optional()
    .describe("Safety confirmation flag (required for delete)"),
  authz: z.string().optional().describe("Authorization token"),
});

export const knowledgeCorrectOutputSchema = z.object({
  corrected: z.boolean(),
  nodeId: z.string().optional(),
  edgeId: z.string().optional(),
  correctionId: z.string(),
  previousValue: z
    .object({
      label: z.string().optional(),
      properties: z.unknown().optional(),
      metadata: z.unknown().optional(),
    })
    .optional(),
});

export type KnowledgeCorrectInput = z.infer<typeof knowledgeCorrectInputSchema>;
export type KnowledgeCorrectOutput = z.infer<
  typeof knowledgeCorrectOutputSchema
>;
