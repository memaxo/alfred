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

type ChronoResult = ReturnType<typeof chrono.parse>[number];

export type EntityKind = "person" | "place" | "organization" | "unknown";

export type EntityMention = {
  text: string;
  sentence: number;
  start: number;
  end: number;
};

export type Entity = {
  label: string;
  canonical: string;
  kind: EntityKind;
  confidence: number;
  mentions: EntityMention[];
  isPronoun?: boolean;
};

export type RelationTriple = {
  source: string;
  relation: string;
  target: string;
  sentence: number;
  evidence: string;
  confidence: number;
};

export type Contradiction = {
  pair: [string, string];
  reason: "negation" | "antonym" | "numeric";
  focus?: string;
  confidence: number;
};

export type TemporalPrecision = "year" | "month" | "day" | "time";

export type TemporalExpression = {
  raw: string;
  type: "instant" | "range" | "recurring";
  normalized: {
    start?: string;
    end?: string;
  };
  context: string;
  precision?: TemporalPrecision;
  recurrence?: string;
  confidence: number;
};

type ExtractedFact = {
  content: string;
  confidence: number;
  source: string;
  entities: string[];
  relations: RelationTriple[];
};

export type ExtractionResult = {
  facts: ExtractedFact[];
  entities: Set<string>;
  entityDetails: Entity[];
  relations: RelationTriple[];
  contradictions: Contradiction[];
  temporal: TemporalExpression[];
};

const PERSON_TITLES = [
  "mr",
  "mrs",
  "ms",
  "dr",
  "professor",
  "president",
  "sir",
  "madam",
];

const ORG_KEYWORDS = [
  "inc",
  "corp",
  "labs",
  "university",
  "college",
  "group",
  "team",
  "company",
  "committee",
  "department",
  "agency",
  "association",
  "foundation",
  "studio",
];

const ANTONYM_PAIRS: Array<[string, string]> = [
  ["allow", "forbid"],
  ["accept", "reject"],
  ["add", "remove"],
  ["agree", "disagree"],
  ["approve", "deny"],
  ["arrive", "leave"],
  ["asleep", "awake"],
  ["attack", "defend"],
  ["begin", "end"],
  ["buy", "sell"],
  ["cold", "hot"],
  ["create", "destroy"],
  ["dark", "bright"],
  ["decrease", "increase"],
  ["deficit", "surplus"],
  ["expand", "shrink"],
  ["fail", "succeed"],
  ["fast", "slow"],
  ["gain", "lose"],
  ["give", "take"],
  ["hire", "fire"],
  ["include", "exclude"],
  ["legal", "illegal"],
  ["light", "heavy"],
  ["open", "closed"],
  ["optimistic", "pessimistic"],
  ["pass", "fail"],
  ["positive", "negative"],
  ["raise", "lower"],
  ["safe", "dangerous"],
  ["strong", "weak"],
  ["support", "oppose"],
  ["win", "lose"],
];

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

const RECURRENCE_REGEX =
  /\bevery\s+(?<interval>(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend|week|month|quarter|year)(?:\s+(?:morning|afternoon|evening))?)/gi;

const PLACE_TAGS = new Set([
  "Place",
  "City",
  "Country",
  "Region",
  "Address",
  "Continent",
]);

const ORG_TAGS = new Set(["Organization", "Company", "Corporation"]);

const antonymMap = new Map<string, Set<string>>();
for (const [a, b] of ANTONYM_PAIRS) {
  if (!antonymMap.has(a)) {
    antonymMap.set(a, new Set());
  }
  if (!antonymMap.has(b)) {
    antonymMap.set(b, new Set());
  }
  antonymMap.get(a)!.add(b);
  antonymMap.get(b)!.add(a);
}

const clampConfidence = (value: number): number =>
  Math.min(0.98, Math.max(0.2, Number(value.toFixed(2))));

