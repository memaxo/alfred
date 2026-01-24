# Codeprint MVP: Fast File Relevance for Planner

**Owner:** agent/plan  
**Status:** Draft  
**Created:** 2026-01-24  
**Timeline:** 3 days

---

## Problem

ALFRED's planner uses LLM calls to find relevant files (2-5s, 50K+ tokens). We need sub-200ms retrieval with minimal token usage.

## Solution

Single-file module (~300 lines) that:

1. Indexes file exports/imports/keywords using OXC (already in use)
2. Matches query keywords against index
3. Reranks top candidates using `@alfred/rerank` (already built)

## Non-Goals

- Call graphs, impact analysis, exemplars
- Multi-language support (Python, Rust, Go)
- SQLite, FTS5, custom BM25
- Rust/WASM native port
- File watching, incremental updates
- Architecture detection

---

## Implementation

### Day 1: Core Index

**File:** `packages/codeprint/src/index.ts`

```typescript
import { parseSync } from "oxc-parser";
import { rerank, isRerankAvailable } from "@alfred/rerank";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface FileEntry {
  path: string;
  exports: string[];
  imports: string[];
  keywords: string[];
}

interface RelevantFile {
  path: string;
  score: number;
  method: "keyword" | "rerank";
}

// ─────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────

const indexes = new Map<string, Map<string, FileEntry>>();
const INDEX_FILE = ".codeprint.json";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const indexTimestamps = new Map<string, number>();

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

/**
 * Find files relevant to a query.
 * Builds/loads index automatically.
 */
export async function findRelevantFiles(
  workspace: string,
  query: string,
  topK = 15
): Promise<RelevantFile[]> {
  const index = await getOrBuildIndex(workspace);

  // Keyword matching
  const queryTerms = tokenize(query);
  const candidates: Array<{ path: string; score: number }> = [];

  for (const [path, entry] of index) {
    const matches = entry.keywords.filter((k) => queryTerms.has(k)).length;
    if (matches > 0) {
      candidates.push({ path, score: matches / queryTerms.size });
    }
  }

  if (candidates.length === 0) {
    return [];
  }

  candidates.sort((a, b) => b.score - a.score);

  // If few candidates or no reranker, return keyword results
  const toRerank = candidates.slice(0, 50);
  if (!isRerankAvailable() || toRerank.length <= topK) {
    return toRerank
      .slice(0, topK)
      .map((c) => ({ ...c, method: "keyword" as const }));
  }

  // Rerank using cross-encoder
  const reranked = await rerank({
    query,
    documents: toRerank.map((c) => ({
      id: c.path,
      text: buildRerankText(c.path, index.get(c.path)!),
    })),
    topN: topK,
    instruction: "Rank code files by relevance to the programming task.",
  });

  if (reranked.length === 0) {
    // Rerank failed, fall back to keyword
    return toRerank
      .slice(0, topK)
      .map((c) => ({ ...c, method: "keyword" as const }));
  }

  return reranked.map((r) => ({
    path: r.id,
    score: r.score,
    method: "rerank" as const,
  }));
}

/**
 * Force rebuild of index.
 */
export async function rebuildIndex(workspace: string): Promise<number> {
  const index = await buildIndex(workspace);
  indexes.set(workspace, index);
  indexTimestamps.set(workspace, Date.now());
  return index.size;
}

/**
 * Clear cached index.
 */
export function clearIndex(workspace: string): void {
  indexes.delete(workspace);
  indexTimestamps.delete(workspace);
}

// ─────────────────────────────────────────────────────────
// Internal
// ─────────────────────────────────────────────────────────

async function getOrBuildIndex(
  workspace: string
): Promise<Map<string, FileEntry>> {
  const cached = indexes.get(workspace);
  const timestamp = indexTimestamps.get(workspace) ?? 0;

  // Return cached if fresh
  if (cached && Date.now() - timestamp < CACHE_TTL_MS) {
    return cached;
  }

  // Try loading from disk
  const diskIndex = await loadIndexFromDisk(workspace);
  if (diskIndex) {
    indexes.set(workspace, diskIndex);
    indexTimestamps.set(workspace, Date.now());
    return diskIndex;
  }

  // Build fresh
  const index = await buildIndex(workspace);
  indexes.set(workspace, index);
  indexTimestamps.set(workspace, Date.now());
  return index;
}

async function buildIndex(workspace: string): Promise<Map<string, FileEntry>> {
  const glob = new Bun.Glob("**/*.{ts,tsx,js,jsx}");
  const index = new Map<string, FileEntry>();

  for await (const path of glob.scan({ cwd: workspace, onlyFiles: true })) {
    // Skip node_modules, dist, etc.
    if (shouldIgnore(path)) continue;

    try {
      const content = await Bun.file(`${workspace}/${path}`).text();
      const entry = parseFileEntry(path, content);
      index.set(path, entry);
    } catch {
      // Skip unparseable files
    }
  }

  // Persist to disk
  await saveIndexToDisk(workspace, index);

  return index;
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

  return { path, exports, imports, keywords };
}

function extractKeywords(
  path: string,
  exports: string[],
  imports: string[]
): string[] {
  const keywords = new Set<string>();

  // Path segments
  for (const segment of path.split("/")) {
    for (const word of splitIdentifier(segment.replace(/\.[^.]+$/, ""))) {
      keywords.add(word);
    }
  }

  // Export names
  for (const exp of exports) {
    for (const word of splitIdentifier(exp)) {
      keywords.add(word);
    }
  }

  // Import sources (just the package/file name)
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

  return Array.from(keywords).filter((k) => k.length >= 2);
}

function splitIdentifier(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
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
  ];
  return ignorePatterns.some((p) => path.includes(p));
}

async function loadIndexFromDisk(
  workspace: string
): Promise<Map<string, FileEntry> | null> {
  try {
    const data = await Bun.file(`${workspace}/${INDEX_FILE}`).json();
    return new Map(data);
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
```

