/**
 * Learning Tools
 * Exposes explicit learning/feedback capabilities as agent tools.
 */

import type {
  LearnFeedbackNegativeEvent,
  LearnFeedbackPositiveEvent,
  LearnHeuristicProposedEvent,
  LearnPatternDetectedEvent,
} from "@alfred/type";
import type { ToolCallOptions } from "ai";

import type { ToolExecuteArgs } from "../shared/context.js";
import type {
  LearnMistakeInput,
  LearnPatternInput,
  LearnRecordInput,
} from "./definition.js";

import { getHooksRuntime } from "../../../../assistant/src/tool/memory/hook";
import { type AITool, withPolicyApproval } from "../approval.js";
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
  execute: async (
    { input }: ToolExecuteArgs<LearnRecordInput>,
    options?: ToolCallOptions
  ) => {
    const { userId } = await enforceLearnRecordPolicy(input);

    const hooks = getHooksRuntime(options);
    let { actual } = input;

    if (hooks) {
      const base = {
        context: input.workflowId,
        action: actual,
      };

      const hookEvent: LearnFeedbackPositiveEvent | LearnFeedbackNegativeEvent =
        input.outcome === "success"
          ? {
              type: "learn:feedback:positive",
              ...base,
              reinforcement: 1,
            }
          : {
              type: "learn:feedback:negative",
              ...base,
              reason: input.outcome,
            };

      const out = await hooks.registry.emit(hookEvent, hooks.ctx);
      if (out.decision === "deny" || out.decision === "ask") {
        throw new Error(out.reason ?? "hook_denied");
      }

      const next = (out.transformed ?? hookEvent) as
        | LearnFeedbackPositiveEvent
        | LearnFeedbackNegativeEvent;
      actual = next.action;
    }

    return executeLearnRecord({ input: { ...input, actual }, userId });
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
  execute: async (
    { input }: ToolExecuteArgs<LearnPatternInput>,
    options?: ToolCallOptions
  ) => {
    const { userId } = await enforceLearnPatternPolicy(input);

    const hooks = getHooksRuntime(options);
    let { description } = input;
    let { confidence } = input;

    if (hooks) {
      const hookEvent: LearnPatternDetectedEvent = {
        type: "learn:pattern:detected",
        pattern: {
          type: input.domain
            ? `tool_sequence:${input.domain}`
            : "tool_sequence",
          description,
          confidence,
          examples: [input.toolSequence.join(" → ")],
        },
      };

      const out = await hooks.registry.emit(hookEvent, hooks.ctx);
      if (out.decision === "deny" || out.decision === "ask") {
        throw new Error(out.reason ?? "hook_denied");
      }

      const next = (out.transformed ?? hookEvent) as LearnPatternDetectedEvent;
      ({ description } = next.pattern);
      ({ confidence } = next.pattern);
    }

    return executeLearnPattern({
      input: { ...input, description, confidence },
      userId,
    });
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
  execute: async (
    { input }: ToolExecuteArgs<LearnMistakeInput>,
    options?: ToolCallOptions
  ) => {
    const { userId } = await enforceLearnMistakePolicy(input);

    const hooks = getHooksRuntime(options);
    let { mistake } = input;
    let { correction } = input;

    if (hooks) {
      const baseConfidence =
        input.severity === "high"
          ? 0.9
          : (input.severity === "medium"
            ? 0.7
            : 0.5);

      const hookEvent: LearnHeuristicProposedEvent = {
        type: "learn:heuristic:proposed",
        heuristic: {
          condition: mistake,
          action: correction,
          confidence: baseConfidence,
          source: "feedback",
        },
      };

      const out = await hooks.registry.emit(hookEvent, hooks.ctx);
      if (out.decision === "deny" || out.decision === "ask") {
        throw new Error(out.reason ?? "hook_denied");
      }

      const next = (out.transformed ??
        hookEvent) as LearnHeuristicProposedEvent;
      mistake = next.heuristic.condition;
      correction = next.heuristic.action;
    }

    return executeLearnMistake({
      input: { ...input, mistake, correction },
      userId,
    });
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
