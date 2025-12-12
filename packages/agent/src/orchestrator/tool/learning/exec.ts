/**
 * Learning Tool Execution
 * Persists explicit learning artifacts into the knowledge graph store.
 */

import { randomUUID } from "node:crypto";
import { logger } from "@alfred/logger";
import { supervise } from "@alfred/learning/self_supervision";
import { redactObject, redactSecrets } from "../../../utils/redaction.js";
import { recordAudit } from "../../../utils/audit.js";
import type {
  LearnMistakeInput,
  LearnMistakeOutput,
  LearnPatternInput,
  LearnPatternOutput,
  LearnRecordInput,
  LearnRecordOutput,
} from "./definition.js";

type NodeRow = {
  id: string;
  resource: string;
  hash: string;
  kind: string;
  label: string;
  properties: unknown;
};

const INSIGHT_ERROR_THRESHOLD = 0.15;
const RULE_MAX_LEN = 240;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function jaccardError(expected: string, actual: string): number {
  const e = new Set(tokenize(expected));
  const a = new Set(tokenize(actual));
  if (e.size === 0 && a.size === 0) {
    return 0;
  }
  if (e.size === 0 || a.size === 0) {
    return 1;
  }
  let inter = 0;
  for (const token of e) {
    if (a.has(token)) {
      inter += 1;
    }
  }
  const union = e.size + a.size - inter;
  const similarity = union === 0 ? 0 : inter / union;
  return clamp01(1 - similarity);
}

