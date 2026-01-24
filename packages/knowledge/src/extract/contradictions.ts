import nlp from "compromise";

import type { BaseView, Contradiction, NumberJson, TextView } from "./types.js";

import { buildAntonymMap } from "../lexicon/index.js";
import { canonicalize, clampConfidence, isStopword } from "./entities.js";
import { asTextView } from "./types.js";

/**
 * Detect contradictions between two text statements.
 * Uses negation detection, antonym matching, and numeric comparison.
 */

const antonymMap = buildAntonymMap();

const tokensFromDoc = (doc: TextView): Set<string> =>
  new Set(
    doc
      .text()
      .toLowerCase()
      .split(/[^a-z0-9%-]+/)
      .filter((token) => token.length > 2 && !isStopword(token))
  );

const nounSet = (doc: TextView): Set<string> =>
  new Set(
    doc
      .nouns()
      .out("array")
      .map((n: string) => canonicalize(n))
      .filter(Boolean)
  );

export const detectContradiction = (
  first: string,
  second: string
): Contradiction | null => {
  const docA = asTextView(nlp(first));
  const docB = asTextView(nlp(second));
  const overlap = [...nounSet(docA)].filter((noun) => nounSet(docB).has(noun));
  const focus = overlap[0];

  const negativeA = docA.has("#Negative");
  const negativeB = docB.has("#Negative");

  if (negativeA !== negativeB) {
    const sentencesA = asTextView(
      docA.clone() as unknown as BaseView
    ).sentences();
    const normalizedA = (sentencesA.toPositive() as unknown as TextView)
      .text()
      .trim();
    const sentencesB = asTextView(
      docB.clone() as unknown as BaseView
    ).sentences();
    const normalizedB = (sentencesB.toPositive() as unknown as TextView)
      .text()
      .trim();
    if (normalizedA && normalizedA === normalizedB) {
      return {
        pair: [first, second],
        reason: "negation",
        focus: focus ?? normalizedA.split(" ")[0],
        confidence: clampConfidence(0.92),
      };
    }
  }

  const tokensA = tokensFromDoc(docA);
  const tokensB = tokensFromDoc(docB);
  for (const token of tokensA) {
    const antonyms = antonymMap.get(token);
    if (!antonyms) {
      continue;
    }
    for (const antonym of antonyms) {
      if (tokensB.has(antonym) && (focus || overlap.length > 0)) {
        return {
          pair: [first, second],
          reason: "antonym",
          focus: focus ?? token,
          confidence: clampConfidence(0.78),
        };
      }
    }
  }

  const numbersA = docA.numbers().json() as NumberJson[];
  const numbersB = docB.numbers().json() as NumberJson[];
  if (
    numbersA.length > 0 &&
    numbersB.length > 0 &&
    (focus || overlap.length > 0)
  ) {
    const firstNum = numbersA[0];
    const secondNum = numbersB[0];
    if (firstNum && secondNum) {
      const valueA = Number(firstNum.number ?? firstNum.text);
      const valueB = Number(secondNum.number ?? secondNum.text);
      if (
        Number.isFinite(valueA) &&
        Number.isFinite(valueB) &&
        valueA !== valueB
      ) {
        return {
          pair: [first, second],
          reason: "numeric",
          focus: focus ?? firstNum.text,
          confidence: clampConfidence(0.74),
        };
      }
    }
  }

  if (negativeA !== negativeB && overlap.length > 0) {
    return {
      pair: [first, second],
      reason: "negation",
      focus,
      confidence: clampConfidence(0.8),
    };
  }

  return null;
};
