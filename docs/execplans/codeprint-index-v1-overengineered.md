# Codeprint: Fast Codebase Understanding Layer

**Owner:** agent/plan  
**Status:** Draft  
**Created:** 2026-01-24  
**Target:** v0.1.0 (Phase 1), v0.2.0 (Phase 2), v1.0.0 (Phase 3)

---

## Purpose

Build `@alfred/codeprint`, a persistent codebase index that provides sub-100ms semantic context retrieval for ALFRED's planning system. The current approach re-scans via LLM or keyword grep on every planning request, burning tokens and adding latency. Codeprint pre-computes structural information (signatures, imports, exports, call graphs) and uses two-stage retrieval (BM25 recall → cross-encoder rerank) to deliver accurate, token-efficient context.

### Success Metrics

| Metric                                      | Current         | Target                  |
| ------------------------------------------- | --------------- | ----------------------- |
| Context retrieval latency                   | 2-5s (LLM scan) | < 150ms                 |
| Tokens per context request                  | 50K-100K        | < 5K                    |
| Planner accuracy (relevant files in top 10) | ~60%            | > 85%                   |
| Index freshness                             | N/A (no index)  | < 1s incremental update |

### Non-Goals

- Full LSP/IDE features (go-to-definition, rename)
- Real-time type checking or diagnostics
- Replacing tree-sitter for syntax highlighting
- Supporting every programming language at launch

---

## Vendor Dependencies

### OXC (Oxidation Compiler) - `vendor/oxc`

Added as git submodule: `https://github.com/oxc-project/oxc`

OXC is a high-performance JavaScript/TypeScript toolchain written in Rust. We leverage it for:

#### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Applications                           │
├─────────────────────────────────────────────────────────────────┤
│  oxlint  │  Language Server  │  NAPI Bindings  │  Future Tools  │
├─────────────────────────────────────────────────────────────────┤
│                        Core Libraries                           │
├─────────────────────────────────────────────────────────────────┤
│ Parser │ Semantic │ Linter │ Transformer │ Minifier │ Codegen   │
├─────────────────────────────────────────────────────────────────┤
│                    Foundation Libraries                         │
├─────────────────────────────────────────────────────────────────┤
│    AST    │  Allocator  │  Diagnostics  │   Span   │  Syntax    │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Components for Codeprint

| Crate           | Purpose                               | Usage in Codeprint              |
| --------------- | ------------------------------------- | ------------------------------- |
| `oxc_parser`    | Hand-written recursive descent parser | Parse JS/TS to AST              |
| `oxc_semantic`  | Scope chain, symbol table, references | Extract definitions, call graph |
| `oxc_ast`       | AST node definitions                  | Type-safe AST traversal         |
| `oxc_span`      | Source positions                      | Line/column for definitions     |
| `oxc_allocator` | Arena allocator                       | Zero-copy parsing               |

#### OXC AST Design (Important Differences from ESTree)

OXC uses **distinct identifier types** instead of generic `Identifier`:

- `BindingIdentifier` - for variable declarations and bindings
- `IdentifierReference` - for variable references
- `IdentifierName` - for property names and labels

This distinction is critical for accurate definition/reference extraction.

#### NAPI Bindings (`napi/parser`)

The `oxc-parser` npm package provides:

```typescript
import { parseSync, ParseResult } from "oxc-parser";
import type { Program, StaticImport, StaticExport } from "@oxc-project/types";

interface ParseResult {
  program: Program; // Full AST
  module: EcmaScriptModule; // Pre-extracted imports/exports
  comments: Comment[]; // Preserved comments
  errors: OxcError[]; // Parse errors
}

interface EcmaScriptModule {
  hasModuleSyntax: boolean;
  staticImports: StaticImport[]; // Already extracted!
  staticExports: StaticExport[]; // Already extracted!
  dynamicImports: DynamicImport[];
  importMetas: Span[];
}
```

**Key insight**: OXC already extracts imports/exports into `EcmaScriptModule` - we don't need to walk the AST for these!

#### Semantic Analysis (`oxc_semantic`)

For deeper analysis (call graphs, symbol resolution), we can use:

```rust
use oxc_semantic::{Semantic, SemanticBuilder};

let semantic = SemanticBuilder::new()
    .with_cfg(true)  // Control flow graph
    .build(&program);

// Access:
// - semantic.scoping() - scope chain
// - semantic.nodes() - AST nodes with parent links
// - semantic.symbol_references(id) - all references to a symbol
```

#### Performance Characteristics

From OXC ARCHITECTURE.md:

- **Arena allocation**: Single arena per compilation unit, zero-copy strings
- **No GC**: Manual memory management for predictable performance
- **Parallel file processing**: Multiple files in parallel, single-threaded per file
- **Target**: 10-100x faster than comparable tools

#### Integration Strategy

**Phase 1 (TypeScript)**: Use `oxc-parser` npm package (already in use)

- Leverage `EcmaScriptModule` for imports/exports (zero extra work)
- Walk AST for function/class/type definitions
- Use Visitor pattern from `oxc-parser` for traversal

**Phase 3 (Native)**: Direct Rust integration options

1. **NAPI-RS bindings**: Build custom bindings exposing semantic analysis
2. **WASM**: Compile oxc_parser + oxc_semantic to WASM
3. **Subprocess**: Run Rust binary, communicate via JSON

#### Existing Usage in ALFRED

`packages/agent/src/orchestrator/reasoning/decompose-semantic.ts`:

```typescript
import { parseSync } from "oxc-parser";

// Currently used for:
// - Import graph analysis
// - File clustering by package
// - Basic definition extraction
```

Current version: `oxc-parser@0.98.0` (should update to 0.110.0)

---

## Plan

### Phase 1: Core Index & TypeScript Parser (Week 1-2)

Build the foundational index with TypeScript/JavaScript support using oxc-parser.

#### 1.1 Package Scaffold

```
packages/codeprint/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Public API
│   ├── types.ts              # Core types
│   ├── index/
│   │   ├── schema.ts         # SQLite schema
│   │   ├── writer.ts         # Index writer
│   │   ├── reader.ts         # Index reader
│   │   └── incremental.ts    # Change detection
│   ├── parse/
│   │   ├── typescript.ts     # oxc-parser integration
│   │   ├── extract.ts        # Signature/export extraction
│   │   └── summarize.ts      # Auto-summary generation
│   ├── search/
│   │   ├── bm25.ts           # BM25 keyword search
│   │   ├── rerank.ts         # @alfred/rerank integration
│   │   └── retrieve.ts       # Two-stage retrieval pipeline
│   └── graph/
│       ├── deps.ts           # Dependency graph
│       ├── reverse.ts        # Reverse dependency index
│       └── impact.ts         # Impact radius calculation
├── test/
│   ├── parse.test.ts
│   ├── search.test.ts
│   ├── index.test.ts
│   └── integration.test.ts
└── README.md
```

#### 1.2 SQLite Index Schema