function computePredictionError(input: LearnRecordInput): number {
  const expected = input.expected?.trim();
  if (!expected) {
    return 0;
  }
  const actual = input.actual.trim();
  if (expected === actual) {
    return 0;
  }
  return jaccardError(expected, actual);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}…`;
}

function normalizeToolSequence(seq: string[]): string[] {
  return seq.map((s) => s.trim()).filter((s) => s.length > 0);
}

function buildHeuristicRule(input: LearnPatternInput): string {
  const domain = input.domain?.trim();
  const seq = normalizeToolSequence(input.toolSequence).join(" → ");
  const headline = domain ? `[${domain}] ${input.description}` : input.description;
  return truncate(`${headline.trim()} (tools: ${seq})`, RULE_MAX_LEN);
}

async function maybeRefineRuleWithLlm(args: {
  description: string;
  toolSequence: string[];
  context: Record<string, unknown> | undefined;
  domain: string | undefined;
}): Promise<string | null> {
  if (process.env.LEARN_PATTERN_LLM_ENABLED?.trim() !== "true") {
    return null;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  try {
    const [{ generateObject }, { createOpenAI }, { z }] = await Promise.all([
      import("ai"),
      import("@ai-sdk/openai"),
      import("zod"),
    ]);

    const openai = createOpenAI({
      apiKey,
      ...(process.env.OPENAI_BASE_URL
        ? { baseURL: process.env.OPENAI_BASE_URL }
        : {}),
      ...(process.env.OPENAI_ORGANIZATION
        ? { organization: process.env.OPENAI_ORGANIZATION }
        : process.env.OPENAI_ORG
          ? { organization: process.env.OPENAI_ORG }
          : {}),
    });

    const schema = z.object({
      rule: z
        .string()
        .min(1)
        .max(RULE_MAX_LEN)
        .describe("A concise, reusable rule capturing the pattern."),
    });

    const safeContext = redactObject(args.context) as Record<string, unknown> | undefined;
    const prompt = [
      "You are extracting a reusable operational pattern for an agent.",
      "Write ONE concise rule (imperative voice).",
      "No markdown. No prefacing.",
      "",
      `Domain: ${args.domain ?? "(none)"}`,
      `Description: ${redactSecrets(args.description)}`,
      `Tool sequence: ${args.toolSequence.map(redactSecrets).join(" -> ")}`,
      `Context (JSON): ${safeContext ? JSON.stringify(safeContext).slice(0, 2000) : "{}"}`,
    ].join("\n");

    const result = await generateObject({
      model: openai.chat(process.env.LEARN_PATTERN_MODEL?.trim() || "gpt-4o-mini"),
      schema,
      prompt,
      temperature: 0,
      maxTokens: 120,
    });

    const candidate = result.object.rule.trim();
    return candidate.length > 0 ? truncate(candidate, RULE_MAX_LEN) : null;
  } catch (error) {
    logger.debug("learn_pattern_llm_refine_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function firstMapValue<T>(map: Map<string, T>): T | null {
  for (const value of map.values()) {
    return value;
  }
  return null;
}

export async function executeLearnRecord(args: {
  input: LearnRecordInput;
  userId: string;
}): Promise<LearnRecordOutput> {
  const graphPkg = "@alfred/db/repo/graph";
  const graphRepo = await import(graphPkg);

  const resource = `runtime:${args.input.workflowId}`;
  const error = computePredictionError(args.input);

  const safeExpected = args.input.expected ? redactSecrets(args.input.expected) : undefined;
  const safeActual = redactSecrets(args.input.actual);
  const safeToolSequence = args.input.toolSequence
    ? normalizeToolSequence(args.input.toolSequence).map(redactSecrets)
    : undefined;
  const safeContext = args.input.context
    ? (redactObject(args.input.context) as Record<string, unknown>)
    : undefined;

  const outcomeLabel = truncate(`${args.input.outcome}: ${safeActual}`, 200);
  const outcomeProps = {
    workflowId: args.input.workflowId,
    outcome: args.input.outcome,
    expected: safeExpected ?? null,
    actual: safeActual,
    toolSequence: safeToolSequence ?? null,
    context: safeContext ?? null,
    error,
    recordedAt: new Date().toISOString(),
  };

  const outcomeMap: Map<string, NodeRow> = await graphRepo.upsertNodes([
    {
      resource,
      hash: randomUUID(),
      kind: "learning_outcome",
      label: outcomeLabel,
      properties: outcomeProps,
    },
  ]);

  const outcomeRow = firstMapValue(outcomeMap);
  if (!outcomeRow) {
    throw new Error("learning_record_persist_failed");
  }

  let insightCount = 0;
  if (error >= INSIGHT_ERROR_THRESHOLD && args.input.expected) {
    const now = new Date().toISOString();
    const updates = supervise({
      input: { workflowId: args.input.workflowId, outcome: args.input.outcome },
      output: safeActual,
      expected: safeExpected,
      error,
      context: {
        ...(safeContext ?? {}),
        reason: "explicit_learning_record",
      },
      ts: now,
    });

    if (updates && updates.length > 0) {
      const insightSeeds = updates
        .map((update) => update.node)
        .filter((node) => node && typeof node === "object")
        .flatMap((node) => {
          if (!("conclusion" in node)) {
            return [];
          }
          const conclusion = (node as { conclusion?: unknown }).conclusion;
          const confidence = (node as { confidence?: unknown }).confidence;
          if (typeof conclusion !== "string" || conclusion.trim().length === 0) {
            return [];
          }
          const insightProps = {
            confidence: typeof confidence === "number" ? confidence : null,
            workflowId: args.input.workflowId,
            outcomeId: outcomeRow.id,
            error,
            source: "learn_record",
          };
          return [
            {
              resource,
              hash: randomUUID(),
              kind: "insight",
              label: truncate(conclusion.trim(), 240),
              properties: insightProps,
            },
          ];
        });

      if (insightSeeds.length > 0) {
        await graphRepo.upsertNodes(insightSeeds);
        insightCount = insightSeeds.length;
      }
    }
  }

  void recordAudit({
    userId: args.userId,
    action: "learning.record",
    resource: { kind: "learning", id: resource },
    decision: "allow",
    obligations: [],
    context: {
      outcome: args.input.outcome,
      error,
      insightCount,
      learningId: outcomeRow.id,
    },
  });

  logger.info("learning_record_completed", {
    workflowId: args.input.workflowId,
    learningId: outcomeRow.id,
    error,
    insightCount,
  });

  return {
    recorded: true,
    learningId: outcomeRow.id,
    error,
  };
}

export async function executeLearnPattern(args: {
  input: LearnPatternInput;
  userId: string;
}): Promise<LearnPatternOutput> {
  const graphPkg = "@alfred/db/repo/graph";
  const graphRepo = await import(graphPkg);

  const resource = "user";
  const heuristicRule = buildHeuristicRule(args.input);

  const refined =
    (await maybeRefineRuleWithLlm({
      description: args.input.description,
      toolSequence: args.input.toolSequence,
      context: args.input.context,
      domain: args.input.domain,
    })) ?? null;

  const rule = refined ?? heuristicRule;
  const source = refined ? "llm" : "heuristic";

  const safeTools = normalizeToolSequence(args.input.toolSequence).map(redactSecrets);
  const safeContext = args.input.context
    ? (redactObject(args.input.context) as Record<string, unknown>)
    : undefined;

  const nodeMap: Map<string, NodeRow> = await graphRepo.upsertNodes([
    {
      resource,
      hash: `pattern:${randomUUID()}`,
      kind: "pattern",
      label: truncate(redactSecrets(rule), RULE_MAX_LEN),
      properties: {
        description: redactSecrets(args.input.description),
        rule: redactSecrets(rule),
        toolSequence: safeTools,
        context: safeContext ?? null,
        domain: args.input.domain ?? null,
        confidence: args.input.confidence,
        source,
        recordedAt: new Date().toISOString(),
      },
    },
  ]);

  const row = firstMapValue(nodeMap);
  if (!row) {
    throw new Error("learning_pattern_persist_failed");
  }

  void recordAudit({
    userId: args.userId,
    action: "learning.pattern",
    resource: { kind: "learning", id: args.input.domain ?? "user" },
    decision: "allow",
    obligations: [],
    context: {
      patternId: row.id,
      confidence: args.input.confidence,
      source,
    },
  });

  logger.info("learning_pattern_completed", {
    patternId: row.id,
    confidence: args.input.confidence,
    source,
  });

  return {
    patternId: row.id,
    description: args.input.description,
    confidence: args.input.confidence,
  };
}

export async function executeLearnMistake(args: {
  input: LearnMistakeInput;
  userId: string;
}): Promise<LearnMistakeOutput> {
  const graphPkg = "@alfred/db/repo/graph";
  const graphRepo = await import(graphPkg);

  const resource = "user";
  const safeMistake = redactSecrets(args.input.mistake);
  const safeCorrection = redactSecrets(args.input.correction);
  const safeContext = args.input.context
    ? (redactObject(args.input.context) as Record<string, unknown>)
    : undefined;

  const rule = truncate(`Avoid: ${safeMistake}. Fix: ${safeCorrection}`, RULE_MAX_LEN);

  const nodeMap: Map<string, NodeRow> = await graphRepo.upsertNodes([
    {
      resource,
      hash: `mistake:${randomUUID()}`,
      kind: "heuristic",
      label: truncate(`Avoid: ${safeMistake}`, 200),
      properties: {
        rule,
        mistake: safeMistake,
        correction: safeCorrection,
        severity: args.input.severity,
        domain: args.input.domain ?? null,
        context: safeContext ?? null,
        confidence: args.input.severity === "high" ? 0.9 : args.input.severity === "medium" ? 0.75 : 0.6,
        source: "explicit_mistake",
        recordedAt: new Date().toISOString(),
      },
    },
  ]);

  const row = firstMapValue(nodeMap);
  if (!row) {
    throw new Error("learning_mistake_persist_failed");
  }

  void recordAudit({
    userId: args.userId,
    action: "learning.mistake",
    resource: { kind: "learning", id: args.input.domain ?? "user" },
    decision: "allow",
    obligations: [],
    context: {
      mistakeId: row.id,
      severity: args.input.severity,
    },
  });

  logger.info("learning_mistake_completed", {
    mistakeId: row.id,
    severity: args.input.severity,
  });

  return {
    mistakeId: row.id,
    recorded: true,
  };
}

