import { logger } from "@alfred/logger";
import { rerank, isRerankAvailable } from "@alfred/rerank";
import { parseSync } from "oxc-parser";

import {
  indexBuildDuration,
  queryDuration,
  queriesTotal,
  parseErrorsTotal,
  rerankFallbacksTotal,
  indexSizeGauge,
  keywordCandidatesHistogram,
  rerankScoreShift,
} from "./metrics.js";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface FileEntry {
  path: string;
  exports: string[];
  imports: string[];
  keywords: string[];
}

export interface RelevantFile {
  path: string;
  score: number;
  method: "keyword" | "rerank";
}

// ─────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────

const indexes = new Map<string, Map<string, FileEntry>>();
const INDEX_FILE = ".codeprint.json";
const CACHE_TTL_MS = 5 * 60 * 1000;
const indexTimestamps = new Map<string, number>();

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

export async function findRelevantFiles(
  workspace: string,
  query: string,
  topK = 15
): Promise<RelevantFile[]> {
  const startTime = performance.now();
  const { index, cacheHit } = await getOrBuildIndexWithMeta(workspace);

  const queryTerms = tokenize(query);
  if (queryTerms.size === 0) {
    logger.debug("codeprint_query_empty", { query, workspace });
    return [];
  }

  const candidates: { path: string; score: number }[] = [];

  for (const [path, entry] of index) {
    const matches = entry.keywords.filter((k) => queryTerms.has(k)).length;
    if (matches > 0) {
      candidates.push({ path, score: matches / queryTerms.size });
    }
  }

  keywordCandidatesHistogram.observe(candidates.length);

  if (candidates.length === 0) {
    const durationMs = performance.now() - startTime;
    logger.debug("codeprint_query_no_matches", {
      durationMs,
      queryTerms: queryTerms.size,
      workspace,
    });
    queriesTotal.inc({ cache_hit: String(cacheHit), method: "keyword" });
    queryDuration.observe(
      { cache_hit: String(cacheHit), method: "keyword" },
      durationMs / 1000
    );
    return [];
  }

  candidates.sort((a, b) => b.score - a.score);

  const toRerank = candidates.slice(0, 50);
  if (!isRerankAvailable() || toRerank.length <= topK) {
    const results = toRerank
      .slice(0, topK)
      .map((c) => ({ ...c, method: "keyword" as const }));

    const durationMs = performance.now() - startTime;
    queriesTotal.inc({ cache_hit: String(cacheHit), method: "keyword" });
    queryDuration.observe(
      { cache_hit: String(cacheHit), method: "keyword" },
      durationMs / 1000
    );

    logger.debug("codeprint_query", {
      cacheHit,
      candidateCount: candidates.length,
      durationMs,
      method: "keyword",
      queryTerms: queryTerms.size,
      resultCount: results.length,
      topScore: results[0]?.score,
      workspace,
    });

    return results;
  }

  const keywordTopScore = toRerank[0]?.score ?? 0;

  let reranked: { id: string; score: number }[];
  try {
    reranked = await rerank({
      documents: toRerank.map((c) => ({
        id: c.path,
        text: buildRerankText(c.path, index.get(c.path)!),
      })),
      instruction: "Rank code files by relevance to the programming task.",
      query,
      topN: topK,
    });
  } catch (error) {
    rerankFallbacksTotal.inc();
    logger.warn("codeprint_rerank_failed", {
      error: error instanceof Error ? error.message : String(error),
      fallback: "keyword",
    });
    reranked = [];
  }

  if (reranked.length === 0) {
    rerankFallbacksTotal.inc();
    const results = toRerank
      .slice(0, topK)
      .map((c) => ({ ...c, method: "keyword" as const }));

    const durationMs = performance.now() - startTime;
    queriesTotal.inc({ cache_hit: String(cacheHit), method: "keyword" });
    queryDuration.observe(
      { cache_hit: String(cacheHit), method: "keyword" },
      durationMs / 1000
    );

    return results;
  }

  const rerankTopScore = reranked[0]?.score ?? 0;
  rerankScoreShift.observe(rerankTopScore - keywordTopScore);

  const results = reranked.map((r) => ({
    method: "rerank" as const,
    path: r.id,
    score: r.score,
  }));

  const durationMs = performance.now() - startTime;
  queriesTotal.inc({ cache_hit: String(cacheHit), method: "rerank" });
  queryDuration.observe(
    { cache_hit: String(cacheHit), method: "rerank" },
    durationMs / 1000
  );

  logger.debug("codeprint_query", {
    cacheHit,
    candidateCount: candidates.length,
    durationMs,
    keywordTopScore,
    method: "rerank",
    queryTerms: queryTerms.size,
    rerankTopScore,
    resultCount: results.length,
    topScore: results[0]?.score,
    workspace,
  });

  return results;
}

export async function rebuildIndex(workspace: string): Promise<number> {
  const startTime = performance.now();
  const { index, parseErrors } = await buildIndexWithStats(workspace);
  indexes.set(workspace, index);
  indexTimestamps.set(workspace, Date.now());

  const durationMs = performance.now() - startTime;
  indexBuildDuration.observe(durationMs / 1000);
  indexSizeGauge.set(index.size);

  logger.info("codeprint_index_build", {
    durationMs,
    fileCount: index.size,
    fromCache: false,
    parseErrors,
    workspace,
  });

  return index.size;
}

export function clearIndex(workspace: string): void {
  indexes.delete(workspace);
  indexTimestamps.delete(workspace);
}