### Day 2: Integration + Tests

**Wire into planner** (`packages/plan/src/research/codebase.ts`):

```typescript
import { findRelevantFiles } from "@alfred/codeprint";

export async function gatherCodebaseContext(options: {
  requirement: string;
  workspace?: string;
  topK?: number;
}): Promise<string[]> {
  const workspace = options.workspace ?? process.cwd();
  const results = await findRelevantFiles(
    workspace,
    options.requirement,
    options.topK ?? 10
  );
  return results.map((r) => r.path);
}
```

**Tests** (`packages/codeprint/test/index.test.ts`):

```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { findRelevantFiles, rebuildIndex, clearIndex } from "../src/index.js";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

describe("codeprint", () => {
  let workspace: string;

  beforeAll(async () => {
    workspace = await mkdtemp(join(tmpdir(), "codeprint-test-"));
    await mkdir(join(workspace, "src"));

    await writeFile(
      join(workspace, "src/user.ts"),
      `
      export interface User { id: string; name: string; }
      export function createUser(name: string): User { return { id: "1", name }; }
    `
    );

    await writeFile(
      join(workspace, "src/auth.ts"),
      `
      import { User } from "./user.js";
      export function authenticate(user: User): boolean { return true; }
    `
    );

    await rebuildIndex(workspace);
  });

  afterAll(async () => {
    clearIndex(workspace);
    await rm(workspace, { recursive: true });
  });

  test("finds relevant files by keyword", async () => {
    const results = await findRelevantFiles(
      workspace,
      "user authentication",
      5
    );
    expect(results.length).toBeGreaterThan(0);
    const paths = results.map((r) => r.path);
    expect(paths).toContain("src/user.ts");
    expect(paths).toContain("src/auth.ts");
  });

  test("returns empty for no matches", async () => {
    const results = await findRelevantFiles(workspace, "zzzznotfound", 5);
    expect(results).toEqual([]);
  });

  test("respects topK limit", async () => {
    const results = await findRelevantFiles(workspace, "user", 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });
});
```

### Day 3: Performance Test + Deploy

**Performance validation:**

```typescript
// packages/codeprint/test/perf.test.ts
import { describe, test, expect } from "bun:test";
import { findRelevantFiles, rebuildIndex } from "../src/index.js";

describe("performance", () => {
  const workspace = process.cwd(); // ALFRED repo

  test("index build < 10s for monorepo", async () => {
    const start = performance.now();
    const count = await rebuildIndex(workspace);
    const elapsed = performance.now() - start;

    console.log(`Indexed ${count} files in ${elapsed.toFixed(0)}ms`);
    expect(elapsed).toBeLessThan(10_000);
  });

  test("query < 200ms", async () => {
    const start = performance.now();
    const results = await findRelevantFiles(
      workspace,
      "rerank workflow api endpoint",
      15
    );
    const elapsed = performance.now() - start;

    console.log(`Found ${results.length} files in ${elapsed.toFixed(0)}ms`);
    expect(elapsed).toBeLessThan(200);
    expect(results.length).toBeGreaterThan(0);
  });
});
```

---

## Package Setup

```json
// packages/codeprint/package.json
{
  "name": "@alfred/codeprint",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "dependencies": {
    "oxc-parser": "^0.110.0",
    "@alfred/rerank": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.3"
  },
  "scripts": {
    "typecheck": "tsc -b",
    "test": "bun test"
  }
}
```

---

## Success Criteria