```sql
-- Core file index
CREATE TABLE files (
  path TEXT PRIMARY KEY,
  language TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  last_modified INTEGER NOT NULL,
  summary TEXT,
  keywords TEXT,           -- JSON array of keywords
  signature_text TEXT,     -- Concatenated signatures for BM25
  indexed_at INTEGER NOT NULL
);

-- Definitions (functions, classes, types, interfaces, consts)
CREATE TABLE definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,      -- 'function' | 'class' | 'type' | 'interface' | 'const'
  signature TEXT NOT NULL,
  line INTEGER NOT NULL,
  docstring TEXT,
  exported INTEGER NOT NULL DEFAULT 0,
  UNIQUE(file_path, name, kind, line)
);

-- Imports
CREATE TABLE imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
  source TEXT NOT NULL,    -- Import source (e.g., "@alfred/rerank")
  specifiers TEXT,         -- JSON array of imported names
  line INTEGER NOT NULL
);

-- Exports
CREATE TABLE exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  line INTEGER NOT NULL,
  re_export_source TEXT    -- If re-exporting from another module
);

-- Call edges (lightweight call graph)
CREATE TABLE call_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caller_file TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
  caller_name TEXT NOT NULL,
  callee_name TEXT NOT NULL,
  callee_file TEXT,        -- NULL if external/unresolved
  line INTEGER NOT NULL
);

-- Indexes for fast queries
CREATE INDEX idx_definitions_file ON definitions(file_path);
CREATE INDEX idx_definitions_name ON definitions(name);
CREATE INDEX idx_definitions_exported ON definitions(exported) WHERE exported = 1;
CREATE INDEX idx_imports_file ON imports(file_path);
CREATE INDEX idx_imports_source ON imports(source);
CREATE INDEX idx_exports_file ON exports(file_path);
CREATE INDEX idx_exports_name ON exports(name);
CREATE INDEX idx_call_edges_caller ON call_edges(caller_file);
CREATE INDEX idx_call_edges_callee ON call_edges(callee_file);

-- FTS5 for full-text search on signatures
CREATE VIRTUAL TABLE fts_signatures USING fts5(
  path,
  signature_text,
  keywords,
  summary,
  content='files',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER files_ai AFTER INSERT ON files BEGIN
  INSERT INTO fts_signatures(rowid, path, signature_text, keywords, summary)
  VALUES (NEW.rowid, NEW.path, NEW.signature_text, NEW.keywords, NEW.summary);
END;

CREATE TRIGGER files_ad AFTER DELETE ON files BEGIN
  INSERT INTO fts_signatures(fts_signatures, rowid, path, signature_text, keywords, summary)
  VALUES ('delete', OLD.rowid, OLD.path, OLD.signature_text, OLD.keywords, OLD.summary);
END;

CREATE TRIGGER files_au AFTER UPDATE ON files BEGIN
  INSERT INTO fts_signatures(fts_signatures, rowid, path, signature_text, keywords, summary)
  VALUES ('delete', OLD.rowid, OLD.path, OLD.signature_text, OLD.keywords, OLD.summary);
  INSERT INTO fts_signatures(rowid, path, signature_text, keywords, summary)
  VALUES (NEW.rowid, NEW.path, NEW.signature_text, NEW.keywords, NEW.summary);
END;
```

#### 1.3 TypeScript Parser (oxc-based)

**Key Discovery**: OXC's `ParseResult.module` already extracts imports/exports!

```typescript
// packages/codeprint/src/parse/typescript.ts

import { parseSync, type ParseResult, Visitor } from "oxc-parser";
import type {
  Program,
  StaticImport,
  StaticExport,
  FunctionDeclaration,
  ClassDeclaration,
  VariableDeclaration,
} from "@oxc-project/types";
import type { Definition, Export, Import, FileParseResult } from "../types.js";

const TS_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

export function canParse(path: string): boolean {
  const ext = path.substring(path.lastIndexOf("."));
  return TS_EXTENSIONS.has(ext);
}

export function parseFile(path: string, content: string): FileParseResult {
  const result = parseSync(path, content, {
    lang: inferLang(path),
    sourceType: "module",
  });

  // Handle parse errors gracefully
  if (result.errors.length > 0) {
    return {
      language: "typescript",
      definitions: [],
      imports: [],
      exports: [],
      callEdges: [],
      keywords: [],
      errors: result.errors.map((e) => e.message),
    };
  }

  // ─────────────────────────────────────────────────────────
  // Imports: Use pre-extracted module.staticImports (FREE!)
  // ─────────────────────────────────────────────────────────
  const imports: Import[] = result.module.staticImports.map((imp) => ({
    source: imp.moduleRequest.value,
    specifiers: imp.entries.map((e) => ({
      imported: e.importName.name ?? e.importName.kind,
      local: e.localName.value,
      isType: e.isType,
    })),
    line: calculateLine(content, imp.start),
    isType: imp.entries.every((e) => e.isType),
  }));

  // ─────────────────────────────────────────────────────────
  // Exports: Use pre-extracted module.staticExports (FREE!)
  // ─────────────────────────────────────────────────────────
  const exports: Export[] = [];
  for (const exp of result.module.staticExports) {
    for (const entry of exp.entries) {
      exports.push({
        name: entry.exportName.name ?? entry.exportName.kind,
        kind: inferExportKind(entry),
        line: calculateLine(content, exp.start),
        reExportSource: entry.moduleRequest?.value,
        isType: entry.isType,
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // Definitions: Walk AST for functions, classes, types
  // ─────────────────────────────────────────────────────────
  const definitions: Definition[] = [];
  const keywords = new Set<string>();
  const exportedNames = new Set(exports.map((e) => e.name));

  // Use OXC's Visitor pattern for efficient traversal
  const visitor = new Visitor({
    FunctionDeclaration(node) {
      if (node.id) {
        definitions.push({
          name: node.id.name,
          kind: "function",
          signature: buildFunctionSignature(node, content),
          line: calculateLine(content, node.start),
          docstring: extractLeadingComment(result.comments, node.start),
          exported: exportedNames.has(node.id.name),
        });
        extractKeywords(node.id.name, keywords);
      }
    },

    ClassDeclaration(node) {
      if (node.id) {
        definitions.push({
          name: node.id.name,
          kind: "class",
          signature: buildClassSignature(node, content),
          line: calculateLine(content, node.start),
          docstring: extractLeadingComment(result.comments, node.start),
          exported: exportedNames.has(node.id.name),
        });
        extractKeywords(node.id.name, keywords);
      }
    },

    TSTypeAliasDeclaration(node) {
      definitions.push({
        name: node.id.name,
        kind: "type",
        signature: `type ${node.id.name}${extractTypeParams(node)}`,
        line: calculateLine(content, node.start),
        docstring: extractLeadingComment(result.comments, node.start),
        exported: exportedNames.has(node.id.name),
      });
      extractKeywords(node.id.name, keywords);
    },

    TSInterfaceDeclaration(node) {
      definitions.push({
        name: node.id.name,
        kind: "interface",
        signature: buildInterfaceSignature(node),
        line: calculateLine(content, node.start),
        docstring: extractLeadingComment(result.comments, node.start),
        exported: exportedNames.has(node.id.name),
      });
      extractKeywords(node.id.name, keywords);
    },

    VariableDeclaration(node) {
      // Only top-level const declarations
      if (node.kind === "const") {
        for (const decl of node.declarations) {
          if (decl.id.type === "Identifier") {
            definitions.push({
              name: decl.id.name,
              kind: "const",
              signature: buildConstSignature(decl, content),
              line: calculateLine(content, node.start),
              docstring: extractLeadingComment(result.comments, node.start),
              exported: exportedNames.has(decl.id.name),
            });
            extractKeywords(decl.id.name, keywords);
          }
        }
      }
    },
  });

  visitor.visit(result.program);

  return {
    language: "typescript",
    definitions,
    imports,
    exports,
    callEdges: [], // Phase 2: Add call graph extraction
    keywords: Array.from(keywords),
  };
}

// ─────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────

function inferLang(path: string): "js" | "jsx" | "ts" | "tsx" | "dts" {
  if (path.endsWith(".d.ts")) return "dts";
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts") || path.endsWith(".mts") || path.endsWith(".cts"))
    return "ts";
  if (path.endsWith(".jsx")) return "jsx";
  return "js";
}

function calculateLine(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

function buildFunctionSignature(
  node: FunctionDeclaration,
  content: string
): string {
  const async = node.async ? "async " : "";
  const generator = node.generator ? "*" : "";
  const name = node.id?.name ?? "anonymous";
  const typeParams = extractTypeParams(node);
  const params = extractParams(node.params, content);
  const returnType = node.returnType
    ? `: ${extractTypeAnnotation(node.returnType, content)}`
    : "";
  return `${async}function${generator} ${name}${typeParams}(${params})${returnType}`;
}

function buildClassSignature(node: ClassDeclaration, content: string): string {
  const name = node.id?.name ?? "anonymous";
  const typeParams = extractTypeParams(node);
  const extendsClause = node.superClass
    ? ` extends ${extractExpression(node.superClass, content)}`
    : "";
  const implementsClause = node.implements?.length
    ? ` implements ${node.implements.map((i) => extractExpression(i, content)).join(", ")}`
    : "";
  return `class ${name}${typeParams}${extendsClause}${implementsClause}`;
}

function buildInterfaceSignature(node: TSInterfaceDeclaration): string {
  const name = node.id.name;
  const typeParams = extractTypeParams(node);
  const extendsClause = node.extends?.length
    ? ` extends ${node.extends.map((e) => e.expression.name).join(", ")}`
    : "";
  return `interface ${name}${typeParams}${extendsClause}`;
}

function extractLeadingComment(
  comments: Comment[],
  nodeStart: number
): string | undefined {
  // Find JSDoc comment immediately before node
  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = comments[i];
    if (
      comment.end <= nodeStart &&
      comment.type === "Block" &&
      comment.value.startsWith("*")
    ) {
      // Check it's immediately before (within 2 lines)
      return comment.value.replace(/^\*+/, "").trim();
    }
  }
  return undefined;
}

function extractKeywords(name: string, keywords: Set<string>): void {
  // Split camelCase and PascalCase
  const parts = name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 2);

  for (const part of parts) {
    keywords.add(part);
  }
  keywords.add(name.toLowerCase());
}
```

