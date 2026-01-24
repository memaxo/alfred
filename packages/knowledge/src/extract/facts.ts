import nlp from "compromise";

import type { Knowledge } from "../hypergraph.js";
import type {
  EntityKind,
  EntityMention,
  ExtractedFact,
  ExtractionResult,
  SentenceJson,
  TextView,
} from "./types.js";

import { fact, knowledgeHash, nodeFromHash, relation } from "../hypergraph.js";
import { applyTopicBoost, detectTopics } from "../lexicon/domains.js";
import { cacheExtraction, getCachedExtraction } from "./cache.js";
import { detectContradiction } from "./contradictions.js";
import {
  canonicalize,
  clampConfidence,
  extractEntities,
  isStopword,
} from "./entities.js";
import { extractRelations } from "./relations.js";
import { extractTemporal } from "./temporal.js";
import { asTextView } from "./types.js";

/**
 * Extract facts from natural language text.
 * Zero allocation design - reuses buffers.
 *
 * PURE, SYNCHRONOUS, FAST.
 * Removed: Async dependency on Vector Classifier.
 * Removed: Regex Taxonomy dependency.
 */

export type KnowledgeEntry = {
  hash: string;
  data: Knowledge;
};

const computeSentenceConfidence = (sentenceDoc: TextView): number => {
  let confidence = 0.8;

  if (sentenceDoc.has("#Modal")) {
    confidence -= 0.15;
  }

  if (sentenceDoc.questions().out("array").length > 0) {
    confidence -= 0.1;
  }

  if (sentenceDoc.has("#Negative")) {
    confidence -= 0.05;
  }

  const adverbCount = sentenceDoc.match("#Adverb").out("array").length;
  if (adverbCount > 2) {
    confidence -= 0.05;
  }

  const numberCount = sentenceDoc.numbers().out("array").length;
  if (numberCount > 0) {
    confidence += 0.05;
  }

  const quoteCount = sentenceDoc.text().split('"').length - 1;
  if (quoteCount > 0) {
    confidence += 0.02;
  }

  return clampConfidence(confidence);
};

export const extract = (text: string, source: string): ExtractionResult => {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return {
      facts: [],
      entities: new Set(),
      entityDetails: [],
      relations: [],
      contradictions: [],
      temporal: [],
      topics: [],
      hasCodeBlock: false,
      primaryDomain: null,
    };
  }

  // Check cache first
  const cached = getCachedExtraction(trimmed);
  if (cached) {
    // Update source for cached results
    return {
      ...cached,
      facts: cached.facts.map((f) => ({ ...f, source })),
    };
  }

  // Detect topics early for confidence boosting
  const topicResult = detectTopics(trimmed);

  const entityDetails = extractEntities(trimmed);
  const relations = extractRelations(trimmed, entityDetails);
  const entitySet = new Set(entityDetails.map((entity) => entity.label));
  const temporal = extractTemporal(trimmed);

  const doc = asTextView(nlp(trimmed));
  const sentences = (doc.sentences().json() as SentenceJson[]) ?? [];
  const facts: ExtractedFact[] = [];

  sentences.forEach((sentence, index) => {
    const content = sentence.text?.trim() ?? "";
    if (!content) {
      return;
    }
    const sentenceDoc = asTextView(nlp(sentence.text ?? ""));
    const sentenceEntities = entityDetails
      .filter((entity) =>
        entity.mentions.some(
          (mention: EntityMention) => mention.sentence === index
        )
      )
      .map((entity) => entity.label);
    const sentenceRelations = relations.filter(
      (relation) => relation.sentence === index
    );

    // Apply domain-based confidence boosting
    const baseConfidence = computeSentenceConfidence(sentenceDoc);
    const boostedConfidence = applyTopicBoost(baseConfidence, topicResult);

    facts.push({
      content,
      confidence: boostedConfidence,
      source,
      entities: [...new Set(sentenceEntities)],
      relations: sentenceRelations,
    });
  });

  const contradictions: Array<{
    pair: [string, string];
    reason: "negation" | "antonym" | "numeric";
    focus?: string;
    confidence: number;
  }> = [];
  const seen = new Set<string>();
  for (let i = 0; i < facts.length; i++) {
    for (let j = i + 1; j < facts.length; j++) {
      const factA = facts[i];
      const factB = facts[j];
      if (!(factA && factB)) {
        continue;
      }
      const key = [factA.content, factB.content].sort().join("::");
      if (seen.has(key)) {
        continue;
      }
      const contradiction = detectContradiction(factA.content, factB.content);
      if (contradiction) {
        seen.add(key);
        contradictions.push(contradiction);
      }
    }
  }

  const result: ExtractionResult = {
    facts,
    entities: entitySet,
    entityDetails,
    relations,
    contradictions,
    temporal,
    topics: topicResult.topics,
    hasCodeBlock: topicResult.hasCodeBlock,
    primaryDomain: topicResult.primaryDomain,
  };

  // Cache result
  cacheExtraction(trimmed, result);

  return result;
};

/**
 * Convert extraction result to knowledge graph nodes.
 */
export const toKnowledge = (result: ExtractionResult): KnowledgeEntry[] => {
  const list: KnowledgeEntry[] = [];
  const seen = new Set<string>();
  const entityNodes = new Map<string, ReturnType<typeof nodeFromHash>>();
  const entitySources = new Map<string, string>();
  const defaultSource = result.facts[0]?.source ?? "extraction";

  for (const fact of result.facts) {
    for (const label of fact.entities) {
      if (!entitySources.has(label)) {
        entitySources.set(label, fact.source);
      }
    }
  }

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

  const ensureEntityNode = (
    label: string,
    kind: EntityKind,
    confidence: number,
    sourceHint?: string
  ): ReturnType<typeof nodeFromHash> | null => {
    if (!label || label.length < 2) {
      return null;
    }
    const lower = label.toLowerCase();
    if (isStopword(lower)) {
      return null;
    }
    const key = canonicalize(label);
    const existing = entityNodes.get(key);
    if (existing) {
      return existing;
    }
    const source = `${sourceHint ?? entitySources.get(label) ?? defaultSource}:entity`;
    const node = insert(
      fact(`[entity:${kind}] ${label}`, clampConfidence(confidence), source)
    );
    entityNodes.set(key, node);
    return node;
  };

  const resolveEntityNode = (
    label: string
  ): ReturnType<typeof nodeFromHash> | null => {
    const key = canonicalize(label);
    const direct = entityNodes.get(key);
    if (direct) {
      return direct;
    }
    return null;
  };

  for (const entity of result.entityDetails ?? []) {
    if (entity.isPronoun) {
      continue;
    }
    ensureEntityNode(
      entity.label,
      entity.kind,
      entity.confidence,
      entitySources.get(entity.label)
    );
  }

  for (const rel of result.relations ?? []) {
    const fromNode =
      resolveEntityNode(rel.source) ??
      ensureEntityNode(rel.source, "unknown", rel.confidence, defaultSource);
    const toNode =
      resolveEntityNode(rel.target) ??
      ensureEntityNode(rel.target, "unknown", rel.confidence, defaultSource);

    if (!(fromNode && toNode)) {
      continue;
    }

    insert(
      relation(fromNode, toNode, rel.relation, clampConfidence(rel.confidence))
    );
  }

  return list;
};
