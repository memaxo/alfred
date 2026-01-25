import type { EnrichedEntry } from "./types.js";

export function buildSearchText(path: string, entry: EnrichedEntry): string {
  return buildSearchTokens(path, entry).join(" ");
}

/**
 * Build tokens for BM25 indexing.
 * Weight different fields by repetition:
 * - Exported symbols: 3x (functions/classes), 2x (other)
 * - Path segments: 2x
 * - Exports: 2x
 * - Dependencies: 1x
 */
export function buildSearchTokens(
  path: string,
  entry: EnrichedEntry
): string[] {
  const tokens: string[] = [];

  // Path segments (2x)
  for (const segment of path.split("/")) {
    const base = segment.replace(/\.[^.]+$/, "");
    pushWeighted(tokens, base, 2);
  }

  // Exported symbols (functions/classes: 3x, others: 2x)
  for (const symbol of entry.symbols) {
    if (!symbol.exported) {
      continue;
    }
    const weight =
      symbol.kind === "function" || symbol.kind === "class" ? 3 : 2;
    pushWeighted(tokens, symbol.name, weight);
  }

  // Exports (2x)
  for (const exp of entry.exports) {
    pushWeighted(tokens, exp, 2);
  }

  // Dependencies (1x)
  for (const dep of entry.dependencies) {
    const name = dep.replace(/^@[^/]+\//, "");
    pushWeighted(tokens, name, 1);
  }

  // Imports (1x) - module basename
  for (const imp of entry.imports) {
    const base =
      imp
        .split("/")
        .pop()
        ?.replace(/\.[^.]+$/, "") ?? "";
    if (base.length > 0) {
      pushWeighted(tokens, base, 1);
    }
  }

  // Internal symbols (1x) - skip variables to avoid noise
  const internalSymbols = entry.symbols
    .filter((s) => !s.exported && s.kind !== "variable")
    .map((s) => s.name);
  for (const sym of pickLongest(internalSymbols, 40)) {
    pushWeighted(tokens, sym, 1);
  }

  // References (1x) - keep the most specific names to avoid bloating docs
  for (const ref of pickLongest(
    entry.references.map((r) => r.name),
    50
  )) {
    pushWeighted(tokens, ref, 1);
  }

  return tokens;
}

function pickLongest(values: readonly string[], limit: number): string[] {
  const unique = new Set(values);
  return [...unique].sort((a, b) => b.length - a.length).slice(0, limit);
}

function pushWeighted(out: string[], text: string, weight: number): void {
  if (weight <= 0 || text.length === 0) {
    return;
  }

  const parts = tokenize(text);
  if (parts.length === 0) {
    return;
  }

  for (let i = 0; i < weight; i++) {
    for (const p of parts) {
      out.push(p);
    }
  }
}

function tokenize(text: string): string[] {
  const out = new Set<string>();

  for (const raw of text.split(/[^A-Za-z0-9]+/)) {
    const term = raw.toLowerCase();
    if (term.length >= 2) {
      out.add(term);
    }
  }

  for (const term of text
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2)) {
    out.add(term);
  }

  return [...out];
}