const cleanText = (value: string): string =>
  value.replace(/\s+/g, " ").replace(/[^\w\s'-]/g, "").trim();

const canonicalize = (value: string): string =>
  nlp(value).normalize({ whitespace: true, case: true }).text().toLowerCase();

const getSentenceBoundary = (
  text: string,
  index: number,
  length: number
): string => {
  let start = index;
  while (start > 0 && !/[.!?]/.test(text[start - 1] ?? "")) {
    start--;
  }
  let end = index + length;
  while (end < text.length && !/[.!?]/.test(text[end] ?? "")) {
    end++;
  }
  return text.slice(start, end + 1).trim();
};

const computeSentenceConfidence = (sentenceDoc: nlp.Document): number => {
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

type MentionTerm = {
  text: string;
  index?: [number, number];
  tags?: string[];
};

const toMention = (terms: MentionTerm[]): EntityMention | null => {
  if (terms.length === 0) {
    return null;
  }
  const first = terms[0];
  const last = terms[terms.length - 1];
  const sentence = first.index?.[0] ?? 0;
  const start = first.index?.[1] ?? 0;
  const end = last.index?.[1] ?? start;
  return {
    text: cleanText(terms.map((term) => term.text).join(" ")),
    sentence,
    start,
    end,
  };
};

const looksLikeTitleCase = (label: string): boolean => {
  const tokens = label.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return false;
  }
  let titled = 0;
  for (const token of tokens) {
    if (/^[A-Z][\w'-]+$/.test(token)) {
      titled++;
    }
  }
  return titled / tokens.length >= 0.8;
};

const pickEntityKind = (
  label: string,
  tags: Set<string>,
  inferred: EntityKind
): EntityKind => {
  if (tags.has("Person") || tags.has("FirstName") || tags.has("LastName")) {
    return "person";
  }
  for (const tag of tags) {
    if (PLACE_TAGS.has(tag)) {
      return "place";
    }
    if (ORG_TAGS.has(tag)) {
      return "organization";
    }
  }
  if (inferred !== "unknown") {
    return inferred;
  }

  const lower = label.toLowerCase();
  if (ORG_KEYWORDS.some((kw) => lower.includes(kw))) {
    return "organization";
  }
  const condensed = label.replace(/[^A-Za-z]/g, "");
  if (/[A-Z]{2,}/.test(condensed) || /[A-Z][a-z]+[A-Z]/.test(label)) {
    return "organization";
  }
  if (looksLikeTitleCase(label) && label.split(" ").length <= 4) {
    return "person";
  }
  return "unknown";
};

const upsertEntity = (
  map: Map<string, Entity>,
  kind: EntityKind,
  label: string,
  mention: EntityMention | null,
  confidence: number,
  opts: { isPronoun?: boolean; allowMerge?: boolean } = {}
): void => {
  if (!label) {
    return;
  }

  const canonical = canonicalize(label);
  let key = canonical;

  if (opts.allowMerge !== false) {
    for (const existing of map.values()) {
      if (existing.kind !== kind) {
        continue;
      }
      if (
        existing.canonical === canonical ||
        existing.canonical.includes(canonical) ||
        canonical.includes(existing.canonical)
      ) {
        key = existing.canonical;
        break;
      }
    }
  }

  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      label,
      canonical: key,
      kind,
      confidence: clampConfidence(confidence),
      mentions: mention ? [mention] : [],
      isPronoun: opts.isPronoun,
    });
    return;
  }

  if (!opts.isPronoun && existing.isPronoun) {
    existing.isPronoun = false;
    existing.label = label;
  }

  if (existing.kind === "unknown" && kind !== "unknown") {
    existing.kind = kind;
  }

  if (mention) {
    existing.mentions.push(mention);
  }
  if (label.length > existing.label.length && !opts.isPronoun) {
    existing.label = label;
  }

  existing.confidence = clampConfidence(
    Math.max(existing.confidence, confidence)
  );
};

