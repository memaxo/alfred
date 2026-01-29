import { logger } from "@alfred/logger";
import { rerank, isRerankAvailable } from "@alfred/rerank";
import { parseSync } from "oxc-parser";

import type {
  EnrichedEntry,
  PersistedIndex,
  RelevantFile,
  SymbolKind,
} from "./types.js";

import { BM25Index } from "./bm25.js";
import { discoverFiles, type DiscoveryMethod } from "./discover.js";
import { cosineSimilarity, embedText } from "./liteembed.js";
import {
  indexBuildDuration,
  queryDuration,
  queriesTotal,
  parseErrorsTotal,
  rerankFallbacksTotal,
  indexSizeGauge,
  keywordCandidatesHistogram,
  rerankScoreShift,
  bm25VocabularyGauge,
} from "./metrics.js";
import { getPool, isPoolAvailable, shutdownPool } from "./pool.js";
import { getRankerWeights, scoreRanker } from "./ranker.js";
import { buildSearchTokens } from "./searchtext.js";

// ─────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────

const indexes = new Map<string, Map<string, EnrichedEntry>>();
const bm25Indexes = new Map<string, BM25Index>();
const dirIndexes = new Map<string, Map<string, string[]>>();
const packageIndexes = new Map<string, Map<string, string[]>>();
const INDEX_FILE = ".codeprint.json";
const CACHE_TTL_MS = 5 * 60 * 1000;
const indexTimestamps = new Map<string, number>();

const QUERY_ALIASES: Record<string, readonly string[]> = {
  application: ["app"],
  authentication: ["auth"],
  authorization: ["auth", "authz"],
  config: ["configuration"],
  configuration: ["config"],
  database: ["db"],
  dependencies: ["dep", "deps"],
  dependency: ["dep", "deps"],
  environment: ["env"],
  embedding: ["embed"],
  embeddings: ["embed"],
  javascript: ["js"],
  jwt: ["auth", "jwks"],
  package: ["pkg"],
  packages: ["pkg"],
  planner: ["plan"],
  planning: ["plan"],
  repository: ["repo"],
  tanstack: ["tree"],
  typescript: ["ts"],
};

const DIR_STOPWORDS = new Set([
  "apps",
  "dist",
  "lib",
  "packages",
  "src",
  "test",
  "tests",
]);

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        t = setTimeout(() => reject(new Error("codeprint_timeout")), ms);
        (t as unknown as { unref?: () => void }).unref?.();
      }),
    ]);
  } finally {
    if (t) {
      clearTimeout(t);
    }
  }
}

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

