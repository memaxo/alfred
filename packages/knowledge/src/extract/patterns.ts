import type { Knowledge } from "../hypergraph.js";
import { pattern } from "../hypergraph.js";

/**
 * Infer patterns from multiple examples.
 * Extracts common templates from similar strings.
 */

const tokenizeExample = (input: string): string[] =>
  input
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

const findCommonTemplate = (
  tokenized: string[][],
  agreement = 0.7
): (string | null)[] | null => {
  if (tokenized.length === 0) {
    return null;
  }

  const maxLen = Math.max(...tokenized.map((tokens) => tokens.length));
  const template: (string | null)[] = [];

  for (let i = 0; i < maxLen; i++) {
    const counts = new Map<string, number>();

    for (const tokens of tokenized) {
      const token = tokens[i];
      if (!token) {
        continue;
      }
      counts.set(token, (counts.get(token) || 0) + 1);
    }

    let best: string | null = null;
    let bestCount = 0;
    for (const [token, count] of counts.entries()) {
      if (count > bestCount) {
        best = token;
        bestCount = count;
      }
    }

    if (best && bestCount / tokenized.length >= agreement) {
      template.push(best);
    } else {
      template.push(null);
    }
  }

  return template.some((token) => token !== null) ? template : null;
};

const matchesTemplate = (
  tokens: string[],
  template: (string | null)[]
): boolean => {
  for (let i = 0; i < template.length; i++) {
    const expected = template[i];
    if (expected === null) {
      continue;
    }
    if (tokens[i] !== expected) {
      return false;
    }
  }
  return true;
};

const templateToRule = (template: (string | null)[]): string =>
  template.map((token) => token ?? "*").join(" ");

export const inferPattern = (
  examples: string[],
  minSupport = 0.7
): Knowledge | null => {
  if (examples.length < 3) {
    return null;
  }

  const tokenized = examples.map(tokenizeExample);
  const template = findCommonTemplate(tokenized, minSupport);

  if (!template) {
    return null;
  }

  const matches = tokenized.filter((tokens) =>
    matchesTemplate(tokens, template)
  );
  const accuracy = matches.length / examples.length;

  if (accuracy < minSupport) {
    return null;
  }

  return pattern([], templateToRule(template), accuracy);
};
