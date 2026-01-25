/**
 * RAG Document Management Tools
 * Exposes RAG capabilities as agent tools for document ingestion and retrieval
 */

import type { ToolExecuteArgs } from "../shared/context.js";

import { withPolicyApproval, type AITool } from "../approval.js";
import {
  type RagDeleteInput,
  type RagIngestInput,
  type RagListInput,
  type RagQueryInput,
  ragDeleteInputSchema,
  ragDeleteOutputSchema,
  ragIngestInputSchema,
  ragIngestOutputSchema,
  ragListInputSchema,
  ragListOutputSchema,
  ragQueryInputSchema,
  ragQueryOutputSchema,
} from "./definition.js";
import {
  executeDelete,
  executeIngest,
  executeList,
  executeQuery,
} from "./exec.js";
import {
  enforceDeletePolicy,
  enforceIngestPolicy,
  enforceListPolicy,
  enforceQueryPolicy,
} from "./policy.js";

// Re-export types
export type {
  RagDeleteInput,
  RagDeleteOutput,
  RagIngestInput,
  RagIngestOutput,
  RagListInput,
  RagListOutput,
  RagQueryInput,
  RagQueryOutput,
} from "./definition.js";

// Re-export schemas
export {
  ragDeleteInputSchema,
  ragDeleteOutputSchema,
  ragIngestInputSchema,
  ragIngestOutputSchema,
  ragListInputSchema,
  ragListOutputSchema,
  ragQueryInputSchema,
  ragQueryOutputSchema,
} from "./definition.js";

// ============================================================================
// Tool: rag_ingest
// ============================================================================

export const toolRagIngest = {
  description:
    "Save documents to the RAG system for later semantic retrieval. Use for persisting documentation, articles, or any text content.",
  execute: async ({ input }: ToolExecuteArgs<RagIngestInput>) => {
    await enforceIngestPolicy(input);
    return executeIngest(input);
  },
  inputSchema: ragIngestInputSchema,
  name: "rag_ingest",
  outputSchema: ragIngestOutputSchema,
};

const aiToolRagIngestBase = {
  description: toolRagIngest.description,
  execute: async (input: RagIngestInput) => toolRagIngest.execute({ input }),
  inputSchema: toolRagIngest.inputSchema,
  name: toolRagIngest.name,
  parameters: toolRagIngest.inputSchema,
};

export const aiToolRagIngest: AITool<RagIngestInput, any> = withPolicyApproval(
  aiToolRagIngestBase,
  (input) => ({
    action: "rag.ingest",
    authz: input.authz,
    context: {
      contentLength: input.content.length,
    },
    resource: {
      kind: "rag",
      id: input.source,
    },
    scopes: ["rag.write"],
  })
);

// ============================================================================
// Tool: rag_query
// ============================================================================

export const toolRagQuery = {
  description:
    "Semantic search over the document collection. Returns relevant chunks with similarity scores.",
  execute: async ({ input }: ToolExecuteArgs<RagQueryInput>) => {
    await enforceQueryPolicy(input);
    return executeQuery(input);
  },
  inputSchema: ragQueryInputSchema,
  name: "rag_query",
  outputSchema: ragQueryOutputSchema,
};

const aiToolRagQueryBase = {
  description: toolRagQuery.description,
  execute: async (input: RagQueryInput) => toolRagQuery.execute({ input }),
  inputSchema: toolRagQuery.inputSchema,
  name: toolRagQuery.name,
  parameters: toolRagQuery.inputSchema,
};

export const aiToolRagQuery: AITool<RagQueryInput, any> = withPolicyApproval(
  aiToolRagQueryBase,
  (input) => ({
    action: "rag.query",
    authz: input.authz,
    resource: {
      kind: "rag",
      id: input.source ?? "all",
    },
    scopes: ["rag.read"],
  })
);

// ============================================================================
// Tool: rag_list
// ============================================================================

export const toolRagList = {
  description:
    "List documents in the RAG system. Returns document metadata with chunk counts.",
  execute: async ({ input }: ToolExecuteArgs<RagListInput>) => {
    await enforceListPolicy(input);
    return executeList(input);
  },
  inputSchema: ragListInputSchema,
  name: "rag_list",
  outputSchema: ragListOutputSchema,
};

const aiToolRagListBase = {
  description: toolRagList.description,
  execute: async (input: RagListInput) => toolRagList.execute({ input }),
  inputSchema: toolRagList.inputSchema,
  name: toolRagList.name,
  parameters: toolRagList.inputSchema,
};

export const aiToolRagList: AITool<RagListInput, any> = withPolicyApproval(
  aiToolRagListBase,
  (input) => ({
    action: "rag.list",
    authz: input.authz,
    resource: {
      kind: "rag",
      id: input.source ?? "all",
    },
    scopes: ["rag.read"],
  })
);

// ============================================================================
// Tool: rag_delete
// ============================================================================

export const toolRagDelete = {
  description:
    "Remove documents from the RAG system. Requires confirmation flag and elevated authorization.",
  execute: async ({ input }: ToolExecuteArgs<RagDeleteInput>) => {
    await enforceDeletePolicy(input);
    return executeDelete(input);
  },
  inputSchema: ragDeleteInputSchema,
  name: "rag_delete",
  outputSchema: ragDeleteOutputSchema,
};

const aiToolRagDeleteBase = {
  description: toolRagDelete.description,
  execute: async (input: RagDeleteInput) => toolRagDelete.execute({ input }),
  inputSchema: toolRagDelete.inputSchema,
  name: toolRagDelete.name,
  parameters: toolRagDelete.inputSchema,
};

export const aiToolRagDelete: AITool<RagDeleteInput, any> = withPolicyApproval(
  aiToolRagDeleteBase,
  (input) => ({
    action: "rag.delete",
    authz: input.authz,
    context: {
      requireElevated: true,
      requireBiometric: true,
    },
    resource: {
      kind: "rag",
      id: input.documentId,
    },
    scopes: ["rag.write"],
  })
);

// ============================================================================
// Export types for tool consumers
// ============================================================================

export type ToolRagIngest = typeof toolRagIngest;
export type ToolRagQuery = typeof toolRagQuery;
export type ToolRagList = typeof toolRagList;
export type ToolRagDelete = typeof toolRagDelete;
