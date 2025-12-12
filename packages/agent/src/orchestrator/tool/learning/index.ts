/**
 * Learning Tools
 * Exposes explicit learning/feedback capabilities as agent tools.
 */

import { withPolicyApproval } from "../approval.js";
import type {
  LearnMistakeInput,
  LearnPatternInput,
  LearnRecordInput,
} from "./definition.js";
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
  name: "learn_record",
  description:
    "Record a workflow outcome (expected vs actual) to improve future behavior. Persists a learning outcome and optional insights to the knowledge graph.",
  inputSchema: learnRecordInputSchema,
  outputSchema: learnRecordOutputSchema,
  execute: async ({ input }: { input: LearnRecordInput }) => {
    const { userId } = await enforceLearnRecordPolicy(input);
    return executeLearnRecord({ input, userId });
  },
};

const aiToolLearnRecordBase = {
  name: toolLearnRecord.name,
  description: toolLearnRecord.description,
  parameters: toolLearnRecord.inputSchema,
  inputSchema: toolLearnRecord.inputSchema,
  execute: async (input: LearnRecordInput) => toolLearnRecord.execute({ input }),
};

export const aiToolLearnRecord = withPolicyApproval(
  aiToolLearnRecordBase,
  (input: LearnRecordInput) => ({
    action: "learning.record",
    resource: {
      kind: "learning",
      id: `runtime:${input.workflowId}`,
    },
    scopes: ["learning.write"],
    authz: input.authz,
    context: {
      outcome: input.outcome,
      contentLength: input.actual.length,
    },
  })
);

// ============================================================================
// Tool: learn_pattern
// ============================================================================

export const toolLearnPattern = {
  name: "learn_pattern",
  description:
    "Store a successful tool sequence as a reusable pattern. Optionally refines a concise rule using a fast/low-cost language model when available.",
  inputSchema: learnPatternInputSchema,
  outputSchema: learnPatternOutputSchema,
  execute: async ({ input }: { input: LearnPatternInput }) => {
    const { userId } = await enforceLearnPatternPolicy(input);
    return executeLearnPattern({ input, userId });
  },
};

const aiToolLearnPatternBase = {
  name: toolLearnPattern.name,
  description: toolLearnPattern.description,
  parameters: toolLearnPattern.inputSchema,
  inputSchema: toolLearnPattern.inputSchema,
  execute: async (input: LearnPatternInput) =>
    toolLearnPattern.execute({ input }),
};

export const aiToolLearnPattern = withPolicyApproval(
  aiToolLearnPatternBase,
  (input: LearnPatternInput) => ({
    action: "learning.pattern",
    resource: {
      kind: "learning",
      id: input.domain ?? "user",
    },
    scopes: ["learning.write"],
    authz: input.authz,
    context: {
      domain: input.domain ?? null,
      confidence: input.confidence,
      toolCount: input.toolSequence.length,
    },
  })
);

// ============================================================================
// Tool: learn_mistake
// ============================================================================

export const toolLearnMistake = {
  name: "learn_mistake",
  description:
    "Record a mistake and its correction for future avoidance. Persists a heuristic-style rule into the knowledge graph.",
  inputSchema: learnMistakeInputSchema,
  outputSchema: learnMistakeOutputSchema,
  execute: async ({ input }: { input: LearnMistakeInput }) => {
    const { userId } = await enforceLearnMistakePolicy(input);
    return executeLearnMistake({ input, userId });
  },
};

const aiToolLearnMistakeBase = {
  name: toolLearnMistake.name,
  description: toolLearnMistake.description,
  parameters: toolLearnMistake.inputSchema,
  inputSchema: toolLearnMistake.inputSchema,
  execute: async (input: LearnMistakeInput) =>
    toolLearnMistake.execute({ input }),
};

export const aiToolLearnMistake = withPolicyApproval(
  aiToolLearnMistakeBase,
  (input: LearnMistakeInput) => ({
    action: "learning.mistake",
    resource: {
      kind: "learning",
      id: input.domain ?? "user",
    },
    scopes: ["learning.write"],
    authz: input.authz,
    context: {
      domain: input.domain ?? null,
      severity: input.severity,
    },
  })
);

export type ToolLearnRecord = typeof toolLearnRecord;
export type ToolLearnPattern = typeof toolLearnPattern;
export type ToolLearnMistake = typeof toolLearnMistake;

