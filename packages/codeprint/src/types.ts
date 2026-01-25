// ─────────────────────────────────────────────────────────
// Index Version - Bump when format changes
// ─────────────────────────────────────────────────────────

export const INDEX_VERSION = 2;

export type { BM25Config, BM25Document, BM25Result } from "./bm25.js";

// ─────────────────────────────────────────────────────────
// Symbol Types
// ─────────────────────────────────────────────────────────

export type SymbolKind =
  | "function"
  | "class"
  | "variable"
  | "type"
  | "interface"
  | "enum"
  | "namespace";

export interface Symbol {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly exported: boolean;
  readonly line: number;
}

export interface Reference {
  readonly name: string;
  readonly kind: "call" | "access" | "type";
  readonly line: number;
}

// ─────────────────────────────────────────────────────────
// File Entry Types
// ─────────────────────────────────────────────────────────

export interface FileEntry {
  readonly path: string;
  readonly exports: readonly string[];
  readonly imports: readonly string[];
  readonly keywords: readonly string[];
}

export interface EnrichedEntry extends FileEntry {
  readonly symbols: readonly Symbol[];
  readonly references: readonly Reference[];
  readonly dependencies: readonly string[];
}

// ─────────────────────────────────────────────────────────
// Query Result Types
// ─────────────────────────────────────────────────────────

export type MatchMethod = "keyword" | "rerank" | "symbol" | "dependency";

export interface RelevantFile {
  readonly path: string;
  readonly score: number;
  readonly method: MatchMethod;
}

// ─────────────────────────────────────────────────────────
// Worker Protocol Types
// ─────────────────────────────────────────────────────────

export interface ParseTask {
  readonly id: number;
  readonly workspace: string;
  readonly path: string;
}

export interface ParseResult {
  readonly id: number;
  readonly path: string;
  readonly entry?: EnrichedEntry;
  readonly error?: string;
}

// ─────────────────────────────────────────────────────────
// Index Persistence Types
// ─────────────────────────────────────────────────────────

export interface IndexMetadata {
  readonly version: number;
  readonly createdAt: number;
  readonly fileCount: number;
}

export interface PersistedIndex {
  readonly meta: IndexMetadata;
  readonly entries: readonly [string, EnrichedEntry][];
}

// ─────────────────────────────────────────────────────────
// Pool Types
// ─────────────────────────────────────────────────────────

export interface PoolOptions {
  readonly workers?: number;
  readonly timeout?: number;
}

export interface PoolStats {
  readonly workers: number;
  readonly pending: number;
  readonly processed: number;
  readonly errors: number;
}
