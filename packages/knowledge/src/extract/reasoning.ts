import type { KnowledgeEntry } from "./facts.js";
import type { ExtractionResult } from "./types.js";

import { extract } from "./facts.js";

/**
 * Extract knowledge from Codex reasoning traces.
 * Focuses on decision rationale, alternatives, and causal chains.
 */

export const extractReasoning = (
  text: string,
  context: {
    threadId?: string;
    turnId?: string;
    source?: string;
  }
): ExtractionResult => {
  const result = extract(text, context.source ?? "codex-reasoning");

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  const DECISION_MARKERS = [
    "considering",
    "choosing",
    "selecting",
    "opting for",
    "decided to",
    "will",
  ] as const;

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const marker of DECISION_MARKERS) {
      if (lower.includes(marker)) {
        result.facts.push({
          content: sentence.trim(),
          confidence: 0.85,
          source: "decision-reasoning",
          entities: [],
          relations: [],
        });
        break;
      }
    }
  }

  const ALTERNATIVE_MARKERS = [
    "however",
    "alternatively",
    "instead",
    "but",
    "though",
  ] as const;

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const marker of ALTERNATIVE_MARKERS) {
      if (lower.includes(marker)) {
        result.facts.push({
          content: sentence.trim(),
          confidence: 0.75,
          source: "alternative-reasoning",
          entities: [],
          relations: [],
        });
        break;
      }
    }
  }

  return result;
};

/**
 * Enrich knowledge entries with reasoning context metadata.
 */
export const enrichReasoningContext = (
  entries: KnowledgeEntry[],
  context: {
    threadId?: string;
    turnId?: string;
    sessionId?: string;
    timestamp: number;
  }
): KnowledgeEntry[] =>
  entries.map((entry) => {
    if (entry.data._ === "fact") {
      return {
        ...entry,
        data: {
          ...entry.data,
          source: `${entry.data.source}:${context.threadId ?? "unknown"}`,
        },
      };
    }
    return entry;
  });