export function getIndexStats(workspace: string): {
  size: number;
  cached: boolean;
  age: number;
} | null {
  const index = indexes.get(workspace);
  const timestamp = indexTimestamps.get(workspace);
  if (!index || !timestamp) {
    return null;
  }
  return {
    age: Date.now() - timestamp,
    cached: true,
    size: index.size,
  };
}

// ─────────────────────────────────────────────────────────
// Internal
// ─────────────────────────────────────────────────────────

async function getOrBuildIndexWithMeta(
  workspace: string
): Promise<{ index: Map<string, FileEntry>; cacheHit: boolean }> {
  const cached = indexes.get(workspace);
  const timestamp = indexTimestamps.get(workspace) ?? 0;

  if (cached && Date.now() - timestamp < CACHE_TTL_MS) {
    return { cacheHit: true, index: cached };
  }

  const diskIndex = await loadIndexFromDisk(workspace);
  if (diskIndex) {
    indexes.set(workspace, diskIndex);
    indexTimestamps.set(workspace, Date.now());
    indexSizeGauge.set(diskIndex.size);
    logger.debug("codeprint_index_loaded", {
      fileCount: diskIndex.size,
      source: "disk",
      workspace,
    });
    return { cacheHit: false, index: diskIndex };
  }

  const startTime = performance.now();
  const { index, parseErrors } = await buildIndexWithStats(workspace);
  indexes.set(workspace, index);
  indexTimestamps.set(workspace, Date.now());

  const durationMs = performance.now() - startTime;
  indexBuildDuration.observe(durationMs / 1000);
  indexSizeGauge.set(index.size);

  logger.info("codeprint_index_build", {
    durationMs,
    fileCount: index.size,
    fromCache: false,
    parseErrors,
    workspace,
  });

  return { cacheHit: false, index };
}

async function buildIndexWithStats(
  workspace: string
): Promise<{ index: Map<string, FileEntry>; parseErrors: number }> {
  const glob = new Bun.Glob("**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}");
  const index = new Map<string, FileEntry>();
  let parseErrors = 0;

  for await (const path of glob.scan({ cwd: workspace, onlyFiles: true })) {
    if (shouldIgnore(path)) {
      continue;
    }

    try {
      const content = await Bun.file(`${workspace}/${path}`).text();
      const entry = parseFileEntry(path, content);
      index.set(path, entry);
    } catch (error) {
      parseErrors++;
      parseErrorsTotal.inc();
      logger.debug("codeprint_parse_error", {
        error: error instanceof Error ? error.message : String(error),
        file: path,
      });
    }
  }

  await saveIndexToDisk(workspace, index);

  return { index, parseErrors };
}

function parseFileEntry(path: string, content: string): FileEntry {
  const result = parseSync(path, content, { sourceType: "module" });

  const exports = result.module.staticExports.flatMap((exp) =>
    exp.entries.map((e) => e.exportName.name ?? e.exportName.kind)
  );

  const imports = result.module.staticImports.map(
    (imp) => imp.moduleRequest.value
  );

  const keywords = extractKeywords(path, exports, imports);

  return { exports, imports, keywords, path };
}

function extractKeywords(
  path: string,
  exports: string[],
  imports: string[]
): string[] {
  const keywords = new Set<string>();

  for (const segment of path.split("/")) {
    for (const word of splitIdentifier(segment.replace(/\.[^.]+$/, ""))) {
      keywords.add(word);
    }
  }

  for (const exp of exports) {
    for (const word of splitIdentifier(exp)) {
      keywords.add(word);
    }
  }

  for (const imp of imports) {
    const name =
      imp
        .split("/")
        .pop()
        ?.replace(/\.[^.]+$/, "") ?? "";
    for (const word of splitIdentifier(name)) {
      keywords.add(word);
    }
  }

  return [...keywords].filter((k) => k.length >= 2);
}

function splitIdentifier(name: string): string[] {
  return name
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 2);
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2)
  );
}

function buildRerankText(path: string, entry: FileEntry): string {
  const parts = [path];
  if (entry.exports.length > 0) {
    parts.push(`Exports: ${entry.exports.slice(0, 10).join(", ")}`);
  }
  if (entry.imports.length > 0) {
    const pkgImports = entry.imports
      .filter((i) => !i.startsWith("."))
      .slice(0, 5);
    if (pkgImports.length > 0) {
      parts.push(`Uses: ${pkgImports.join(", ")}`);
    }
  }
  return parts.join("\n");
}

function shouldIgnore(path: string): boolean {
  const ignorePatterns = [
    "node_modules/",
    "dist/",
    "build/",
    ".git/",
    ".turbo/",
    "coverage/",
    "__snapshots__/",
    ".tsbuild/",
    "vendor/",
  ];
  return ignorePatterns.some((p) => path.includes(p));
}

async function loadIndexFromDisk(
  workspace: string
): Promise<Map<string, FileEntry> | null> {
  try {
    const data = await Bun.file(`${workspace}/${INDEX_FILE}`).json();
    return new Map(data as [string, FileEntry][]);
  } catch {
    return null;
  }
}

async function saveIndexToDisk(
  workspace: string,
  index: Map<string, FileEntry>
): Promise<void> {
  try {
    await Bun.write(
      `${workspace}/${INDEX_FILE}`,
      JSON.stringify([...index.entries()])
    );
  } catch {
    // Ignore write failures
  }
}
