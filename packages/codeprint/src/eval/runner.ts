import type {
  EvalCase,
  EvalResult,
  EvalSummary,
  EvalDataset,
} from "./types.js";

import { findRelevantFiles, rebuildIndex } from "../index.js";
import {
  computePrecision,
  computeRecall,
  computeMrr,
  computeNdcg,
} from "./metrics.js";

export interface RunEvalOptions {
  dataset: EvalDataset;
  topK?: number;
  rebuildIndexFirst?: boolean;
  verbose?: boolean;
}

export async function runEval(options: RunEvalOptions): Promise<EvalSummary> {
  const {
    dataset,
    topK = 15,
    rebuildIndexFirst = true,
    verbose = false,
  } = options;
  const { workspace } = dataset;

  if (rebuildIndexFirst) {
    if (verbose) {
      console.log(`Building index for ${workspace}...`);
    }
    const count = await rebuildIndex(workspace);
    if (verbose) {
      console.log(`Indexed ${count} files`);
    }
  }

  const results: EvalResult[] = [];

  for (const evalCase of dataset.cases) {
    const result = await runSingleCase(evalCase, workspace, topK);
    results.push(result);

    if (verbose) {
      console.log(
        `[${evalCase.id}] P=${result.precision.toFixed(2)} R=${result.recall.toFixed(2)} ` +
          `MRR=${result.mrr.toFixed(2)} NDCG=${result.ndcg.toFixed(2)} ` +
          `(${result.method}, ${result.latencyMs.toFixed(0)}ms)`
      );
    }
  }

  const summary = computeSummary(results);

  if (verbose) {
    console.log("\n--- Summary ---");
    console.log(`Cases: ${summary.totalCases}`);
    console.log(`Avg Precision: ${summary.avgPrecision.toFixed(3)}`);
    console.log(`Avg Recall: ${summary.avgRecall.toFixed(3)}`);
    console.log(`Avg MRR: ${summary.avgMrr.toFixed(3)}`);
    console.log(`Avg NDCG: ${summary.avgNdcg.toFixed(3)}`);
    console.log(`Avg Latency: ${summary.avgLatencyMs.toFixed(1)}ms`);
    console.log(
      `Methods: keyword=${summary.methodBreakdown.keyword}, rerank=${summary.methodBreakdown.rerank}`
    );
  }

  return summary;
}

async function runSingleCase(
  evalCase: EvalCase,
  workspace: string,
  topK: number
): Promise<EvalResult> {
  const relevantSet = new Set(evalCase.relevantFiles);
  const irrelevantSet = new Set(evalCase.irrelevantFiles ?? []);

  const start = performance.now();
  const results = await findRelevantFiles(workspace, evalCase.query, topK);
  const latencyMs = performance.now() - start;

  const returnedFiles = results.map((r) => r.path);
  const relevantReturned = returnedFiles.filter((f) => relevantSet.has(f));
  const relevantMissed = evalCase.relevantFiles.filter(
    (f) => !returnedFiles.includes(f)
  );
  const irrelevantReturned = returnedFiles.filter((f) => irrelevantSet.has(f));

  return {
    caseId: evalCase.id,
    irrelevantReturned,
    latencyMs,
    method: results[0]?.method === "rerank" ? "rerank" : "keyword",
    mrr: computeMrr(returnedFiles, relevantSet),
    ndcg: computeNdcg(returnedFiles, relevantSet),
    precision: computePrecision(returnedFiles, relevantSet),
    query: evalCase.query,
    recall: computeRecall(returnedFiles, relevantSet),
    relevantMissed,
    relevantReturned,
    returnedFiles,
  };
}

function computeSummary(results: EvalResult[]): EvalSummary {
  const n = results.length;
  if (n === 0) {
    return {
      avgLatencyMs: 0,
      avgMrr: 0,
      avgNdcg: 0,
      avgPrecision: 0,
      avgRecall: 0,
      methodBreakdown: { keyword: 0, rerank: 0 },
      results: [],
      totalCases: 0,
    };
  }

  const sum = results.reduce(
    (acc, r) => ({
      keyword: acc.keyword + (r.method === "keyword" ? 1 : 0),
      latency: acc.latency + r.latencyMs,
      mrr: acc.mrr + r.mrr,
      ndcg: acc.ndcg + r.ndcg,
      precision: acc.precision + r.precision,
      recall: acc.recall + r.recall,
      rerank: acc.rerank + (r.method === "rerank" ? 1 : 0),
    }),
    {
      keyword: 0,
      latency: 0,
      mrr: 0,
      ndcg: 0,
      precision: 0,
      recall: 0,
      rerank: 0,
    }
  );

  return {
    avgLatencyMs: sum.latency / n,
    avgMrr: sum.mrr / n,
    avgNdcg: sum.ndcg / n,
    avgPrecision: sum.precision / n,
    avgRecall: sum.recall / n,
    methodBreakdown: { keyword: sum.keyword, rerank: sum.rerank },
    results,
    totalCases: n,
  };
}

/**
 * Compare keyword-only vs keyword+rerank
 */
export async function compareKeywordVsRerank(
  dataset: EvalDataset,
  topK = 15
): Promise<{ keywordOnly: EvalSummary; withRerank: EvalSummary }> {
  // Force keyword-only by setting RERANK_OFFLINE
  const originalEnv = process.env.RERANK_OFFLINE;

  process.env.RERANK_OFFLINE = "1";
  const keywordOnly = await runEval({
    dataset,
    rebuildIndexFirst: true,
    topK,
    verbose: false,
  });

  process.env.RERANK_OFFLINE = originalEnv;
  const withRerank = await runEval({
    dataset,
    rebuildIndexFirst: false,
    topK,
    verbose: false,
  });

  return { keywordOnly, withRerank };
}
