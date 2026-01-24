import * as chrono from "chrono-node";

import type {
  ChronoResult,
  TemporalExpression,
  TemporalPrecision,
} from "./types.js";

import { RECURRENCE_REGEX } from "../lexicon/index.js";
import { clampConfidence } from "./entities.js";

/**
 * Extract temporal expressions (dates, durations, sequences) from text.
 */

const getSentenceBoundary = (
  text: string,
  index: number,
  length: number
): string => {
  let start = index;
  while (start > 0 && !/[.!?]/.test(text[start - 1] ?? "")) {
    start--;
  }
  let end = index + length;
  while (end < text.length && !/[.!?]/.test(text[end] ?? "")) {
    end++;
  }
  return text.slice(start, end + 1).trim();
};

const hasRelativeDateFormatTag = (result: ChronoResult): boolean => {
  try {
    const { tags } = result;
    if (!tags) {
      return false;
    }
    if (tags instanceof Set) {
      return tags.has("RelativeDateFormatParser");
    }
    if (typeof tags === "function") {
      const resolved = tags();
      return resolved instanceof Set
        ? resolved.has("RelativeDateFormatParser")
        : false;
    }
    if (typeof tags === "object") {
      return Boolean(
        (tags as Record<string, unknown>).RelativeDateFormatParser
      );
    }
    return false;
  } catch {
    return false;
  }
};

const temporalPrecision = (
  components?: ChronoResult["start"]
): TemporalPrecision | undefined => {
  if (!components) {
    return;
  }
  if (components.isCertain("hour")) {
    return "time";
  }
  if (components.isCertain("day")) {
    return "day";
  }
  if (components.isCertain("month")) {
    return "month";
  }
  if (components.isCertain("year")) {
    return "year";
  }
  return;
};

const temporalConfidence = (result: ChronoResult): number => {
  let confidence = 0.72;
  if (result.start?.isCertain("day")) {
    confidence += 0.08;
  }
  if (result.start?.isCertain("hour")) {
    confidence += 0.05;
  }
  if (hasRelativeDateFormatTag(result)) {
    confidence -= 0.05;
  }
  if (result.text.match(/^\d{4}$/)) {
    confidence -= 0.05;
  }
  return clampConfidence(confidence);
};

export const extractTemporal = (text: string): TemporalExpression[] => {
  const expressions: TemporalExpression[] = [];
  const seen = new Set<string>();

  const pushExpression = (expr: TemporalExpression) => {
    const key = `${expr.type}:${expr.raw}:${expr.normalized.start ?? ""}:${
      expr.normalized.end ?? ""
    }:${expr.context}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    expressions.push(expr);
  };

  const parsed = chrono.parse(text);
  for (const result of parsed) {
    const start = result.start?.date();
    const end = result.end?.date();
    pushExpression({
      raw: result.text,
      type: result.end ? "range" : "instant",
      normalized: {
        start: start?.toISOString(),
        end: end?.toISOString(),
      },
      context: getSentenceBoundary(text, result.index ?? 0, result.text.length),
      precision: temporalPrecision(result.start),
      confidence: temporalConfidence(result),
    });
  }

  const rangeRegex =
    /\b(?:from|between)\s+([^,.;]+?)\s+(?:to|and)\s+([^,.;]+?)(?=[,.;!?]|$)/gi;
  let rangeMatch: RegExpExecArray | null;
  while ((rangeMatch = rangeRegex.exec(text)) !== null) {
    const raw = rangeMatch[0];
    const start = rangeMatch[1] ? chrono.parseDate(rangeMatch[1]) : null;
    const end = rangeMatch[2] ? chrono.parseDate(rangeMatch[2]) : null;
    if (!(start && end)) {
      continue;
    }
    pushExpression({
      raw,
      type: "range",
      normalized: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      context: getSentenceBoundary(text, rangeMatch.index ?? 0, raw.length),
      precision: "day",
      confidence: clampConfidence(0.74),
    });
  }

  let recurrenceMatch: RegExpExecArray | null;
  while ((recurrenceMatch = RECURRENCE_REGEX.exec(text)) !== null) {
    const raw = recurrenceMatch[0];
    const interval = recurrenceMatch.groups?.interval?.toLowerCase();
    pushExpression({
      raw,
      type: "recurring",
      normalized: {},
      context: getSentenceBoundary(
        text,
        recurrenceMatch.index ?? 0,
        raw.length
      ),
      precision: "time",
      recurrence: interval,
      confidence: clampConfidence(0.6),
    });
  }

  return expressions;
};
