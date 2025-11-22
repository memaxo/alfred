import * as chrono from "chrono-node";
import nlp from "compromise";
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
  relations: [string, string, string][]; // [from, relation, to]
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
  contradictions: [string, string][];
};

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
 * 
 * PURE, SYNCHRONOUS, FAST.
 * Removed: Async dependency on Vector Classifier.
 * Removed: Regex Taxonomy dependency.
 */
export const extract = (
  text: string,
  source: string
): ExtractionResult => {
  const facts: ExtractedFact[] = [];
  const causality: CausalLink[] = [];
  const entities = new Set<string>();
  const contradictions: [string, string][] = [];

  const doc = nlp(text);
  const sentences = doc.sentences().out("array");

  for (const sentence of sentences) {
    const sDoc = nlp(sentence);
    const trimmed = sentence.trim();
    if (trimmed.length === 0) {
      continue;
    }

    // Extract entities using compromise
    const sentenceEntities: string[] = [];
    const people = sDoc.people().out("array");
    const places = sDoc.places().out("array");
    const orgs = sDoc.organizations().out("array");
    const topicEntities = sDoc.topics().out("array"); // Fallback for other proper nouns
    const nouns = sDoc.nouns().out("array"); // Catch-all for capitalized terms

    const allEntities = [
      ...new Set([...people, ...places, ...orgs, ...topicEntities, ...nouns]),
    ];

    for (const entity of allEntities) {
      // Simple heuristic: only keep entities that look like proper nouns (capitalized)
      // unless they were explicitly detected as people/places/orgs
      const isExplicit =
        people.includes(entity) ||
        places.includes(entity) ||
        orgs.includes(entity);
      const isCapitalized = /^[A-Z]/.test(entity);

      if (isExplicit || isCapitalized) {
        // Strip trailing punctuation (.,!?)
        const cleanEntity = entity.replace(/[.,!?]+$/, "");
        if (cleanEntity.length > 0) {
          entities.add(cleanEntity);
          sentenceEntities.push(cleanEntity);
        }
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

    // Extract relations
    // Simple heuristic: if we have Subject + Verb + Object structure
    // compromise allows finding this somewhat
    const relations: [string, string, string][] = [];

    // 1. Pairwise co-occurrence (fallback)
    if (sentenceEntities.length >= 2) {
      for (let i = 0; i < sentenceEntities.length - 1; i++) {
        for (let j = i + 1; j < sentenceEntities.length; j++) {
          const e1 = sentenceEntities[i];
          const e2 = sentenceEntities[j];
          if (e1 && e2) {
            relations.push([e1, "related_to", e2]);
          }
        }
      }
    }

    // 2. Verb-based extraction (Subject -> Verb -> Object)
    // This is a simplification; improving it requires a full dependency parser
    // or a dedicated relation extraction model.
    // We can use compromise's .verbs() to get the action.
    const verbs = sDoc.verbs().out("array");
    if (verbs.length > 0 && sentenceEntities.length >= 2) {
      // Try to find entities before and after the main verb
      const mainVerb = verbs[0];
      // Check if mainVerb is defined before splitting
      if (mainVerb) {
        const parts = sentence.split(mainVerb);
        if (parts.length === 2) {
          const before = parts[0];
          const after = parts[1];

          // Add null checks for before/after
          if (before && after) {
            const subject = sentenceEntities.find((e) => before.includes(e));
            const object = sentenceEntities.find((e) => after.includes(e));

            if (subject && object) {
              // More specific relation found
              relations.push([subject, mainVerb, object]);
            }
          }
        }
      }
    }

    // Check for causal relationships
    const lowerSentence = trimmed.toLowerCase();
    for (const marker of CAUSAL_MARKERS) {
      const markerIndex = lowerSentence.indexOf(marker);
      if (markerIndex !== -1) {
        // Simple split on marker
        const cause = trimmed
          .substring(0, markerIndex)
          .trim()
          .replace(/[.,!?]+$/, "");
        const effect = trimmed
          .substring(markerIndex + marker.length)
          .trim()
          .replace(/[.,!?]+$/, "");

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

  // Detect contradictions (using compromise for negation check)
  for (let i = 0; i < facts.length; i++) {
    for (let j = i + 1; j < facts.length; j++) {
      // Add non-null assertions or checks for facts[i] and facts[j]
      const factI = facts[i];
      const factJ = facts[j];
      if (factI && factJ && detectContradiction(factI.content, factJ.content)) {
        contradictions.push([factI.content, factJ.content]);
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
    return nodeFromHash(hash); // Returns NodeId which is a string
  };

  // Collect all entities to tag properties (simple domain detection logic placeholder)
  // In future, we can use graph feedback to tag these nodes with domains
  // const allEntities = Array.from(result.entities);

  for (const f of result.facts) {
    // Enriched fact with entities as metadata/properties?
    // Currently Hypergraph 'Fact' is pure content string.
    // We rely on Relation nodes to link them.
    insert(fact(f.content, f.confidence, f.source));
  }

  for (const c of result.causality) {
    const causeNode = insert(
      fact(c.cause, c.confidence, "inferred")
    );
    const effectNode = insert(
      fact(c.effect, c.confidence, "inferred")
    );

    if (causeNode && effectNode) {
      insert(
        relation(causeNode, effectNode, "causes", c.confidence)
      );
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
  const doc1 = nlp(s1);
  const doc2 = nlp(s2);

  // Check for explicit negation in one but not the other
  const hasNegation1 = doc1.has("#Negative");
  const hasNegation2 = doc2.has("#Negative");

  if (hasNegation1 === hasNegation2) {
    return false;
  }

  // Normalize to compare core content
  // This is basic; essentially "I like pizza" vs "I do not like pizza"
  // We strip the negative and compare
  // compromise allows toggling negation

  if (hasNegation1) {
    // remove negation from s1 and see if it roughly matches s2
    // This is tricky to do reliably without changing meaning,
    // but we can try to match verbs/nouns
    const verbs1 = doc1.verbs().toPositive().out("array");
    const verbs2 = doc2.verbs().out("array");

    // If main verbs match after removing negation
    const intersection = verbs1.filter((v: string) => verbs2.includes(v));
    if (intersection.length > 0) {
      // Check if subjects/objects overlap significantly
      const nouns1 = doc1.nouns().out("array");
      const nouns2 = doc2.nouns().out("array");
      const nounIntersection = nouns1.filter((n: string) => nouns2.includes(n));
      if (nounIntersection.length >= 2) {
        return true; // Subject + Object match
      }
    }
  }

  if (hasNegation2) {
    const verbs1 = doc1.verbs().out("array");
    const verbs2 = doc2.verbs().toPositive().out("array");

    const intersection = verbs1.filter((v: string) => verbs2.includes(v));
    if (intersection.length > 0) {
      const nouns1 = doc1.nouns().out("array");
      const nouns2 = doc2.nouns().out("array");
      const nounIntersection = nouns1.filter((n: string) => nouns2.includes(n));
      if (nounIntersection.length >= 2) {
        return true;
      }
    }
  }

  // Fallback to simple keyword negation check if structure fails
  const negations = ["not", "no", "never", "none", "neither"];
  const s1Lower = s1.toLowerCase();
  const s2Lower = s2.toLowerCase();

  for (const negation of negations) {
    if (s1Lower.includes(negation) && !s2Lower.includes(negation)) {
      const s2Terms = s2Lower.split(/\s+/);
      for (const term of s2Terms) {
        if (term.length > 3 && s1Lower.includes(`${negation} ${term}`)) {
          return true;
        }
      }
    }
    if (s2Lower.includes(negation) && !s1Lower.includes(negation)) {
      const s1Terms = s1Lower.split(/\s+/);
      for (const term of s1Terms) {
        if (term.length > 3 && s2Lower.includes(`${negation} ${term}`)) {
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
  if (examples.length < 3) {
    return null;
  }

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

  if (commonTokens.length === 0) {
    return null;
  }

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

  // Use chrono-node for parsing
  const parsed = chrono.parse(text);

  for (const result of parsed) {
    const date = result.start.date();
    const textMatch = result.text;

    // Find context (sentence)
    // Simple heuristic: expand around the match until punctuation
    const index = result.index;
    let start = index;
    while (start > 0 && !/[.!?]/.test(text[start - 1] || "")) {
      start--;
    }
    let end = index + textMatch.length;
    while (end < text.length && !/[.!?]/.test(text[end] || "")) {
      end++;
    }

    const sentence = text.substring(start, end + 1).trim();
    temporal.push({ time: date, fact: sentence });
  }

  // Fallback to regex if chrono misses (though chrono is quite good)
  // Keeping existing regex logic as backup or for specific formats not covered
  if (temporal.length === 0) {
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
      /(\d{4}-\d{2}-\d{2})/g,
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
    ];

    for (const pattern of datePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        try {
          // Avoid duplicates if chrono already found it (heuristic check)
          // But here we are in the fallback block
          const date = new Date(match[0]);
          if (!Number.isNaN(date.getTime())) {
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
): KnowledgeEntry[] =>
  entries.map((entry) => {
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
