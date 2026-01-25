#!/usr/bin/env bun
import { shutdownPool } from "../src/pool.js";
import {
  enableProfiling,
  formatIndexBuildProfile,
  formatQueryProfile,
  formatProfileSummary,
  clearProfiles,
} from "../src/profile.js";
import {
  buildIndexProfiled,
  findRelevantFilesProfiled,
} from "../src/profiled.js";

const SAMPLE_QUERIES = [
  "workflow api router tRPC endpoint",
  "rerank cross-encoder embedding model",
  "authentication token JWT signing verification",
  "database migration drizzle schema",
  "pipeline stage orchestrator observer",
  "agent tool codex executor spawn",
  "voice assistant speech recognition transcription",
  "prometheus metrics counter histogram gauge",
  "cognitive state machine transition autonomy",
  "logger structured logging winston pino",
];

const args = process.argv.slice(2);
const iterations = Number.parseInt(
  args.find((a) => a.startsWith("--iterations="))?.split("=")[1] ?? "1",
  10
);
const workspace =
  args.find((a) => !a.startsWith("--")) ??
  process.cwd().replace(/\/packages\/codeprint.*$/, "");

async function main() {
  try {
    enableProfiling();
    clearProfiles();

    console.log("=== Codeprint Profiler ===\n");
    console.log(`Workspace: ${workspace}`);
    console.log(`Iterations: ${iterations}`);
    console.log("");

    // Profile index build
    console.log("--- Index Build ---\n");
    for (let i = 0; i < iterations; i++) {
      // Clear disk cache to force rebuild
      try {
        await Bun.write(`${workspace}/.codeprint.json`, "invalid");
      } catch {}

      const { profile } = await buildIndexProfiled(workspace);
      if (i === 0 || iterations === 1) {
        console.log(formatIndexBuildProfile(profile));
        console.log("");
      }
    }

    // Profile queries
    console.log("--- Query Profiles ---\n");

    // First query (cache miss)
    console.log("Cold query (cache miss):");
    const { profile: coldProfile } = await findRelevantFilesProfiled(
      workspace,
      SAMPLE_QUERIES[0]!,
      15
    );
    console.log(formatQueryProfile(coldProfile));
    console.log("");

    // Warm queries
    console.log("Warm queries (cache hit):");
    for (const query of SAMPLE_QUERIES.slice(1, 5)) {
      const { profile } = await findRelevantFilesProfiled(workspace, query, 15);
      console.log(
        `  "${query.slice(0, 40)}..." - ${profile.totalMs.toFixed(2)}ms`
      );
    }
    console.log("");

    // Run all queries for aggregation
    if (iterations > 1) {
      console.log(
        `Running ${SAMPLE_QUERIES.length} queries x ${iterations} iterations...`
      );
      for (let i = 0; i < iterations; i++) {
        for (const query of SAMPLE_QUERIES) {
          await findRelevantFilesProfiled(workspace, query, 15);
        }
      }
      console.log("");
    }

    // Summary
    console.log(formatProfileSummary());

    // Bottleneck analysis
    console.log("\n--- Bottleneck Analysis ---\n");
    analyzeBottlenecks(coldProfile);
  } finally {
    shutdownPool();
  }
}

function analyzeBottlenecks(profile: import("../src/profile.js").QueryProfile) {
  const stages = [
    { ms: profile.stages.cacheCheck.durationMs, name: "cacheCheck" },
    { ms: profile.stages.tokenize.durationMs, name: "tokenize" },
    { ms: profile.stages.match.durationMs, name: "match" },
    { ms: profile.stages.sort.durationMs, name: "sort" },
    { ms: profile.stages.rerankPrep.durationMs, name: "rerankPrep" },
    { ms: profile.stages.rerank.durationMs, name: "rerank" },
    { ms: profile.stages.format.durationMs, name: "format" },
  ];

  stages.sort((a, b) => b.ms - a.ms);

  console.log("Query stages by time (slowest first):");
  for (const stage of stages) {
    const pct = ((stage.ms / profile.totalMs) * 100).toFixed(1);
    const bar = "█".repeat(Math.round(Number.parseFloat(pct) / 5));
    console.log(
      `  ${stage.name.padEnd(12)} ${stage.ms.toFixed(3).padStart(8)}ms (${pct.padStart(5)}%) ${bar}`
    );
  }

  // Recommendations
  console.log("\nOptimization recommendations:");
  const slowest = stages[0];
  if (slowest && slowest.ms > profile.totalMs * 0.5) {
    console.log(
      `  ⚠️  ${slowest.name} takes ${((slowest.ms / profile.totalMs) * 100).toFixed(0)}% of query time`
    );

    if (slowest.name === "match") {
      console.log(
        "     Consider: Inverted index, bloom filter, or parallel matching"
      );
    } else if (slowest.name === "rerank") {
      console.log(
        "     Consider: Batch size reduction, model quantization, or caching"
      );
    } else if (slowest.name === "cacheCheck") {
      console.log("     Consider: Memory-only cache, or async disk check");
    }
  }

  if (profile.result.candidates > 100) {
    console.log(
      `  ⚠️  High candidate count (${profile.result.candidates}) - consider stricter keyword matching`
    );
  }

  if (!profile.result.cacheHit) {
    console.log("  💡 Cache miss - subsequent queries will be faster");
  }
}

main().catch((error) => {
  console.error("Profile failed:", error);
  process.exit(1);
});
