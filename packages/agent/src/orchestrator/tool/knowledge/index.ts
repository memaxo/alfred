/**
 * Knowledge Graph Tools
 * Exposes knowledge graph capabilities as agent tools
 */

import { withPolicyApproval } from "../approval.js";
import type { ToolExecuteArgs } from "../shared/context.js";
import {
  type KnowledgeConnectInput,
  type KnowledgeCorrectInput,
  type KnowledgeExtractInput,
  type KnowledgeQueryInput,
  knowledgeConnectInputSchema,
  knowledgeConnectOutputSchema,
  knowledgeCorrectInputSchema,
  knowledgeCorrectOutputSchema,
  knowledgeExtractInputSchema,
  knowledgeExtractOutputSchema,
  knowledgeQueryInputSchema,
  knowledgeQueryOutputSchema,
} from "./definition.js";
import {
  executeConnect,
  executeCorrect,
  executeExtract,
  executeQuery,
} from "./exec.js";
import {
  enforceConnectPolicy,
  enforceCorrectPolicy,
  enforceExtractPolicy,
  enforceQueryPolicy,
} from "./policy.js";

// Re-export types
export type {
  KnowledgeConnectInput,
  KnowledgeConnectOutput,
  KnowledgeCorrectInput,
  KnowledgeCorrectOutput,
  KnowledgeExtractInput,
  KnowledgeExtractOutput,
  KnowledgeQueryInput,
  KnowledgeQueryOutput,
} from "./definition.js";

// Re-export schemas
export {
  knowledgeConnectInputSchema,
  knowledgeConnectOutputSchema,
  knowledgeCorrectInputSchema,
  knowledgeCorrectOutputSchema,
  knowledgeExtractInputSchema,
  knowledgeExtractOutputSchema,
  knowledgeQueryInputSchema,
  knowledgeQueryOutputSchema,
} from "./definition.js";

// ============================================================================
// Tool: knowledge_query
// ============================================================================

export const toolKnowledgeQuery = {
  name: "knowledge_query",
  description:
    "Search the knowledge graph using natural language. Returns facts, insights, and patterns related to the query.",
  inputSchema: knowledgeQueryInputSchema,
  outputSchema: knowledgeQueryOutputSchema,
  execute: async ({ input }: ToolExecuteArgs<KnowledgeQueryInput>) => {
    await enforceQueryPolicy(input);
    return executeQuery(input);
  },
};

const aiToolKnowledgeQueryBase = {
  name: toolKnowledgeQuery.name,
  description: toolKnowledgeQuery.description,
  parameters: toolKnowledgeQuery.inputSchema,
  inputSchema: toolKnowledgeQuery.inputSchema,
  execute: async (input: KnowledgeQueryInput) =>
    toolKnowledgeQuery.execute({ input }),
};

export const aiToolKnowledgeQuery = withPolicyApproval(
  aiToolKnowledgeQueryBase,
  (input: KnowledgeQueryInput) => ({
    action: "knowledge.query",
    resource: {
      kind: "knowledge",
      id: input.resource ?? "user",
    },
    scopes: ["knowledge.read"],
    authz: input.authz,
  })
);

// ============================================================================
// Tool: knowledge_extract
// ============================================================================

export const toolKnowledgeExtract = {
  name: "knowledge_extract",
  description:
    "Extract and persist knowledge from text. Identifies facts, entities, and relations to store in the knowledge graph.",
  inputSchema: knowledgeExtractInputSchema,
  outputSchema: knowledgeExtractOutputSchema,
  execute: async ({ input }: ToolExecuteArgs<KnowledgeExtractInput>) => {
    await enforceExtractPolicy(input);
    return executeExtract(input);
  },
};

const aiToolKnowledgeExtractBase = {
  name: toolKnowledgeExtract.name,
  description: toolKnowledgeExtract.description,
  parameters: toolKnowledgeExtract.inputSchema,
  inputSchema: toolKnowledgeExtract.inputSchema,
  execute: async (input: KnowledgeExtractInput) =>
    toolKnowledgeExtract.execute({ input }),
};

export const aiToolKnowledgeExtract = withPolicyApproval(
  aiToolKnowledgeExtractBase,
  (input: KnowledgeExtractInput) => ({
    action: "knowledge.extract",
    resource: {
      kind: "knowledge",
      id: input.resource ?? "user",
    },
    scopes: ["knowledge.write"],
    authz: input.authz,
    context: {
      contentLength: input.content.length,
    },
  })
);

// ============================================================================
// Tool: knowledge_connect
// ============================================================================

export const toolKnowledgeConnect = {
  name: "knowledge_connect",
  description:
    "Create a connection between two nodes in the knowledge graph. Use to establish relationships like 'relates_to', 'blocks', 'depends_on', 'is_a', or 'part_of'.",
  inputSchema: knowledgeConnectInputSchema,
  outputSchema: knowledgeConnectOutputSchema,
  execute: async ({ input }: ToolExecuteArgs<KnowledgeConnectInput>) => {
    await enforceConnectPolicy(input);
    return executeConnect(input);
  },
};

const aiToolKnowledgeConnectBase = {
  name: toolKnowledgeConnect.name,
  description: toolKnowledgeConnect.description,
  parameters: toolKnowledgeConnect.inputSchema,
  inputSchema: toolKnowledgeConnect.inputSchema,
  execute: async (input: KnowledgeConnectInput) =>
    toolKnowledgeConnect.execute({ input }),
};

export const aiToolKnowledgeConnect = withPolicyApproval(
  aiToolKnowledgeConnectBase,
  (input: KnowledgeConnectInput) => ({
    action: "knowledge.connect",
    resource: {
      kind: "knowledge",
      id: input.resource ?? "user",
    },
    scopes: ["knowledge.write"],
    authz: input.authz,
  })
);

// ============================================================================
// Tool: knowledge_correct
// ============================================================================

export const toolKnowledgeCorrect = {
  name: "knowledge_correct",
  description:
    "Correct errors in the knowledge graph by updating a node/edge or archiving an incorrect fact. Requires elevated (passkey) authorization for safety.",
  inputSchema: knowledgeCorrectInputSchema,
  outputSchema: knowledgeCorrectOutputSchema,
  execute: async ({ input }: ToolExecuteArgs<KnowledgeCorrectInput>) => {
    const { userId } = await enforceCorrectPolicy(input);
    return executeCorrect(input, userId);
  },
};

const aiToolKnowledgeCorrectBase = {
  name: toolKnowledgeCorrect.name,
  description: toolKnowledgeCorrect.description,
  parameters: toolKnowledgeCorrect.inputSchema,
  inputSchema: toolKnowledgeCorrect.inputSchema,
  execute: async (input: KnowledgeCorrectInput) =>
    toolKnowledgeCorrect.execute({ input }),
};

export const aiToolKnowledgeCorrect = withPolicyApproval(
  aiToolKnowledgeCorrectBase,
  (input: KnowledgeCorrectInput) => ({
    action: "knowledge.correct",
    resource: {
      kind: "knowledge",
      id: input.resource ?? "user",
    },
    scopes: ["knowledge.write"],
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

export type ToolKnowledgeQuery = typeof toolKnowledgeQuery;
export type ToolKnowledgeExtract = typeof toolKnowledgeExtract;
export type ToolKnowledgeConnect = typeof toolKnowledgeConnect;
export type ToolKnowledgeCorrect = typeof toolKnowledgeCorrect;