| Metric           | Target                         | How to Measure       |
| ---------------- | ------------------------------ | -------------------- |
| Query latency    | < 200ms                        | Performance test     |
| Index build time | < 10s for ALFRED repo          | Performance test     |
| Accuracy         | Top 10 includes relevant files | Manual spot check    |
| Code size        | < 400 lines                    | `wc -l src/index.ts` |

---

## What's Deferred

| Feature            | Reason                      | Revisit When     |
| ------------------ | --------------------------- | ---------------- |
| SQLite persistence | JSON file sufficient        | Index > 100MB    |
| Custom BM25        | Keyword + rerank sufficient | Accuracy < 70%   |
| Call graphs        | Planner doesn't need it     | Explicit request |
| Impact analysis    | Planner doesn't need it     | Explicit request |
| Multi-language     | ALFRED is TS-focused        | Non-TS project   |
| Rust/WASM          | Premature optimization      | Query > 500ms    |
| File watcher       | 5-min cache sufficient      | Real-time needed |
| Incremental update | Full rebuild is fast        | Index > 30s      |

---

## Tasks

### Day 1: Core Index

- [x] Create `packages/codeprint/` directory
- [x] Create `package.json` with dependencies (oxc-parser, @alfred/rerank)
- [x] Create `tsconfig.json` extending base config
- [x] Implement `parseFileEntry()` - extract exports/imports using OXC
- [x] Implement `extractKeywords()` - split identifiers, path segments
- [x] Implement `buildIndex()` - glob files, parse each, build Map
- [x] Implement `saveIndexToDisk()` / `loadIndexFromDisk()` - JSON persistence
- [x] Implement `getOrBuildIndex()` - cache logic with 5-min TTL
- [x] Implement `findRelevantFiles()` - keyword matching + rerank
- [x] Add to workspace `tsconfig.json` references
- [x] Verify `bun run typecheck` passes

### Day 2: Integration + Tests

- [x] Update `packages/plan/src/research/codebase.ts` to use codeprint
- [x] Write unit test: finds relevant files by keyword
- [x] Write unit test: returns empty for no matches
- [x] Write unit test: respects topK limit
- [x] Write unit test: handles parse errors gracefully
- [x] Write unit test: index stats and cache clearing
- [x] Run tests against ALFRED repo as smoke test
- [x] Add `.codeprint.json` to `.gitignore`

### Day 3: Performance + Polish

- [x] Write perf test: index build < 10s
- [x] Write perf test: query < 200ms
- [ ] Measure actual token savings vs old approach
- [ ] Add logging for index build/query timing
- [ ] Document public API in README
- [ ] Manual test: run planner with new codeprint, verify results

---

## Progress

| Task                | Status          | Notes                                  |
| ------------------- | --------------- | -------------------------------------- |
| ExecPlan created    | Done            | 2026-01-24                             |
| OXC submodule       | Done            | vendor/oxc                             |
| **Day 1**           | **Done**        |                                        |
| Package scaffold    | Done            | package.json, tsconfig.json            |
| Core implementation | Done            | 250 lines in src/index.ts              |
| Typecheck           | Done            | Passes                                 |
| **Day 2**           | **Done**        |                                        |
| Planner integration | Done            | packages/plan/src/research/codebase.ts |
| Unit tests          | Done            | 7 tests passing                        |
| Smoke test          | Done            | 2839 files indexed                     |
| **Day 3**           | **In Progress** |                                        |
| Perf tests          | Done            | 4 tests passing                        |
| Documentation       | Pending         |                                        |

---

## Results

### Performance Achieved

| Metric                   | Target      | Actual         |
| ------------------------ | ----------- | -------------- |
| Index build (2839 files) | < 10s       | **2.4s**       |
| Query latency            | < 200ms     | **1ms**        |
| Code size                | < 400 lines | **~250 lines** |

### Test Results

```
22 pass, 0 fail
- 7 unit tests
- 4 performance tests
- (duplicated in dist/ = 22 total)
```

### Sample Query Output

Query: "rerank workflow api endpoint router"

```
packages/api/src/deps.ts
packages/api/src/routers/workflow.ts
packages/api/src/routers/orchestrator.ts
packages/api/src/routers/trajectory.ts
packages/api/src/routers/index.ts
```

---

## Decision Log

| Date       | Decision                      | Rationale                           |
| ---------- | ----------------------------- | ----------------------------------- |
| 2026-01-24 | JSON file over SQLite         | Simpler, sufficient for single-user |
| 2026-01-24 | Keyword matching over BM25    | Let reranker handle precision       |
| 2026-01-24 | 5-min cache over file watcher | Simpler, rebuild is fast            |
| 2026-01-24 | Single file over module tree  | YAGNI until > 500 lines             |
| 2026-01-24 | Defer all Phase 2/3 features  | Prove value first                   |