#### 1.4 BM25 Search Implementation

```typescript
// packages/codeprint/src/search/bm25.ts

interface BM25Config {
  k1: number; // Term frequency saturation (default: 1.2)
  b: number; // Length normalization (default: 0.75)
}

interface BM25Document {
  path: string;
  terms: Map<string, number>; // term -> frequency
  length: number;
}

export class BM25Index {
  private documents: Map<string, BM25Document> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map(); // term -> doc paths
  private avgDocLength: number = 0;
  private config: BM25Config;

  constructor(config: Partial<BM25Config> = {}) {
    this.config = {
      k1: config.k1 ?? 1.2,
      b: config.b ?? 0.75,
    };
  }

  addDocument(path: string, text: string): void {
    const terms = this.tokenize(text);
    const termFreq = new Map<string, number>();

    for (const term of terms) {
      termFreq.set(term, (termFreq.get(term) ?? 0) + 1);

      if (!this.invertedIndex.has(term)) {
        this.invertedIndex.set(term, new Set());
      }
      this.invertedIndex.get(term)!.add(path);
    }

    this.documents.set(path, {
      path,
      terms: termFreq,
      length: terms.length,
    });

    this.updateAvgDocLength();
  }

  removeDocument(path: string): void {
    const doc = this.documents.get(path);
    if (!doc) return;

    for (const term of doc.terms.keys()) {
      this.invertedIndex.get(term)?.delete(path);
    }

    this.documents.delete(path);
    this.updateAvgDocLength();
  }

  search(
    query: string,
    limit: number
  ): Array<{ path: string; score: number; matchedTerms: string[] }> {
    const queryTerms = this.tokenize(query);
    const scores = new Map<
      string,
      { score: number; matchedTerms: Set<string> }
    >();
    const N = this.documents.size;

    for (const term of queryTerms) {
      const matchingDocs = this.invertedIndex.get(term);
      if (!matchingDocs) continue;

      const df = matchingDocs.size;
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

      for (const path of matchingDocs) {
        const doc = this.documents.get(path)!;
        const tf = doc.terms.get(term) ?? 0;
        const docLength = doc.length;

        // BM25 formula
        const numerator = tf * (this.config.k1 + 1);
        const denominator =
          tf +
          this.config.k1 *
            (1 -
              this.config.b +
              this.config.b * (docLength / this.avgDocLength));
        const termScore = idf * (numerator / denominator);

        if (!scores.has(path)) {
          scores.set(path, { score: 0, matchedTerms: new Set() });
        }
        const entry = scores.get(path)!;
        entry.score += termScore;
        entry.matchedTerms.add(term);
      }
    }

    return Array.from(scores.entries())
      .map(([path, { score, matchedTerms }]) => ({
        path,
        score,
        matchedTerms: Array.from(matchedTerms),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private tokenize(text: string): string[] {
    // Split on non-alphanumeric, split camelCase, lowercase
    return text
      .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase -> camel Case
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2") // XMLParser -> XML Parser
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2);
  }

  private updateAvgDocLength(): void {
    if (this.documents.size === 0) {
      this.avgDocLength = 0;
      return;
    }
    let total = 0;
    for (const doc of this.documents.values()) {
      total += doc.length;
    }
    this.avgDocLength = total / this.documents.size;
  }
}
```

#### 1.5 Rerank Integration

```typescript
// packages/codeprint/src/search/rerank.ts

import { rerank, isRerankAvailable, type RerankDocument } from "@alfred/rerank";
import type { FileIndex } from "../types.js";

const CODE_RERANK_INSTRUCTION = `Rank code files by relevance to the programming task.
Consider: function signatures, type definitions, imports, module purpose.
Prioritize files that would need modification over reference-only files.
Give higher scores to files with matching function/type names.`;

export interface RerankOptions {
  query: string;
  candidates: FileIndex[];
  topN: number;
  instruction?: string;
}

export interface RerankResult {
  path: string;
  score: number;
  originalRank: number;
}

export async function rerankFiles(
  opts: RerankOptions
): Promise<RerankResult[]> {
  if (!isRerankAvailable() || opts.candidates.length === 0) {
    // Fail-open: return candidates in original order with synthetic scores
    return opts.candidates.slice(0, opts.topN).map((f, i) => ({
      path: f.path,
      score: 1 - i / opts.candidates.length,
      originalRank: i,
    }));
  }

  // Build rerank documents from index (signatures, not full content)
  const documents: RerankDocument[] = opts.candidates.map((file, index) => ({
    id: file.path,
    text: buildRerankText(file, index),
  }));

  const results = await rerank({
    query: opts.query,
    documents,
    topN: opts.topN,
    instruction: opts.instruction ?? CODE_RERANK_INSTRUCTION,
  });

  // If rerank failed (fail-open returns []), fall back to original order
  if (results.length === 0) {
    return opts.candidates.slice(0, opts.topN).map((f, i) => ({
      path: f.path,
      score: 1 - i / opts.candidates.length,
      originalRank: i,
    }));
  }

  return results.map((r) => ({
    path: r.id,
    score: r.score,
    originalRank: r.index,
  }));
}

function buildRerankText(file: FileIndex, rank: number): string {
  const parts: string[] = [];

  // File path (strong signal)
  parts.push(`[${rank + 1}] ${file.path}`);

  // Summary
  if (file.summary) {
    parts.push(file.summary);
  }

  // Exported definitions (signatures only, max 8)
  const exportedDefs = file.definitions.filter((d) => d.exported).slice(0, 8);

  if (exportedDefs.length > 0) {
    parts.push("Exports:");
    for (const def of exportedDefs) {
      parts.push(`  ${def.signature}`);
    }
  }

  // Key imports (max 5)
  const keyImports = file.imports
    .filter((i) => !i.source.startsWith(".")) // Skip relative imports
    .slice(0, 5)
    .map((i) => i.source);

  if (keyImports.length > 0) {
    parts.push(`Uses: ${keyImports.join(", ")}`);
  }

  return parts.join("\n");
}

// Token budget: ~50-150 tokens per file
// 50 files = 2500-7500 tokens (well within reranker limits)
```

