import { findRelevantFiles } from "@alfred/codeprint";
import { performance } from "node:perf_hooks";

import { gatherCodeContext } from "../packages/agent/src/orchestrator/flow/context";

const QUERIES = [
  "persist workflow hooks",
  "agentfs docker workspace constraints",
  "where is tool policy enforced",
  "how does rag ingestion work",
  "voice session state",
  "jwt auth token signing",
  "logger transport implementation",
  "db migrations schema",
  "tanstack route tree generation",
  "how do we select ai models",
];

function formatMs(ms: number) {
  return `${ms.toFixed(1)}ms`;
}

async function main() {
  const cw = process.argv[2] ? String(process.argv[2]) : process.cwd();
  const topK = process.argv[3] ? Number(process.argv[3]) : 15;

  // Force the legacy orchestrator path to avoid external Codex/Droid calls.
  process.env.ORCH_CONTEXT_NO_LLM = "1";
  process.env.CODEPRINT_ENABLED = "0";

  console.log(`cw=${cw}`);
  console.log(`topK=${topK}`);
  console.log("");

  for (const q of QUERIES) {
    console.log(`query: ${q}`);

    const startScan = performance.now();
    const scan = await gatherCodeContext({
      requirement: q,
      cw,
      topK,
      authz: undefined,
    });
    const scanMs = performance.now() - startScan;
    console.log(
      `  scan   ${formatMs(scanMs)}  ${scan.code
        .map((f) => f.path)
        .slice(0, 5)
        .join(", ")}`
    );

    const startCp = performance.now();
    const cp = await findRelevantFiles(cw, q, topK);
    const cpMs = performance.now() - startCp;
    console.log(
      `  cp     ${formatMs(cpMs)}  ${cp
        .map((f) => f.path)
        .slice(0, 5)
        .join(", ")}`
    );

    console.log("");
  }
}

await main();
