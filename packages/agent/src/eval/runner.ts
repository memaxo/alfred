import type { Agent } from "@mastra/core/agent";
import type { MessageListInput } from "@mastra/core/agent/message-list";
import type { MastraScorer } from "@mastra/core/scores";
import { mastra } from "../mastra";
import * as evalRepo from "@alfred/db/repo/eval";
import { randomUUID } from "node:crypto";
import type {
  EvalDefRow,
  EvalDatasetRow,
  EvalPointRow,
  EvalRunRow,
} from "@alfred/db/repo/eval";
import {
  getLaminarEvalDefaults,
  prepareLaminarEvalRun,
  createLaminarDatapoint,
  updateLaminarDatapoint,
  withEvalSpan,
  flushLaminar,
  postEvaluatorScore,
  type LaminarEvalConfig,
} from "./laminar-bridge";
import {
  recordEvalRunStatus,
  recordEvalScore,
  recordEvalFailure,
  startEvalRunTimer,
} from "../metrics";
import { buildEvaluationScorers } from "./scorer";

export interface RunEvalOptions {
  def: { slug: string } | { id: string };
  datasetId: string;
  variant?: string;
  laminar?: Partial<LaminarEvalConfig>;
  onPoint?: (event: { pointId: string; index: number; total: number }) => void;
}

export interface RunEvalResult {
  runId: string;
  counts: {
    points: number;
    scored: number;
    errors: number;
  };
  stats: Record<
    string,
    {
      mean: number;
      min: number;
      max: number;
      count: number;
    }
  >;
  run: EvalRunRow;
}

type ScoreAggregate = {
  sum: number;
  count: number;
  min: number;
  max: number;
};

