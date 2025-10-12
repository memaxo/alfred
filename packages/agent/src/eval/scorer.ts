import type { MastraLanguageModel } from "@mastra/core/agent";
import type { MastraScorer, MastraScorers, ScoringSamplingConfig } from "@mastra/core/scores";
import {
  createAnswerRelevancyScorer,
  createPromptAlignmentScorerLLM,
  createToxicityScorer,
} from "@mastra/evals/scorers/llm";
import { createOpenAI, openai as defaultOpenAI } from "@ai-sdk/openai";
import { postEvaluatorScore } from "./laminar-bridge";

type ScorerKey = "relevancy" | "promptAlignment" | "toxicity";

interface ParsedConfig {
  scorers: ScorerKey[];
  model?: string;
}

export interface BuildAgentScorersOptions {
  agent: string;
  samplingRate?: number;
  config?: unknown;
}

const DEFAULT_SCORER_KEYS: ScorerKey[] = ["relevancy", "promptAlignment", "toxicity"];
const DEFAULT_MODEL_ID = process.env.EVAL_MODEL_ID ?? "gpt-4o-mini";

let cachedModel: { id: string; model: MastraLanguageModel } | null = null;

export function buildAgentScorers(options: BuildAgentScorersOptions): MastraScorers {
  const parsed = parseConfig(options.config);
  const model = resolveModel(parsed.model);
  if (!model) {
    return {};
  }

  const samplingConfig = resolveSamplingConfig(options.samplingRate);
  const scorers: MastraScorers = {};

  for (const key of parsed.scorers) {
    const scorer = createScorerByKey(key, model);
    if (!scorer) continue;
    attachLiveScoreHook(scorer, key, options.agent);
    scorers[key] = {
      scorer,
      sampling: samplingConfig,
    };
  }

  return scorers;
}

export function buildEvaluationScorers(config?: unknown) {
  const parsed = parseConfig(config);
  const model = resolveModel(parsed.model);
  if (!model) {
    return {};
  }

  const scorers: Record<string, MastraScorer> = {};
  for (const key of parsed.scorers) {
    const scorer = createScorerByKey(key, model);
    if (!scorer) continue;
    scorers[key] = scorer;
  }
  return scorers;
}

function parseConfig(raw: unknown): ParsedConfig {
  if (!raw || typeof raw !== "object") {
    return { scorers: DEFAULT_SCORER_KEYS };
  }

  const value = raw as { scorers?: unknown; model?: unknown };
  const scorers: ScorerKey[] = Array.isArray(value.scorers)
    ? value.scorers
        .map(item => (typeof item === "string" ? item.trim() : ""))
        .filter((item): item is ScorerKey =>
          item === "relevancy" || item === "promptAlignment" || item === "toxicity",
        )
    : DEFAULT_SCORER_KEYS;

  const uniqueKeys = Array.from(new Set(scorers));
  const modelId = typeof value.model === "string" && value.model.trim().length > 0 ? value.model.trim() : undefined;
  return { scorers: uniqueKeys.length > 0 ? uniqueKeys : DEFAULT_SCORER_KEYS, model: modelId };
}

function resolveModel(preferredModel?: string): MastraLanguageModel | null {
  const modelId = preferredModel ?? cachedModel?.id ?? DEFAULT_MODEL_ID;

  if (cachedModel && cachedModel.id === modelId) {
    return cachedModel.model;
  }

  const provider = createOpenAIProvider();
  if (!provider) {
    return null;
  }

  try {
    const model = provider.chat(modelId);
    cachedModel = { id: modelId, model };
    return model;
  } catch {
    return null;
  }
}

function createOpenAIProvider() {
  try {
    if (process.env.OPENAI_API_KEY) {
      return createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return defaultOpenAI;
  } catch {
    return null;
  }
}

function createScorerByKey(key: ScorerKey, model: MastraLanguageModel) {
  switch (key) {
    case "relevancy":
      return createAnswerRelevancyScorer({
        model,
      });
    case "promptAlignment":
      return createPromptAlignmentScorerLLM({
        model,
      });
    case "toxicity":
      return createToxicityScorer({
        model,
      });
    default:
      return null;
  }
}

function resolveSamplingConfig(rate?: number): ScoringSamplingConfig {
  const rawRate =
    typeof rate === "number" && Number.isFinite(rate)
      ? rate
      : Number(process.env.EVALS_SAMPLING_RATE ?? "0.1");

  if (!Number.isFinite(rawRate) || rawRate <= 0) {
    return { type: "none" };
  }

  if (rawRate >= 1) {
    return { type: "none" };
  }

  return { type: "ratio", rate: rawRate };
}

function attachLiveScoreHook(scorer: MastraScorer, name: string, agent: string) {
  const originalRun = scorer.run.bind(scorer);
  scorer.run = (async function runWithHooks(input) {
    const result = await originalRun(input);
    Promise.resolve(
      postEvaluatorScore(name, result.score, {
        agent,
        runId: input?.runId,
        reason: result.reason,
      }),
    ).catch(() => {
      // swallow post errors to keep scorer execution safe
    });
    return result;
  }) as typeof scorer.run;
}
