/**
 * Semantic Entropy Utilities
 * Used to detect repetitive thought loops and stuck states.
 */

/**
 * Calculate Levenshtein distance between two strings
 * Time complexity: O(n*m)
 * Space complexity: O(m)
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let prev = matrix[0];
    matrix[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const temp = matrix[j] ?? 0;
      if (a[i - 1] === b[j - 1]) {
        matrix[j] = prev;
      } else {
        matrix[j] = 1 + Math.min(matrix[j - 1] ?? 0, matrix[j] ?? 0, prev);
      }
      prev = temp;
    }
  }

  return matrix[b.length] ?? 0;
}

/**
 * Calculate similarity ratio between two strings (0.0 to 1.0)
 * 1.0 = identical
 * 0.0 = completely different
 */
export function calculateSimilarity(a: string, b: string): number {
  if (!(a && b)) return 0.0;
  if (a.length === 0 && b.length === 0) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);

  return 1.0 - distance / maxLength;
}

/**
 * Calculate Jaccard Similarity based on token sets
 * Good for detecting "same thought, slightly different phrasing"
 */
export function jaccardSimilarity(a: string, b: string): number {
  if (!(a && b)) return 0.0;

  const tokenize = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 2)
    );

  const setA = tokenize(a);
  const setB = tokenize(b);

  if (setA.size === 0 && setB.size === 0) return 1.0;

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

/**
 * Check if a sequence of thoughts indicates a loop
 * @param window Array of recent thoughts (strings)
 * @param threshold Similarity threshold (default 0.8)
 * @returns boolean True if loop detected
 */
export function detectLoop(window: string[], threshold = 0.8): boolean {
  if (window.length < 2) return false;

  const current = window[window.length - 1];

  // Check against previous N thoughts
  // If we find high similarity with ANY recent thought, it might be a loop.
  // But for a "Stuck Loop", we usually mean repeating the SAME thing.
  // Let's check the immediate predecessor, and maybe the one before.

  // Strategy: Immediate repetition is bad. A-B-A repetition is also bad.

  // 1. Check immediate predecessor
  const prev = window[window.length - 2];
  if (calculateSimilarity(current, prev) > threshold) {
    return true;
  }

  // 2. Check A-B-A pattern (ping-pong)
  if (window.length >= 3) {
    const prevPrev = window[window.length - 3];
    if (calculateSimilarity(current, prevPrev) > threshold) {
      return true;
    }
  }

  return false;
}
