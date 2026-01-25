/**
 * Profiled versions of codeprint functions.
 * Use these when you need detailed stage-by-stage timing.
 */

import { logger } from "@alfred/logger";
import { rerank, isRerankAvailable } from "@alfred/rerank";
import { parseSync } from "oxc-parser";

import type { EnrichedEntry, RelevantFile } from "./types.js";

import { BM25Index } from "./bm25.js";
import { discoverFiles } from "./discover.js";
import { getPool, isPoolAvailable } from "./pool.js";
import {
  Profiler,
  type IndexBuildProfile,
  type QueryProfile,
  recordProfile,
  isProfilingEnabled,
} from "./profile.js";
import { buildSearchTokens } from "./searchtext.js";

// ─────────────────────────────────────────────────────────
// State (shared with main module via re-export)
// ─────────────────────────────────────────────────────────

const indexes = new Map<string, Map<string, EnrichedEntry>>();
const bm25Indexes = new Map<string, BM25Index>();
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
  javascript: ["js"],
  package: ["pkg"],
  packages: ["pkg"],
  repository: ["repo"],
  typescript: ["ts"],
};

// ─────────────────────────────────────────────────────────
// Profiled Index Build
// ─────────────────────────────────────────────────────────

export interface ProfiledIndexResult {
  index: Map<string, EnrichedEntry>;
  bm25: BM25Index;
  profile: IndexBuildProfile;
}

export async function buildIndexProfiled(
  workspace: string
): Promise<ProfiledIndexResult> {
  const profiler = new Profiler();
  const filePaths: string[] = [];
  let bytesRead = 0;
  let parseErrors = 0;

  // Stage 1: Discover - find files (git -> fd -> rg -> glob)
  profiler.start("discover");
  const discovery = await discoverFiles(workspace);
  filePaths.push(...discovery.files);
  profiler.end("discover", {
    files: filePaths.length,
    method: discovery.method,
  });

  // Check if parallel parsing is available
  const useParallel = isPoolAvailable();

  let index: Map<string, EnrichedEntry>;

  if (useParallel) {
    // Parallel path: Pool handles read + parse + semantic extraction
    profiler.start("read");
    profiler.end("read", { bytes: 0, files: 0, note: "included in parse" });

    profiler.start("parse");
    const pool = getPool();
    const { entries, errors } = await pool.parseMany(workspace, filePaths);
    index = entries;
    parseErrors = errors;

    // Calculate bytes read (approximate from entries)
    for (const entry of entries.values()) {
      bytesRead += entry.keywords.length * 10; // Rough estimate
    }
    profiler.end("parse", {
      errors: parseErrors,
      parsed: entries.size,
      parallel: true,
      workers: pool.stats().workers,
    });

    profiler.start("extract");
    profiler.end("extract", { entries: index.size, note: "included in parse" });
  } else {
    // Sequential path: Original behavior
    const contents: { path: string; content: string }[] = [];

    // Stage 2: Read - load file contents
    profiler.start("read");
    for (const path of filePaths) {
      try {
        const content = await Bun.file(`${workspace}/${path}`).text();
        contents.push({ content, path });
        bytesRead += content.length;
      } catch {
        // Skip unreadable files
      }
    }
    profiler.end("read", { bytes: bytesRead, files: contents.length });

    // Stage 3: Parse - OXC parsing
    profiler.start("parse");
    const parsed: {
      path: string;
      exports: string[];
      imports: string[];
    }[] = [];
    for (const { path, content } of contents) {
      try {
        const result = parseSync(path, content, { sourceType: "module" });
        const exports = result.module.staticExports.flatMap((exp) =>
          exp.entries.map((e) => e.exportName.name ?? e.exportName.kind)
        );
        const imports = result.module.staticImports.map(
          (imp) => imp.moduleRequest.value
        );
        parsed.push({ exports, imports, path });
      } catch {
        parseErrors++;
      }
    }
    profiler.end("parse", {
      errors: parseErrors,
      parsed: parsed.length,
      parallel: false,
    });

    // Stage 4: Extract - keyword extraction
    profiler.start("extract");
    index = new Map<string, EnrichedEntry>();
    for (const { path, exports, imports } of parsed) {
      const keywords = extractKeywords(path, exports, imports);
      const dependencies = imports.filter(
        (i) => !i.startsWith(".") && !i.startsWith("/")
      );
      index.set(path, {
        path,
        exports,
        imports,
        keywords,
        symbols: [],
        references: [],
        dependencies,
      });
    }
    profiler.end("extract", { entries: index.size });
  }

  // Stage 5: BM25 build
  profiler.start("bm25Build");
  const bm25 = buildBm25Index(index);
  bm25Indexes.set(workspace, bm25);
  profiler.end("bm25Build", {
    docs: bm25.size,
    vocab: bm25.vocabularySize,
  });

  // Stage 6: Persist - save to disk
  profiler.start("persist");
  await saveIndexToDisk(workspace, index);
  profiler.end("persist");

  const profile: IndexBuildProfile = {
    bytesRead,
    discoveryMethod: discovery.method,
    files: {
      total: filePaths.length,
      parsed: index.size,
      errors: parseErrors,
    },
    stages: {
      discover: profiler.getStage("discover"),
      read: profiler.getStage("read"),
      parse: profiler.getStage("parse"),
      extract: profiler.getStage("extract"),
      bm25Build: profiler.getStage("bm25Build"),
      persist: profiler.getStage("persist"),
    },
    totalMs: profiler.getTotalMs(),
  };

  if (isProfilingEnabled()) {
    recordProfile(profile);
    logger.debug("codeprint_index_profile", {
      bytesRead: profile.bytesRead,
      files: profile.files,
      parallel: useParallel,
      totalMs: profile.totalMs,
    });
  }

  indexes.set(workspace, index);
  bm25Indexes.set(workspace, bm25);
  indexTimestamps.set(workspace, Date.now());

  return { bm25, index, profile };
}

