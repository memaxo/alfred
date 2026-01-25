/**
 * Learning Tools
 * Exposes explicit learning/feedback capabilities as agent tools.
 */

import type { ToolExecuteArgs } from "../shared/context.js";
import type {
  LearnMistakeInput,
  LearnPatternInput,
  LearnRecordInput,
} from "./definition.js";

import { withPolicyApproval, type AITool } from "../approval.js";
import {
  learnMistakeInputSchema,
  learnMistakeOutputSchema,
  learnPatternInputSchema,
  learnPatternOutputSchema,
  learnRecordInputSchema,
  learnRecordOutputSchema,
} from "./definition.js";
import {
  executeLearnMistake,
  executeLearnPattern,
  executeLearnRecord,
} from "./exec.js";
import {
  enforceLearnMistakePolicy,
  enforceLearnPatternPolicy,
  enforceLearnRecordPolicy,
} from "./policy.js";

export type {
  LearnMistakeInput,
  LearnMistakeOutput,
  LearnPatternInput,
  LearnPatternOutput,
  LearnRecordInput,
  LearnRecordOutput,
} from "./definition.js";

export {
  learnMistakeInputSchema,
  learnMistakeOutputSchema,
  learnPatternInputSchema,
  learnPatternOutputSchema,
  learnRecordInputSchema,
  learnRecordOutputSchema,
} from "./definition.js";

// ============================================================================
// Tool: learn_record
// ============================================================================

export const toolLearnRecord = {
  description:
    "Record a workflow outcome (expected vs actual) to improve future behavior. Persists a learning outcome and optional insights to the knowledge graph.",
  execute: async ({ input }: ToolExecuteArgs<LearnRecordInput>) => {
    const { userId } = await enforceLearnRecordPolicy(input);
    return executeLearnRecord({ input, userId });
  },
  inputSchema: learnRecordInputSchema,
  name: "learn_record",
  outputSchema: learnRecordOutputSchema,
};

const aiToolLearnRecordBase = {
  description: toolLearnRecord.description,
  execute: async (input: LearnRecordInput) =>
    toolLearnRecord.execute({ input }),
  inputSchema: toolLearnRecord.inputSchema,
  name: toolLearnRecord.name,
  parameters: toolLearnRecord.inputSchema,
};

export const aiToolLearnRecord: AITool<LearnRecordInput, any> =
  withPolicyApproval(aiToolLearnRecordBase, (input: LearnRecordInput) => ({
    action: "learning.record",
    authz: input.authz,
    context: {
      outcome: input.outcome,
      contentLength: input.actual.length,
    },
    resource: {
      kind: "learning",
      id: `runtime:${input.workflowId}`,
    },
    scopes: ["learning.write"],
  }));

// ============================================================================
// Tool: learn_pattern
// ============================================================================

export const toolLearnPattern = {
  description:
    "Store a successful tool sequence as a reusable pattern. Optionally refines a concise rule using a fast/low-cost language model when available.",
  execute: async ({ input }: ToolExecuteArgs<LearnPatternInput>) => {
    const { userId } = await enforceLearnPatternPolicy(input);
    return executeLearnPattern({ input, userId });
  },
  inputSchema: learnPatternInputSchema,
  name: "learn_pattern",
  outputSchema: learnPatternOutputSchema,
};

const aiToolLearnPatternBase = {
  description: toolLearnPattern.description,
  execute: async (input: LearnPatternInput) =>
    toolLearnPattern.execute({ input }),
  inputSchema: toolLearnPattern.inputSchema,
  name: toolLearnPattern.name,
  parameters: toolLearnPattern.inputSchema,
};

export const aiToolLearnPattern: AITool<LearnPatternInput, any> =
  withPolicyApproval(aiToolLearnPatternBase, (input: LearnPatternInput) => ({
    action: "learning.pattern",
    authz: input.authz,
    context: {
      domain: input.domain ?? null,
      confidence: input.confidence,
      toolCount: input.toolSequence.length,
    },
    resource: {
      kind: "learning",
      id: input.domain ?? "user",
    },
    scopes: ["learning.write"],
  }));

// ============================================================================
// Tool: learn_mistake
// ============================================================================

export const toolLearnMistake = {
  description:
    "Record a mistake and its correction for future avoidance. Persists a heuristic-style rule into the knowledge graph.",
  execute: async ({ input }: ToolExecuteArgs<LearnMistakeInput>) => {
    const { userId } = await enforceLearnMistakePolicy(input);
    return executeLearnMistake({ input, userId });
  },
  inputSchema: learnMistakeInputSchema,
  name: "learn_mistake",
  outputSchema: learnMistakeOutputSchema,
};

const aiToolLearnMistakeBase = {
  description: toolLearnMistake.description,
  execute: async (input: LearnMistakeInput) =>
    toolLearnMistake.execute({ input }),
  inputSchema: toolLearnMistake.inputSchema,
  name: toolLearnMistake.name,
  parameters: toolLearnMistake.inputSchema,
};

export const aiToolLearnMistake: AITool<LearnMistakeInput, any> =
  withPolicyApproval(aiToolLearnMistakeBase, (input: LearnMistakeInput) => ({
    action: "learning.mistake",
    authz: input.authz,
    context: {
      domain: input.domain ?? null,
      severity: input.severity,
    },
    resource: {
      kind: "learning",
      id: input.domain ?? "user",
    },
    scopes: ["learning.write"],
  }));

export type ToolLearnRecord = typeof toolLearnRecord;
export type ToolLearnPattern = typeof toolLearnPattern;
export type ToolLearnMistake = typeof toolLearnMistake;
