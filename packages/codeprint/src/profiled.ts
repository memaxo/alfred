/**
 * Profiled versions of codeprint functions.
 * Use these when you need detailed stage-by-stage timing.
 */

import { logger } from "@alfred/logger";
import { rerank, isRerankAvailable } from "@alfred/rerank";
import { parseSync } from "oxc-parser";

import { type FileEntry, type RelevantFile } from "./index.js";
import {
  Profiler,
  type IndexBuildProfile,
  type QueryProfile,
  recordProfile,
  isProfilingEnabled,
} from "./profile.js";

// ─────────────────────────────────────────────────────────
// State (shared with main module via re-export)
// ─────────────────────────────────────────────────────────

const indexes = new Map<string, Map<string, FileEntry>>();
const INDEX_FILE = ".codeprint.json";
const CACHE_TTL_MS = 5 * 60 * 1000;
const indexTimestamps = new Map<string, number>();

// ─────────────────────────────────────────────────────────
// Profiled Index Build
// ─────────────────────────────────────────────────────────

export interface ProfiledIndexResult {
  index: Map<string, FileEntry>;
  profile: IndexBuildProfile;
}

export async function buildIndexProfiled(
  workspace: string
): Promise<ProfiledIndexResult> {
  const profiler = new Profiler();
  const filePaths: string[] = [];
  let bytesRead = 0;
  let parseErrors = 0;

  // Stage 1: Glob - discover files
  profiler.start("glob");
  const glob = new Bun.Glob("**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}");
  for await (const path of glob.scan({ cwd: workspace, onlyFiles: true })) {
    if (!shouldIgnore(path)) {
      filePaths.push(path);
    }
  }
  profiler.end("glob", { files: filePaths.length });

  const index = new Map<string, FileEntry>();
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
  profiler.end("parse", { errors: parseErrors, parsed: parsed.length });

  // Stage 4: Extract - keyword extraction
  profiler.start("extract");
  for (const { path, exports, imports } of parsed) {
    const keywords = extractKeywords(path, exports, imports);
    index.set(path, { exports, imports, keywords, path });
  }
  profiler.end("extract", { entries: index.size });

  // Stage 5: Persist - save to disk
  profiler.start("persist");
  await saveIndexToDisk(workspace, index);
  profiler.end("persist");

  const profile: IndexBuildProfile = {
    bytesRead,
    files: {
      total: filePaths.length,
      parsed: parsed.length,
      errors: parseErrors,
    },
    stages: {
      glob: profiler.getStage("glob"),
      read: profiler.getStage("read"),
      parse: profiler.getStage("parse"),
      extract: profiler.getStage("extract"),
      persist: profiler.getStage("persist"),
    },
    totalMs: profiler.getTotalMs(),
  };

  if (isProfilingEnabled()) {
    recordProfile(profile);
    logger.debug("codeprint_index_profile", {
      bytesRead: profile.bytesRead,
      files: profile.files,
      totalMs: profile.totalMs,
    });
  }

  return { index, profile };
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
  const timestamp = indexTimestamps.get(workspace) ?? 0;
  const cacheHit = !!(cached && Date.now() - timestamp < CACHE_TTL_MS);

  let index: Map<string, FileEntry>;
  if (cacheHit) {
    index = cached!;
  } else {
    const diskIndex = await loadIndexFromDisk(workspace);
    if (diskIndex) {
      index = diskIndex;
      indexes.set(workspace, diskIndex);
      indexTimestamps.set(workspace, Date.now());
    } else {
      const { index: builtIndex } = await buildIndexProfiled(workspace);
      index = builtIndex;
      indexes.set(workspace, index);
      indexTimestamps.set(workspace, Date.now());
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

  // Stage 3: Keyword matching
  profiler.start("match");
  const candidates: { path: string; score: number }[] = [];
  for (const [path, entry] of index) {
    const matches = entry.keywords.filter((k) => queryTerms.has(k)).length;
    if (matches > 0) {
      candidates.push({ path, score: matches / queryTerms.size });
    }
  }
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