#### 1.6 Two-Stage Retrieval Pipeline

```typescript
// packages/codeprint/src/search/retrieve.ts

import type { CodeprintIndex } from "../index.js";
import type { FileRelevance, PlannerContext } from "../types.js";
import { rerankFiles } from "./rerank.js";

export interface RetrieveOptions {
  query: string;
  recallLimit?: number; // BM25 candidates (default: 200)
  rerankLimit?: number; // Candidates to rerank (default: 50)
  topK?: number; // Final results (default: 15)
  skipRerank?: boolean; // For offline/testing
}

export async function retrieveRelevantFiles(
  index: CodeprintIndex,
  opts: RetrieveOptions
): Promise<FileRelevance[]> {
  const recallLimit = opts.recallLimit ?? 200;
  const rerankLimit = opts.rerankLimit ?? 50;
  const topK = opts.topK ?? 15;

  // ─────────────────────────────────────────────────────────
  // Stage 1: BM25 Recall (< 10ms)
  // ─────────────────────────────────────────────────────────
  const bm25Results = index.bm25Search(opts.query, recallLimit);

  if (bm25Results.length === 0) {
    return [];
  }

  // Skip rerank if requested or if few results
  if (opts.skipRerank || bm25Results.length <= topK) {
    return bm25Results.slice(0, topK).map((r, i) => ({
      path: r.path,
      score: r.score,
      rank: i + 1,
      reason: `Keywords: ${r.matchedTerms.slice(0, 3).join(", ")}`,
      method: "bm25",
    }));
  }

  // ─────────────────────────────────────────────────────────
  // Stage 2: Rerank (< 100ms)
  // ─────────────────────────────────────────────────────────
  const toRerank = bm25Results.slice(0, rerankLimit);
  const fileIndexes = toRerank
    .map((r) => index.getFile(r.path))
    .filter((f): f is FileIndex => f !== null);

  const reranked = await rerankFiles({
    query: opts.query,
    candidates: fileIndexes,
    topN: topK,
  });

  return reranked.map((r, i) => {
    const bm25Result = toRerank.find((b) => b.path === r.path);
    return {
      path: r.path,
      score: r.score,
      rank: i + 1,
      reason: `Reranked from #${r.originalRank + 1}`,
      method: "rerank",
      bm25Score: bm25Result?.score,
      bm25Rank: r.originalRank + 1,
    };
  });
}
```

#### 1.7 Public API

```typescript
// packages/codeprint/src/index.ts

import Database from "bun:sqlite";
import { BM25Index } from "./search/bm25.js";
import {
  retrieveRelevantFiles,
  type RetrieveOptions,
} from "./search/retrieve.js";
import { parseFile, canParse } from "./parse/typescript.js";
import type {
  FileIndex,
  FileRelevance,
  Definition,
  Export,
  Import,
  ImpactRadius,
  ArchitectureSketch,
  CodeExemplar,
} from "./types.js";

export class CodeprintIndex {
  private db: Database;
  private bm25: BM25Index;
  private workspace: string;

  private constructor(workspace: string, db: Database) {
    this.workspace = workspace;
    this.db = db;
    this.bm25 = new BM25Index();
  }

  // ─────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────

  /**
   * Create or load an index for a workspace.
   * Index is stored at {workspace}/.codeprint/index.db
   */
  static async load(workspace: string): Promise<CodeprintIndex> {
    const indexPath = `${workspace}/.codeprint/index.db`;
    const db = new Database(indexPath, { create: true });

    // Initialize schema if needed
    db.exec(SCHEMA_SQL);

    const index = new CodeprintIndex(workspace, db);
    await index.loadBM25FromDb();

    return index;
  }

  /**
   * Full reindex of a workspace.
   * Use for initial indexing or recovery.
   */
  static async index(
    workspace: string,
    options?: {
      extensions?: string[];
      ignore?: string[];
      onProgress?: (indexed: number, total: number) => void;
    }
  ): Promise<CodeprintIndex> {
    const index = await CodeprintIndex.load(workspace);
    await index.fullIndex(options);
    return index;
  }

  // ─────────────────────────────────────────────────────────
  // Indexing
  // ─────────────────────────────────────────────────────────

  /**
   * Incrementally update index for changed files.
   */
  async update(
    changedPaths: string[]
  ): Promise<{ added: number; updated: number; removed: number }> {
    let added = 0,
      updated = 0,
      removed = 0;

    for (const path of changedPaths) {
      const fullPath = `${this.workspace}/${path}`;
      const exists = await Bun.file(fullPath).exists();

      if (!exists) {
        this.removeFile(path);
        removed++;
        continue;
      }

      if (!canParse(path)) continue;

      const content = await Bun.file(fullPath).text();
      const hash = Bun.hash(content).toString(16);

      const existing = this.getFile(path);
      if (existing?.contentHash === hash) continue;

      await this.indexFile(path, content, hash);

      if (existing) {
        updated++;
      } else {
        added++;
      }
    }

    return { added, updated, removed };
  }

  // ─────────────────────────────────────────────────────────
  // Query API (for Planner)
  // ─────────────────────────────────────────────────────────

  /**
   * BM25 keyword search on signatures and keywords.
   */
  bm25Search(
    query: string,
    limit: number
  ): Array<{ path: string; score: number; matchedTerms: string[] }> {
    return this.bm25.search(query, limit);
  }

  /**
   * Full retrieval pipeline: BM25 recall → rerank → return top K.
   */
  async relevantFiles(
    query: string,
    options?: Partial<RetrieveOptions>
  ): Promise<FileRelevance[]> {
    return retrieveRelevantFiles(this, { query, ...options });
  }