type ScoreRecord = {
  name: string;
  value: number;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export async function runEval(options: RunEvalOptions): Promise<RunEvalResult> {
  const definition = await resolveDefinition(options.def);
  const dataset = await evalRepo.getDatasetById(options.datasetId);
  if (!dataset) {
    throw new Error("eval_dataset_not_found");
  }

  const agent = resolveAgent(definition.agent);
  const scorerMap = buildEvaluationScorers(definition.config ?? undefined);
  if (Object.keys(scorerMap).length === 0) {
    throw new Error("eval_scorers_unavailable");
  }

  const run = await evalRepo.createRun({
    defId: definition.id,
    datasetId: dataset.id,
    variant: options.variant,
  });
  if (!run) {
    throw new Error("eval_run_create_failed");
  }

  const runId = run.id;
  const startTime = new Date();
  const timer = startEvalRunTimer(definition.agent);

  await evalRepo.updateRun(runId, {
    status: "running",
    startedAt: startTime,
  });

  recordEvalRunStatus(definition.agent, "started");

  const laminarConfig = mergeLaminarConfig(options.laminar);
  const aggregates = new Map<string, ScoreAggregate>();
  const buffer: Array<{
    pointId: string;
    scorer: string;
    score: number;
    reason?: unknown;
    metadata?: unknown;
  }> = [];
  const totals = {
    points: 0,
    scored: 0,
    errors: 0,
  };
  let laminarRun:
    | {
        evalId: string;
        mode: LaminarEvalConfig["mode"];
      }
    | null = null;

  try {
    laminarRun = await prepareLaminarEvalRun(
      definition.slug,
      {
        defId: definition.id,
        datasetId: dataset.id,
        runId,
        variant: options.variant ?? "control",
      },
      laminarConfig,
    );

    if (laminarRun?.evalId) {
      await evalRepo.updateRun(runId, { laminarEvalId: laminarRun.evalId });
    }

    const points = await evalRepo.getPointsForDataset(dataset.id);
    totals.points = points.length;
    const BUFFER_SIZE = 100;

    for (let index = 0; index < points.length; index++) {
      const point = points[index]!;
      options.onPoint?.({ pointId: point.id, index, total: points.length });

      try {
        const spanName = `eval.point.${definition.slug}`;
        const spanMetadata = {
          runId,
          pointId: point.id,
          defId: definition.id,
          datasetId: dataset.id,
          agent: definition.agent,
          variant: options.variant ?? "control",
        };

        const { traceId, result } = await withEvalSpan(
          spanName,
          point.input,
          spanMetadata,
          async () =>
            evaluatePoint({
              agent,
              point,
              dataset,
              runId,
              variant: options.variant,
              scorers: scorerMap,
            }),
        );

        if (result.scoreRows.length > 0) {
          totals.scored += 1;
        }
        appendScores(buffer, result.scoreRows);

        for (const row of result.scoreRows) {
          updateAggregate(aggregates, row.scorer, row.score);
        }

        if (buffer.length >= BUFFER_SIZE) {
          await persistScoreBuffer(runId, buffer);
        }

        if (laminarRun?.evalId) {
          const datapointId = await createLaminarDatapoint(
            laminarRun.evalId,
            {
              data: point.input,
              target: point.target ?? null,
              metadata: normalizeRecord(point.metadata),
              index,
            },
            traceId,
            laminarRun.mode,
          );

          if (datapointId) {
            await updateLaminarDatapoint(
              laminarRun.evalId,
              datapointId,
              {
                scores: result.laminarScores,
                executorOutput: result.executorOutput,
              },
              laminarRun.mode,
            );
          }
        }
      } catch (error) {
        totals.errors += 1;
        recordEvalFailure("runtime", toErrorMessage(error));
      }
    }

    if (buffer.length > 0) {
      await persistScoreBuffer(runId, buffer);
    }

    const stats = buildStats(aggregates);
    const finishedAt = new Date();
    const status =
      totals.errors > 0 && totals.scored === 0
        ? "failed"
        : totals.errors > 0
          ? "partial"
          : "success";

    await evalRepo.updateRun(runId, {
      status,
      finishedAt,
      stats: {
        totals,
        scorers: stats,
      },
    });

    recordEvalRunStatus(definition.agent, status);
    timer();

    if (laminarRun?.evalId) {
      await flushLaminar();
    }

    const refreshed = await evalRepo.getRun(runId);
    const runRow = refreshed?.run ?? run;

    return {
      runId,
      counts: totals,
      stats,
      run: runRow,
    };
  } catch (error) {
    try {
      if (buffer.length > 0) {
        await persistScoreBuffer(runId, buffer);
      }
    } catch {
      // ignore flush errors during failure
    }

    const stats = buildStats(aggregates);
    await evalRepo.updateRun(runId, {
      status: "failed",
      finishedAt: new Date(),
      stats: {
        totals,
        scorers: stats,
      },
    });

    recordEvalRunStatus(definition.agent, "failed");
    timer();

    if (laminarRun?.evalId) {
      await flushLaminar();
    }

    throw error;
  }
}

async function evaluatePoint(input: {
  agent: Agent;
  point: EvalPointRow;
  dataset: EvalDatasetRow;
  runId: string;
  variant?: string;
  scorers: Record<string, MastraScorer>;
}) {
  const { agent, point, runId, variant, scorers } = input;
  const messageInput = normalizeMessageInput(point.input);

  const output = await agent.generate(messageInput, {
    runId: `${runId}:${point.id}`,
    returnScorerData: true,
  });

  const fallbackContext = buildFallbackScorerContext(messageInput, output.text);

  const scorerInput =
    (output.scoringData?.input as unknown) ?? fallbackContext.input;

  const scorerOutput =
    (output.scoringData?.output as unknown) ?? fallbackContext.output;

  const scores: ScoreRecord[] = [];
  const laminarScores: Record<string, number> = {};

  for (const [name, scorer] of Object.entries(scorers)) {
    try {
      const result = await scorer.run({
        runId: `${runId}:${point.id}:${name}`,
        input: scorerInput,
        output: scorerOutput,
        groundTruth: point.target ?? null,
        runtimeContext: {
          datasetId: input.dataset.id,
          pointId: point.id,
          variant: variant ?? "control",
        },
      });

      const metadata = compactMetadata({
        runId: result.runId,
        prompts: {
          preprocess: result.preprocessPrompt,
          analyze: result.analyzePrompt,
          score: result.generateScorePrompt,
          reason: result.generateReasonPrompt,
        },
        steps: {
          preprocess: result.preprocessStepResult,
          analyze: result.analyzeStepResult,
        },
      });

      scores.push({
        name,
        value: result.score,
        reason: result.reason,
        metadata,
      });

      laminarScores[name] = result.score;
      recordEvalScore(name);

      await postEvaluatorScore(name, result.score, {
        runId,
        pointId: point.id,
        variant: variant ?? "control",
      });
    } catch (error) {
      recordEvalFailure(name, toErrorMessage(error));
    }
  }

  const executorOutput = {
    text: output.text,
    usage: output.usage,
    finishReason: output.finishReason,
  };

  return {
    scoreRows: scores.map(score => ({
      pointId: point.id,
      scorer: score.name,
      score: score.value,
      reason: score.reason ?? null,
      metadata: score.metadata ?? null,
    })),
    laminarScores,
    executorOutput,
  };
}

async function persistScoreBuffer(
  runId: string,
  buffer: Array<{
    pointId: string;
    scorer: string;
    score: number;
    reason?: unknown;
    metadata?: unknown;
  }>,
) {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  await evalRepo.insertScores(runId, batch);
}

function updateAggregate(store: Map<string, ScoreAggregate>, scorer: string, value: number) {
  const current = store.get(scorer);
  if (!current) {
    store.set(scorer, {
      sum: value,
      count: 1,
      min: value,
      max: value,
    });
    return;
  }

  current.sum += value;
  current.count += 1;
  current.min = Math.min(current.min, value);
  current.max = Math.max(current.max, value);
}

function buildStats(aggregates: Map<string, ScoreAggregate>) {
  const stats: Record<string, { mean: number; min: number; max: number; count: number }> = {};
  for (const [name, value] of aggregates.entries()) {
    stats[name] = {
      mean: value.count > 0 ? value.sum / value.count : 0,
      min: value.min,
      max: value.max,
      count: value.count,
    };
  }
  return stats;
}

function normalizeMessageInput(input: unknown): MessageListInput {
  if (typeof input === "string") return input;
  if (Array.isArray(input)) return input as MessageListInput;

  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    if (Array.isArray(record.messages)) {
      return record.messages as MessageListInput;
    }
    if (typeof record.prompt === "string") {
      return record.prompt;
    }
  }

  if (input === null || input === undefined) {
    return "";
  }

  if (typeof input === "object") {
    return JSON.stringify(input);
  }

  return String(input);
}