export const extractEntities = (text: string): Entity[] => {
  const doc = nlp(text);
  const entityMap = new Map<string, Entity>();

  const register = (
    view: nlp.View,
    kind: EntityKind,
    confidence: number,
    opts?: { isPronoun?: boolean; allowMerge?: boolean }
  ) => {
    view.json().forEach((entry: any) => {
      const label = cleanText(entry.text ?? "");
      if (!label) {
        return;
      }
      const mention = toMention((entry.terms ?? []) as MentionTerm[]) ?? null;
      upsertEntity(entityMap, kind, label, mention, confidence, opts);
    });
  };

  register(doc.people(), "person", 0.92);
  register(doc.places(), "place", 0.87);
  register(doc.organizations(), "organization", 0.85);

  doc
    .match("#Pronoun")
    .json()
    .forEach((entry: any) => {
      const label = cleanText(entry.text ?? "");
      if (!label) {
        return;
      }
      const mention = toMention((entry.terms ?? []) as MentionTerm[]) ?? null;
      upsertEntity(entityMap, "person", label, mention, 0.6, {
        isPronoun: true,
        allowMerge: false,
      });
    });

  doc
    .nouns()
    .json()
    .forEach((noun: any) => {
      const label = cleanText(noun.text ?? "");
      if (!label) {
        return;
      }
      const mention = toMention((noun.terms ?? []) as MentionTerm[]) ?? null;
      const tags = new Set<string>();
      for (const term of noun.terms ?? []) {
        for (const tag of term.tags ?? []) {
          tags.add(tag);
        }
      }
      const inferred: EntityKind = PERSON_TITLES.some((title) =>
        label.toLowerCase().startsWith(`${title} `)
      )
        ? "person"
        : "unknown";
      const kind = pickEntityKind(label, tags, inferred);
      const baseConfidence =
        kind === "person"
          ? 0.8
          : kind === "organization"
            ? 0.78
            : kind === "place"
              ? 0.76
              : 0.65;
      upsertEntity(entityMap, kind, label, mention, baseConfidence);
    });

  const entities = Array.from(entityMap.values());
  entities.forEach((entity) =>
    entity.mentions.sort(
      (a, b) => a.sentence - b.sentence || a.start - b.start
    )
  );

  return entities.sort((a, b) => b.confidence - a.confidence);
};

type MentionRecord = EntityMention & { entity: Entity };

const buildMentionIndex = (entities: Entity[]): Map<number, MentionRecord[]> => {
  const index = new Map<number, MentionRecord[]>();
  for (const entity of entities) {
    for (const mention of entity.mentions) {
      const list = index.get(mention.sentence) ?? [];
      list.push({ ...mention, entity });
      index.set(mention.sentence, list);
    }
  }
  for (const mentions of index.values()) {
    mentions.sort((a, b) => a.start - b.start);
  }
  return index;
};

const nearestMentions = (
  mentions: MentionRecord[],
  pivot: number,
  direction: "left" | "right",
  limit: number
): Array<{ record: MentionRecord; distance: number }> => {
  const filtered = mentions
    .map((record) => {
      const distance =
        direction === "left" ? pivot - record.end : record.start - pivot;
      return { record, distance };
    })
    .filter(({ distance }) =>
      direction === "left" ? distance >= 0 : distance > 0
    )
    .filter(({ distance }) => distance <= 6)
    .sort((a, b) => a.distance - b.distance);
  return filtered.slice(0, limit);
};

export const extractRelations = (
  text: string,
  existingEntities?: Entity[]
): RelationTriple[] => {
  const entities = existingEntities ?? extractEntities(text);
  if (entities.length === 0) {
    return [];
  }

  const doc = nlp(text);
  const sentences = doc.sentences();
  const sentencesJson = doc.sentences().json();
  const mentionIndex = buildMentionIndex(entities);
  const relations: RelationTriple[] = [];

  sentences.forEach((sentence, sentenceIndex) => {
    const mentionList = mentionIndex.get(sentenceIndex) ?? [];
    let carrySubject: MentionRecord | null = null;
    const sentenceTerms = sentencesJson[sentenceIndex]?.terms ?? [];

    const intermediateTerms = (start: number, end: number) =>
      sentenceTerms.filter((term: any) => {
        const idx = term.index?.[1];
        return typeof idx === "number" && idx > start && idx < end;
      });

    const adjoinsPreposition = (record: MentionRecord) => {
      const previous = sentenceTerms.find(
        (term: any) => term.index?.[1] === record.start - 1
      );
      return Boolean(previous && previous.tags?.includes("Preposition"));
    };

    sentence.verbs().json().forEach((verb: any) => {
      const verbTerm = verb.terms?.[0];
      if (!verbTerm || typeof verbTerm.index?.[1] !== "number") {
        return;
      }
      const pivot = verbTerm.index[1];
      let subjects =
        nearestMentions(mentionList, pivot, "left", 2) ??
        ([] as Array<{ record: MentionRecord; distance: number }>);
      subjects = subjects.filter(({ record }) => {
        const between = intermediateTerms(record.end, pivot);
        const hasConjunction = between.some((term: any) =>
          term.tags?.includes("Conjunction")
        );
        if (hasConjunction && carrySubject) {
          return false;
        }
        if (adjoinsPreposition(record) && carrySubject) {
          return false;
        }
        return true;
      });
      if (subjects.length === 0 && carrySubject) {
        subjects.push({ record: carrySubject, distance: 0 });
      }
      const objects = nearestMentions(mentionList, pivot, "right", 3);

      if (subjects.length === 0 || objects.length === 0) {
        return;
      }

      const relationLabel =
        verb.verb?.infinitive ?? verb.verb?.root ?? verb.text ?? "related";

      subjects.forEach(({ record: subjectRecord }) => {
        const subjectName = subjectRecord.entity.label;
        carrySubject = subjectRecord;

        objects.forEach(({ record: objectRecord, distance }) => {
          const targetName = objectRecord.entity.label;
          if (!targetName || targetName === subjectName) {
            return;
          }
          const confidenceAdjustment = distance > 3 ? 0.05 : 0;
          relations.push({
            source: subjectName,
            relation: relationLabel,
            target: targetName,
            sentence: sentenceIndex,
            evidence: sentence.text(),
            confidence: clampConfidence(0.75 - confidenceAdjustment),
          });
        });
      });
    });
  });

  const deduped = new Map<string, RelationTriple>();
  for (const rel of relations) {
    const key = `${rel.source}|${rel.relation}|${rel.target}|${rel.sentence}`;
    if (!deduped.has(key)) {
      deduped.set(key, rel);
    }
  }

  return Array.from(deduped.values());
};