export async function findRelevantFiles(
  workspace: string,
  query: string,
  topK = 15
): Promise<RelevantFile[]> {
  const startTime = performance.now();
  const { index, bm25, cacheHit } = await getOrBuildIndexWithMeta(workspace);

  const dirIndex = getOrBuildDirIndex(workspace, index);
  const pkgIndex = getOrBuildPackageIndex(workspace, index);

  if (topK <= 0) {
    return [];
  }

  const queryTerms = tokenize(query);
  if (queryTerms.size === 0) {
    logger.debug("codeprint_query_empty", { query, workspace });
    return [];
  }

  const expandedTerms = expandQueryTerms(queryTerms, bm25);

  const bm25Results = bm25.search(buildBm25Query(queryTerms, bm25), 200);
  if (bm25Results.length === 0) {
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

  const maxBm25Score = bm25Results[0]?.score ?? 0;

  let candidates = bm25Results.map((r) => {
    const entry = index.get(r.path);
    const base = normalizeBm25(r.score, maxBm25Score);
    const boost = entry ? computeSymbolBoost(entry, expandedTerms) : 0;
    const score = clamp01(base + boost * SYMBOL_BOOST_WEIGHT);
    return { path: r.path, score };
  });

  candidates.sort((a, b) => b.score - a.score);

  applyPackageBoost(candidates, pkgIndex, expandedTerms);
  candidates.sort((a, b) => b.score - a.score);

  applyDirectoryBoost(candidates, dirIndex, expandedTerms);
  candidates.sort((a, b) => b.score - a.score);
  keywordCandidatesHistogram.observe(candidates.length);

  if (process.env.CODEPRINT_RANKER === "1") {
    const w = getRankerWeights();
    const bm25ByPath = new Map<string, number>();
    for (const r of bm25Results) {
      bm25ByPath.set(r.path, normalizeBm25(r.score, maxBm25Score));
    }

    const scored = candidates.map((c) => {
      const bm25 = bm25ByPath.get(c.path) ?? 0;
      const entry = index.get(c.path);
      const symbolBoost = entry ? computeSymbolBoost(entry, expandedTerms) : 0;
      const base = clamp01(bm25 + symbolBoost * SYMBOL_BOOST_WEIGHT);
      const boostDelta = Math.max(0, c.score - base);

      const pri = siblingPriority(c.path);
      const entrypoint = 1 - Math.min(1, pri / 10);
      const depth = c.path.split("/").length;
      const shallow = 1 - Math.min(1, (depth - 1) / 8);
      const name = basename(c.path);

      const rankerScore = scoreRanker(
        {
          finalScore: c.score,
          bm25,
          symbolBoost,
          boostDelta,
          entrypoint,
          shallow,
          isTypes: name === "types" ? 1 : 0,
          isIndex: name === "index" ? 1 : 0,
        },
        w
      );

      return { ...c, rankerScore };
    });

    scored.sort(
      (a, b) =>
        b.rankerScore - a.rankerScore ||
        b.score - a.score ||
        a.path.localeCompare(b.path)
    );

    candidates = scored.map((c) => ({ path: c.path, score: c.score }));
  }

  const liteFusionRaw = (process.env.CODEPRINT_LITE_FUSION ?? "").trim();
  const liteFusionEnabled = liteFusionRaw.length > 0 && liteFusionRaw !== "0";
  const liteFusionMode =
    liteFusionRaw === "1"
      ? (isRerankAvailable()
        ? "rerank"
        : "hash")
      : liteFusionRaw;

  if (liteFusionEnabled && candidates.length > 0) {
    const fuseN = Math.min(50, candidates.length);
    const top = candidates.slice(0, fuseN);

    if (liteFusionMode === "rerank" && isRerankAvailable()) {
      const docs = top.map((c) => {
        const entry = index.get(c.path);
        return {
          id: c.path,
          text: entry ? buildRerankText(c.path, entry) : c.path,
        };
      });

      let reranked: { id: string; score: number }[] = [];
      try {
        reranked = await withTimeout(
          rerank({
            documents: docs,
            instruction:
              "Rank code files by relevance to the programming task.",
            query,
            topN: fuseN,
          }),
          250
        );
      } catch {
        reranked = [];
      }

      if (reranked.length > 0) {
        const max = reranked[0]?.score ?? 0;
        const byId = new Map(reranked.map((r) => [r.id, r.score] as const));
        const fused = top.map((c) => {
          const s = byId.get(c.path) ?? 0;
          const norm = max > 0 ? s / max : 0;
          const fusedScore = clamp01(c.score + norm * 0.08);
          return { ...c, fusedScore };
        });

        fused.sort(
          (a, b) =>
            b.fusedScore - a.fusedScore ||
            b.score - a.score ||
            a.path.localeCompare(b.path)
        );

        candidates = [
          ...fused.map((c) => ({ path: c.path, score: c.fusedScore })),
          ...candidates.slice(fuseN),
        ];
      }
    } else if (liteFusionMode === "hash") {
      const qv = embedText(query, 128);
      const fused = top.map((c) => {
        const entry = index.get(c.path);
        if (!entry) {
          return { ...c, fusedScore: c.score };
        }
        const dv = embedText(buildRerankText(c.path, entry), 128);
        const sim = cosineSimilarity(qv, dv);
        const fusedScore = clamp01(c.score + sim * 0.05);
        return { ...c, fusedScore };
      });

      fused.sort(
        (a, b) =>
          b.fusedScore - a.fusedScore ||
          b.score - a.score ||
          a.path.localeCompare(b.path)
      );

      candidates = [
        ...fused.map((c) => ({ path: c.path, score: c.fusedScore })),
        ...candidates.slice(fuseN),
      ];
    }
  }

  const toRerank = candidates.slice(0, 50);
  if (!isRerankAvailable() || toRerank.length <= topK || liteFusionEnabled) {
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

export interface FindBySymbolOptions {
  kind?: SymbolKind | readonly SymbolKind[];
  exportedOnly?: boolean;
  topK?: number;
}

export async function findBySymbol(
  workspace: string,
  query: string,
  options: FindBySymbolOptions = {}
): Promise<RelevantFile[]> {
  const { kind, exportedOnly = true, topK = 15 } = options;
  const { index } = await getOrBuildIndexWithMeta(workspace);

  const queryTerms = tokenize(query);
  if (queryTerms.size === 0) {
    return [];
  }

  const kinds = kind ? (Array.isArray(kind) ? kind : [kind]) : null;
  const candidates: { path: string; score: number }[] = [];

  for (const [path, entry] of index) {
    let score = 0;

    for (const symbol of entry.symbols) {
      // Filter by export status
      if (exportedOnly && !symbol.exported) {
        continue;
      }

      // Filter by kind
      if (kinds && !kinds.includes(symbol.kind)) {
        continue;
      }

      // Score by name match
      const symbolTerms = splitIdentifier(symbol.name);
      const matches = symbolTerms.filter((t) => queryTerms.has(t)).length;
      if (matches > 0) {
        const matchScore =
          matches / Math.max(symbolTerms.length, queryTerms.size);
        // Bonus for functions and classes
        const kindBonus =
          symbol.kind === "function" || symbol.kind === "class" ? 0.1 : 0;
        score = Math.max(score, matchScore + kindBonus);
      }
    }

    if (score > 0) {
      candidates.push({ path, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  return candidates.slice(0, topK).map((c) => ({
    ...c,
    method: "symbol" as const,
  }));
}

export async function findByDependency(
  workspace: string,
  packageName: string,
  topK = 15
): Promise<RelevantFile[]> {
  const { index } = await getOrBuildIndexWithMeta(workspace);
  const results: RelevantFile[] = [];

  for (const [path, entry] of index) {
    const hasDep = entry.dependencies.some(
      (dep) => dep === packageName || dep.startsWith(`${packageName}/`)
    );
    if (hasDep) {
      results.push({ path, score: 1, method: "dependency" as const });
    }
  }

  return results.slice(0, topK);
}

export async function rebuildIndex(workspace: string): Promise<number> {
  const startTime = performance.now();
  const { index, bm25, parseErrors, discoveryMethod } =
    await buildIndexWithStats(workspace);
  indexes.set(workspace, index);
  bm25Indexes.set(workspace, bm25);
  indexTimestamps.set(workspace, Date.now());

  const durationMs = performance.now() - startTime;
  indexBuildDuration.observe(durationMs / 1000);
  indexSizeGauge.set(index.size);

  logger.info("codeprint_index_build", {
    discoveryMethod,
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
  bm25Indexes.delete(workspace);
  dirIndexes.delete(workspace);
  packageIndexes.delete(workspace);
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

export { shutdownPool };

// ─────────────────────────────────────────────────────────
// Internal
// ─────────────────────────────────────────────────────────

async function getOrBuildIndexWithMeta(workspace: string): Promise<{
  index: Map<string, EnrichedEntry>;
  bm25: BM25Index;
  cacheHit: boolean;
}> {
  const cached = indexes.get(workspace);
  const cachedBm25 = bm25Indexes.get(workspace);
  const timestamp = indexTimestamps.get(workspace) ?? 0;

  if (cached && Date.now() - timestamp < CACHE_TTL_MS) {
    if (cachedBm25) {
      return { bm25: cachedBm25, cacheHit: true, index: cached };
    }
    const bm25 = buildBm25Index(cached);
    bm25Indexes.set(workspace, bm25);
    return { bm25, cacheHit: true, index: cached };
  }

  const diskIndex = await loadIndexFromDisk(workspace);
  if (diskIndex) {
    const bm25 = buildBm25Index(diskIndex);
    indexes.set(workspace, diskIndex);
    bm25Indexes.set(workspace, bm25);
    dirIndexes.delete(workspace);
    packageIndexes.delete(workspace);
    indexTimestamps.set(workspace, Date.now());
    indexSizeGauge.set(diskIndex.size);
    logger.debug("codeprint_index_loaded", {
      fileCount: diskIndex.size,
      source: "disk",
      workspace,
    });
    return { bm25, cacheHit: false, index: diskIndex };
  }

  const startTime = performance.now();
  const { index, bm25, parseErrors, discoveryMethod } =
    await buildIndexWithStats(workspace);
  indexes.set(workspace, index);
  bm25Indexes.set(workspace, bm25);
  dirIndexes.delete(workspace);
  packageIndexes.delete(workspace);
  indexTimestamps.set(workspace, Date.now());

  const durationMs = performance.now() - startTime;
  indexBuildDuration.observe(durationMs / 1000);
  indexSizeGauge.set(index.size);

  logger.info("codeprint_index_build", {
    discoveryMethod,
    durationMs,
    fileCount: index.size,
    fromCache: false,
    parseErrors,
    workspace,
  });

  return { bm25, cacheHit: false, index };
}

async function buildIndexWithStats(workspace: string): Promise<{
  index: Map<string, EnrichedEntry>;
  bm25: BM25Index;
  parseErrors: number;
  discoveryMethod: DiscoveryMethod;
}> {
  const discovery = await discoverFiles(workspace);

  // Use parallel parsing if available
  if (isPoolAvailable()) {
    const pool = getPool();
    const { entries, errors } = await pool.parseMany(
      workspace,
      discovery.files
    );

    const bm25 = buildBm25Index(entries);

    await saveIndexToDisk(workspace, entries);

    return {
      bm25,
      index: entries,
      parseErrors: errors,
      discoveryMethod: discovery.method,
    };
  }

  // Fallback to sequential parsing
  const index = new Map<string, EnrichedEntry>();
  let parseErrors = 0;

  for (const path of discovery.files) {
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

  const bm25 = buildBm25Index(index);

  await saveIndexToDisk(workspace, index);

  return { bm25, index, parseErrors, discoveryMethod: discovery.method };
}

function parseFileEntry(path: string, content: string): EnrichedEntry {
  const result = parseSync(path, content, { sourceType: "module" });

  const exports = result.module.staticExports.flatMap((exp) =>
    exp.entries.map((e) => e.exportName.name ?? e.exportName.kind)
  );

  const imports = result.module.staticImports.map(
    (imp) => imp.moduleRequest.value
  );

  const keywords = extractKeywords(path, exports, imports);
  const dependencies = imports.filter(
    (i) => !i.startsWith(".") && !i.startsWith("/")
  );

  // Sequential mode: no semantic extraction for backward compat
  return {
    path,
    exports,
    imports,
    keywords,
    symbols: [],
    references: [],
    dependencies,
  };
}

// ─────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────

const SYMBOL_BOOST_WEIGHT = 0.25;

function computeSymbolBoost(
  entry: EnrichedEntry,
  queryTerms: Set<string>
): number {
  let best = 0;

  for (const symbol of entry.symbols) {
    if (!symbol.exported) {
      continue;
    }

    const symbolTerms = splitIdentifier(symbol.name);
    if (symbolTerms.length === 0) {
      continue;
    }

    let matches = 0;
    for (const t of symbolTerms) {
      if (queryTerms.has(t)) {
        matches++;
      }
    }
    if (matches === 0) {
      continue;
    }

    let score = matches / symbolTerms.length;
    if (symbol.kind === "function" || symbol.kind === "class") {
      score += 0.1;
    }
    best = Math.max(best, score);
  }

  return Math.min(1, best);
}

function normalizeBm25(score: number, maxScore: number): number {
  if (score <= 0 || maxScore <= 0) {
    return 0;
  }
  return score / maxScore;
}

function clamp01(n: number): number {
  if (n <= 0) {
    return 0;
  }
  if (n >= 1) {
    return 1;
  }
  return n;
}

// ─────────────────────────────────────────────────────────
// Text Processing
// ─────────────────────────────────────────────────────────

function extractKeywords(
  path: string,
  exports: readonly string[],
  imports: readonly string[]
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
  const out = new Set<string>();

  // Raw tokens (preserve unsplit identifiers like AuthProvider)
  for (const raw of text.split(/[^A-Za-z0-9]+/)) {
    const term = raw.toLowerCase();
    if (term.length >= 2) {
      out.add(term);
    }
  }

  // Split tokens (camelCase, snake_case, kebab-case)
  for (const term of splitIdentifier(text)) {
    out.add(term);
  }

  return out;
}

function expandQueryTerms(
  queryTerms: Set<string>,
  bm25: BM25Index
): Set<string> {
  const expanded = new Set<string>(queryTerms);

  for (const term of queryTerms) {
    const alts = QUERY_ALIASES[term];
    if (alts) {
      for (const alt of alts) {
        if (alt !== term && bm25.hasTerm(alt)) {
          expanded.add(alt);
        }
      }
    }

    if (term.length >= 8) {
      const prefix = term.slice(0, 4);
      if (prefix !== term && bm25.hasTerm(prefix)) {
        expanded.add(prefix);
      }
    }
  }

  return expanded;
}

function buildBm25Query(queryTerms: Set<string>, bm25: BM25Index): string {
  const expanded: string[] = [];

  for (const term of queryTerms) {
    expanded.push(term);

    const alts = QUERY_ALIASES[term];
    if (alts) {
      for (const alt of alts) {
        if (alt !== term && bm25.hasTerm(alt)) {
          expanded.push(alt);
        }
      }
    }

    if (term.length >= 8) {
      const prefix = term.slice(0, 4);
      if (prefix !== term && bm25.hasTerm(prefix)) {
        expanded.push(prefix);
      }
    }
  }

  return expanded.join(" ");
}

function getOrBuildDirIndex(
  workspace: string,
  index: Map<string, EnrichedEntry>
): Map<string, string[]> {
  const cached = dirIndexes.get(workspace);
  if (cached) {
    return cached;
  }

  const dirs = new Map<string, string[]>();
  for (const path of index.keys()) {
    const dir = dirname(path);
    let group = dirs.get(dir);
    if (!group) {
      group = [];
      dirs.set(dir, group);
    }
    group.push(path);
  }

  for (const group of dirs.values()) {
    group.sort();
  }

  dirIndexes.set(workspace, dirs);
  return dirs;
}

function getOrBuildPackageIndex(
  workspace: string,
  index: Map<string, EnrichedEntry>
): Map<string, string[]> {
  const cached = packageIndexes.get(workspace);
  if (cached) {
    return cached;
  }

  const pkgs = new Map<string, string[]>();
  for (const path of index.keys()) {
    const root = packageRoot(path);
    if (root.length === 0) {
      continue;
    }
    let group = pkgs.get(root);
    if (!group) {
      group = [];
      pkgs.set(root, group);
    }
    group.push(path);
  }

  for (const group of pkgs.values()) {
    group.sort();
  }

  packageIndexes.set(workspace, pkgs);
  return pkgs;
}

function applyPackageBoost(
  candidates: { path: string; score: number }[],
  pkgIndex: Map<string, string[]>,
  queryTerms: Set<string>
): void {
  if (candidates.length === 0) {
    return;
  }

  const scoreByPath = new Map<string, number>();
  for (const c of candidates) {
    scoreByPath.set(c.path, c.score);
  }

  const pkgScores = new Map<string, number>();
  const expandFrom = Math.min(candidates.length, 20);
  for (let i = 0; i < expandFrom; i++) {
    const c = candidates[i];
    if (!c) {
      continue;
    }
    const root = packageRoot(c.path);
    if (root.length === 0) {
      continue;
    }
    const name = packageName(root);
    if (!queryTerms.has(name)) {
      continue;
    }
    const prev = pkgScores.get(root) ?? 0;
    if (c.score > prev) {
      pkgScores.set(root, c.score);
    }
  }

  for (const [root, parentScore] of pkgScores) {
    const paths = pkgIndex.get(root);
    if (!paths || paths.length === 0) {
      continue;
    }

    // Avoid biasing huge packages (api, type, etc)
    if (paths.length > 120) {
      continue;
    }

    const bonusBase = 0.07 + parentScore * 0.12;
    if (bonusBase <= 0) {
      continue;
    }

    const sorted = paths
      .filter(
        (p) => p.endsWith(".ts") || p.endsWith(".tsx") || p.endsWith(".d.ts")
      )
      .toSorted(
        (a, b) =>
          siblingPriority(a) - siblingPriority(b) ||
          relativeDepth(a, root) - relativeDepth(b, root) ||
          a.localeCompare(b)
      );

    let boosted = 0;
    for (const path of sorted) {
      if (boosted >= 6) {
        break;
      }

      const name = basename(path);
      let bonus = bonusBase;
      if (name === "index") {
        bonus *= path === `${root}/src/index.ts` ? 4 : 2;
      } else if (name === "types") {
        bonus *= 1.6;
      } else if (name === "shared") {
        bonus *= 1.5;
      } else if (name === "token") {
        bonus *= 1.5;
      } else if (name === "env") {
        bonus *= 1.4;
      } else if (name === "transport") {
        bonus *= 1.3;
      } else if (name === "exec") {
        bonus *= 1.3;
      } else if (name === "process") {
        bonus *= 1.3;
      } else if (name === "user" || name === "workflow") {
        bonus *= 1.3;
      } else if (name === "client" || name === "server") {
        bonus *= 1.2;
      }

      const cur = scoreByPath.get(path) ?? 0;
      const next = clamp01(cur + bonus);
      if (next !== cur) {
        scoreByPath.set(path, next);
        boosted++;
      }
    }
  }

  candidates.length = 0;
  for (const [path, score] of scoreByPath) {
    candidates.push({ path, score });
  }
}

function applyDirectoryBoost(
  candidates: { path: string; score: number }[],
  dirIndex: Map<string, string[]>,
  queryTerms: Set<string>
): void {
  if (candidates.length === 0) {
    return;
  }

  const scoreByPath = new Map<string, number>();
  for (const c of candidates) {
    scoreByPath.set(c.path, c.score);
  }

  const dirScores = new Map<string, number>();
  const dirPrimary = new Map<string, string>();
  const expandFrom = Math.min(candidates.length, 20);
  for (let i = 0; i < expandFrom; i++) {
    const c = candidates[i];
    if (!c) {
      continue;
    }
    const dir = dirname(c.path);
    if (dir.length === 0) {
      continue;
    }
    if (!dirMatchesQuery(dir, queryTerms)) {
      continue;
    }

    const prev = dirScores.get(dir) ?? 0;
    if (c.score > prev) {
      dirScores.set(dir, c.score);
      dirPrimary.set(dir, c.path);
    }
  }

  for (const [dir, parentScore] of dirScores) {
    const siblings = dirIndex.get(dir);
    if (!siblings || siblings.length === 0) {
      continue;
    }

    let maxSiblings = 4;
    if (siblings.length > 12) {
      const leaf = basename(dir);
      if (DIR_STOPWORDS.has(leaf) || !queryTerms.has(leaf)) {
        continue;
      }
      maxSiblings = 2;
    }

    const primary = dirPrimary.get(dir);

    const bonusBase = 0.03 + parentScore * 0.07;
    if (bonusBase <= 0) {
      continue;
    }

    const sorted = siblings
      .filter(
        (p) => p.endsWith(".ts") || p.endsWith(".tsx") || p.endsWith(".d.ts")
      )
      .toSorted(
        (a, b) => siblingPriority(a) - siblingPriority(b) || a.localeCompare(b)
      );

    let added = 0;
    for (const path of sorted) {
      if (added >= maxSiblings) {
        break;
      }

      if (primary && path === primary) {
        continue;
      }

      const name = basename(path);
      let bonus = bonusBase;
      if (name === "index") {
        bonus *= 2.5;
      } else if (name === "types") {
        bonus *= 1.6;
      } else if (name === "shared") {
        bonus *= 1.5;
      } else if (name === "env") {
        bonus *= 1.4;
      } else if (name === "transport") {
        bonus *= 1.3;
      } else if (name === "exec") {
        bonus *= 1.3;
      } else if (name === "user" || name === "workflow") {
        bonus *= 1.3;
      } else if (name === "client" || name === "server") {
        bonus *= 1.2;
      }

      const cur = scoreByPath.get(path) ?? 0;
      const next = clamp01(cur + bonus);
      if (next !== cur) {
        scoreByPath.set(path, next);
        added++;
      }
    }

    const parentDir = dirname(dir);
    const leaf = basename(dir);
    if (parentDir.length > 0 && leaf.length > 0 && !DIR_STOPWORDS.has(leaf)) {
      const parentSiblings = dirIndex.get(parentDir);
      if (parentSiblings) {
        const entryCandidates = [
          `${parentDir}/${leaf}.ts`,
          `${parentDir}/${leaf}.tsx`,
        ];
        for (const entryPath of entryCandidates) {
          if (!parentSiblings.includes(entryPath)) {
            continue;
          }

          const cur = scoreByPath.get(entryPath) ?? 0;
          const next = clamp01(cur + bonusBase * 2);
          if (next !== cur) {
            scoreByPath.set(entryPath, next);
          }
        }
      }
    }
  }

  candidates.length = 0;
  for (const [path, score] of scoreByPath) {
    candidates.push({ path, score });
  }
}

function dirMatchesQuery(dir: string, queryTerms: Set<string>): boolean {
  for (const segment of dir.split("/")) {
    const base = segment.replace(/\.[^.]+$/, "");
    for (const w of splitIdentifier(base)) {
      if (DIR_STOPWORDS.has(w)) {
        continue;
      }
      if (queryTerms.has(w)) {
        return true;
      }
    }
  }
  return false;
}

function siblingPriority(path: string): number {
  const name = basename(path);
  switch (name) {
    case "index": {
      return 0;
    }
    case "types": {
      return 1;
    }
    case "shared": {
      return 2;
    }
    case "env": {
      return 3;
    }
    case "client": {
      return 4;
    }
    case "server": {
      return 5;
    }
    case "transport": {
      return 6;
    }
    case "exec": {
      return 7;
    }
    case "process": {
      return 8;
    }
    case "user": {
      return 8;
    }
    case "workflow": {
      return 9;
    }
    default: {
      return 10;
    }
  }
}

function dirname(path: string): string {
  const slash = path.lastIndexOf("/");
  if (slash <= 0) {
    return "";
  }
  return path.slice(0, slash);
}

function basename(path: string): string {
  const file = path.slice(path.lastIndexOf("/") + 1);
  if (file.endsWith(".d.ts")) {
    return file.slice(0, -5);
  }
  return file.replace(/\.[^.]+$/, "");
}

function relativeDepth(path: string, root: string): number {
  if (!path.startsWith(root)) {
    return Number.POSITIVE_INFINITY;
  }

  let rel = path.slice(root.length);
  if (rel.startsWith("/")) {
    rel = rel.slice(1);
  }

  if (rel.length === 0) {
    return 0;
  }

  return rel.split("/").length;
}

function packageRoot(path: string): string {
  if (!path.startsWith("packages/") && !path.startsWith("apps/")) {
    return "";
  }

  const secondSlash = path.indexOf("/", path.indexOf("/") + 1);
  if (secondSlash <= 0) {
    return "";
  }
  return path.slice(0, secondSlash);
}

function packageName(root: string): string {
  const slash = root.indexOf("/");
  if (slash === -1) {
    return root;
  }
  return root.slice(slash + 1);
}

function buildRerankText(path: string, entry: EnrichedEntry): string {
  const parts = [path];

  // Exported symbols grouped by kind
  const exported = entry.symbols.filter((s) => s.exported);
  if (exported.length > 0) {
    const functions = exported
      .filter((s) => s.kind === "function")
      .map((s) => s.name);
    const classes = exported
      .filter((s) => s.kind === "class")
      .map((s) => s.name);
    const types = exported
      .filter((s) => s.kind === "type" || s.kind === "interface")
      .map((s) => s.name);

    if (functions.length > 0) {
      parts.push(`Functions: ${functions.slice(0, 5).join(", ")}`);
    }
    if (classes.length > 0) {
      parts.push(`Classes: ${classes.slice(0, 5).join(", ")}`);
    }
    if (types.length > 0) {
      parts.push(`Types: ${types.slice(0, 5).join(", ")}`);
    }
  }

  // Fallback to exports if no symbols
  if (exported.length === 0 && entry.exports.length > 0) {
    parts.push(`Exports: ${entry.exports.slice(0, 10).join(", ")}`);
  }

  // Dependencies
  if (entry.dependencies.length > 0) {
    parts.push(`Uses: ${entry.dependencies.slice(0, 5).join(", ")}`);
  }

  return parts.join("\n");
}

// ─────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────

async function loadIndexFromDisk(
  workspace: string
): Promise<Map<string, EnrichedEntry> | null> {
  try {
    const data = await Bun.file(`${workspace}/${INDEX_FILE}`).json();

    // Handle versioned format
    if (
      data &&
      typeof data === "object" &&
      "meta" in data &&
      "entries" in data
    ) {
      const persisted = data as PersistedIndex;
      // Version check - rebuild if outdated
      if (persisted.meta.version !== 2) {
        logger.debug("codeprint_index_version_mismatch", {
          expected: 2,
          found: persisted.meta.version,
        });
        return null;
      }
      return new Map(persisted.entries as [string, EnrichedEntry][]);
    }

    // Legacy format (array of entries)
    if (Array.isArray(data)) {
      return new Map(data as [string, EnrichedEntry][]);
    }

    return null;
  } catch {
    return null;
  }
}

async function saveIndexToDisk(
  workspace: string,
  index: Map<string, EnrichedEntry>
): Promise<void> {
  try {
    const persisted: PersistedIndex = {
      meta: {
        version: 2,
        createdAt: Date.now(),
        fileCount: index.size,
      },
      entries: [...index.entries()],
    };
    await Bun.write(`${workspace}/${INDEX_FILE}`, JSON.stringify(persisted));
  } catch {
    // Ignore write failures
  }
}

function buildBm25Index(index: Map<string, EnrichedEntry>): BM25Index {
  const bm25 = new BM25Index();
  for (const [path, entry] of index) {
    bm25.addDocumentTokens(path, buildSearchTokens(path, entry));
  }
  bm25VocabularyGauge.set(bm25.vocabularySize);
  return bm25;
}
