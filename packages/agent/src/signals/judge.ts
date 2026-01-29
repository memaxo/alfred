/**
 * Signals LLM Judge
 *
 * Runs an LLM judge over a sanitized trace and returns structured
 * friction/delight/intervention outputs.
 */

import type { LanguageModel } from "ai";

import {
  type SignalsJudgeOutput,
  signalsJudgeOutputSchema,
} from "@alfred/type";
import { generateObject } from "ai";

import { SIGNALS_JUDGE_PROMPT } from "./judge.prompt.js";

export interface SignalsJudgeInput {
  /** Sanitized trace JSON (no raw quotes, no code, no raw paths). */
  readonly trace: Record<string, unknown>;
  /** Optional extra instructions (versioned by caller). */
  readonly guidance?: string;
}

export interface SignalsJudgeOptions {
  readonly model: LanguageModel;
  readonly abortSignal?: AbortSignal;
}

export async function judgeSignals(
  input: SignalsJudgeInput,
  options: SignalsJudgeOptions
): Promise<SignalsJudgeOutput> {
  const prompt = `${SIGNALS_JUDGE_PROMPT}\n\n${
    input.guidance ? `${input.guidance}\n\n` : ""
  }<trace_json>\n${JSON.stringify(input.trace)}\n</trace_json>\n`;

  const res = await generateObject({
    model: options.model as Parameters<typeof generateObject>[0]["model"],
    schema: signalsJudgeOutputSchema,
    prompt,
    abortSignal: options.abortSignal,
  });

  return res.object;
}
