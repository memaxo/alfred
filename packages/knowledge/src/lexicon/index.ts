/**
 * Lexical resources for knowledge extraction.
 * Modular lexicon system with domain-specific word lists.
 */

export { PERSON_TITLES } from "./titles.js";
export { ORG_KEYWORDS, ORG_TAGS } from "./organizations.js";
export { ANTONYM_PAIRS } from "./antonyms.js";
export { PLACE_TAGS } from "./places.js";
export { RECURRENCE_REGEX } from "./temporal.js";
export {
  PROGRAMMING_LANGUAGES,
  FRAMEWORKS,
  DEV_TOOLS,
  FILE_EXTENSIONS,
  isProgrammingLanguage,
  isFramework,
  isDevTool,
  getLanguageFromExtension,
} from "./code.js";
export {
  classifyDomain,
  detectTopics,
  applyTopicBoost,
  type TopicResult,
  type DomainResult,
} from "./domains.js";

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