  /**
   * Find code exemplars matching a pattern description.
   */
  async findExemplars(pattern: string, limit = 3): Promise<CodeExemplar[]> {
    const files = await this.relevantFiles(pattern, { topK: limit * 2 });
    const exemplars: CodeExemplar[] = [];

    for (const file of files.slice(0, limit)) {
      const fileIndex = this.getFile(file.path);
      if (!fileIndex) continue;

      // Find the most relevant definition
      const relevantDef = fileIndex.definitions
        .filter((d) => d.exported)
        .sort((a, b) => {
          // Prefer functions/classes over types
          const kindOrder = {
            function: 0,
            class: 1,
            interface: 2,
            type: 3,
            const: 4,
          };
          return (kindOrder[a.kind] ?? 5) - (kindOrder[b.kind] ?? 5);
        })[0];

      if (relevantDef) {
        exemplars.push({
          path: file.path,
          name: relevantDef.name,
          kind: relevantDef.kind,
          signature: relevantDef.signature,
          line: relevantDef.line,
          docstring: relevantDef.docstring,
          score: file.score,
        });
      }
    }

    return exemplars;
  }

  /**
   * Get files affected by changing a file.
   */
  impactRadius(path: string): ImpactRadius {
    const directDeps = this.getReverseDeps(path);
    const transitiveDeps = new Set<string>();
    const testFiles: string[] = [];

    // BFS for transitive deps (max depth 3)
    const queue = [...directDeps];
    const visited = new Set<string>(directDeps);
    let depth = 0;

    while (queue.length > 0 && depth < 3) {
      const levelSize = queue.length;
      for (let i = 0; i < levelSize; i++) {
        const dep = queue.shift()!;
        transitiveDeps.add(dep);

        // Check if it's a test file
        if (
          dep.includes(".test.") ||
          dep.includes(".spec.") ||
          dep.includes("__tests__")
        ) {
          testFiles.push(dep);
        }

        for (const nextDep of this.getReverseDeps(dep)) {
          if (!visited.has(nextDep)) {
            visited.add(nextDep);
            queue.push(nextDep);
          }
        }
      }
      depth++;
    }

    return {
      file: path,
      directDependents: directDeps,
      transitiveDependents: Array.from(transitiveDeps),
      affectedTests: testFiles,
      depth,
    };
  }

  /**
   * Get architecture sketch for the workspace.
   */
  architectureSketch(): ArchitectureSketch {
    // Query packages/apps structure
    const packages = this.db
      .query<{ path: string }, []>(
        `
      SELECT DISTINCT 
        CASE 
          WHEN path LIKE 'packages/%' THEN substr(path, 10, instr(substr(path, 10), '/') - 1)
          WHEN path LIKE 'apps/%' THEN substr(path, 6, instr(substr(path, 6), '/') - 1)
          ELSE 'root'
        END as path
      FROM files
      WHERE path NOT LIKE 'node_modules/%'
    `
      )
      .all();

    const layers: string[] = [];
    const packageNames = packages
      .map((p) => p.path)
      .filter((p) => p && p !== "root");

    // Detect common layers
    if (packageNames.includes("db")) layers.push("db");
    if (packageNames.includes("api")) layers.push("api");
    if (packageNames.includes("agent") || packageNames.includes("runtime"))
      layers.push("agent");
    if (packageNames.some((p) => p.includes("web") || p.includes("native")))
      layers.push("app");

    return {
      type: packageNames.length > 1 ? "monorepo" : "single",
      packages: packageNames,
      layers,
      fileCount:
        this.db
          .query<{ count: number }, []>("SELECT COUNT(*) as count FROM files")
          .get()?.count ?? 0,
      definitionCount:
        this.db
          .query<
            { count: number },
            []
          >("SELECT COUNT(*) as count FROM definitions")
          .get()?.count ?? 0,
    };
  }

  // ─────────────────────────────────────────────────────────
  // Low-level Access
  // ─────────────────────────────────────────────────────────

  getFile(path: string): FileIndex | null {
    const file = this.db
      .query<any, [string]>(
        `
      SELECT * FROM files WHERE path = ?
    `
      )
      .get(path);

    if (!file) return null;

    const definitions = this.db
      .query<any, [string]>(
        `
      SELECT * FROM definitions WHERE file_path = ?
    `
      )
      .all(path);

    const imports = this.db
      .query<any, [string]>(
        `
      SELECT * FROM imports WHERE file_path = ?
    `
      )
      .all(path);

    const exports = this.db
      .query<any, [string]>(
        `
      SELECT * FROM exports WHERE file_path = ?
    `
      )
      .all(path);

    return {
      path: file.path,
      language: file.language,
      contentHash: file.content_hash,
      lastModified: file.last_modified,
      summary: file.summary,
      keywords: JSON.parse(file.keywords ?? "[]"),
      definitions: definitions.map(mapDefinition),
      imports: imports.map(mapImport),
      exports: exports.map(mapExport),
    };
  }

  findExports(pattern: string): Export[] {
    return this.db
      .query<any, [string]>(
        `
      SELECT e.*, f.path as file_path
      FROM exports e
      JOIN files f ON e.file_path = f.path
      WHERE e.name LIKE ?
    `
      )
      .all(`%${pattern}%`)
      .map((row) => ({
        ...mapExport(row),
        filePath: row.file_path,
      }));
  }

  getReverseDeps(path: string): string[] {
    return this.db
      .query<{ file_path: string }, [string]>(
        `
      SELECT DISTINCT file_path FROM imports WHERE source LIKE ?
    `
      )
      .all(`%${path.replace(/\.[^.]+$/, "")}%`)
      .map((r) => r.file_path);
  }

  // ─────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────

  private async indexFile(
    path: string,
    content: string,
    hash: string
  ): Promise<void> {
    const parsed = parseFile(path, content);
    const summary = await generateSummary(path, parsed);
    const signatureText = parsed.definitions.map((d) => d.signature).join("\n");

    // Upsert file
    this.db.run(
      `
      INSERT OR REPLACE INTO files (path, language, content_hash, last_modified, summary, keywords, signature_text, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        path,
        parsed.language,
        hash,
        Date.now(),
        summary,
        JSON.stringify(parsed.keywords),
        signatureText,
        Date.now(),
      ]
    );

    // Clear old relations
    this.db.run("DELETE FROM definitions WHERE file_path = ?", [path]);
    this.db.run("DELETE FROM imports WHERE file_path = ?", [path]);
    this.db.run("DELETE FROM exports WHERE file_path = ?", [path]);
    this.db.run("DELETE FROM call_edges WHERE caller_file = ?", [path]);

    // Insert new relations
    for (const def of parsed.definitions) {
      this.db.run(
        `
        INSERT INTO definitions (file_path, name, kind, signature, line, docstring, exported)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        [
          path,
          def.name,
          def.kind,
          def.signature,
          def.line,
          def.docstring ?? null,
          def.exported ? 1 : 0,
        ]
      );
    }

    for (const imp of parsed.imports) {
      this.db.run(
        `
        INSERT INTO imports (file_path, source, specifiers, line)
        VALUES (?, ?, ?, ?)
      `,
        [path, imp.source, JSON.stringify(imp.specifiers), imp.line]
      );
    }

    for (const exp of parsed.exports) {
      this.db.run(
        `
        INSERT INTO exports (file_path, name, kind, line, re_export_source)
        VALUES (?, ?, ?, ?, ?)
      `,
        [path, exp.name, exp.kind, exp.line, exp.reExportSource ?? null]
      );
    }

