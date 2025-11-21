/**
 * LLM Fact Extraction and Causal Inference
 * Pure functional extraction with no dependencies
 */

import type { Knowledge } from "./hypergraph.js";
import {
  fact,
  insight,
  knowledgeHash,
  nodeFromHash,
  pattern,
  relation,
} from "./hypergraph.js";

// Extraction types
type ExtractedFact = {
  content: string;
  confidence: number;
  source: string;
  entities: string[];
  relations: Array<[string, string, string]>; // [from, relation, to]
};

type CausalLink = {
  cause: string;
  effect: string;
  confidence: number;
  evidence: string[];
};

type ExtractionResult = {
  facts: ExtractedFact[];
  causality: CausalLink[];
  entities: Set<string>;
  contradictions: Array<[string, string]>;
};

// TODO: Replace with proper NER (Named Entity Recognition)
// Consider using compromise.js or calling LLM for entity extraction
// Current regex patterns miss many entity types:
// - Organizations, locations, products
// - Email addresses, URLs, phone numbers
// - Technical terms, acronyms
const ENTITY_PATTERNS = [
  /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g, // Proper nouns
  /\b\d{4}\b/g, // Years
  /\b\d+(?:\.\d+)?%\b/g, // Percentages
  /\$\d+(?:,\d{3})*(?:\.\d{2})?/g, // Money
] as const;

// Causal markers
const CAUSAL_MARKERS = [
  "because",
  "therefore",
  "thus",
  "hence",
  "as a result",
  "due to",
  "owing to",
  "leads to",
  "causes",
  "results in",
] as const;

// Confidence modifiers
const CONFIDENCE_MODIFIERS = {
  certain: 0.95,
  likely: 0.8,
  probable: 0.7,
  possible: 0.5,
  uncertain: 0.3,
  unlikely: 0.2,
} as const;

/**
 * Extract facts from natural language text
 * Zero allocation design - reuses buffers
 */
export const extract = (text: string, source: string): ExtractionResult => {
  const facts: ExtractedFact[] = [];
  const causality: CausalLink[] = [];
  const entities = new Set<string>();
  const contradictions: Array<[string, string]> = [];

  // TODO: Implement proper sentence segmentation
  // Current approach fails on:
  // - Abbreviations (Dr., Inc., etc.)
  // - Decimal numbers (3.14)
  // - URLs and email addresses
  // Consider using natural or compromise.js
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length === 0) continue;

    // Extract entities
    const sentenceEntities: string[] = [];
    for (const pattern of ENTITY_PATTERNS) {
      const matches = trimmed.match(pattern) || [];
      for (const match of matches) {
        entities.add(match);
        sentenceEntities.push(match);
      }
    }

    // Determine confidence
    let confidence = 0.8; // default
    for (const [modifier, conf] of Object.entries(CONFIDENCE_MODIFIERS)) {
      if (trimmed.toLowerCase().includes(modifier)) {
        confidence = conf;
        break;
      }
    }

    // TODO: Implement proper relation extraction
    // Current approach just marks co-occurrence as "related_to"
    // Should:
    // - Use dependency parsing to find actual relationships
    // - Extract typed relations (works_for, located_in, part_of)
    // - Consider verb phrases between entities
    // - Use pre-trained relation extraction models
    const relations: Array<[string, string, string]> = [];
    if (sentenceEntities.length >= 2) {
      for (let i = 0; i < sentenceEntities.length - 1; i++) {
        for (let j = i + 1; j < sentenceEntities.length; j++) {
          relations.push([
            sentenceEntities[i],
            "related_to",
            sentenceEntities[j],
          ]);
        }
      }
    }

    // Check for causal relationships
    const lowerSentence = trimmed.toLowerCase();
    for (const marker of CAUSAL_MARKERS) {
      const markerIndex = lowerSentence.indexOf(marker);
      if (markerIndex !== -1) {
        // TODO: Implement proper causal parsing
        // Current approach is too simplistic:
        // - Doesn't handle complex sentence structures
        // - Misses nested causality
        // - No validation of causal direction
        // Should use dependency parsing or causal inference models
        const cause = trimmed.substring(0, markerIndex).trim();
        const effect = trimmed.substring(markerIndex + marker.length).trim();

        if (cause.length > 0 && effect.length > 0) {
          causality.push({
            cause,
            effect,
            confidence: confidence * 0.9, // Slightly lower for inferred causality
            evidence: [trimmed],
          });
        }
        break;
      }
    }

    // Create fact
    facts.push({
      content: trimmed,
      confidence,
      source,
      entities: sentenceEntities,
      relations,
    });
  }

  // Detect contradictions (simple negation check for MVP)
  for (let i = 0; i < facts.length; i++) {
    for (let j = i + 1; j < facts.length; j++) {
      if (detectContradiction(facts[i].content, facts[j].content)) {
        contradictions.push([facts[i].content, facts[j].content]);
      }
    }
  }

  return { facts, causality, entities, contradictions };
};

/**
 * Convert extraction result to knowledge graph nodes
 */
export type KnowledgeEntry = {
  hash: string;
  data: Knowledge;
};

export const toKnowledge = (result: ExtractionResult): KnowledgeEntry[] => {
  const list: KnowledgeEntry[] = [];
  const seen = new Set<string>();

  const insert = (item: Knowledge) => {
    const hash = knowledgeHash(item);
    if (!seen.has(hash)) {
      seen.add(hash);
      list.push({ hash, data: item });
    }
    return nodeFromHash(hash);
  };

  for (const f of result.facts) {
    insert(fact(f.content, f.confidence, f.source));
  }

  for (const c of result.causality) {
    const causeNode = insert(fact(c.cause, c.confidence, "inferred"));
    const effectNode = insert(fact(c.effect, c.confidence, "inferred"));

    if (causeNode && effectNode) {
      insert(relation(causeNode, effectNode, "causes", c.confidence));
      insert(
        insight(
          [causeNode, effectNode],
          `${c.cause} causes ${c.effect}`,
          c.confidence
        )
      );
    }
  }

  return list;
};