const tokensFromDoc = (doc: nlp.Document): Set<string> => {
  return new Set(
    doc
      .text()
      .toLowerCase()
      .split(/[^a-z0-9%-]+/)
      .filter((token) => token.length > 2 && !STOPWORDS.has(token))
  );
};

const nounSet = (doc: nlp.Document): Set<string> =>
  new Set(
    doc
      .nouns()
      .out("array")
      .map((n: string) => canonicalize(n))
      .filter(Boolean)
  );

export const detectContradiction = (
  first: string,
  second: string
): Contradiction | null => {
  const docA = nlp(first);
  const docB = nlp(second);
  const overlap = [...nounSet(docA)].filter((noun) => nounSet(docB).has(noun));
  const focus = overlap[0];

  const negativeA = docA.has("#Negative");
  const negativeB = docB.has("#Negative");

  if (negativeA !== negativeB) {
    const normalizedA = docA.clone().sentences().toPositive().text().trim();
    const normalizedB = docB.clone().sentences().toPositive().text().trim();
    if (normalizedA && normalizedA === normalizedB) {
      return {
        pair: [first, second],
        reason: "negation",
        focus: focus ?? normalizedA.split(" ")[0],
        confidence: clampConfidence(0.92),
      };
    }
  }

  const tokensA = tokensFromDoc(docA);
  const tokensB = tokensFromDoc(docB);
  for (const token of tokensA) {
    const antonyms = antonymMap.get(token);
    if (!antonyms) {
      continue;
    }
    for (const antonym of antonyms) {
      if (tokensB.has(antonym) && (focus || overlap.length > 0)) {
        return {
          pair: [first, second],
          reason: "antonym",
          focus: focus ?? token,
          confidence: clampConfidence(0.78),
        };
      }
    }
  }

  const numbersA = docA.numbers().json();
  const numbersB = docB.numbers().json();
  if (numbersA.length > 0 && numbersB.length > 0 && (focus || overlap.length)) {
    const valueA = Number(numbersA[0]?.number ?? numbersA[0]?.text);
    const valueB = Number(numbersB[0]?.number ?? numbersB[0]?.text);
    if (
      Number.isFinite(valueA) &&
      Number.isFinite(valueB) &&
      valueA !== valueB
    ) {
      return {
        pair: [first, second],
        reason: "numeric",
        focus: focus ?? numbersA[0]?.text ?? undefined,
        confidence: clampConfidence(0.74),
      };
    }
  }

  if (negativeA !== negativeB && overlap.length > 0) {
    return {
      pair: [first, second],
      reason: "negation",
      focus,
      confidence: clampConfidence(0.8),
    };
  }

  return null;
};

