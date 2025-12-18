/**
 * CRAG-Style Retrieval Evaluator
 *
 * Implements Corrective Retrieval Augmented Generation (CRAG) pattern
 * to assess retrieval quality before LLM consumption.
 *
 * Reference: alfred-memory-review.md - "CRAG-style evaluation improves RAG quality"
 *
 * The evaluator makes three decisions:
 * 1. USE: Results are high quality, use directly
 * 2. REFINE: Results are ambiguous, refine query and retry
 * 3. FALLBACK: Results are poor, use alternative source (web search, etc.)
 *
 * This implementation uses rule-based heuristics initially, with the option
 * to upgrade to ML-based evaluation (T5-small or similar) later.
 */

/**
 * Evaluation action decisions
 */
export type EvaluatorAction = "use" | "refine" | "fallback";

/**
 * Evaluation result with action and reasoning
 */
export type EvaluatorResult = {
  action: EvaluatorAction;
  score: number; // Overall quality score [0, 1]
  reason: string;
  metrics: {
    relevance: number; // Query-document relevance [0, 1]
    coverage: number; // Query term coverage [0, 1]
    coherence: number; // Document coherence [0, 1]
    diversity: number; // Result diversity [0, 1]
  };
  suggestions?: string[]; // Refinement suggestions if action is "refine"
};

/**
 * Document to evaluate
 */
export type EvaluatorDocument = {
  content: string;
  score?: number; // Retrieval score if available
  metadata?: Record<string, unknown>;
};

/**
 * Evaluation thresholds
 */
export type EvaluatorThresholds = {
  /** Minimum score for "use" decision (default: 0.7) */
  useThreshold?: number;
  /** Maximum score for "fallback" decision (default: 0.3) */
  fallbackThreshold?: number;
  /** Minimum coverage for "use" decision (default: 0.5) */
  minCoverage?: number;
  /** Minimum number of relevant documents (default: 1) */
  minRelevantDocs?: number;
};

const DEFAULT_THRESHOLDS: Required<EvaluatorThresholds> = {
  useThreshold: 0.7,
  fallbackThreshold: 0.3,
  minCoverage: 0.5,
  minRelevantDocs: 1,
};

/**
 * Extract important terms from a query.
 * Simple rule-based extraction: nouns, verbs, and technical terms.
 */
function extractQueryTerms(query: string): string[] {
  // Remove common stop words
  const stopWords = new Set([
    "a",
    "an",
    "the",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "can",
    "need",
    "dare",
    "and",
    "or",
    "but",
    "if",
    "then",
    "else",
    "when",
    "where",
    "why",
    "how",
    "what",
    "which",
    "who",
    "whom",
    "this",
    "that",
    "these",
    "those",
    "i",
    "you",
    "he",
    "she",
    "it",
    "we",
    "they",
    "them",
    "my",
    "your",
    "his",
    "her",
    "its",
    "our",
    "their",
    "of",
    "in",
    "on",
    "at",
    "to",
    "for",
    "with",
    "by",
    "from",
    "about",
    "into",
  ]);

  // Tokenize and filter
  const tokens = query
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !stopWords.has(t));

  // Deduplicate
  return [...new Set(tokens)];
}

/**
 * Calculate query term coverage in documents.
 * Returns ratio of query terms found in at least one document.
 */
function calculateCoverage(
  queryTerms: string[],
  documents: EvaluatorDocument[]
): number {
  if (queryTerms.length === 0) {
    return 1; // No terms to cover
  }

  const allContent = documents.map((d) => d.content.toLowerCase()).join(" ");

  let covered = 0;
  for (const term of queryTerms) {
    if (allContent.includes(term)) {
      covered++;
    }
  }

  return covered / queryTerms.length;
}

/**
 * Calculate document coherence.
 * Measures how well documents relate to each other.
 */
function calculateCoherence(documents: EvaluatorDocument[]): number {
  if (documents.length < 2) {
    return 1; // Single document is coherent with itself
  }

  // Simple heuristic: measure term overlap between documents
  const docTerms = documents.map((d) => new Set(extractQueryTerms(d.content)));

  let totalOverlap = 0;
  let pairs = 0;

  for (let i = 0; i < docTerms.length; i++) {
    for (let j = i + 1; j < docTerms.length; j++) {
      const set1 = docTerms[i];
      const set2 = docTerms[j];
      if (!(set1 && set2)) {
        continue;
      }

      const intersection = new Set([...set1].filter((t) => set2.has(t)));
      const union = new Set([...set1, ...set2]);

      if (union.size > 0) {
        totalOverlap += intersection.size / union.size;
        pairs++;
      }
    }
  }

  return pairs > 0 ? totalOverlap / pairs : 1;
}

/**
 * Calculate result diversity.
 * Measures how different the documents are from each other.
 */
function calculateDiversity(documents: EvaluatorDocument[]): number {
  if (documents.length < 2) {
    return 1; // Single document has maximum diversity
  }

  // Measure inverse of coherence (more different = more diverse)
  const coherence = calculateCoherence(documents);

  // Transform: high coherence = low diversity
  // But not too low - we want some relevance
  return 0.5 + (1 - coherence) * 0.5;
}

/**
 * Calculate overall relevance score.
 * Combines individual document scores with coverage.
 */
