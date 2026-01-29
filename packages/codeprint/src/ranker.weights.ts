import type { RankerWeights } from "./ranker.js";

export const RANKER_WEIGHTS: RankerWeights = {
  bias: 0,
  finalScore: 0.85,
  bm25: 0.15,
  symbolBoost: 0.08,
  boostDelta: 0.12,
  entrypoint: 0.06,
  shallow: 0.03,
  isTypes: 0.04,
  isIndex: 0.04,
};
