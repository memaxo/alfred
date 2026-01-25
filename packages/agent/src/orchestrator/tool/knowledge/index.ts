/**
 * Knowledge Graph Tools
 * Exposes knowledge graph capabilities as agent tools
 */

import type { ToolExecuteArgs } from "../shared/context.js";

import { withPolicyApproval, type AITool } from "../approval.js";
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
  description:
    "Search the knowledge graph using natural language. Returns facts, insights, and patterns related to the query.",
  execute: async ({ input }: ToolExecuteArgs<KnowledgeQueryInput>) => {
    await enforceQueryPolicy(input);
    return executeQuery(input);
  },
  inputSchema: knowledgeQueryInputSchema,
  name: "knowledge_query",
  outputSchema: knowledgeQueryOutputSchema,
};

const aiToolKnowledgeQueryBase = {
  description: toolKnowledgeQuery.description,
  execute: async (input: KnowledgeQueryInput) =>
    toolKnowledgeQuery.execute({ input }),
  inputSchema: toolKnowledgeQuery.inputSchema,
  name: toolKnowledgeQuery.name,
  parameters: toolKnowledgeQuery.inputSchema,
};

export const aiToolKnowledgeQuery: AITool<KnowledgeQueryInput, any> =
  withPolicyApproval(
    aiToolKnowledgeQueryBase,
    (input: KnowledgeQueryInput) => ({
      action: "knowledge.query",
      authz: input.authz,
      resource: {
        kind: "knowledge",
        id: input.resource ?? "user",
      },
      scopes: ["knowledge.read"],
    })
  );

// ============================================================================
// Tool: knowledge_extract
// ============================================================================

export const toolKnowledgeExtract = {
  description:
    "Extract and persist knowledge from text. Identifies facts, entities, and relations to store in the knowledge graph.",
  execute: async ({ input }: ToolExecuteArgs<KnowledgeExtractInput>) => {
    await enforceExtractPolicy(input);
    return executeExtract(input);
  },
  inputSchema: knowledgeExtractInputSchema,
  name: "knowledge_extract",
  outputSchema: knowledgeExtractOutputSchema,
};

const aiToolKnowledgeExtractBase = {
  description: toolKnowledgeExtract.description,
  execute: async (input: KnowledgeExtractInput) =>
    toolKnowledgeExtract.execute({ input }),
  inputSchema: toolKnowledgeExtract.inputSchema,
  name: toolKnowledgeExtract.name,
  parameters: toolKnowledgeExtract.inputSchema,
};

export const aiToolKnowledgeExtract: AITool<KnowledgeExtractInput, any> =
  withPolicyApproval(
    aiToolKnowledgeExtractBase,
    (input: KnowledgeExtractInput) => ({
      action: "knowledge.extract",
      authz: input.authz,
      context: {
        contentLength: input.content.length,
      },
      resource: {
        kind: "knowledge",
        id: input.resource ?? "user",
      },
      scopes: ["knowledge.write"],
    })
  );

// ============================================================================
// Tool: knowledge_connect
// ============================================================================

export const toolKnowledgeConnect = {
  description:
    "Create a connection between two nodes in the knowledge graph. Use to establish relationships like 'relates_to', 'blocks', 'depends_on', 'is_a', or 'part_of'.",
  execute: async ({ input }: ToolExecuteArgs<KnowledgeConnectInput>) => {
    await enforceConnectPolicy(input);
    return executeConnect(input);
  },
  inputSchema: knowledgeConnectInputSchema,
  name: "knowledge_connect",
  outputSchema: knowledgeConnectOutputSchema,
};

const aiToolKnowledgeConnectBase = {
  description: toolKnowledgeConnect.description,
  execute: async (input: KnowledgeConnectInput) =>
    toolKnowledgeConnect.execute({ input }),
  inputSchema: toolKnowledgeConnect.inputSchema,
  name: toolKnowledgeConnect.name,
  parameters: toolKnowledgeConnect.inputSchema,
};

export const aiToolKnowledgeConnect: AITool<KnowledgeConnectInput, any> =
  withPolicyApproval(
    aiToolKnowledgeConnectBase,
    (input: KnowledgeConnectInput) => ({
      action: "knowledge.connect",
      authz: input.authz,
      resource: {
        kind: "knowledge",
        id: input.resource ?? "user",
      },
      scopes: ["knowledge.write"],
    })
  );

// ============================================================================
// Tool: knowledge_correct
// ============================================================================

export const toolKnowledgeCorrect = {
  description:
    "Correct errors in the knowledge graph by updating a node/edge or archiving an incorrect fact. Requires elevated (passkey) authorization for safety.",
  execute: async ({ input }: ToolExecuteArgs<KnowledgeCorrectInput>) => {
    const { userId } = await enforceCorrectPolicy(input);
    return executeCorrect(input, userId);
  },
  inputSchema: knowledgeCorrectInputSchema,
  name: "knowledge_correct",
  outputSchema: knowledgeCorrectOutputSchema,
};

const aiToolKnowledgeCorrectBase = {
  description: toolKnowledgeCorrect.description,
  execute: async (input: KnowledgeCorrectInput) =>
    toolKnowledgeCorrect.execute({ input }),
  inputSchema: toolKnowledgeCorrect.inputSchema,
  name: toolKnowledgeCorrect.name,
  parameters: toolKnowledgeCorrect.inputSchema,
};

export const aiToolKnowledgeCorrect: AITool<KnowledgeCorrectInput, any> =
  withPolicyApproval(
    aiToolKnowledgeCorrectBase,
    (input: KnowledgeCorrectInput) => ({
      action: "knowledge.correct",
      authz: input.authz,
      context: {
        requireElevated: true,
        requireBiometric: true,
      },
      resource: {
        kind: "knowledge",
        id: input.resource ?? "user",
      },
      scopes: ["knowledge.write"],
    })
  );

// ============================================================================
// Export types for tool consumers
// ============================================================================

export type ToolKnowledgeQuery = typeof toolKnowledgeQuery;
export type ToolKnowledgeExtract = typeof toolKnowledgeExtract;
export type ToolKnowledgeConnect = typeof toolKnowledgeConnect;
export type ToolKnowledgeCorrect = typeof toolKnowledgeCorrect;
