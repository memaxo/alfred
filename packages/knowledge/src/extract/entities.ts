import nlp from "compromise";
import {
  getLanguageFromExtension,
  isDevTool,
  isFramework,
  isProgrammingLanguage,
} from "../lexicon/code.js";
import {
  ORG_KEYWORDS,
  ORG_TAGS,
  PERSON_TITLES,
  PLACE_TAGS,
} from "../lexicon/index.js";
import type {
  BaseView,
  Entity,
  EntityKind,
  EntityMention,
  MaybeMentionTerm,
  MentionTerm,
  SentenceJson,
} from "./types.js";
import { asTextView } from "./types.js";

/**
 * Utility functions for entity extraction
 */

export const clampConfidence = (value: number): number =>
  Math.min(0.98, Math.max(0.2, Number(value.toFixed(2))));

export const cleanText = (value: string): string =>
  value
    .replace(/\s+/g, " ")
    .replace(/[^\w\s'-]/g, "")
    .trim();

export const canonicalize = (value: string): string =>
  asTextView(nlp(value))
    .normalize({ whitespace: true, case: true })
    .text()
    .toLowerCase();

/**
 * Check if a word is a stopword using compromise's native detection.
 * Replaces manual STOPWORDS list per plan Phase 4.
 */
export const isStopword = (word: string): boolean => {
  const doc = nlp(word);
  return doc.has("#StopWord") || doc.has("#Determiner");
};

export const toMention = (terms: MaybeMentionTerm[]): EntityMention | null => {
  const filtered = terms.filter(
    (term): term is MentionTerm =>
      typeof term.text === "string" && term.text.length > 0
  );
  if (filtered.length === 0) {
    return null;
  }
  const first = filtered[0];
  const last = filtered.at(-1);
  if (!(first && last)) {
    return null;
  }
  const sentence = first.index?.[0] ?? 0;
  const start = first.index?.[1] ?? 0;
  const end = last.index?.[1] ?? start;
  return {
    text: cleanText(filtered.map((term) => term.text).join(" ")),
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

/**
 * Extract code-related entities (languages, frameworks, tools, file paths).
 * Performance budget: <2ms
 */
export const extractCodeEntities = (text: string): Entity[] => {
  const codeEntities: Entity[] = [];
  const seen = new Set<string>();

  // Extract file paths and extensions
  const filePathRegex =
    /([\w\-./]+\.(?:js|ts|py|java|cpp|rs|go|rb|php|swift|kt|scala|clj|hs|erl|ex|ml|fs|dart|lua|pl|r|m|sql|html|css|scss|sass|less|xml|json|yaml|yml|toml|md|sh|bash|zsh|ps1|bat|asm|s))/gi;
  const fileMatches = text.matchAll(filePathRegex);

  for (const match of fileMatches) {
    const fullPath = match[0];
    const extMatch = fullPath.match(/\.(\w+)$/);
    if (extMatch) {
      const ext = `.${extMatch[1]}`;
      const lang = getLanguageFromExtension(ext);
      if (lang && !seen.has(lang)) {
        seen.add(lang);
        codeEntities.push({
          label: lang,
          canonical: canonicalize(lang),
          kind: "organization",
          confidence: 0.88,
          mentions: [],
        });
      }
    }
  }

  // Extract potential code terms (single words that match languages/frameworks/tools)
  const words = text.split(/\s+/).filter((w) => w.length > 2);
  for (const word of words) {
    const normalized = word.toLowerCase().replace(/[^\w-]/g, "");
    if (seen.has(normalized)) {
      continue;
    }

    let detected = false;
    let confidence = 0.75;

    if (isProgrammingLanguage(normalized)) {
      detected = true;
      confidence = 0.85;
    } else if (isFramework(normalized)) {
      detected = true;
      confidence = 0.82;
    } else if (isDevTool(normalized)) {
      detected = true;
      confidence = 0.8;
    }

    if (detected) {
      seen.add(normalized);
      codeEntities.push({
        label: normalized,
        canonical: canonicalize(normalized),
        kind: "organization",
        confidence: clampConfidence(confidence),
        mentions: [],
      });
    }
  }

  return codeEntities;
};

/**
 * Extract entities from natural language text.
 * Uses compromise's native entity recognition with fallback heuristics.
 */
export const extractEntities = (text: string): Entity[] => {
  const doc = asTextView(nlp(text));
  const entityMap = new Map<string, Entity>();

  const register = (
    view: BaseView,
    kind: EntityKind,
    confidence: number,
    opts?: { isPronoun?: boolean; allowMerge?: boolean }
  ) => {
    for (const entry of view.json() as SentenceJson[]) {
      const label = cleanText(entry.text ?? "");
      if (!label) {
        continue;
      }
      const mention = toMention(entry.terms ?? []) ?? null;
      upsertEntity(entityMap, kind, label, mention, confidence, opts);
    }
  };

  register(doc.people() as unknown as BaseView, "person", 0.92);
  register(doc.places() as unknown as BaseView, "place", 0.87);
  register(doc.organizations() as unknown as BaseView, "organization", 0.85);

  for (const entry of doc.match("#Pronoun").json() as SentenceJson[]) {
    const label = cleanText(entry.text ?? "");
    if (!label) {
      continue;
    }
    const mention = toMention(entry.terms ?? []) ?? null;
    upsertEntity(entityMap, "person", label, mention, 0.6, {
      isPronoun: true,
      allowMerge: false,
    });
  }

  for (const noun of doc.nouns().json() as SentenceJson[]) {
    const label = cleanText(noun.text ?? "");
    if (!label) {
      continue;
    }
    const mention = toMention(noun.terms ?? []) ?? null;
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
  }

  // Add code entities
  const codeEntities = extractCodeEntities(text);
  for (const codeEntity of codeEntities) {
    const canonical = codeEntity.canonical;
    const existing = entityMap.get(canonical);
    if (!existing) {
      entityMap.set(canonical, codeEntity);
    } else if (existing.kind === "unknown") {
      existing.kind = codeEntity.kind;
      existing.confidence = Math.max(
        existing.confidence,
        codeEntity.confidence
      );
    }
  }

  const entities = Array.from(entityMap.values());
  entities.forEach((entity) =>
    entity.mentions.sort(
      (a: EntityMention, b: EntityMention) =>
        a.sentence - b.sentence || a.start - b.start
    )
  );

  return entities.sort((a, b) => b.confidence - a.confidence);
};