// ─────────────────────────────────────────────────────────
// Profiled Query
// ─────────────────────────────────────────────────────────

export interface ProfiledQueryResult {
  results: RelevantFile[];
  profile: QueryProfile;
}

export async function findRelevantFilesProfiled(
  workspace: string,
  query: string,
  topK = 15
): Promise<ProfiledQueryResult> {
  const profiler = new Profiler();

  // Stage 1: Cache check
  profiler.start("cacheCheck");
  const cached = indexes.get(workspace);
  const cachedBm25 = bm25Indexes.get(workspace);
  const timestamp = indexTimestamps.get(workspace) ?? 0;
  const cacheFresh = !!(cached && Date.now() - timestamp < CACHE_TTL_MS);
  const cacheHit = cacheFresh && !!cachedBm25;

  let index: Map<string, EnrichedEntry>;
  let bm25: BM25Index;
  if (cacheFresh) {
    index = cached!;
    bm25 = cachedBm25 ?? buildBm25Index(index);
    bm25Indexes.set(workspace, bm25);
  } else {
    const diskIndex = await loadIndexFromDisk(workspace);
    if (diskIndex) {
      index = diskIndex;
      bm25 = buildBm25Index(diskIndex);
      indexes.set(workspace, diskIndex);
      bm25Indexes.set(workspace, bm25);
      indexTimestamps.set(workspace, Date.now());
    } else {
      const built = await buildIndexProfiled(workspace);
      ({ index } = built);
      ({ bm25 } = built);
    }
  }
  profiler.end("cacheCheck", { cacheHit, indexSize: index.size });

  // Stage 2: Tokenize query
  profiler.start("tokenize");
  const queryTerms = tokenize(query);
  profiler.end("tokenize", { terms: queryTerms.size });

  if (queryTerms.size === 0) {
    return {
      profile: buildEmptyQueryProfile(profiler, cacheHit),
      results: [],
    };
  }

  if (topK <= 0) {
    return {
      profile: buildQueryProfile(
        profiler,
        queryTerms.size,
        0,
        0,
        0,
        "keyword",
        cacheHit
      ),
      results: [],
    };
  }

  // Stage 3: BM25 search (with semantic boost)
  profiler.start("match");
  const bm25Results = bm25.search(buildBm25Query(queryTerms, bm25), 200);
  const candidates = bm25Results.map((r) => {
    const entry = index.get(r.path);
    const base = normalizeBm25(r.score);
    const boost = entry ? computeSymbolBoost(entry, queryTerms) : 0;
    const score = clamp01(base + boost * SYMBOL_BOOST_WEIGHT);
    return { path: r.path, score };
  });
  profiler.end("match", { candidates: candidates.length });

  if (candidates.length === 0) {
    return {
      profile: buildQueryProfile(
        profiler,
        queryTerms.size,
        0,
        0,
        0,
        "keyword",
        cacheHit
      ),
      results: [],
    };
  }

  // Stage 4: Sort candidates
  profiler.start("sort");
  candidates.sort((a, b) => b.score - a.score);
  const toRerank = candidates.slice(0, 50);
  profiler.end("sort", { toRerank: toRerank.length });

  // Check if we should skip reranking
  if (!isRerankAvailable() || toRerank.length <= topK) {
    profiler.start("rerankPrep");
    profiler.end("rerankPrep");
    profiler.start("rerank");
    profiler.end("rerank");
    profiler.start("format");
    const results = toRerank
      .slice(0, topK)
      .map((c) => ({ ...c, method: "keyword" as const }));
    profiler.end("format", { results: results.length });

    const profile = buildQueryProfile(
      profiler,
      queryTerms.size,
      candidates.length,
      toRerank.length,
      results.length,
      "keyword",
      cacheHit
    );

    if (isProfilingEnabled()) {
      recordProfile(profile);
    }

    return { profile, results };
  }

  // Stage 5: Prepare rerank documents
  profiler.start("rerankPrep");
  const documents = toRerank.map((c) => ({
    id: c.path,
    text: buildRerankText(c.path, index.get(c.path)!),
  }));
  profiler.end("rerankPrep", { documents: documents.length });

  // Stage 6: Rerank
  profiler.start("rerank");
  let reranked: { id: string; score: number }[] = [];
  try {
    reranked = await rerank({
      documents,
      instruction: "Rank code files by relevance to the programming task.",
      query,
      topN: topK,
    });
  } catch (error) {
    logger.warn("codeprint_rerank_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  profiler.end("rerank", { reranked: reranked.length });

  // Stage 7: Format results
  profiler.start("format");
  let results: RelevantFile[];
  let method: "keyword" | "rerank";
  if (reranked.length > 0) {
    results = reranked.map((r) => ({
      method: "rerank" as const,
      path: r.id,
      score: r.score,
    }));
    method = "rerank";
  } else {
    results = toRerank
      .slice(0, topK)
      .map((c) => ({ ...c, method: "keyword" as const }));
    method = "keyword";
  }
  profiler.end("format", { results: results.length });

  const profile = buildQueryProfile(
    profiler,
    queryTerms.size,
    candidates.length,
    toRerank.length,
    results.length,
    method,
    cacheHit
  );

  if (isProfilingEnabled()) {
    recordProfile(profile);
  }

  return { profile, results };
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

function normalizeBm25(score: number): number {
  if (score <= 0) {
    return 0;
  }
  return score / (score + 1);
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
// Helpers
// ─────────────────────────────────────────────────────────

function buildQueryProfile(
  profiler: Profiler,
  queryTerms: number,
  candidates: number,
  toRerank: number,
  returned: number,
  method: "keyword" | "rerank",
  cacheHit: boolean
): QueryProfile {
  return {
    result: {
      queryTerms,
      candidates,
      toRerank,
      returned,
      method,
      cacheHit,
    },
    stages: {
      cacheCheck: profiler.getStage("cacheCheck"),
      tokenize: profiler.getStage("tokenize"),
      match: profiler.getStage("match"),
      sort: profiler.getStage("sort"),
      rerankPrep: profiler.getStage("rerankPrep"),
      rerank: profiler.getStage("rerank"),
      format: profiler.getStage("format"),
    },
    totalMs: profiler.getTotalMs(),
  };
}

function buildEmptyQueryProfile(
  profiler: Profiler,
  cacheHit: boolean
): QueryProfile {
  return buildQueryProfile(profiler, 0, 0, 0, 0, "keyword", cacheHit);
}

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
      const persisted = data as {
        meta: { version: number };
        entries: [string, EnrichedEntry][];
      };
      if (persisted.meta.version !== 2) {
        return null; // Version mismatch, rebuild
      }
      return new Map(persisted.entries);
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
    const persisted = {
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
  return bm25;
}
