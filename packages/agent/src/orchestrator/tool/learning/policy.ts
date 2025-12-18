/**
 * Learning Tool Policy Enforcement
 * Policy checks for explicit learning operations.
 */

import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import type {
  LearnMistakeInput,
  LearnPatternInput,
  LearnRecordInput,
} from "./definition.js";

const MAX_TEXT_LEN = 50_000;
const MAX_TOOL_SEQUENCE = 25;
const MAX_TOOL_NAME_LEN = 128;
const MAX_CONTEXT_JSON_LEN = 50_000;

function assertMaxLen(value: string | undefined, code: string): void {
  if (!value) {
    return;
  }
  if (value.length > MAX_TEXT_LEN) {
    throw new Error(code);
  }
}

function safeJsonSize(value: Record<string, unknown> | undefined): number {
  if (!value) {
    return 0;
  }
  try {
    return JSON.stringify(value).length;
  } catch {
    // If the context is not serializable, treat it as too large/unsafe.
    return Number.POSITIVE_INFINITY;
  }
}

function enforceToolSequence(
  seq: string[] | undefined,
  codeTooLong: string
): void {
  if (!seq) {
    return;
  }
  if (seq.length > MAX_TOOL_SEQUENCE) {
    throw new Error(codeTooLong);
  }
  for (const item of seq) {
    if (item.length > MAX_TOOL_NAME_LEN) {
      throw new Error(codeTooLong);
    }
  }
}

function enforceContextSize(
  context: Record<string, unknown> | undefined
): void {
  const size = safeJsonSize(context);
  if (size > MAX_CONTEXT_JSON_LEN) {
    throw new Error("learning_context_too_large");
  }
}

export async function enforceLearnRecordPolicy(
  input: LearnRecordInput
): Promise<{ userId: string }> {
  assertMaxLen(input.actual, "learning_actual_too_large");
  assertMaxLen(input.expected, "learning_expected_too_large");
  enforceToolSequence(input.toolSequence, "learning_tool_sequence_too_large");
  enforceContextSize(input.context);

  const { claims } = await requireToolScopesAndPolicy(
    input.authz,
    ["learning.write"],
    {
      action: "learning.record",
      resource: {
        kind: "learning",
        id: `runtime:${input.workflowId}`,
      },
      context: {
        outcome: input.outcome,
        contentLength: input.actual.length,
      },
    }
  );

  return { userId: claims.sub };
}

export async function enforceLearnPatternPolicy(
  input: LearnPatternInput
): Promise<{ userId: string }> {
  assertMaxLen(input.description, "learning_description_too_large");
  enforceToolSequence(input.toolSequence, "learning_tool_sequence_too_large");
  enforceContextSize(input.context);

  const { claims } = await requireToolScopesAndPolicy(
    input.authz,
    ["learning.write"],
    {
      action: "learning.pattern",
      resource: {
        kind: "learning",
        id: input.domain ?? "user",
      },
      context: {
        domain: input.domain ?? null,
        confidence: input.confidence,
        toolCount: input.toolSequence.length,
      },
    }
  );

  return { userId: claims.sub };
}

export async function enforceLearnMistakePolicy(
  input: LearnMistakeInput
): Promise<{ userId: string }> {
  assertMaxLen(input.mistake, "learning_mistake_too_large");
  assertMaxLen(input.correction, "learning_correction_too_large");
  enforceContextSize(input.context);

  const { claims } = await requireToolScopesAndPolicy(
    input.authz,
    ["learning.write"],
    {
      action: "learning.mistake",
      resource: {
        kind: "learning",
        id: input.domain ?? "user",
      },
      context: {
        domain: input.domain ?? null,
        severity: input.severity,
      },
    }
  );

  return { userId: claims.sub };
}