function buildFallbackScorerContext(messageInput: MessageListInput, candidate: string) {
  const normalizedInput =
    typeof messageInput === "string"
      ? messageInput
      : Array.isArray(messageInput)
        ? messageInput.map(entry => (typeof entry === "string" ? entry : JSON.stringify(entry))).join("\n")
        : JSON.stringify(messageInput);

  return {
    input: {
      inputMessages: [
        {
          id: randomUUID(),
          role: "user",
          content: normalizedInput,
          createdAt: new Date(),
        },
      ],
      rememberedMessages: [],
      systemMessages: [],
      taggedSystemMessages: {},
    },
    output: [
      {
        id: randomUUID(),
        role: "assistant",
        content: candidate,
        createdAt: new Date(),
      },
    ],
  } as {
    input: any;
    output: any;
  };
}

function mergeLaminarConfig(overrides?: Partial<LaminarEvalConfig>): LaminarEvalConfig {
  const defaults = getLaminarEvalDefaults();
  return {
    enabled: overrides?.enabled ?? defaults.enabled,
    mode: overrides?.mode ?? defaults.mode,
    groupName: overrides?.groupName ?? defaults.groupName,
  };
}

async function resolveDefinition(def: { slug: string } | { id: string }): Promise<EvalDefRow> {
  if ("slug" in def) {
    const row = await evalRepo.getEvalDefBySlug(def.slug);
    if (!row) throw new Error("eval_def_not_found");
    return row;
  }
  const row = await evalRepo.getEvalDefById(def.id);
  if (!row) throw new Error("eval_def_not_found");
  return row;
}

function resolveAgent(agentName: string): Agent {
  const getter = (mastra.getAgent as unknown as ((name: string) => Agent | undefined) | undefined);
  if (!getter) {
    throw new Error("agent_resolver_unavailable");
  }
  const agent = getter(agentName);
  if (!agent) {
    throw new Error(`agent_not_found:${agentName}`);
  }
  return agent;
}

function appendScores(
  buffer: Array<{
    pointId: string;
    scorer: string;
    score: number;
    reason?: unknown;
    metadata?: unknown;
  }>,
  rows: Array<{
    pointId: string;
    scorer: string;
    score: number;
    reason?: unknown;
    metadata?: unknown;
  }>,
) {
  for (const row of rows) {
    buffer.push(row);
  }
}

function normalizeRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function compactMetadata(metadata: Record<string, unknown>) {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      const arrayValue = value
        .map(item =>
          item && typeof item === "object"
            ? compactMetadata(item as Record<string, unknown>)
            : item,
        )
        .filter(item => item !== undefined && item !== null);
      if (arrayValue.length > 0) {
        cleaned[key] = arrayValue;
      }
    } else if (typeof value === "object") {
      const nested = compactMetadata(value as Record<string, unknown>);
      if (Object.keys(nested).length > 0) {
        cleaned[key] = nested;
      }
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unknown_error";
}
