/**
 * Text similarity and Word Error Rate (WER) utilities for voice pipeline tests.
 *
 * These utilities compare original text with transcribed text, accounting for
 * common ASR variations like punctuation differences and capitalization.
 */

/**
 * Normalize text for comparison:
 * - Convert to lowercase
 * - Remove punctuation
 * - Collapse whitespace
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[^\w\s]/g, "") // Remove punctuation
    .replaceAll(/\s+/g, " ") // Collapse whitespace
    .trim();
}

/**
 * Tokenize text into words for WER calculation.
 */
export function tokenize(text: string): string[] {
  return normalizeText(text).split(" ").filter(Boolean);
}

/**
 * Calculate Levenshtein distance between two arrays of tokens.
 * This is used for WER calculation.
 */
export function levenshteinDistance(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;

  // Create distance matrix with explicit initialization
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [];
    for (let j = 0; j <= n; j++) {
      if (i === 0) {
        dp[i][j] = j; // First row: distance from empty string
      } else if (j === 0) {
        dp[i][j] = i; // First column: distance from empty string
      } else {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        const deletion = (dp[i - 1]?.[j] ?? 0) + 1;
        const insertion = (dp[i]?.[j - 1] ?? 0) + 1;
        const substitution = (dp[i - 1]?.[j - 1] ?? 0) + cost;
        dp[i][j] = Math.min(deletion, insertion, substitution);
      }
    }
  }

  return dp[m]?.[n] ?? 0;
}

/**
 * Calculate Word Error Rate (WER) between reference and hypothesis texts.
 *
 * WER = (Substitutions + Insertions + Deletions) / Reference Length
 *
 * Lower is better. 0 = perfect match, 1 = 100% error rate.
 */
export function calculateWer(reference: string, hypothesis: string): number {
  const refWords = tokenize(reference);
  const hypWords = tokenize(hypothesis);

  if (refWords.length === 0) {
    return hypWords.length === 0 ? 0 : 1;
  }

  const distance = levenshteinDistance(refWords, hypWords);
  return distance / refWords.length;
}

/**
 * Calculate similarity score (inverse of WER).
 * Returns a value between 0 and 1, where 1 is a perfect match.
 */
export function calculateSimilarity(
  reference: string,
  hypothesis: string
): number {
  const wer = calculateWer(reference, hypothesis);
  return Math.max(0, 1 - wer);
}

/**
 * Detailed WER analysis with breakdown of error types.
 */
export interface WerAnalysis {
  wer: number;
  similarity: number;
  referenceWords: number;
  hypothesisWords: number;
  editDistance: number;
  normalizedReference: string;
  normalizedHypothesis: string;
}

/**
 * Perform detailed WER analysis.
 */
export function analyzeWer(reference: string, hypothesis: string): WerAnalysis {
  const normalizedRef = normalizeText(reference);
  const normalizedHyp = normalizeText(hypothesis);
  const refWords = tokenize(reference);
  const hypWords = tokenize(hypothesis);
  const editDistance = levenshteinDistance(refWords, hypWords);
  const wer = refWords.length === 0 ? 0 : editDistance / refWords.length;

  return {
    wer,
    similarity: Math.max(0, 1 - wer),
    referenceWords: refWords.length,
    hypothesisWords: hypWords.length,
    editDistance,
    normalizedReference: normalizedRef,
    normalizedHypothesis: normalizedHyp,
  };
}

/**
 * Check if two texts are semantically similar enough for pipeline tests.
 * Uses a configurable similarity threshold.
 */
export function isAcceptableSimilarity(
  reference: string,
  hypothesis: string,
  threshold = 0.8
): boolean {
  return calculateSimilarity(reference, hypothesis) >= threshold;
}

/**
 * Format WER analysis as a human-readable string for test output.
 */
export function formatWerAnalysis(analysis: WerAnalysis): string {
  return [
    `WER: ${(analysis.wer * 100).toFixed(1)}%`,
    `Similarity: ${(analysis.similarity * 100).toFixed(1)}%`,
    `Reference words: ${analysis.referenceWords}`,
    `Hypothesis words: ${analysis.hypothesisWords}`,
    `Edit distance: ${analysis.editDistance}`,
    `Reference: "${analysis.normalizedReference}"`,
    `Hypothesis: "${analysis.normalizedHypothesis}"`,
  ].join("\n");
}

/**
 * Common ASR error patterns for debugging.
 */
export function identifyCommonErrors(
  reference: string,
  hypothesis: string
): string[] {
  const errors: string[] = [];
  const refWords = tokenize(reference);
  const hypWords = tokenize(hypothesis);

  // Check for missing words
  for (const word of refWords) {
    if (!hypWords.includes(word)) {
      errors.push(`Missing word: "${word}"`);
    }
  }

  // Check for extra words
  for (const word of hypWords) {
    if (!refWords.includes(word)) {
      errors.push(`Extra word: "${word}"`);
    }
  }

  // Check for number transcription issues
  const numbers = reference.match(/\d+/g) || [];
  for (const num of numbers) {
    if (!hypothesis.includes(num)) {
      errors.push(`Number not transcribed: "${num}"`);
    }
  }

  return errors;
}
