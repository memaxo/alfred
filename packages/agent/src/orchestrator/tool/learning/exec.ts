/**
 * Learning Tool Execution
 * Persists explicit learning artifacts into the knowledge graph store.
 */

import { randomUUID } from "node:crypto";
import { cosineSimilarity, embedMany } from "@alfred/embed";
import { supervise } from "@alfred/learning/self_supervision";
import { logger } from "@alfred/logger";
import type { KnowledgeInsight } from "@alfred/type/knowledge";
import { recordAudit } from "../../../utils/audit.js";
import { redactObject, redactSecrets } from "../../../utils/redaction.js";
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

/**
 * Error threshold for triggering insight generation.
 * When prediction error >= this value, supervise() is called to generate insights.
 */
const INSIGHT_ERROR_THRESHOLD = 0.15;

/**
 * Maximum length for rule strings stored in the knowledge graph.
 * Rules exceeding this length are truncated.
 */
const RULE_MAX_LEN = 240;

/**
 * Clamps a numeric value to the range [0, 1].
 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Computes prediction error between expected and actual outcomes.
 * Returns 0 if no expected value is provided.
 */
async function computePredictionError(input: LearnRecordInput): Promise<number> {
  const expected = input.expected?.trim();
  if (!expected) {
    return 0;
  }
  const actual = input.actual.trim();
  if (expected === actual) {
    return 0;
  }
  try {
    const vectors = await embedMany([expected, actual]);
    const expectedVec = vectors[0];
    const actualVec = vectors[1];
    if (!(expectedVec && actualVec)) {
      return 1;
    }

    const similarity = cosineSimilarity(expectedVec, actualVec);
    const sim01 = clamp01(Math.max(0, similarity));
    return clamp01(1 - sim01);
  } catch (error) {
    logger.warn("learning_prediction_error_embed_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 1;
  }
}

/**
 * Truncates a string to a maximum length, appending ellipsis if truncated.
 */
function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}…`;
}

/**
 * Normalizes a tool sequence by trimming and filtering empty strings.
 */
function normalizeToolSequence(seq: string[]): string[] {
  return seq.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Builds a heuristic rule string from pattern input.
 * Format: "[domain] description (tools: seq1 → seq2 → ...)"
 */
function buildHeuristicRule(input: LearnPatternInput): string {
  const domain = input.domain?.trim();
  const seq = normalizeToolSequence(input.toolSequence).join(" → ");
  const headline = domain
    ? `[${domain}] ${input.description}`
    : input.description;
  return truncate(`${headline.trim()} (tools: ${seq})`, RULE_MAX_LEN);
}

/**
 * Extracts the first value from a Map, or null if empty.
 */
function firstMapValue<T>(map: Map<string, T>): T | null {
  for (const value of map.values()) {
    return value;
  }
  return null;
}

/**
 * Type guard for insight nodes with conclusion property.
 * Checks if a node from supervise() output is a KnowledgeInsight node.
 */
function isInsightNode(node: unknown): node is KnowledgeInsight {
  return (
    typeof node === "object" &&
    node !== null &&
    "conclusion" in node &&
    "derived" in node &&
    "confidence" in node &&
    typeof (node as { conclusion?: unknown }).conclusion === "string" &&
    Array.isArray((node as { derived?: unknown }).derived) &&
    typeof (node as { confidence?: unknown }).confidence === "number"
  );
}

/**
 * Executes learn_record tool: persists workflow outcome and generates insights.
 *
 * Resource ID pattern: `runtime:${workflowId}` - scoped to specific workflow run.
 * This allows learning outcomes to be associated with their originating workflow.
 *
 * @param args - Input data and user ID
 * @returns Learning record ID and prediction error
 * @throws Error if persistence fails
 */
export async function executeLearnRecord(args: {
  input: LearnRecordInput;
  userId: string;
}): Promise<LearnRecordOutput> {
  const graphPkg = "@alfred/db/repo/graph";
  const graphRepo = await import(graphPkg);

  const resource = `runtime:${args.input.workflowId}`;
  const error = await computePredictionError(args.input);

  const safeExpected = args.input.expected
    ? redactSecrets(args.input.expected)
    : undefined;
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
    throw new Error(
      `learning_record_persist_failed: workflowId=${args.input.workflowId}, userId=${args.userId}`
    );
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
        .filter(
          (node): node is NonNullable<typeof node> =>
            node !== null && typeof node === "object"
        )
        .filter(isInsightNode)
        .filter((node) => node.conclusion.trim().length > 0)
        .map((node) => {
          const insightProps = {
            confidence: node.confidence,
            workflowId: args.input.workflowId,
            outcomeId: outcomeRow.id,
            error,
            source: "learn_record",
          };
          return {
            resource,
            hash: randomUUID(),
            kind: "insight",
            label: truncate(node.conclusion.trim(), 240),
            properties: insightProps,
          };
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

/**
 * Executes learn_pattern tool: stores successful tool sequences as reusable patterns.
 *
 * Resource ID pattern: `"user"` or `${domain}` - scoped to user or domain.
 * Patterns are shared across workflows within the same domain for reuse.
 *
 * @param args - Pattern input and user ID
 * @returns Pattern ID, description, and confidence
 * @throws Error if persistence fails
 */
export async function executeLearnPattern(args: {
  input: LearnPatternInput;
  userId: string;
}): Promise<LearnPatternOutput> {
  const graphPkg = "@alfred/db/repo/graph";
  const graphRepo = await import(graphPkg);

  const resource = "user";
  const heuristicRule = buildHeuristicRule(args.input);
  const rule = heuristicRule;
  const source = "heuristic";

  const safeTools = normalizeToolSequence(args.input.toolSequence).map(
    redactSecrets
  );
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
    throw new Error(
      `learning_pattern_persist_failed: domain=${args.input.domain ?? "user"}, userId=${args.userId}`
    );
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

/**
 * Executes learn_mistake tool: records mistakes and corrections as heuristic rules.
 *
 * Resource ID pattern: `"user"` or `${domain}` - scoped to user or domain.
 * Mistakes are stored as heuristics to avoid similar errors in future workflows.
 *
 * @param args - Mistake input and user ID
 * @returns Mistake ID and recording status
 * @throws Error if persistence fails
 */
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

  const rule = truncate(
    `Avoid: ${safeMistake}. Fix: ${safeCorrection}`,
    RULE_MAX_LEN
  );

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
        confidence:
          args.input.severity === "high"
            ? 0.9
            : args.input.severity === "medium"
              ? 0.75
              : 0.6,
        source: "explicit_mistake",
        recordedAt: new Date().toISOString(),
      },
    },
  ]);

  const row = firstMapValue(nodeMap);
  if (!row) {
    throw new Error(
      `learning_mistake_persist_failed: domain=${args.input.domain ?? "user"}, userId=${args.userId}, severity=${args.input.severity}`
    );
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