    // Update BM25 index
    this.bm25.removeDocument(path);
    this.bm25.addDocument(
      path,
      `${path} ${signatureText} ${parsed.keywords.join(" ")} ${summary ?? ""}`
    );
  }

  private removeFile(path: string): void {
    this.db.run("DELETE FROM files WHERE path = ?", [path]);
    this.bm25.removeDocument(path);
  }

  private async loadBM25FromDb(): Promise<void> {
    const files = this.db
      .query<
        {
          path: string;
          signature_text: string;
          keywords: string;
          summary: string;
        },
        []
      >(
        `
      SELECT path, signature_text, keywords, summary FROM files
    `
      )
      .all();

    for (const file of files) {
      const keywords = JSON.parse(file.keywords ?? "[]").join(" ");
      this.bm25.addDocument(
        file.path,
        `${file.path} ${file.signature_text} ${keywords} ${file.summary ?? ""}`
      );
    }
  }

  private async fullIndex(options?: {
    extensions?: string[];
    ignore?: string[];
    onProgress?: (indexed: number, total: number) => void;
  }): Promise<void> {
    // Implementation: walk workspace, filter files, index each
    // ... (uses Bun.glob or similar)
  }
}

// Re-exports
export type {
  FileIndex,
  FileRelevance,
  Definition,
  Export,
  Import,
  ImpactRadius,
  ArchitectureSketch,
  CodeExemplar,
} from "./types.js";
```

---

### Phase 2: Multi-Language Support (Week 3-4)

Add support for Python, Rust, Go, and fallback via tree-sitter.

#### 2.1 Language Abstraction

```typescript
// packages/codeprint/src/parse/index.ts

import type { FileParseResult } from "../types.js";

export interface LanguageParser {
  extensions: string[];
  parse(path: string, content: string): FileParseResult;
}

const parsers: LanguageParser[] = [];

export function registerParser(parser: LanguageParser): void {
  parsers.push(parser);
}

export function getParser(path: string): LanguageParser | null {
  const ext = path.substring(path.lastIndexOf("."));
  return parsers.find((p) => p.extensions.includes(ext)) ?? null;
}

// Register built-in parsers
import { TypeScriptParser } from "./typescript.js";
registerParser(new TypeScriptParser());
```

#### 2.2 Python Parser (tree-sitter)

```typescript
// packages/codeprint/src/parse/python.ts

import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type {
  LanguageParser,
  FileParseResult,
  Definition,
  Import,
  Export,
} from "../types.js";

export class PythonParser implements LanguageParser {
  extensions = [".py", ".pyi"];
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(Python);
  }

  parse(path: string, content: string): FileParseResult {
    const tree = this.parser.parse(content);
    const definitions: Definition[] = [];
    const imports: Import[] = [];
    const exports: Export[] = [];
    const keywords = new Set<string>();

    // Walk tree to extract structure
    this.walk(tree.rootNode, (node) => {
      switch (node.type) {
        case "function_definition":
          definitions.push(this.extractFunction(node, content));
          break;
        case "class_definition":
          definitions.push(this.extractClass(node, content));
          break;
        case "import_statement":
        case "import_from_statement":
          imports.push(this.extractImport(node, content));
          break;
        // Python exports are implicit (no leading _)
      }
    });

    // Infer exports (public names)
    for (const def of definitions) {
      if (!def.name.startsWith("_")) {
        def.exported = true;
        exports.push({ name: def.name, kind: def.kind, line: def.line });
      }
    }

    return {
      language: "python",
      definitions,
      imports,
      exports,
      callEdges: [],
      keywords: Array.from(keywords),
    };
  }

  private extractFunction(node: any, content: string): Definition {
    const nameNode = node.childForFieldName("name");
    const paramsNode = node.childForFieldName("parameters");
    const returnNode = node.childForFieldName("return_type");

    const name = nameNode?.text ?? "anonymous";
    const params = paramsNode?.text ?? "()";
    const returnType = returnNode ? ` -> ${returnNode.text}` : "";
    const decorators = this.extractDecorators(node);
    const docstring = this.extractDocstring(node);

    return {
      name,
      kind: "function",
      signature: `${decorators}def ${name}${params}${returnType}`,
      line: node.startPosition.row + 1,
      docstring,
      exported: false,
    };
  }

  private extractClass(node: any, content: string): Definition {
    const nameNode = node.childForFieldName("name");
    const basesNode = node.childForFieldName("superclasses");

    const name = nameNode?.text ?? "anonymous";
    const bases = basesNode ? `(${basesNode.text})` : "";
    const docstring = this.extractDocstring(node);

    return {
      name,
      kind: "class",
      signature: `class ${name}${bases}`,
      line: node.startPosition.row + 1,
      docstring,
      exported: false,
    };
  }

  // Additional helper methods...
}
```

#### 2.3 Rust Parser (tree-sitter)

```typescript
// packages/codeprint/src/parse/rust.ts

import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import type { LanguageParser, FileParseResult } from "../types.js";

export class RustParser implements LanguageParser {
  extensions = [".rs"];
  // Similar implementation to Python...
}
```

#### 2.4 Go Parser (tree-sitter)

```typescript
// packages/codeprint/src/parse/go.ts

import Parser from "tree-sitter";
import Go from "tree-sitter-go";
import type { LanguageParser, FileParseResult } from "../types.js";

export class GoParser implements LanguageParser {
  extensions = [".go"];
  // Similar implementation...
}
```

---

### Phase 3: Performance Optimization & Rust Port (Week 5-6)

Port hot paths to Rust for maximum performance.

#### 3.1 Rust Core Library

```
packages/codeprint-core/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── parse/
│   │   ├── mod.rs
│   │   ├── typescript.rs    # oxc-parser bindings
│   │   └── treesitter.rs    # tree-sitter wrapper
│   ├── index/
│   │   ├── mod.rs
│   │   ├── bm25.rs          # High-perf BM25
│   │   └── sqlite.rs        # SQLite bindings
│   └── ffi/
│       ├── mod.rs
│       ├── napi.rs          # Node/Bun bindings
│       └── wasm.rs          # WASM bindings
└── build.rs
```

#### 3.2 Rust BM25 Implementation

```rust
// packages/codeprint-core/src/index/bm25.rs

use std::collections::{HashMap, HashSet};
use fxhash::FxHashMap;

pub struct BM25Index {
    documents: FxHashMap<String, Document>,
    inverted_index: FxHashMap<String, HashSet<String>>,
    avg_doc_length: f32,
    k1: f32,
    b: f32,
}

struct Document {
    path: String,
    terms: FxHashMap<String, u32>,
    length: u32,
}

impl BM25Index {
    pub fn new() -> Self {
        Self {
            documents: FxHashMap::default(),
            inverted_index: FxHashMap::default(),
            avg_doc_length: 0.0,
            k1: 1.2,
            b: 0.75,
        }
    }

    pub fn search(&self, query: &str, limit: usize) -> Vec<(String, f32)> {
        let query_terms = tokenize(query);
        let mut scores: FxHashMap<&str, f32> = FxHashMap::default();
        let n = self.documents.len() as f32;

        for term in &query_terms {
            if let Some(matching_docs) = self.inverted_index.get(term) {
                let df = matching_docs.len() as f32;
                let idf = ((n - df + 0.5) / (df + 0.5) + 1.0).ln();

                for path in matching_docs {
                    if let Some(doc) = self.documents.get(path) {
                        let tf = *doc.terms.get(term).unwrap_or(&0) as f32;
                        let doc_len = doc.length as f32;

                        let numerator = tf * (self.k1 + 1.0);
                        let denominator = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / self.avg_doc_length));
                        let term_score = idf * (numerator / denominator);

                        *scores.entry(path.as_str()).or_insert(0.0) += term_score;
                    }
                }
            }
        }

        let mut results: Vec<_> = scores.into_iter().map(|(p, s)| (p.to_string(), s)).collect();
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        results.truncate(limit);
        results
    }
}

