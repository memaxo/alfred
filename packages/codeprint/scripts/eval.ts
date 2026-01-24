#!/usr/bin/env bun
import {
  runEval,
  compareKeywordVsRerank,
  alfredTasksDataset,
} from "../src/eval/index.js";

const args = new Set(process.argv.slice(2));
const verbose = args.has("--verbose") || args.has("-v");
const compare = args.has("--compare") || args.has("-c");

async function main() {
  console.log("=== Codeprint Evaluation ===\n");
  console.log(`Dataset: ${alfredTasksDataset.name}`);
  console.log(`Cases: ${alfredTasksDataset.cases.length}`);
  console.log(`Workspace: ${alfredTasksDataset.workspace}\n`);

  if (compare) {
    console.log("Running keyword-only vs keyword+rerank comparison...\n");
    const { keywordOnly, withRerank } =
      await compareKeywordVsRerank(alfredTasksDataset);

    console.log("--- Keyword Only ---");
    printSummary(keywordOnly);

    console.log("\n--- With Rerank ---");
    printSummary(withRerank);

    console.log("\n--- Improvement ---");
    console.log(
      `Precision: ${((withRerank.avgPrecision - keywordOnly.avgPrecision) * 100).toFixed(1)}%`
    );
    console.log(
      `Recall: ${((withRerank.avgRecall - keywordOnly.avgRecall) * 100).toFixed(1)}%`
    );
    console.log(
      `MRR: ${((withRerank.avgMrr - keywordOnly.avgMrr) * 100).toFixed(1)}%`
    );
    console.log(
      `NDCG: ${((withRerank.avgNdcg - keywordOnly.avgNdcg) * 100).toFixed(1)}%`
    );
  } else {
    const summary = await runEval({
      dataset: alfredTasksDataset,
      rebuildIndexFirst: true,
      verbose,
    });

    if (!verbose) {
      printSummary(summary);
    }

    if (summary.avgPrecision < 0.3) {
      console.log(
        "\n⚠️  Low precision - consider improving keyword extraction"
      );
    }
    if (summary.avgRecall < 0.5) {
      console.log("\n⚠️  Low recall - consider expanding search scope");
    }
  }
}

function printSummary(summary: {
  avgPrecision: number;
  avgRecall: number;
  avgMrr: number;
  avgNdcg: number;
  avgLatencyMs: number;
  methodBreakdown: { keyword: number; rerank: number };
}) {
  console.log(`Precision@15: ${summary.avgPrecision.toFixed(3)}`);
  console.log(`Recall: ${summary.avgRecall.toFixed(3)}`);
  console.log(`MRR: ${summary.avgMrr.toFixed(3)}`);
  console.log(`NDCG: ${summary.avgNdcg.toFixed(3)}`);
  console.log(`Latency: ${summary.avgLatencyMs.toFixed(1)}ms`);
  console.log(
    `Methods: keyword=${summary.methodBreakdown.keyword}, rerank=${summary.methodBreakdown.rerank}`
  );
}

main().catch((error) => {
  console.error("Eval failed:", error);
  process.exit(1);
});
