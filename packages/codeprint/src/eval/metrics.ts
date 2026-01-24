/**
 * Compute precision@K: relevant_returned / total_returned
 */
export function computePrecision(
  returned: string[],
  relevant: Set<string>
): number {
  if (returned.length === 0) {
    return 0;
  }
  const relevantReturned = returned.filter((f) => relevant.has(f));
  return relevantReturned.length / returned.length;
}

/**
 * Compute recall: relevant_returned / total_relevant
 */
export function computeRecall(
  returned: string[],
  relevant: Set<string>
): number {
  if (relevant.size === 0) {
    return 1;
  }
  const relevantReturned = returned.filter((f) => relevant.has(f));
  return relevantReturned.length / relevant.size;
}

/**
 * Compute Mean Reciprocal Rank: 1 / position_of_first_relevant
 */
export function computeMrr(returned: string[], relevant: Set<string>): number {
  for (let i = 0; i < returned.length; i++) {
    if (relevant.has(returned[i]!)) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

/**
 * Compute Normalized Discounted Cumulative Gain
 */
export function computeNdcg(returned: string[], relevant: Set<string>): number {
  if (relevant.size === 0) {
    return 1;
  }

  const dcg = returned.reduce((sum, file, i) => {
    const gain = relevant.has(file) ? 1 : 0;
    return sum + gain / Math.log2(i + 2);
  }, 0);

  const idealOrder = [...returned].toSorted((a, b) => {
    const aRel = relevant.has(a) ? 1 : 0;
    const bRel = relevant.has(b) ? 1 : 0;
    return bRel - aRel;
  });

  const idcg = idealOrder.reduce((sum, file, i) => {
    const gain = relevant.has(file) ? 1 : 0;
    return sum + gain / Math.log2(i + 2);
  }, 0);

  return idcg === 0 ? 0 : dcg / idcg;
}