/**
 * Extract facts from natural language text
 * Zero allocation design - reuses buffers
 *
 * PURE, SYNCHRONOUS, FAST.
 * Removed: Async dependency on Vector Classifier.
 * Removed: Regex Taxonomy dependency.
 */
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
    };
  }

  const entityDetails = extractEntities(trimmed);
  const relations = extractRelations(trimmed, entityDetails);
  const entitySet = new Set(entityDetails.map((entity) => entity.label));
  const temporal = extractTemporal(trimmed);

  const doc = nlp(trimmed);
  const sentences = doc.sentences().json();
  const facts: ExtractedFact[] = [];

  sentences.forEach((sentence, index) => {
    const content = sentence.text.trim();
    if (!content) {
      return;
    }
    const sentenceDoc = nlp(sentence.text);
    const sentenceEntities = entityDetails
      .filter((entity) =>
        entity.mentions.some((mention) => mention.sentence === index)
      )
      .map((entity) => entity.label);
    const sentenceRelations = relations.filter(
      (relation) => relation.sentence === index
    );

    facts.push({
      content,
      confidence: computeSentenceConfidence(sentenceDoc),
      source,
      entities: [...new Set(sentenceEntities)],
      relations: sentenceRelations,
    });
  });

  const contradictions: Contradiction[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < facts.length; i++) {
    for (let j = i + 1; j < facts.length; j++) {
      const factA = facts[i];
      const factB = facts[j];
      if (!factA || !factB) {
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

  return {
    facts,
    entities: entitySet,
    entityDetails,
    relations,
    contradictions,
    temporal,
  };
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
    return nodeFromHash(hash); // Returns NodeId which is a string
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
    if (STOPWORDS.has(lower)) {
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

  const resolveEntityNode = (label: string): ReturnType<typeof nodeFromHash> | null => {
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

    insert(relation(fromNode, toNode, rel.relation, clampConfidence(rel.confidence)));
  }

  return list;
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

const temporalPrecision = (
  components?: ChronoResult["start"]
): TemporalPrecision | undefined => {
  if (!components) {
    return undefined;
  }
  if (components.isCertain("hour")) {
    return "time";
  }
  if (components.isCertain("day")) {
    return "day";
  }
  if (components.isCertain("month")) {
    return "month";
  }
  if (components.isCertain("year")) {
    return "year";
  }
  return undefined;
};

const temporalConfidence = (result: ChronoResult): number => {
  let confidence = 0.72;
  if (result.start?.isCertain("day")) {
    confidence += 0.08;
  }
  if (result.start?.isCertain("hour")) {
    confidence += 0.05;
  }
  if (result.tags?.RelativeDateFormatParser) {
    confidence -= 0.05;
  }
  if (result.text.match(/^\d{4}$/)) {
    confidence -= 0.05;
  }
  return clampConfidence(confidence);
};

/**
 * Extract temporal facts (dates, durations, sequences)
 */
export const extractTemporal = (text: string): TemporalExpression[] => {
  const expressions: TemporalExpression[] = [];
  const seen = new Set<string>();

  const pushExpression = (expr: TemporalExpression) => {
    const key = `${expr.type}:${expr.raw}:${expr.normalized.start ?? ""}:${
      expr.normalized.end ?? ""
    }:${expr.context}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    expressions.push(expr);
  };

  const parsed = chrono.parse(text);
  for (const result of parsed) {
    const start = result.start?.date();
    const end = result.end?.date();
    pushExpression({
      raw: result.text,
      type: result.end ? "range" : "instant",
      normalized: {
        start: start?.toISOString(),
        end: end?.toISOString(),
      },
      context: getSentenceBoundary(text, result.index ?? 0, result.text.length),
      precision: temporalPrecision(result.start),
      confidence: temporalConfidence(result),
    });
  }

  const rangeRegex =
    /\b(?:from|between)\s+([^,.;]+?)\s+(?:to|and)\s+([^,.;]+?)(?=[,.;!?]|$)/gi;
  let rangeMatch: RegExpExecArray | null;
  while ((rangeMatch = rangeRegex.exec(text)) !== null) {
    const raw = rangeMatch[0];
    const start = chrono.parseDate(rangeMatch[1]);
    const end = chrono.parseDate(rangeMatch[2]);
    if (!start || !end) {
      continue;
    }
    pushExpression({
      raw,
      type: "range",
      normalized: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      context: getSentenceBoundary(
        text,
        rangeMatch.index ?? 0,
        raw.length
      ),
      precision: "day",
      confidence: clampConfidence(0.74),
    });
  }

  let recurrenceMatch: RegExpExecArray | null;
  while ((recurrenceMatch = RECURRENCE_REGEX.exec(text)) !== null) {
    const raw = recurrenceMatch[0];
    const interval = recurrenceMatch.groups?.interval?.toLowerCase();
    pushExpression({
      raw,
      type: "recurring",
      normalized: {},
      context: getSentenceBoundary(
        text,
        recurrenceMatch.index ?? 0,
        raw.length
      ),
      precision: "time",
      recurrence: interval,
      confidence: clampConfidence(0.6),
    });
  }

  return expressions;
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