fn tokenize(text: &str) -> Vec<String> {
    // Fast tokenization with SIMD where possible
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| s.len() >= 2)
        .map(|s| s.to_string())
        .collect()
}
```

#### 3.3 NAPI Bindings for Bun/Node

```rust
// packages/codeprint-core/src/ffi/napi.rs

use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi]
pub struct CodeprintIndex {
    inner: crate::index::Index,
}

#[napi]
impl CodeprintIndex {
    #[napi(constructor)]
    pub fn new(workspace: String) -> Result<Self> {
        Ok(Self {
            inner: crate::index::Index::open(&workspace)?,
        })
    }

    #[napi]
    pub fn bm25_search(&self, query: String, limit: u32) -> Vec<SearchResult> {
        self.inner.bm25.search(&query, limit as usize)
            .into_iter()
            .map(|(path, score)| SearchResult { path, score })
            .collect()
    }

    #[napi]
    pub fn index_file(&mut self, path: String, content: String) -> Result<()> {
        self.inner.index_file(&path, &content)
    }
}

#[napi(object)]
pub struct SearchResult {
    pub path: String,
    pub score: f32,
}
```

#### 3.4 WASM Build for Browser

```rust
// packages/codeprint-core/src/ffi/wasm.rs

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmCodeprintIndex {
    inner: crate::index::Index,
}

#[wasm_bindgen]
impl WasmCodeprintIndex {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: crate::index::Index::in_memory(),
        }
    }

    #[wasm_bindgen]
    pub fn bm25_search(&self, query: &str, limit: u32) -> JsValue {
        let results = self.inner.bm25.search(query, limit as usize);
        serde_wasm_bindgen::to_value(&results).unwrap()
    }
}
```

---

### Phase 4: Integration with ALFRED Planner (Week 7)

Wire codeprint into the existing planning system.

#### 4.1 Replace gatherCodebaseContext

```typescript
// packages/plan/src/research/codebase.ts

import { CodeprintIndex } from "@alfred/codeprint";
import { logger } from "@alfred/logger";

let indexCache: Map<string, CodeprintIndex> = new Map();

export async function gatherCodebaseContext(options: {
  requirement: string;
  workspace?: string;
  topK?: number;
}): Promise<string[]> {
  const workspace = options.workspace ?? process.cwd();
  const topK = options.topK ?? 10;

  try {
    // Get or create index
    let index = indexCache.get(workspace);
    if (!index) {
      index = await CodeprintIndex.load(workspace);
      indexCache.set(workspace, index);
    }

    // Use two-stage retrieval
    const results = await index.relevantFiles(options.requirement, { topK });

    logger.debug("codeprint_context_gathered", {
      requirement: options.requirement.slice(0, 100),
      resultCount: results.length,
      topScore: results[0]?.score,
    });

    return results.map((r) => r.path);
  } catch (error) {
    logger.error("codeprint_context_failed", {
      error: error instanceof Error ? error.message : String(error),
      requirement: options.requirement,
    });

    // Fallback to legacy approach
    const { gatherCodeContext } =
      await import("@alfred/agent/orchestrator/flow/context");
    const receipt = await gatherCodeContext({
      requirement: options.requirement,
      cw: workspace,
      topK,
      authz: undefined,
    });

    return (receipt.code ?? [])
      .map((item) => item.path)
      .filter((p): p is string => typeof p === "string");
  }
}

/**
 * Get full planner context using codeprint.
 */
export async function getPlannerContext(options: {
  requirement: string;
  workspace?: string;
  topK?: number;
}): Promise<PlannerContext> {
  const workspace = options.workspace ?? process.cwd();
  const topK = options.topK ?? 15;

  const index = await CodeprintIndex.load(workspace);

  const [entryPoints, architecture] = await Promise.all([
    index.relevantFiles(options.requirement, { topK }),
    Promise.resolve(index.architectureSketch()),
  ]);

  // Get exemplars for top files
  const exemplars = await index.findExemplars(options.requirement, 3);

  return {
    entryPoints,
    architecture,
    exemplars,
    impactRadius: (file: string) => index.impactRadius(file),
  };
}

export interface PlannerContext {
  entryPoints: FileRelevance[];
  architecture: ArchitectureSketch;
  exemplars: CodeExemplar[];
  impactRadius: (file: string) => ImpactRadius;
}
```

#### 4.2 File Watcher Integration

```typescript
// packages/codeprint/src/watcher.ts

import { watch } from "fs";
import type { CodeprintIndex } from "./index.js";

export class CodeprintWatcher {
  private index: CodeprintIndex;
  private watcher: ReturnType<typeof watch> | null = null;
  private pendingUpdates: Set<string> = new Set();
  private debounceTimer: Timer | null = null;

  constructor(index: CodeprintIndex) {
    this.index = index;
  }

  start(workspace: string): void {
    this.watcher = watch(workspace, { recursive: true }, (event, filename) => {
      if (!filename) return;
      if (this.shouldIgnore(filename)) return;

      this.pendingUpdates.add(filename);
      this.scheduleUpdate();
    });
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  private shouldIgnore(path: string): boolean {
    return (
      path.includes("node_modules") ||
      path.includes(".git") ||
      path.includes(".codeprint") ||
      path.startsWith(".")
    );
  }

  private scheduleUpdate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      const paths = Array.from(this.pendingUpdates);
      this.pendingUpdates.clear();

      if (paths.length > 0) {
        await this.index.update(paths);
      }
    }, 100);
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// packages/codeprint/test/parse.test.ts

import { describe, test, expect } from "bun:test";
import { parseFile } from "../src/parse/typescript.js";

describe("TypeScript parser", () => {
  test("extracts function signatures", () => {
    const content = `
      export async function fetchUser(id: string): Promise<User> {
        return db.users.get(id);
      }
    `;

    const result = parseFile("test.ts", content);

    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]).toMatchObject({
      name: "fetchUser",
      kind: "function",
      signature: "async function fetchUser(id: string): Promise<User>",
      exported: true,
    });
  });

  test("extracts class signatures with inheritance", () => {
    const content = `
      export class UserService extends BaseService implements IUserService {
        constructor(private db: Database) {
          super();
        }
      }
    `;

    const result = parseFile("test.ts", content);

    expect(result.definitions[0]).toMatchObject({
      name: "UserService",
      kind: "class",
      signature:
        "class UserService extends BaseService implements IUserService",
    });
  });

  test("extracts imports", () => {
    const content = `
      import { Database } from "@alfred/db";
      import type { User } from "./types.js";
    `;

    const result = parseFile("test.ts", content);

    expect(result.imports).toHaveLength(2);
    expect(result.imports[0]).toMatchObject({
      source: "@alfred/db",
      specifiers: ["Database"],
    });
  });
});
```

### Integration Tests

```typescript
// packages/codeprint/test/integration.test.ts

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { CodeprintIndex } from "../src/index.js";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