function calculateRelevance(
  documents: EvaluatorDocument[],
  coverage: number
): number {
  if (documents.length === 0) {
    return 0;
  }

  // Average document scores (if available)
  const scores = documents.map((d) => d.score ?? 0.5);
  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

  // Weight by coverage
  return avgScore * 0.7 + coverage * 0.3;
}

/**
 * Generate query refinement suggestions.
 */
function generateRefinementSuggestions(
  queryTerms: string[],
  documents: EvaluatorDocument[]
): string[] {
  const suggestions: string[] = [];

  // Find terms in documents not in query (potential expansion)
  const docTerms = new Set(
    documents
      .flatMap((d) => extractQueryTerms(d.content))
      .filter((t) => !queryTerms.includes(t))
  );

  const querySet = new Set(queryTerms);
  const relatedTerms = [...docTerms]
    .filter((t) => !querySet.has(t))
    .slice(0, 3);

  if (relatedTerms.length > 0) {
    suggestions.push(`Try adding related terms: ${relatedTerms.join(", ")}`);
  }

  // Suggest specificity changes
  if (queryTerms.length < 3) {
    suggestions.push("Try adding more specific terms to narrow results");
  } else if (queryTerms.length > 6) {
    suggestions.push("Try removing some terms to broaden results");
  }

  // Suggest rephrasing
  suggestions.push("Try rephrasing the query with different keywords");

  return suggestions;
}

/**
 * Evaluate retrieval quality and decide on action.
 *
 * @param query - Original query string
 * @param documents - Retrieved documents to evaluate
 * @param thresholds - Evaluation thresholds
 * @returns Evaluation result with action and metrics
 */
export function evaluateRetrieval(
  query: string,
  documents: EvaluatorDocument[],
  thresholds: EvaluatorThresholds = {}
): EvaluatorResult {
  const config = { ...DEFAULT_THRESHOLDS, ...thresholds };

  // Handle empty results
  if (documents.length === 0) {
    return {
      action: "fallback",
      score: 0,
      reason: "No documents retrieved",
      metrics: {
        relevance: 0,
        coverage: 0,
        coherence: 0,
        diversity: 0,
      },
      suggestions: ["Try a different query", "Expand search scope"],
    };
  }

  // Extract query terms
  const queryTerms = extractQueryTerms(query);

  // Calculate metrics
  const coverage = calculateCoverage(queryTerms, documents);
  const coherence = calculateCoherence(documents);
  const diversity = calculateDiversity(documents);
  const relevance = calculateRelevance(documents, coverage);

  // Calculate overall score
  const score =
    relevance * 0.4 + coverage * 0.3 + coherence * 0.2 + diversity * 0.1;

  // Count high-scoring documents
  const relevantDocs = documents.filter((d) => (d.score ?? 0.5) >= 0.5).length;

  // Determine action
  let action: EvaluatorAction;
  let reason: string;
  let suggestions: string[] | undefined;

  if (
    score >= config.useThreshold &&
    coverage >= config.minCoverage &&
    relevantDocs >= config.minRelevantDocs
  ) {
    action = "use";
    reason = "High quality retrieval results";
  } else if (score <= config.fallbackThreshold || relevantDocs === 0) {
    action = "fallback";
    reason =
      score <= config.fallbackThreshold
        ? "Very low quality results"
        : "No relevant documents found";
    suggestions = [
      "Consider web search as alternative",
      "Try knowledge graph traversal",
    ];
  } else {
    action = "refine";
    reason =
      coverage < config.minCoverage
        ? "Insufficient query term coverage"
        : "Ambiguous results quality";
    suggestions = generateRefinementSuggestions(queryTerms, documents);
  }

  return {
    action,
    score,
    reason,
    metrics: {
      relevance,
      coverage,
      coherence,
      diversity,
    },
    suggestions,
  };
}

/**
 * Quick check if results should trigger fallback.
 * Use this for fast filtering before full evaluation.
 */
export function shouldTriggerFallback(
  documents: EvaluatorDocument[],
  fallbackThreshold: number = DEFAULT_THRESHOLDS.fallbackThreshold
): boolean {
  if (documents.length === 0) {
    return true;
  }

  // Check if average score is below threshold
  const scores = documents.map((d) => d.score ?? 0.5);
  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

  return avgScore < fallbackThreshold;
}

/**
 * Quick check if results are good enough to use directly.
 * Use this for fast filtering before full evaluation.
 */
export function canUseDirectly(
  documents: EvaluatorDocument[],
  useThreshold: number = DEFAULT_THRESHOLDS.useThreshold
): boolean {
  if (documents.length === 0) {
    return false;
  }

  // Check if top result is above threshold
  const topScore = Math.max(...documents.map((d) => d.score ?? 0.5));
  return topScore >= useThreshold;
}

/**
 * Evaluate with ML model (placeholder for future implementation).
 * Currently falls back to rule-based evaluation.
 */
export async function evaluateWithModel(
  query: string,
  documents: EvaluatorDocument[],
  _modelId?: string
): Promise<EvaluatorResult> {
  // TODO: Implement T5-small or similar model for evaluation
  // For now, use rule-based evaluation
  return evaluateRetrieval(query, documents);
}
