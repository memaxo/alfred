/**
 * RAG Document Management Tools
 * Exposes RAG capabilities as agent tools for document ingestion and retrieval
 */

import type { ToolExecuteArgs } from "../shared/context.js";
import { withPolicyApproval } from "../approval.js";
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
  name: "rag_ingest",
  description:
    "Save documents to the RAG system for later semantic retrieval. Use for persisting documentation, articles, or any text content.",
  inputSchema: ragIngestInputSchema,
  outputSchema: ragIngestOutputSchema,
  execute: async ({ input }: ToolExecuteArgs<RagIngestInput>) => {
    await enforceIngestPolicy(input);
    return executeIngest(input);
  },
};

const aiToolRagIngestBase = {
  name: toolRagIngest.name,
  description: toolRagIngest.description,
  parameters: toolRagIngest.inputSchema,
  inputSchema: toolRagIngest.inputSchema,
  execute: async (input: RagIngestInput) => toolRagIngest.execute({ input }),
};

export const aiToolRagIngest = withPolicyApproval(
  aiToolRagIngestBase,
  (input) => ({
    action: "rag.ingest",
    resource: {
      kind: "rag",
      id: input.source,
    },
    scopes: ["rag.write"],
    authz: input.authz,
    context: {
      contentLength: input.content.length,
    },
  })
);

// ============================================================================
// Tool: rag_query
// ============================================================================

export const toolRagQuery = {
  name: "rag_query",
  description:
    "Semantic search over the document collection. Returns relevant chunks with similarity scores.",
  inputSchema: ragQueryInputSchema,
  outputSchema: ragQueryOutputSchema,
  execute: async ({ input }: ToolExecuteArgs<RagQueryInput>) => {
    await enforceQueryPolicy(input);
    return executeQuery(input);
  },
};

const aiToolRagQueryBase = {
  name: toolRagQuery.name,
  description: toolRagQuery.description,
  parameters: toolRagQuery.inputSchema,
  inputSchema: toolRagQuery.inputSchema,
  execute: async (input: RagQueryInput) => toolRagQuery.execute({ input }),
};

export const aiToolRagQuery = withPolicyApproval(
  aiToolRagQueryBase,
  (input) => ({
    action: "rag.query",
    resource: {
      kind: "rag",
      id: input.source ?? "all",
    },
    scopes: ["rag.read"],
    authz: input.authz,
  })
);

// ============================================================================
// Tool: rag_list
// ============================================================================

export const toolRagList = {
  name: "rag_list",
  description:
    "List documents in the RAG system. Returns document metadata with chunk counts.",
  inputSchema: ragListInputSchema,
  outputSchema: ragListOutputSchema,
  execute: async ({ input }: ToolExecuteArgs<RagListInput>) => {
    await enforceListPolicy(input);
    return executeList(input);
  },
};

const aiToolRagListBase = {
  name: toolRagList.name,
  description: toolRagList.description,
  parameters: toolRagList.inputSchema,
  inputSchema: toolRagList.inputSchema,
  execute: async (input: RagListInput) => toolRagList.execute({ input }),
};

export const aiToolRagList = withPolicyApproval(aiToolRagListBase, (input) => ({
  action: "rag.list",
  resource: {
    kind: "rag",
    id: input.source ?? "all",
  },
  scopes: ["rag.read"],
  authz: input.authz,
}));

// ============================================================================
// Tool: rag_delete
// ============================================================================

export const toolRagDelete = {
  name: "rag_delete",
  description:
    "Remove documents from the RAG system. Requires confirmation flag and elevated authorization.",
  inputSchema: ragDeleteInputSchema,
  outputSchema: ragDeleteOutputSchema,
  execute: async ({ input }: ToolExecuteArgs<RagDeleteInput>) => {
    await enforceDeletePolicy(input);
    return executeDelete(input);
  },
};

const aiToolRagDeleteBase = {
  name: toolRagDelete.name,
  description: toolRagDelete.description,
  parameters: toolRagDelete.inputSchema,
  inputSchema: toolRagDelete.inputSchema,
  execute: async (input: RagDeleteInput) => toolRagDelete.execute({ input }),
};

export const aiToolRagDelete = withPolicyApproval(
  aiToolRagDeleteBase,
  (input) => ({
    action: "rag.delete",
    resource: {
      kind: "rag",
      id: input.documentId,
    },
    scopes: ["rag.write"],
    authz: input.authz,
    context: {
      requireElevated: true,
      requireBiometric: true,
    },
  })
);

// ============================================================================
// Export types for tool consumers
// ============================================================================

export type ToolRagIngest = typeof toolRagIngest;
export type ToolRagQuery = typeof toolRagQuery;
export type ToolRagList = typeof toolRagList;
export type ToolRagDelete = typeof toolRagDelete;
