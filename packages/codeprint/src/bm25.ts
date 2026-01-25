export interface BM25Config {
  readonly k1: number;
  readonly b: number;
}

export interface BM25Document {
  readonly path: string;
  readonly terms: ReadonlyMap<string, number>;
  readonly length: number;
}

export interface BM25Result {
  readonly path: string;
  readonly score: number;
  readonly matchedTerms: readonly string[];
}

export class BM25Index {
  private readonly documents = new Map<string, BM25Document>();
  private readonly invertedIndex = new Map<string, Set<string>>();
  private readonly docFrequency = new Map<string, number>();
  private totalDocLength = 0;
  private avgDocLength = 0;
  private readonly config: BM25Config;

  constructor(config: Partial<BM25Config> = {}) {
    this.config = {
      b: config.b ?? 0.75,
      k1: config.k1 ?? 1.2,
    };
  }

  addDocument(path: string, text: string): void {
    this.addDocumentTokens(path, tokenize(text));
  }

  addDocumentTokens(path: string, tokens: readonly string[]): void {
    const existing = this.documents.get(path);
    if (existing) {
      this.removeDocument(path);
    }

    const termFreq = new Map<string, number>();
    let length = 0;

    for (const raw of tokens) {
      const term = raw.toLowerCase();
      if (term.length < 2) {
        continue;
      }
      length++;
      termFreq.set(term, (termFreq.get(term) ?? 0) + 1);
    }

    for (const term of termFreq.keys()) {
      let docs = this.invertedIndex.get(term);
      if (!docs) {
        docs = new Set<string>();
        this.invertedIndex.set(term, docs);
      }
      docs.add(path);
      this.docFrequency.set(term, (this.docFrequency.get(term) ?? 0) + 1);
    }

    this.documents.set(path, { length, path, terms: termFreq });
    this.totalDocLength += length;
    this.updateAvgDocLength();
  }

  removeDocument(path: string): void {
    const doc = this.documents.get(path);
    if (!doc) {
      return;
    }

    for (const term of doc.terms.keys()) {
      const docs = this.invertedIndex.get(term);
      if (docs) {
        docs.delete(path);
        if (docs.size === 0) {
          this.invertedIndex.delete(term);
        }
      }

      const df = this.docFrequency.get(term) ?? 0;
      if (df <= 1) {
        this.docFrequency.delete(term);
      } else {
        this.docFrequency.set(term, df - 1);
      }
    }

    this.documents.delete(path);
    this.totalDocLength -= doc.length;
    this.updateAvgDocLength();
  }

  search(query: string, limit: number): BM25Result[] {
    if (limit <= 0) {
      return [];
    }

    const queryTerms = dedupe(tokenize(query));
    if (queryTerms.length === 0) {
      return [];
    }

    const candidates = new Set<string>();
    for (const term of queryTerms) {
      const docs = this.invertedIndex.get(term);
      if (!docs) {
        continue;
      }
      for (const path of docs) {
        candidates.add(path);
      }
    }

    if (candidates.size === 0) {
      return [];
    }

    const N = this.documents.size;
    const avg = this.avgDocLength > 0 ? this.avgDocLength : 1;
    const results: BM25Result[] = [];

    for (const path of candidates) {
      const doc = this.documents.get(path);
      if (!doc) {
        continue;
      }

      let score = 0;
      const matchedTerms: string[] = [];

      for (const term of queryTerms) {
        const tf = doc.terms.get(term) ?? 0;
        if (tf === 0) {
          continue;
        }

        matchedTerms.push(term);

        const df = this.docFrequency.get(term) ?? 0;
        const idf = Math.log1p((N - df + 0.5) / (df + 0.5));
        const numerator = tf * (this.config.k1 + 1);
        const denominator =
          tf +
          this.config.k1 *
            (1 - this.config.b + this.config.b * (doc.length / avg));

        score += idf * (numerator / denominator);
      }

      if (score > 0) {
        results.push({ matchedTerms, path, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  hasTerm(term: string): boolean {
    return (this.docFrequency.get(term) ?? 0) > 0;
  }

  get size(): number {
    return this.documents.size;
  }

  get vocabularySize(): number {
    return this.invertedIndex.size;
  }

  private updateAvgDocLength(): void {
    if (this.documents.size === 0) {
      this.avgDocLength = 0;
      return;
    }
    this.avgDocLength = this.totalDocLength / this.documents.size;
  }
}

function dedupe(tokens: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    if (seen.has(t)) {
      continue;
    }
    seen.add(t);
    out.push(t);
  }
  return out;
}

function tokenize(text: string): string[] {
  return text
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}