describe("CodeprintIndex integration", () => {
  let workspace: string;
  let index: CodeprintIndex;

  beforeAll(async () => {
    workspace = await mkdtemp(join(tmpdir(), "codeprint-test-"));

    // Create test files
    await mkdir(join(workspace, "src"));
    await writeFile(
      join(workspace, "src/user.ts"),
      `
      export interface User {
        id: string;
        name: string;
      }
      
      export async function createUser(name: string): Promise<User> {
        return { id: crypto.randomUUID(), name };
      }
      
      export async function getUser(id: string): Promise<User | null> {
        return null;
      }
    `
    );

    await writeFile(
      join(workspace, "src/service.ts"),
      `
      import { User, getUser, createUser } from "./user.js";
      
      export class UserService {
        async findOrCreate(name: string): Promise<User> {
          const existing = await getUser(name);
          return existing ?? await createUser(name);
        }
      }
    `
    );

    index = await CodeprintIndex.index(workspace);
  });

  afterAll(async () => {
    await rm(workspace, { recursive: true });
  });

  test("indexes files correctly", () => {
    const userFile = index.getFile("src/user.ts");

    expect(userFile).not.toBeNull();
    expect(userFile!.definitions).toHaveLength(3); // User, createUser, getUser
    expect(userFile!.exports).toHaveLength(3);
  });

  test("BM25 search finds relevant files", () => {
    const results = index.bm25Search("create user", 10);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe("src/user.ts");
  });

  test("relevantFiles with rerank returns accurate results", async () => {
    const results = await index.relevantFiles("user service creation", {
      topK: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    // Both files should be relevant
    const paths = results.map((r) => r.path);
    expect(paths).toContain("src/user.ts");
    expect(paths).toContain("src/service.ts");
  });

  test("impactRadius identifies dependents", () => {
    const impact = index.impactRadius("src/user.ts");

    expect(impact.directDependents).toContain("src/service.ts");
  });

  test("incremental update works", async () => {
    await writeFile(
      join(workspace, "src/new.ts"),
      `
      export const VERSION = "1.0.0";
    `
    );

    const result = await index.update(["src/new.ts"]);

    expect(result.added).toBe(1);
    expect(index.getFile("src/new.ts")).not.toBeNull();
  });
});
```

### Performance Tests

```typescript
// packages/codeprint/test/perf.test.ts

import { describe, test, expect } from "bun:test";
import { CodeprintIndex } from "../src/index.js";

describe("Performance", () => {
  test("BM25 search completes in < 10ms for 10K files", async () => {
    const index = await CodeprintIndex.load(process.cwd()); // Use ALFRED repo

    const start = performance.now();
    const results = index.bm25Search("rerank workflow api", 200);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
    expect(results.length).toBeGreaterThan(0);
  });

  test("relevantFiles completes in < 150ms with rerank", async () => {
    const index = await CodeprintIndex.load(process.cwd());

    const start = performance.now();
    const results = await index.relevantFiles("add rate limiting to workflow", {
      topK: 15,
    });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(150);
    expect(results.length).toBeGreaterThan(0);
  });
});
```

---

## Progress

| Task                | Status  | Notes                                                        |
| ------------------- | ------- | ------------------------------------------------------------ |
| ExecPlan created    | Done    | 2026-01-24                                                   |
| OXC submodule added | Done    | `vendor/oxc` - v0.110.0                                      |
| OXC API analysis    | Done    | Discovered `ParseResult.module` pre-extracts imports/exports |
| Package scaffold    | Pending |                                                              |
| SQLite schema       | Pending |                                                              |
| TypeScript parser   | Pending | Use OXC Visitor + `module.staticImports/Exports`             |
| BM25 implementation | Pending |                                                              |
| Rerank integration  | Pending | Use @alfred/rerank                                           |
| Two-stage retrieval | Pending |                                                              |
| Public API          | Pending |                                                              |
| Unit tests          | Pending |                                                              |
| Integration tests   | Pending |                                                              |
| Python parser       | Pending | Phase 2                                                      |
| Rust parser         | Pending | Phase 2                                                      |
| Go parser           | Pending | Phase 2                                                      |
| Rust core port      | Pending | Phase 3 - leverage `oxc_semantic`                            |
| NAPI bindings       | Pending | Phase 3                                                      |
| WASM build          | Pending | Phase 3                                                      |
| Planner integration | Pending | Phase 4                                                      |
| File watcher        | Pending | Phase 4                                                      |

---

## Surprises & Discoveries

### 2026-01-24: OXC Pre-Extracts Module Information

**Discovery**: OXC's `ParseResult` includes a `module: EcmaScriptModule` field that already contains:

- `staticImports` - All import statements with source, specifiers, and type info
- `staticExports` - All export statements with names, kinds, and re-export sources
- `dynamicImports` - Dynamic import expressions
- `importMetas` - `import.meta` usage locations

**Impact**: We don't need to walk the AST to extract imports/exports. This is a significant simplification:

- Before: Walk AST → find ImportDeclaration → extract manually
- After: Access `result.module.staticImports` directly

**Estimated savings**: ~50 lines of code, ~2ms per file parsing time

### 2026-01-24: OXC Uses Distinct Identifier Types

**Discovery**: Unlike ESTree's generic `Identifier`, OXC distinguishes:

- `BindingIdentifier` - declarations (`const x`, `function x()`)
- `IdentifierReference` - usage (`console.log(x)`)
- `IdentifierName` - property names (`obj.x`)

**Impact**: More accurate definition vs. reference tracking. When building call graphs, we can easily distinguish "this function defines X" from "this function calls X".

---

## Decision Log

| Date       | Decision                                      | Rationale                                                                |
| ---------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| 2026-01-24 | Use SQLite for persistence                    | Bun has native SQLite, no external deps, FTS5 for full-text search       |
| 2026-01-24 | Start with oxc-parser, not tree-sitter for TS | Already used in decompose-semantic.ts, faster than tree-sitter for JS/TS |
| 2026-01-24 | Two-stage retrieval (BM25 → rerank)           | Industry standard, balances speed and accuracy                           |
| 2026-01-24 | Rerank on signatures, not full content        | 10-20x token reduction, signatures are high-signal                       |
| 2026-01-24 | Fail-open semantics for rerank                | Matches @alfred/rerank design, graceful degradation                      |
| 2026-01-24 | Phase 3 Rust port optional                    | Only if performance targets not met in TypeScript                        |
| 2026-01-24 | Add OXC as vendor submodule                   | Direct access to Rust crates for Phase 3, reference for API design       |
| 2026-01-24 | Use `ParseResult.module` for imports/exports  | OXC pre-extracts these - zero AST walking needed for import graph        |
| 2026-01-24 | Use OXC Visitor pattern                       | Type-safe traversal, generated from AST schema, handles all node types   |
| 2026-01-24 | Leverage oxc_semantic for Phase 3             | Scope chain, symbol table, reference tracking already implemented        |
| 2026-01-24 | Update oxc-parser to 0.110.0                  | Current 0.98.0 is outdated, new version has improved Visitor API         |

---

## Outcomes & Retrospective

_(To be completed after implementation)_

### Metrics Achieved

| Metric                    | Target           | Actual |
| ------------------------- | ---------------- | ------ |
| Context retrieval latency | < 150ms          | TBD    |
| Tokens per request        | < 5K             | TBD    |
| Planner accuracy (top 10) | > 85%            | TBD    |
| Index freshness           | < 1s incremental | TBD    |

### Lessons Learned

_(To be added)_

### Follow-up Work

_(To be added)_
