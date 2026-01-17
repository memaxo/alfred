/**
 * Lexical resources for knowledge extraction.
 * Modular lexicon system with domain-specific word lists.
 */

export { ANTONYM_PAIRS } from "./antonyms.js";
export {
  type ClassifyDomainLLMOptions,
  classifyDomainLLM,
  DOMAIN_CATEGORIES,
  type DomainCategory,
  enhanceDomainClassification,
  isAmbiguousClassification,
} from "./classify-llm.js";
export {
  DEV_TOOLS,
  FILE_EXTENSIONS,
  FRAMEWORKS,
  getLanguageFromExtension,
  isDevTool,
  isFramework,
  isProgrammingLanguage,
  PROGRAMMING_LANGUAGES,
} from "./code.js";
export {
  applyTopicBoost,
  classifyDomain,
  type DomainResult,
  detectTopics,
  type TopicResult,
} from "./domains.js";
export { ORG_KEYWORDS, ORG_TAGS } from "./organizations.js";
export { PLACE_TAGS } from "./places.js";
export { RECURRENCE_REGEX } from "./temporal.js";
export { PERSON_TITLES } from "./titles.js";

import { ANTONYM_PAIRS } from "./antonyms.js";

/**
 * Build antonym map for fast lookup during contradiction detection.
 */
export function buildAntonymMap(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [a, b] of ANTONYM_PAIRS) {
    const setA = map.get(a) ?? new Set<string>();
    const setB = map.get(b) ?? new Set<string>();
    setA.add(b);
    setB.add(a);
    map.set(a, setA);
    map.set(b, setB);
  }
  return map;
}
