#!/usr/bin/env bun
import { alfredTasksDataset, runEval } from "../src/eval/index.js";
import { shutdownPool } from "../src/pool.js";
import { RANKER_WEIGHTS } from "../src/ranker.weights.js";

function clamp(v: number, min: number, max: number) {
  if (v < min) {
    return min;
  }
  if (v > max) {
    return max;
  }
  return v;
}

const KEYS = Object.keys(RANKER_WEIGHTS);

function setWeight(
  weights: Record<string, number>,
  key: string,
  value: number
): Record<string, number> {
  return { ...weights, [key]: value };
}

async function main() {
  const passes = process.argv[2] ? Number(process.argv[2]) : 3;
  const step0 = process.argv[3] ? Number(process.argv[3]) : 0.12;

  process.env.CODEPRINT_RANKER = "1";
  process.env.CODEPRINT_LITE_FUSION = "0";

  let bestWeights = { ...RANKER_WEIGHTS } as Record<string, number>;
  process.env.CODEPRINT_RANKER_WEIGHTS = JSON.stringify(bestWeights);

  let best = await runEval({
    dataset: alfredTasksDataset,
    rebuildIndexFirst: true,
    verbose: false,
  });
  let bestScore = best.avgNdcg + best.avgMrr;

  let step = step0;
  for (let pass = 0; pass < passes; pass++) {
    for (const k of KEYS) {
      const cur = bestWeights[k] ?? 0;
      const deltas = [-step, 0, step];

      for (const d of deltas) {
        const nextRaw = cur + d;
        const next =
          k === "bias" ? clamp(nextRaw, -0.5, 0.5) : clamp(nextRaw, -1, 1);

        const candidate = setWeight(bestWeights, k, next);
        process.env.CODEPRINT_RANKER_WEIGHTS = JSON.stringify(candidate);

        const summary = await runEval({
          dataset: alfredTasksDataset,
          rebuildIndexFirst: false,
          verbose: false,
        });

        const score = summary.avgNdcg + summary.avgMrr;
        if (score > bestScore) {
          best = summary;
          bestScore = score;
          bestWeights = candidate;
          console.log(
            `best pass=${pass} key=${k} step=${step.toFixed(3)} score=${bestScore.toFixed(4)} P@15=${summary.avgPrecision.toFixed(3)} R=${summary.avgRecall.toFixed(3)} MRR=${summary.avgMrr.toFixed(3)} NDCG=${summary.avgNdcg.toFixed(3)}`
          );
        }
      }
    }
    step *= 0.5;
  }

  const ordered = Object.fromEntries(
    [...KEYS].sort().map((k) => [k, bestWeights[k] ?? 0])
  );

  console.log("\nSuggested CODEPRINT_RANKER_WEIGHTS:");
  console.log(JSON.stringify(ordered, null, 2));
  console.log("\nSummary:");
  console.log(best);
}

try {
  await main();
} finally {
  shutdownPool();
}
