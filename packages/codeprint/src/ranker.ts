export interface RankerWeights {
  bias: number;
  finalScore: number;
  bm25: number;
  symbolBoost: number;
  boostDelta: number;
  entrypoint: number;
  shallow: number;
  isTypes: number;
  isIndex: number;
}

import { RANKER_WEIGHTS } from "./ranker.weights.js";

export interface RankerFeatures {
  finalScore: number;
  bm25: number;
  symbolBoost: number;
  boostDelta: number;
  entrypoint: number;
  shallow: number;
  isTypes: number;
  isIndex: number;
}

function clamp01(v: number) {
  if (v <= 0) {
    return 0;
  }
  if (v >= 1) {
    return 1;
  }
  return v;
}

export function getRankerWeights(): RankerWeights {
  const raw = process.env.CODEPRINT_RANKER_WEIGHTS;
  if (!raw) {
    return RANKER_WEIGHTS;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<RankerWeights>;
    return {
      ...RANKER_WEIGHTS,
      ...parsed,
    };
  } catch {
    return RANKER_WEIGHTS;
  }
}

export function scoreRanker(
  features: RankerFeatures,
  w: RankerWeights
): number {
  const score =
    w.bias +
    features.finalScore * w.finalScore +
    features.bm25 * w.bm25 +
    features.symbolBoost * w.symbolBoost +
    features.boostDelta * w.boostDelta +
    features.entrypoint * w.entrypoint +
    features.shallow * w.shallow +
    features.isTypes * w.isTypes +
    features.isIndex * w.isIndex;

  return clamp01(score);
}