/**
 * TODO: Implement robust contradiction detection
 * Current implementation only checks for simple negation
 * Missing:
 * - Semantic contradictions (hot vs cold)
 * - Numerical contradictions (10% vs 90%)
 * - Temporal contradictions (before vs after)
 * - Logical contradictions (all vs none)
 * Consider using textual entailment models
 */
const detectContradiction = (s1: string, s2: string): boolean => {
  const negations = ["not", "no", "never", "none", "neither"];
  const s1Lower = s1.toLowerCase();
  const s2Lower = s2.toLowerCase();

  // Check if one contains negation of key terms in the other
  for (const negation of negations) {
    if (s1Lower.includes(negation) && !s2Lower.includes(negation)) {
      // Extract key terms from s2 and check if negated in s1
      const s2Terms = s2Lower.split(/\s+/);
      for (const term of s2Terms) {
        if (term.length > 3 && s1Lower.includes(negation + " " + term)) {
          return true;
        }
      }
    }
    if (s2Lower.includes(negation) && !s1Lower.includes(negation)) {
      // Extract key terms from s1 and check if negated in s2
      const s1Terms = s1Lower.split(/\s+/);
      for (const term of s1Terms) {
        if (term.length > 3 && s2Lower.includes(negation + " " + term)) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Infer patterns from multiple examples
 */
export const inferPattern = (
  examples: string[],
  minSupport = 0.7
): Knowledge | null => {
  if (examples.length < 3) return null;

  // TODO: Implement proper pattern mining
  // Current approach just finds common tokens
  // Should:
  // - Use sequence pattern mining (PrefixSpan, GSP)
  // - Extract structural patterns (syntax trees)
  // - Learn regular expressions from examples
  // - Apply template induction
  const tokenCounts = new Map<string, number>();
  let totalExamples = 0;

  for (const example of examples) {
    const tokens = new Set(example.toLowerCase().split(/\s+/));
    totalExamples++;
    for (const token of tokens) {
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
    }
  }

  // Find tokens that appear in most examples
  const commonTokens: string[] = [];
  for (const [token, count] of tokenCounts.entries()) {
    const support = count / totalExamples;
    if (support >= minSupport && token.length > 2) {
      commonTokens.push(token);
    }
  }

  if (commonTokens.length === 0) return null;

  // Generate pattern rule
  const rule = `Common pattern: ${commonTokens.join(", ")}`;
  const accuracy = commonTokens.length / Math.max(tokenCounts.size, 1);

  return pattern([], rule, accuracy);
};

/**
 * Extract temporal facts (dates, durations, sequences)
 */
export const extractTemporal = (
  text: string
): Array<{ time: Date; fact: string }> => {
  const temporal: Array<{ time: Date; fact: string }> = [];

  // TODO: Use proper date/time parsing library (chrono-node, date-fns)
  // Current patterns miss:
  // - Relative dates (yesterday, next week, 3 days ago)
  // - Time expressions (3pm, 14:30, noon)
  // - Date ranges (Jan 1-5, Q3 2023)
  // - Informal dates (last summer, early 2020s)
  // - Different locales and formats
  const datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
    /(\d{4}-\d{2}-\d{2})/g,
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
  ];

  for (const pattern of datePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      try {
        const date = new Date(match[0]);
        if (!isNaN(date.getTime())) {
          // Find sentence containing this date
          const sentences = text.split(/[.!?]+/);
          for (const sentence of sentences) {
            if (sentence.includes(match[0])) {
              temporal.push({ time: date, fact: sentence.trim() });
              break;
            }
          }
        }
      } catch {
        // Invalid date, skip
      }
    }
  }

  return temporal;
};

/**
 * Extract knowledge from Codex reasoning traces
 * Focuses on decision rationale, alternatives, and causal chains
 */
export const extractReasoning = (
  text: string,
  context: {
    threadId?: string;
    turnId?: string;
    source?: string;
  }
): ExtractionResult => {
  const result = extract(text, context.source ?? "codex-reasoning");

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  const DECISION_MARKERS = [
    "considering",
    "choosing",
    "selecting",
    "opting for",
    "decided to",
    "will",
  ] as const;

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const marker of DECISION_MARKERS) {
      if (lower.includes(marker)) {
        result.facts.push({
          content: sentence.trim(),
          confidence: 0.85,
          source: "decision-reasoning",
          entities: [],
          relations: [],
        });
        break;
      }
    }
  }

  const ALTERNATIVE_MARKERS = [
    "however",
    "alternatively",
    "instead",
    "but",
    "though",
  ] as const;

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const marker of ALTERNATIVE_MARKERS) {
      if (lower.includes(marker)) {
        result.facts.push({
          content: sentence.trim(),
          confidence: 0.75,
          source: "alternative-reasoning",
          entities: [],
          relations: [],
        });
        break;
      }
    }
  }

  return result;
};

/**
 * Enrich knowledge entries with reasoning context metadata
 */
export const enrichReasoningContext = (
  entries: KnowledgeEntry[],
  context: {
    threadId?: string;
    turnId?: string;
    sessionId?: string;
    timestamp: number;
  }
): KnowledgeEntry[] => {
  return entries.map((entry) => {
    if (entry.data._ === "fact") {
      return {
        ...entry,
        data: {
          ...entry.data,
          source: `${entry.data.source}:${context.threadId ?? "unknown"}`,
        },
      };
    }
    return entry;
  });
};
